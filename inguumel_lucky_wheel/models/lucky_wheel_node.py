# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# inguumel_lucky_wheel: spin wheel segments (e.g. 8 nodes per warehouse).

from odoo import fields, models


class LuckyWheelNode(models.Model):
    _name = "lucky.wheel.node"
    _description = "Lucky Wheel segment (node)"

    config_id = fields.Many2one(
        "lucky.wheel.config",
        string="Config",
        required=True,
        ondelete="cascade",
    )
    sequence = fields.Integer(default=10)
    prize_type = fields.Selection(
        selection=[
            ("product", "Product"),
            ("coupon", "Coupon"),
            ("empty", "Empty"),
        ],
        default="empty",
        required=True,
    )
    active = fields.Boolean(default=True)
