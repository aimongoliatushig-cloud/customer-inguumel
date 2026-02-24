# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# inguumel_lucky_wheel: per-user per-warehouse spend and spin credits.
# Recompute from paid sale orders so UI is correct even if payment hooks miss.

import logging

from odoo import fields, models

_logger = logging.getLogger(__name__)


class LuckyWheelSpend(models.Model):
    _name = "lucky.wheel.spend"
    _description = "Lucky Wheel spend and credits per user/warehouse"

    user_id = fields.Many2one(
        "res.users",
        string="User",
        required=True,
        ondelete="cascade",
        index=True,
    )
    warehouse_id = fields.Many2one(
        "stock.warehouse",
        string="Warehouse",
        required=True,
        ondelete="cascade",
        index=True,
    )
    accumulated_paid_amount = fields.Float(
        string="Accumulated paid (MNT)",
        default=0.0,
    )
    spins_consumed = fields.Integer(
        string="Spins used",
        default=0,
    )
    computed_spin_credits = fields.Integer(
        string="Spin credits",
        default=0,
        help="Earned credits (floor(accumulated/threshold) - spins_consumed). Updated by recompute.",
    )
    last_synced_at = fields.Datetime(
        string="Last synced",
        help="Last time accumulated_paid_amount was recomputed from orders.",
    )

    _sql_constraint = [
        (
            "user_warehouse_uniq",
            "unique(user_id, warehouse_id)",
            "One spend record per user per warehouse.",
        )
    ]

    def _get_paid_order_domain(self, partner_id, warehouse_id):
        """Domain for paid sale orders that count toward spend.
        Adjust if your sale.order uses different fields for warehouse or payment.
        """
        # States that represent confirmed/done (not draft, not cancelled)
        order_states = ["sale", "done"]
        domain = [
            ("partner_id", "=", partner_id),
            ("state", "in", order_states),
        ]
        # Warehouse: use warehouse_id if exists on sale.order (common custom field)
        if hasattr(self.env["sale.order"], "warehouse_id"):
            domain.append(("warehouse_id", "=", warehouse_id))
        else:
            # Fallback: filter by delivery picking's warehouse
            domain.append(("picking_ids.picking_type_id.warehouse_id", "=", warehouse_id))
        return domain

    def _is_order_paid(self, order):
        """True if order is considered PAID (qpay_paid / card_paid / wallet_paid).
        Standard Odoo: payment_state == 'paid'.
        Custom: x_payment_status in ('qpay_paid','card_paid','wallet_paid').
        """
        if hasattr(order, "payment_state") and order.payment_state == "paid":
            return True
        if hasattr(order, "x_payment_status") and order.x_payment_status:
            return order.x_payment_status in (
                "qpay_paid",
                "card_paid",
                "wallet_paid",
            )
        # Optional: x_paid boolean
        if hasattr(order, "x_paid") and order.x_paid:
            return True
        return False

    def _recompute_from_paid_orders(self, user_id, warehouse_id, threshold_amount):
        """
        Recompute accumulated_paid_amount from paid sale orders for this user+warehouse.
        Then set computed_spin_credits = floor(accumulated / threshold) - spins_consumed.
        """
        user = self.env["res.users"].sudo().browse(user_id)
        warehouse = self.env["stock.warehouse"].sudo().browse(warehouse_id)
        if not user.exists() or not warehouse.exists():
            _logger.warning(
                "lucky_wheel: recompute skipped invalid user_id=%s or warehouse_id=%s",
                user_id,
                warehouse_id,
            )
            return

        partner_id = user.partner_id.id
        SaleOrder = self.env["sale.order"].sudo()

        domain = self._get_paid_order_domain(partner_id, warehouse_id)
        orders = SaleOrder.search(domain)
        total = 0.0
        for order in orders:
            if self._is_order_paid(order):
                total += order.amount_total or 0.0

        spend = self.sudo().search(
            [("user_id", "=", user_id), ("warehouse_id", "=", warehouse_id)],
            limit=1,
        )
        if not spend:
            spend = self.sudo().create({
                "user_id": user_id,
                "warehouse_id": warehouse_id,
                "accumulated_paid_amount": total,
                "last_synced_at": fields.Datetime.now(),
            })
        else:
            spend.write({
                "accumulated_paid_amount": total,
                "last_synced_at": fields.Datetime.now(),
            })

        # Recompute spin credits: floor(accumulated / threshold) - spins_consumed
        if threshold_amount and threshold_amount > 0:
            from math import floor
            earned = int(floor(spend.accumulated_paid_amount / threshold_amount))
            spend.computed_spin_credits = max(0, earned - spend.spins_consumed)
        else:
            spend.computed_spin_credits = 0

        _logger.info(
            "lucky_wheel: recompute user_id=%s warehouse_id=%s accumulated=%.2f spins_consumed=%s computed_credits=%s",
            user_id,
            warehouse_id,
            spend.accumulated_paid_amount,
            spend.spins_consumed,
            spend.computed_spin_credits,
        )

    def recompute_from_paid_orders(self, user_id, warehouse_id, threshold_amount):
        """Public API: recompute spend for this user+warehouse and update credits."""
        self._recompute_from_paid_orders(user_id, warehouse_id, threshold_amount)
        return self.sudo().search(
            [("user_id", "=", user_id), ("warehouse_id", "=", warehouse_id)],
            limit=1,
        )
