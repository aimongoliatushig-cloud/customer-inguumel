# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# inguumel_order_mxm: last status code for UI (e.g. delivery button visibility).

from odoo import api, fields, models

_STATUS_SELECTION = [
    ("RECEIVED", "RECEIVED"),
    ("PREPARING", "PREPARING"),
    ("PACKED", "PACKED"),
    ("OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY"),
    ("DELIVERED", "DELIVERED"),
    ("CANCELLED", "CANCELLED"),
]


class SaleOrder(models.Model):
    _inherit = "sale.order"

    mxm_last_status_code = fields.Selection(
        selection=_STATUS_SELECTION,
        compute="_compute_mxm_last_status_code",
        store=True,
        index=True,
    )

    @api.depends()
    def _compute_mxm_last_status_code(self):
        if not self.ids:
            return
        Log = self.env.get("mxm.order.status.log")
        if not Log:
            for order in self:
                order.mxm_last_status_code = False
            return
        logs = Log.search(
            [("order_id", "in", self.ids)],
            order="at desc, id desc",
        )
        last_by_order = {}
        for log in logs:
            oid = log.order_id.id
            if oid not in last_by_order:
                last_by_order[oid] = log.code
        for order in self:
            order.mxm_last_status_code = last_by_order.get(order.id) or False
