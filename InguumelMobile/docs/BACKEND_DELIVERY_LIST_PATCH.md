# Backend: Orders list delivery-status fields + filtering

Apply these changes in the **Odoo 19 module `inguumel_order_mxm`**. The customer app expects the orders list API to include delivery status per order and to support tab filtering so that **Хүргэгдсэн** / **Цуцлагдсан** tabs are populated without N+1 delivery calls.

---

## 1) Shared delivery status mapping (reuse from delivery API)

Ensure the same code→label mapping used by `GET /api/v1/orders/<id>/delivery` is available to the list controller. If you already have this in `controllers/delivery.py` or similar, **reuse it** (e.g. a shared dict or helper). Example:

```python
# In a shared place, e.g. controllers/delivery.py or a new constants/mapping module:
DELIVERY_STATUS_LABELS_MN = {
    'received': 'Захиалга авлаа',
    'preparing': 'Бэлтгэж байна',
    'prepared': 'Бэлтгэж дууссан',
    'out_for_delivery': 'Хүргэлтэд гарсан',
    'delivered': 'Хүргэгдсэн',
    'cancelled': 'Цуцлагдсан',
}

def get_delivery_status_label_mn(code):
    if not code:
        return None
    return DELIVERY_STATUS_LABELS_MN.get((code or '').strip().lower())
```

Use the same mapping when building the delivery timeline payload so list and detail stay consistent.

---

## 2) Update `controllers/order_list.py`

**Add to each order item in the list response:**

- `delivery_status_code` – from `order.mxm_delivery_status` (string or False/None).
- `delivery_status_label_mn` – Mongolian label for that code (same mapping as delivery payload).
- `delivery_is_delivered` – boolean: `code == 'delivered'`.
- `delivery_is_cancelled` – boolean: `code == 'cancelled'`.
- `delivery_is_active` – boolean: `code in ('received','preparing','prepared','out_for_delivery')`.

**Add query parameter:**

- `delivery_tab`: `all` | `active` | `delivered` | `cancelled`
  - `all` (or omitted): no filter.
  - `active`: `mxm_delivery_status` in active set, or empty/NULL treated as `received`.
  - `delivered`: `mxm_delivery_status == 'delivered'`.
  - `cancelled`: `mxm_delivery_status == 'cancelled'`.

**Do not change:** existing fields, warehouse scope, or auth; only add the new fields and filter.

**Example patch for `order_list.py`:**

```python
# At top, add import if you have a shared mapping:
# from .delivery import get_delivery_status_label_mn  # or wherever the mapping lives

# In the controller that returns the list of orders (e.g. def mxm_orders or similar):

# 1) Read query param (example name; adjust to your routing):
delivery_tab = request.httprequest.args.get('delivery_tab', 'all').strip().lower()

# 2) Build domain for orders as you do now (warehouse scope, etc.)
# ... existing code that builds domain and env['sale.order'].search(domain) ...

# 3) After getting orders, optionally filter by delivery_tab (before serialization):
if delivery_tab == 'active':
    # Keep orders where mxm_delivery_status is in active set or empty (treat empty as received)
    orders = orders.filtered(
        lambda o: (o.mxm_delivery_status or 'received').lower() in (
            'received', 'preparing', 'prepared', 'out_for_delivery'
        )
    )
elif delivery_tab == 'delivered':
    orders = orders.filtered(
        lambda o: (o.mxm_delivery_status or '').strip().lower() == 'delivered'
    )
elif delivery_tab == 'cancelled':
    orders = orders.filtered(
        lambda o: (o.mxm_delivery_status or '').strip().lower() == 'cancelled'
    )
# else: all -> no filter

# 4) When building each order dict for JSON, add (adjust key names to your serializer):
for order in orders:
    code = (order.mxm_delivery_status or '').strip().lower() or None
    label_mn = get_delivery_status_label_mn(order.mxm_delivery_status) if order.mxm_delivery_status else None
    item = {
        # ... your existing fields: id, order_number, name, state, status, amount_total, date_order, ...
        'delivery_status_code': code,
        'delivery_status_label_mn': label_mn,
        'delivery_is_delivered': code == 'delivered',
        'delivery_is_cancelled': code == 'cancelled',
        'delivery_is_active': code in ('received', 'preparing', 'prepared', 'out_for_delivery') if code else False,
    }
    # append item to list
```

**Important:** Keep warehouse scope and access control exactly as today; only add the above logic and fields.

---

## 3) Docs (in Odoo module)

Create or update e.g. `inguumel_order_mxm/docs/DRIVE_APP_COMPAT_AND_POLLING.md`:

```markdown
## Orders list: delivery status and filtering

### GET /api/v1/mxm/orders

Query params (unchanged): `warehouse_id` (required), `limit`, `offset`.

New query param:
- `delivery_tab`: `all` | `active` | `delivered` | `cancelled`
  - `all` (default): no filter.
  - `active`: orders with mxm_delivery_status in received, preparing, prepared, out_for_delivery (empty/NULL treated as received).
  - `delivered`: mxm_delivery_status == 'delivered'.
  - `cancelled`: mxm_delivery_status == 'cancelled'.

New fields per order item:
- `delivery_status_code`: string or null (mxm_delivery_status).
- `delivery_status_label_mn`: Mongolian label (same as delivery timeline).
- `delivery_is_delivered`: boolean.
- `delivery_is_cancelled`: boolean.
- `delivery_is_active`: boolean.
```

---

## 4) Restart / upgrade (server)

Use your actual service name (e.g. `odoo19` or `odoo19.service`):

```bash
# If using systemd:
sudo systemctl restart odoo19

# Or if upgrading module:
# In Odoo UI: Apps -> inguumel_order_mxm -> Upgrade
# Or CLI:
# odoo-bin -u inguumel_order_mxm --stop-after-init
```

---

## 5) cURL verification

Replace `BASE`, `TOKEN`, `WAREHOUSE_ID` with your values.

```bash
# All orders (new fields present)
curl -s -X GET "https://BASE/api/v1/mxm/orders?warehouse_id=WAREHOUSE_ID" \
  -H "Authorization: Bearer TOKEN" | jq '.data[0] | {id, order_number, delivery_status_code, delivery_status_label_mn, delivery_is_delivered, delivery_is_cancelled, delivery_is_active}'

# Active tab
curl -s -X GET "https://BASE/api/v1/mxm/orders?warehouse_id=WAREHOUSE_ID&delivery_tab=active" \
  -H "Authorization: Bearer TOKEN" | jq '.data | length'

# Delivered tab
curl -s -X GET "https://BASE/api/v1/mxm/orders?warehouse_id=WAREHOUSE_ID&delivery_tab=delivered" \
  -H "Authorization: Bearer TOKEN" | jq '.data | length'

# Cancelled tab
curl -s -X GET "https://BASE/api/v1/mxm/orders?warehouse_id=WAREHOUSE_ID&delivery_tab=cancelled" \
  -H "Authorization: Bearer TOKEN" | jq '.data | length'
```

Expect: each response includes the new fields; delivered/cancelled tabs return only orders in that state; active returns only non-delivered, non-cancelled.
