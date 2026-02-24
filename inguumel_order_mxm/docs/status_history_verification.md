# Status history verification (MXM order timeline)

This doc describes how warehouse delivery (stock.picking outgoing) feeds the MXM order status timeline and how to verify it end-to-end.

---

## A–F verification steps

### A) Create order via mobile checkout

- Place an order from the mobile app (checkout flow).
- Backend creates sale.order and first status log (e.g. RECEIVED).

### B) Confirm sale order (state → sale)

- In Odoo: open the sale order and confirm it (state becomes `sale`).
- Backend logs PREPARING (or equivalent) so `status_history` includes PREPARING.

### C) Open Delivery (stock.picking outgoing) → Check Availability

- In Odoo: go to Inventory → Operations → Transfers (or from the sale order: Delivery).
- Open the outgoing delivery for that order.
- Click **Check Availability** so the picking state becomes `assigned`.
- **Expected:** `status_history` includes **PACKED** (system log: "Picking WH/OUT/xxx ready").

### D) Click "Хүргэлтэд гаргах" button

- On the same delivery form, click the button **Хүргэлтэд гаргах**.
- **Expected:** `status_history` includes **OUT_FOR_DELIVERY** (staff log).
- Button should hide afterward (visibility: not shown when `mxm_order_last_status` is OUT_FOR_DELIVERY or DELIVERED).

### E) Validate delivery (state done)

- On the delivery form, click **Validate** (or mark as done) so the picking state becomes `done`.
- **Expected:** `status_history` includes **DELIVERED** (system log: "Picking WH/OUT/xxx done").

### F) Curl proof (API)

After completing A–E, call the MXM order detail API and check `status_history`:

```bash
# Set your token and base URL
export TOKEN="your_bearer_token"
export BASE="https://your-odoo-host"
export ORDER_ID="123"

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/mxm/orders/$ORDER_ID" | jq '.data.status_history'
```

**Expected codes in order (asc by `at`):**

- RECEIVED → PREPARING → PACKED → OUT_FOR_DELIVERY → DELIVERED

---

## Module upgrade and restart

**Upgrade the module (correct flag: `--stop-after-init`):**

```bash
/opt/odoo/odoo19/odoo-bin -c /etc/odoo19.conf -d <DBNAME> -u inguumel_order_mxm --stop-after-init
```

**Then restart the Odoo service:**

```bash
sudo systemctl restart odoo19
sudo systemctl status odoo19 --no-pager -l
```

---

## Edge cases (handled in code)

- **Origin doesn’t match any sale.order:** `_mxm_get_sale_order()` returns empty recordset → no log, no crash.
- **Multiple sale orders with same name:** `search(..., limit=1)` → one order; log note remains accurate.
- **No log spam:** `_mxm_log_status` dedupe (if last code same → do nothing) + in `write()` we only log when `new_state != old_state`.
- **Non-outgoing pickings:** Logic runs only when `picking_type_id.code == "outgoing"`.

---

## Stored compute invalidation

The field `sale.order.mxm_last_status_code` is stored and computed from `mxm.order.status.log`. When a new log is created (e.g. in `_mxm_log_status`), the corresponding sale order must be invalidated so the compute runs again. In the module that implements `_mxm_log_status`, after creating a log line, call:

```python
order.invalidate_recordset(["mxm_last_status_code"])
```

(or `order.invalidate_cache()` for older Odoo if needed). This ensures the delivery form button visibility (which uses `mxm_order_last_status` → `order.mxm_last_status_code`) updates immediately.
