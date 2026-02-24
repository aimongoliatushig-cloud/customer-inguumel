# Delivery POS – Online orders visibility (debug & canonical API)

## 1. Findings: Delivery POS data-source

### In this repo (React Native customer app)

- **Orders list screen:** `OrdersScreen` (`src/screens/OrdersScreen.tsx`) – tab "Orders" / "Захиалга".
- **Endpoint used:** `GET /api/v1/mxm/orders?warehouse_id=<id>&delivery_tab=all|active|delivered|cancelled` via `getMxmOrders()` in `src/api/endpoints.ts`.
- **No** screen or label named "Хүргэлтийн POS" exists in the RN app. The only orders list is the customer Orders tab above.

### Conclusion

- **"Хүргэлтийн POS"** (Delivery POS) is almost certainly an **Odoo backend** view or app (web POS / list view for delivery staff), not this RN app.
- **Regression:** Online orders (sale.order + mxm_delivery_status) appear in **Inguumel Хүргэлт** delivery workbench but **not** in Delivery POS.
- **Root cause (hypotheses to fix on backend):**
  - **A)** Delivery POS list uses an old data source (e.g. `pos.order` or legacy endpoint) instead of `sale.order` + delivery status.
  - **B)** Warehouse scoping: POS user token may not have `warehouse_id` / `x_warehouse_ids` or list is filtered by a different warehouse.
  - **C)** Filter mismatch: POS may filter by `state='sale'` only, or by picking type, while new flow uses `sale.order` + `mxm_delivery_status` (e.g. `received` after confirm).
  - **D)** Security/overrides from the new "Inguumel Хүргэлт" module hiding records from POS group.

---

## 2. Canonical endpoint for POS online orders

To restore visibility **without duplicate orders**, both Delivery Workbench and Delivery POS must read the **same** sale.order records. Define a single canonical API:

### Endpoint

```
GET /api/v1/pos/online-orders
```

### Query parameters

| Parameter     | Required | Description |
|--------------|----------|-------------|
| `warehouse_id` | Yes     | Warehouse ID. User must have access (e.g. in `x_warehouse_ids` or equivalent). |
| `state`        | No      | `pending` \| `delivered` \| `cancelled`. Default: `pending`. |
| `limit`        | No      | Page size. |
| `offset`       | No      | Offset for pagination. |

### State semantics

- **pending** – Orders not yet delivered and not cancelled. Must include at least:  
  `received`, `preparing`, `prepared`, `out_for_delivery` (configurable on backend).  
  Optionally include `draft` only if business wants draft orders in POS.
- **delivered** – `mxm_delivery_status == 'delivered'`.
- **cancelled** – `mxm_delivery_status == 'cancelled'` (or order cancelled).

Backend should use the **same** filters and warehouse scope as the Inguumel Delivery Workbench so the same orders appear in both UIs.

### Response shape (standard envelope)

```json
{
  "success": true,
  "code": "OK",
  "message": null,
  "request_id": "uuid-optional",
  "data": [
    {
      "order_id": 123,
      "order_number": "SO001",
      "customer_name": "Customer name",
      "phone_primary": "99...",
      "phone_secondary": null,
      "delivery_address": "Full address",
      "total_amount": 15000.0,
      "mxm_delivery_status": "received",
      "last_change": "2025-02-03T10:00:00"
    }
  ],
  "meta": { "total": 42 }
}
```

Fields per order:

- `order_id` – sale.order id
- `order_number` – display number
- `customer_name` – partner name
- `phone_primary`, `phone_secondary` – contact
- `delivery_address` – full delivery address
- `total_amount` – order total
- `mxm_delivery_status` – current delivery status code
- `last_change` – last update (ISO or datetime string)

### Auth and permissions

- **Auth:** Bearer token required.
- **Scope:** User must have access to `warehouse_id` (e.g. via `x_warehouse_ids` in token or role). Return 403 if user cannot see that warehouse.
- Use normal Odoo access rules; avoid broad `sudo` so warehouse scope is enforced and no data leak.

### Visibility rule (backend)

- Orders must appear in Delivery POS as soon as they are **confirmed** (`state='sale'`) with e.g. `mxm_delivery_status='received'`.
- Keep filters **aligned** with Delivery Workbench (same domain for warehouse + status).

---

## 3. cURL verification (backend must implement first)

Replace `BASE`, `POS_TOKEN`, and warehouse id as needed.

```bash
# Pending online orders (same warehouse as workbench)
curl -s "$BASE/api/v1/pos/online-orders?warehouse_id=1&state=pending" \
  -H "Authorization: Bearer $POS_TOKEN" | jq .

# Delivered
curl -s "$BASE/api/v1/pos/online-orders?warehouse_id=1&state=delivered" \
  -H "Authorization: Bearer $POS_TOKEN" | jq .

# Cancelled
curl -s "$BASE/api/v1/pos/online-orders?warehouse_id=1&state=cancelled" \
  -H "Authorization: Bearer $POS_TOKEN" | jq .
```

**Success criteria:**  
The same orders visible in **Inguumel Delivery workbench** for that warehouse must appear in the `data` array for the corresponding `state`.

---

## 4. Production checklist

- [ ] Backend implements `GET /api/v1/pos/online-orders` with `warehouse_id`, `state`, `limit`, `offset`.
- [ ] Response returns **sale.order** rows (not pos.order); fields include `order_id`, `order_number`, `customer_name`, `phone_primary`, `phone_secondary`, `delivery_address`, `total_amount`, `mxm_delivery_status`, `last_change`.
- [ ] `state=pending` includes at least: received, preparing, prepared, out_for_delivery (and optionally draft if required).
- [ ] Auth: Bearer required; warehouse access enforced (e.g. `x_warehouse_ids` / warehouse_id).
- [ ] Delivery POS UI (Odoo or RN) calls this endpoint with the logged-in user’s `warehouse_id` (or selected warehouse).
- [ ] POS user has correct warehouse assignments (e.g. warehouse_id=1 in `x_warehouse_ids`).
- [ ] Filters match Delivery Workbench so the same orders appear in both; no duplicate orders created.
- [ ] Confirmed orders (state='sale', mxm_delivery_status='received') appear in POS pending list.
- [ ] Curl with POS staff token returns the same orders as visible in workbench for that warehouse.

---

## 5. RN app usage

- **Customer Orders tab** continues to use `GET /api/v1/mxm/orders` via `getMxmOrders()`.
- **Optional:** When the backend exposes `GET /api/v1/pos/online-orders`, a Delivery POS screen (or the same Orders screen for warehouse owners) can call `getPosOnlineOrders(warehouseId, { state, limit, offset })` so both workbench and POS share the same data source. See `src/api/endpoints.ts` and types `PosOnlineOrderItem`, `PosOnlineOrdersParams`.
