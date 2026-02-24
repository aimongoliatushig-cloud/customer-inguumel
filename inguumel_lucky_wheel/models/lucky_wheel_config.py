# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# inguumel_lucky_wheel: config per warehouse (threshold, active).

from odoo import api, fields, models


class LuckyWheelConfig(models.Model):
    _name = "lucky.wheel.config"
    _description = "Lucky Wheel configuration per warehouse"

    warehouse_id = fields.Many2one(
        "stock.warehouse",
        string="Warehouse",
        required=True,
        ondelete="cascade",
        index=True,
    )
    threshold_amount = fields.Float(
        string="Threshold amount (MNT)",
        required=True,
        default=200000.0,
        help="Paid orders total must reach this to earn spin credits.",
    )
    active = fields.Boolean(default=True)

    _sql_constraint = [
        (
            "warehouse_uniq",
            "unique(warehouse_id)",
            "Only one config per warehouse.",
        )
    ]

    @api.model
    def get_active_for_warehouse(self, warehouse_id):
        """Return the active config for this warehouse_id (exact match)."""
        if not warehouse_id:
            return self.browse()
        return self.sudo().search(
            [("warehouse_id", "=", int(warehouse_id)), ("active", "=", True)],
            limit=1,
        )
