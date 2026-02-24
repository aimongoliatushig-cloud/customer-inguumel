# Lucky Wheel Backend – Eligibility, Spend Accumulation, Verification

## A) Warehouse ID mapping

- **Mobile app** sends `warehouse_id` as a numeric id (e.g. `1`) in query and body.
- **Odoo** uses `stock.warehouse`; the same id should be used in:
  - `lucky.wheel.config` → `warehouse_id` (many2one to `stock.warehouse`)
  - `lucky.wheel.spend` → `warehouse_id`
  - `lucky.wheel.node` → via `config_id.warehouse_id`

Config lookup is **exact**:

```python
config = env['lucky.wheel.config'].sudo().search([
    ('warehouse_id', '=', warehouse_id),
    ('active', '=', True)
], limit=1)
```

If no config is found, the eligibility endpoint returns `code="lucky_wheel_not_configured"` and `threshold_amount=0` with an explicit reason.

**Debug logs** (in the eligibility controller):

- Incoming `warehouse_id`
- Resolved config: `id`, `warehouse_id.id`, `threshold_amount`, `active`
- Recompute results in `lucky.wheel.spend` model (see logger in `lucky_wheel_spend.py`)

---

## B) Which order model and payment status

- **Mobile orders** are **sale.order** (MXM flow: `/api/v1/mxm/orders`, `/api/v1/cart/checkout`, etc.).
- Paid status is one of:
  - **Standard:** `sale.order.payment_state == 'paid'`
  - **Custom:** `x_payment_status` in `('qpay_paid', 'card_paid', 'wallet_paid')` or a boolean like `x_paid`

**To find paid orders for a user (e.g. phone 95909912) and warehouse 1:**

1. **Odoo shell – config and spend:**
   ```python
   env['lucky.wheel.config'].search([('warehouse_id', '=', 1)])
   env['lucky.wheel.spend'].search([('warehouse_id', '=', 1)]).read(
       ['user_id', 'accumulated_paid_amount', 'spins_consumed', 'computed_spin_credits']
   )
   ```

2. **Locate paid orders (adjust model/fields to your setup):**
   ```python
   partner = env['res.partner'].search([('phone', 'ilike', '95909912')], limit=1)
   orders = env['sale.order'].search([
       ('partner_id', '=', partner.id),
       ('state', 'in', ['sale', 'done']),
       ('warehouse_id', '=', 1),  # if field exists
   ])
   for o in orders:
       print(o.id, o.name, o.amount_total, getattr(o, 'payment_state', None), getattr(o, 'x_payment_status', None))
   ```

If `sale.order` has no `warehouse_id`, the recompute domain in `lucky_wheel_spend.py` uses `picking_ids.picking_type_id.warehouse_id`; add or change the domain there to match your schema.

---

## C) Recompute-from-orders (robust fallback)

Spend is kept correct by recomputing from the database at request time:

1. **Model `lucky.wheel.spend`:**
   - `_recompute_from_paid_orders(self, user_id, warehouse_id, threshold_amount)`:
     - Finds **PAID** sale orders for this user (partner) and warehouse.
     - Sums `amount_total` of eligible orders.
     - Updates or creates the spend row: `accumulated_paid_amount`, `last_synced_at`.
     - Sets `computed_spin_credits = floor(accumulated / threshold) - spins_consumed`.

2. **Eligibility controller (GET):**
   - Loads config (exact `warehouse_id`, `active=True`).
   - Gets or creates spend row.
   - Calls recompute:
     - Always if no spend row exists.
     - If `last_synced_at` is older than 30 seconds (configurable `RECOMPUTE_DEBOUNCE_SECONDS`).
   - Returns `threshold_amount` from config (never 0 when config exists), `accumulated_paid_amount`, `spin_credits`, `eligible`.

So even if payment hooks or callbacks miss an event, the next eligibility request will correct the numbers.

**Optional:** add a debug/admin action to recompute one user:

```python
def action_recompute_spend(self):
    self.ensure_one()
    config = self.env['lucky.wheel.config'].sudo().search([
        ('warehouse_id', '=', self.warehouse_id.id), ('active', '=', True)
    ], limit=1)
    threshold = config.threshold_amount if config else 0
    self.sudo()._recompute_from_paid_orders(
        self.user_id.id, self.warehouse_id.id, threshold
    )
```

---

## D) Eligibility response (fix 0/0 UI)

Response when config exists:

```json
{
  "success": true,
  "data": {
    "threshold_amount": 200000,
    "accumulated_paid_amount": 15000.0,
    "spin_credits": 0,
    "eligible": false
  }
}
```

When config is missing:

```json
{
  "success": false,
  "code": "lucky_wheel_not_configured",
  "message": "Lucky Wheel is not configured for this warehouse.",
  "data": {
    "threshold_amount": 0,
    "accumulated_paid_amount": 0,
    "spin_credits": 0,
    "eligible": false,
    "reason": "lucky_wheel_not_configured"
  }
}
```

`threshold_amount` is always taken from `lucky.wheel.config` when a config exists (so never 0 from config).

---

## E) Quick verification

### 1) cURL eligibility (expect threshold 200000 for warehouse 1)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://72.62.247.95:8069/api/v1/lucky-wheel/eligibility?warehouse_id=1" | jq .
```

If your API uses JSON body for GET, adjust (e.g. POST with `{"warehouse_id": 1}`) to match your routing.

### 2) Odoo shell – config and spend

```python
env['lucky.wheel.config'].search([('warehouse_id', '=', 1)])
env['lucky.wheel.spend'].search([('warehouse_id', '=', 1)]).read(
    ['user_id', 'accumulated_paid_amount', 'spins_consumed', 'computed_spin_credits']
)
```

### 3) Paid orders for user and warehouse (last day)

After identifying the correct partner and optional `warehouse_id`/picking logic:

```python
partner_id = ...  # from user / phone
orders = env['sale.order'].search([
    ('partner_id', '=', partner_id),
    ('state', 'in', ['sale', 'done']),
    ('date_order', '>=', (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')),
])
# Then filter by payment_state or x_payment_status and warehouse
```

### 4) After a real PAID order

1. Create/confirm and pay an order (QPay/card/wallet) for the test user and warehouse.
2. Call GET eligibility again (or open Lucky Wheel in the app).
3. `accumulated_paid_amount` should increase and, once over the threshold, `spin_credits` should increase.

---

## Summary

- **Eligibility** always uses config’s `threshold_amount` when config exists; missing config returns `lucky_wheel_not_configured` and 0 values.
- **Spend** is recomputed from paid sale orders on eligibility (and when opening the screen), with a 30s debounce, so accumulation and spin credits stay correct even if payment hooks fail.
- **Warehouse** is matched exactly; config and nodes should exist for the same `stock.warehouse` id the mobile sends.
