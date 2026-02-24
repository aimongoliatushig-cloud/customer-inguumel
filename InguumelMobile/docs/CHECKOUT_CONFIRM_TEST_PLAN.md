# Checkout / Order Confirm – Test Plan

After backend fixes for the v1 checkout flow, use this plan to verify the RN app.

## API contract (reference)

- **Responses:** `{ success, code, message, request_id, data, meta }`
- **Validation:** 400, `code: "VALIDATION_ERROR"`, `errors: { field: string[] }`
- **Auth:** 401/403 → logout or re-login
- **Endpoints (v1):**
  - `GET /api/v1/cart?warehouse_id=`
  - `POST /api/v1/cart/checkout` (→ `order_id`)
  - `POST /api/v1/orders/{order_id}/address`
  - `POST /api/v1/orders/{order_id}/confirm`
  - `GET /api/v1/orders/{order_id}`

---

## 1. Happy path

**Preconditions:** Logged in, warehouse selected, cart has at least one item.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Cart → go to Order Info (checkout) | Form shows with phone, address, payment (cash selected). |
| 2 | Fill valid phone (≥8 digits), address (≥10 chars). Tap **Захиалга баталгаажуулах** | Button shows loading; no double submit. |
| 3 | — | App calls in order: `POST cart/checkout` → `POST orders/{id}/address` → `POST orders/{id}/confirm`. All with `warehouse_id` (query or body as backend expects). |
| 4 | — | Success: green toast “Захиалга амжилттай үүслээ”, cart cleared, redirect to Order detail. |
| 5 | (Dev) Check logs | `[CHECKOUT_V1]`, `[ORDER_ADDRESS]`, `[ORDER_CONFIRM]` with status and request_id. |

**Pass:** Order is created and confirmed; user lands on order detail. No generic “Алдаа гарлаа” or red banner.

---

## 2. Validation path (field-level errors)

**Preconditions:** Same as happy path; backend returns 400 with `VALIDATION_ERROR` and `errors` map.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Submit with invalid phone (e.g. too short) or address (e.g. empty) | If backend validates: 400 VALIDATION_ERROR with e.g. `errors.phone_primary` or `errors.delivery_address`. |
| 2 | — | **No** generic red banner “Алдаа гарлаа. Дахин оролдоно уу.” |
| 3 | — | Error text appears **next to** the relevant field (under phone input or under address input or under payment). |
| 4 | — | No “Дахин оролдох” retry CTA (retry is only for server/network). |
| 5 | Fix the field and submit again | Can resubmit; validation errors cleared when user edits. |

**Optional:** If backend returns `errors.payment_method`, message should show near payment section.

**Pass:** Only field-level messages; no generic error alert/toast for validation.

---

## 3. Expired token path (401)

**Preconditions:** Token expired or invalid; user on Order Info screen.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tap **Захиалга баталгаажуулах** (valid form) | Any of the three endpoints may return 401. |
| 2 | — | App triggers global logout (no duplicate logout). |
| 3 | — | User is taken to login (or appropriate auth screen). No “Алдаа гарлаа” for auth. |

**Pass:** 401 results in logout/re-login flow, not a generic error message.

---

## 4. Server / network path (retry + request_id)

**Preconditions:** Backend returns 5xx or network fails (e.g. airplane mode).

| Step | Action | Expected |
|------|--------|----------|
| 1 | Cause server error (e.g. 500) or disconnect network; submit | Red banner with user-friendly message (e.g. “Серверийн алдаа. Дахин оролдоно уу.” or “Холболт амжилтгүй. Дахин оролдоно уу.”). |
| 2 | — | Small text: **Error ID: &lt;request_id&gt;** (when backend sent `request_id`). |
| 3 | — | **Дахин оролдох** button visible (retry CTA). Tapping it dismisses the banner so user can tap confirm again. |
| 4 | Restore network / fix server; tap confirm again | Same happy flow can succeed. |

**Pass:** Retry is offered only for server/network; validation does not show retry. Request ID visible for support.

---

## 5. Idempotency / double-tap

| Step | Action | Expected |
|------|--------|----------|
| 1 | Fill form; tap **Захиалга баталгаажуулах** twice quickly | Only one request sequence (checkout → address → confirm). Button disabled while in-flight. |
| 2 | — | No duplicate orders from double-tap. |

**Pass:** Single confirm per submit; button disabled during request.

---

## 6. Warehouse context

| Step | Action | Expected |
|------|--------|----------|
| 1 | Ensure warehouse is selected (location store or AsyncStorage has `warehouse_id`). Submit. | All v1 calls include `warehouse_id` (query or body per backend). |
| 2 | (Edge) Open app after kill; go to checkout before location hydrate. | If `warehouse_id` was in AsyncStorage, submit uses it (getWarehouseIdAsync fallback). |

**Pass:** `warehouse_id` is present and consistent for cart/checkout and order address/confirm.

---

## Summary

| Scenario        | Expected behavior |
|----------------|-------------------|
| Happy path     | Checkout → address → confirm; success toast; navigate to order detail. |
| Validation     | Field-level messages only; no generic “Алдаа гарлаа”; no retry CTA. |
| Expired token  | 401 → logout / re-login; no generic error. |
| Server/network | User-friendly message; Error ID when present; “Дахин оролдох” CTA. |
| Double-tap     | Button disabled; single request sequence; no duplicate confirm. |
| Warehouse      | `warehouse_id` sent on all v1 calls; fallback from AsyncStorage when needed. |
