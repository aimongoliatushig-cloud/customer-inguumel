# Order lifecycle – RN contract (frozen)

Order state, payment method/status, and UI copy. Backend may send enums; RN maps to Mongolian labels. **Rule: `order_state` ≠ `payment_status`** (order lifecycle vs payment lifecycle).

---

## 1. Order state (`order_state`)

| Key | Label (MN) |
|-----|------------|
| `PENDING_MERCHANT` | Хүлээгдэж байна |
| `CONFIRMED` | Баталгаажсан |
| `PREPARING` | Бэлтгэж байна |
| `OUT_FOR_DELIVERY` | Хүргэлтэд гарсан |
| `DELIVERED` | Хүргэгдсэн |
| `CANCELLED` | Цуцалсан |

Unknown → UI shows **"Тодорхойгүй"**; do not show raw enum in UI.

---

## 2. Payment method (`payment_method`)

- `COD` – Бэлнээр (cash on delivery)
- `QPAY` – QPay
- `BANK` – Банкаар

Unknown → **"Тодорхойгүй"**.

---

## 3. Payment status (`payment_status`)

- `PENDING` – Хүлээгдэж байна
- `PAID` – Төлөгдсөн
- `FAILED` – Амжилтгүй
- `REFUNDED` – Буцаагдсан

Unknown → **"Тодорхойгүй"**.

**Rule:** `order_state` and `payment_status` are separate. Do not mix order lifecycle with payment lifecycle in UI (e.g. do not use payment_status to show order progress).

---

## 4. UI microcopy

- When **`order_state === PENDING_MERCHANT`**, show helper text:
  - **"Салбар баталгаажуулахыг хүлээж байна."**

---

## 5. Implementation

- **Mapper:** `src/utils/orderI18n.ts`
  - `getOrderStateLabel(state)` → label_mn
  - `getPaymentMethodLabel(method)` → label_mn
  - `getPaymentStatusLabel(status)` → label_mn
  - If API returns `label_mn`, use it; else use fallback mapping above.
- **Order Detail screen:** Uses mappers for all state/method/status; shows helper text for `PENDING_MERCHANT`.

---

## 6. Checklist

- [ ] No raw enums shown in UI (e.g. no `PENDING_MERCHANT`, `COD`, `PAID` as visible text).
- [ ] UI uses `label_mn` from API when provided; otherwise fallback mapping from this doc.
- [ ] `order_state` and `payment_status` displayed separately; no mixing of lifecycles.
- [ ] Helper text "Салбар баталгаажуулахыг хүлээж байна." shown when `order_state === PENDING_MERCHANT`.
