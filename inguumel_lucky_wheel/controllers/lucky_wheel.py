# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# inguumel_lucky_wheel: GET eligibility (threshold + recompute), POST spin.

import logging

from odoo import fields, http
from odoo.http import request

_logger = logging.getLogger(__name__)

# Minimum seconds between full recomputes per user/warehouse (avoid heavy compute every request)
RECOMPUTE_DEBOUNCE_SECONDS = 30


class LuckyWheelController(http.Controller):

    @http.route(
        "/api/v1/lucky-wheel/eligibility",
        type="json",
        auth="user",
        methods=["GET"],
        csrf=False,
    )
    def eligibility(self, **kwargs):
        """
        GET eligibility for current user and warehouse_id.
        Returns threshold_amount, accumulated_paid_amount, spin_credits, eligible.
        Never returns threshold 0 if config exists; recomputes spend from paid orders.
        """
        warehouse_id = (
            kwargs.get("warehouse_id")
            or (request.params.get("warehouse_id") if getattr(request, "params", None) else None)
            or (request.httprequest.args.get("warehouse_id") if getattr(request, "httprequest", None) else None)
        )
        try:
            wh_id = int(warehouse_id) if warehouse_id not in (None, "") else None
        except (TypeError, ValueError):
            wh_id = None

        _logger.info(
            "lucky_wheel eligibility: incoming warehouse_id=%s (resolved=%s)",
            warehouse_id,
            wh_id,
        )

        Config = request.env["lucky.wheel.config"].sudo()
        Spend = request.env["lucky.wheel.spend"].sudo()
        config = Config.get_active_for_warehouse(wh_id) if wh_id else Config.browse()

        if not config:
            _logger.warning(
                "lucky_wheel eligibility: no config for warehouse_id=%s",
                wh_id,
            )
            return {
                "success": False,
                "code": "lucky_wheel_not_configured",
                "message": "Lucky Wheel is not configured for this warehouse.",
                "data": {
                    "threshold_amount": 0,
                    "accumulated_paid_amount": 0,
                    "spin_credits": 0,
                    "eligible": False,
                    "reason": "lucky_wheel_not_configured",
                },
            }

        # Config found: always return its threshold (never 0 from config)
        threshold = config.threshold_amount or 0
        _logger.info(
            "lucky_wheel eligibility: config id=%s warehouse_id.id=%s threshold_amount=%s active=%s",
            config.id,
            config.warehouse_id.id if config.warehouse_id else None,
            threshold,
            config.active,
        )

        uid = request.env.uid
        spend = Spend.search(
            [("user_id", "=", uid), ("warehouse_id", "=", config.warehouse_id.id)],
            limit=1,
        )

        # Recompute from paid orders if no spend yet or last sync old enough
        SpendModel = request.env["lucky.wheel.spend"].sudo()
        now_str = fields.Datetime.now()
        now_dt = fields.Datetime.from_string(now_str) if isinstance(now_str, str) else now_str
        if not spend:
            SpendModel.recompute_from_paid_orders(uid, config.warehouse_id.id, threshold)
            spend = Spend.search(
                [("user_id", "=", uid), ("warehouse_id", "=", config.warehouse_id.id)],
                limit=1,
            )
        else:
            last = spend.last_synced_at
            if last:
                last_dt = fields.Datetime.from_string(last) if isinstance(last, str) else last
                delta = (now_dt - last_dt).total_seconds()
                if delta > RECOMPUTE_DEBOUNCE_SECONDS:
                    SpendModel.recompute_from_paid_orders(uid, config.warehouse_id.id, threshold)
                    spend.invalidate_recordset(["accumulated_paid_amount", "computed_spin_credits", "last_synced_at"])
                    spend.refresh()
            else:
                SpendModel.recompute_from_paid_orders(uid, config.warehouse_id.id, threshold)
                spend.invalidate_recordset()
                spend.refresh()

        accumulated = spend.accumulated_paid_amount if spend else 0.0
        spin_credits = spend.computed_spin_credits if spend else 0

        # Eligible: has credits and config exists (optional: and no unredeemed prize)
        eligible = bool(spin_credits > 0 and config)

        return {
            "success": True,
            "code": "OK",
            "data": {
                "threshold_amount": threshold,
                "accumulated_paid_amount": accumulated,
                "spin_credits": spin_credits,
                "eligible": eligible,
            },
        }

    @http.route(
        "/api/v1/lucky-wheel/spin",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def spin(self, **kwargs):
        """
        POST spin: consume one credit and return prize (idempotency handled by client key).
        Body: { "warehouse_id": number }.
        """
        payload = request.jsonrequest or {}
        warehouse_id = payload.get("warehouse_id") or kwargs.get("warehouse_id")
        try:
            wh_id = int(warehouse_id) if warehouse_id not in (None, "") else None
        except (TypeError, ValueError):
            wh_id = None

        if not wh_id:
            return {"success": False, "code": "BAD_REQUEST", "message": "warehouse_id required"}

        Config = request.env["lucky.wheel.config"].sudo()
        Spend = request.env["lucky.wheel.spend"].sudo()
        config = Config.get_active_for_warehouse(wh_id)
        if not config:
            return {
                "success": False,
                "code": "lucky_wheel_not_configured",
                "message": "Lucky Wheel not configured for this warehouse.",
            }

        uid = request.env.uid
        spend = Spend.search(
            [("user_id", "=", uid), ("warehouse_id", "=", config.warehouse_id.id)],
            limit=1,
        )
        if not spend:
            Spend.recompute_from_paid_orders(uid, config.warehouse_id.id, config.threshold_amount)
            spend = Spend.search(
                [("user_id", "=", uid), ("warehouse_id", "=", config.warehouse_id.id)],
                limit=1,
            )
        if not spend or spend.computed_spin_credits <= 0:
            return {
                "success": False,
                "code": "INSUFFICIENT_CREDITS",
                "message": "No spin credits available.",
            }

        # Consume one credit and persist
        spend.spins_consumed = (spend.spins_consumed or 0) + 1
        spend.computed_spin_credits = max(0, (spend.computed_spin_credits or 0) - 1)

        # TODO: select prize from lucky.wheel.node (or product/coupon/empty) and create prize record
        import random
        from datetime import timedelta
        nodes = request.env["lucky.wheel.node"].sudo().search(
            [("config_id", "=", config.id), ("active", "=", True)],
            order="sequence, id",
        )
        if nodes:
            node = random.choice(nodes)
            prize_type = node.prize_type or "empty"
        else:
            prize_type = "empty"

        now_dt = fields.Datetime.now()
        if isinstance(now_dt, str):
            from datetime import datetime
            now_dt = datetime.strptime(now_dt[:19], "%Y-%m-%d %H:%M:%S") if len(now_dt) >= 19 else datetime.utcnow()
        expires_dt = now_dt + timedelta(days=30)
        expires_at = expires_dt.strftime("%Y-%m-%dT%H:%M:%S")

        return {
            "success": True,
            "data": {
                "prize_id": 0,
                "prize_type": prize_type,
                "product": None,
                "coupon_payload": None,
                "expires_at": expires_at,
            },
        }
