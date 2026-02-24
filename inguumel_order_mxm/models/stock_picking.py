# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# inguumel_order_mxm: wire stock.picking (outgoing) to mxm order status log.

from odoo import api, fields, models


class StockPicking(models.Model):
    _inherit = "stock.picking"

    mxm_order_last_status = fields.Selection(
        selection=[
            ("RECEIVED", "RECEIVED"),
            ("PREPARING", "PREPARING"),
            ("PACKED", "PACKED"),
            ("OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY"),
            ("DELIVERED", "DELIVERED"),
            ("CANCELLED", "CANCELLED"),
        ],
        compute="_compute_mxm_order_last_status",
        readonly=True,
    )

    def _mxm_get_sale_order(self):
        """Return linked sale.order: prefer sale_id, else search by origin (SO name)."""
        self.ensure_one()
        if hasattr(self, "sale_id") and self.sale_id:
            return self.sale_id
        if self.origin:
            return self.env["sale.order"].search(
                [
                    ("name", "=", self.origin),
                    ("company_id", "=", self.company_id.id),
                ],
                limit=1,
            )
        return self.env["sale.order"]

    @api.depends("picking_type_id", "origin", "sale_id")
    def _compute_mxm_order_last_status(self):
        for picking in self:
            if picking.picking_type_id and picking.picking_type_id.code == "outgoing":
                order = picking._mxm_get_sale_order()
                if order and order.id:
                    picking.mxm_order_last_status = order.mxm_last_status_code or False
                else:
                    picking.mxm_order_last_status = False
            else:
                picking.mxm_order_last_status = False

    def write(self, vals):
        if "state" not in vals:
            return super().write(vals)
        old_states = {p.id: p.state for p in self}
        result = super().write(vals)
        for picking in self:
            if not (picking.picking_type_id and picking.picking_type_id.code == "outgoing"):
                continue
            order = picking._mxm_get_sale_order()
            if not order or not order.id:
                continue
            new_state = picking.state
            old_state = old_states.get(picking.id)
            if new_state == old_state:
                continue
            if new_state == "assigned":
                order._mxm_log_status(
                    "PACKED",
                    source="system",
                    note=f"Picking {picking.name} ready",
                )
            elif new_state == "done":
                order._mxm_log_status(
                    "DELIVERED",
                    source="system",
                    note=f"Picking {picking.name} done",
                )
        return result

    def action_mxm_out_for_delivery(self):
        """Staff action: log OUT_FOR_DELIVERY for the linked sale order."""
        self.ensure_one()
        if not (self.picking_type_id and self.picking_type_id.code == "outgoing"):
            return True
        order = self._mxm_get_sale_order()
        if order and order.id:
            order._mxm_log_status(
                "OUT_FOR_DELIVERY",
                source="staff",
                note=f"Picking {self.name} out for delivery",
                user_id=self.env.user.id,
            )
        return True
