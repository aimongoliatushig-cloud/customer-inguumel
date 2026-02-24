# Lucky Wheel (Lucky Draw) – Manual QA Steps

## Prerequisites

- Backend module `inguumel_lucky_wheel` running (Odoo 19).
- App logged in with a user that has a selected warehouse (`warehouse_id` in AsyncStorage).
- API base URL pointing to the backend.

---

## 1. Entry & Eligibility (LuckyWheelScreen)

### 1.1 Open screen

- **Step:** Profile tab → "Азны эргэлт" (or "Шагналын түрийвч" for wallet).
- **Expected:** Lucky Wheel screen opens with header "Азны эргэлт".

### 1.2 Loading state

- **Step:** On first load (or after cache expiry), ensure a loading skeleton is shown (progress placeholder, wheel placeholder).
- **Expected:** No raw empty content; skeleton then replaced by real data.

### 1.3 Progress card (progress bar + credits)

- **Step:** After load, check the progress card.
- **Expected:**
  - "Зарцуулсан: X₮ / Y₮" (X = accumulated_paid_amount, Y = threshold_amount; currency with thousand separators).
  - Progress bar: fill width = min(1, X/Y), clamped 0..1.
  - Badge: "Spin эрх: N" (N = spin_credits from API).
  - If eligible: green badge/label "Эргүүлэх боломжтой".
  - If not eligible: text "200,000₮ хүрэхэд эргүүлэх боломжтой".
  - Debug note visible: "Зөвхөн төлөгдсөн захиалга тооцогдоно".

### 1.4 Spin button state

- **Step:** Check when `spin_credits > 0` and `eligible === true`.
- **Expected:** "Эргүүлэх" button enabled.
- **Step:** Check when `spin_credits === 0` or `eligible === false`.
- **Expected:** Button disabled; text "200,000₮ хүрэхэд эргүүлэх боломжтой" (or similar) visible.

### 1.5 No warehouse

- **Step:** Open Lucky Wheel with no warehouse selected (e.g. after clearing location).
- **Expected:** Message like "Агуулах сонгоно уу" or equivalent; no crash.

### 1.6 Eligibility refresh (focus + after purchase)

- **Step:** On every focus (open Lucky Wheel screen), cache is invalidated and eligibility is refetched.
- **Expected:** Opening Lucky Wheel always triggers a fresh GET eligibility; UI shows current spin_credits and progress.
- **Step:** Complete a **paid** order (checkout success), then open Lucky Wheel (Profile → Азны эргэлт).
- **Expected:** Eligibility updates within one refresh (progress/accumulated amount and spin_credits reflect paid orders). Note: only paid orders (e.g. QPay/card) count; COD/unpaid may not increase until backend marks paid.
- **Step:** Perform a spin, then tap "Буцах" to return to Lucky Wheel.
- **Expected:** spin_credits decreases immediately (cache was invalidated after spin; focus refetches).

---

## 2. Spin flow (LuckyWheelScreen → SpinResultScreen)

### 2.1 Successful spin

- **Step:** With spin_credits > 0 and eligible, tap "Эргүүлэх".
- **Expected:**
  - Button disables immediately.
  - Wheel rotates for ~2–3 seconds.
  - No prize logic run on client; result comes from server.
  - After animation, navigate to Spin Result screen with correct prize_type.

### 2.2 Spin result – product

- **Step:** When API returns `prize_type: "product"` with product data.
- **Expected:** Product image (if any), product name, "Танд бэлэг хожлоо", and expires_at shown.

### 2.3 Spin result – coupon

- **Step:** When API returns `prize_type: "coupon"`.
- **Expected:** Coupon title/description, "Дараагийн худалдан авалтад ашиглана", and expires_at.

### 2.4 Spin result – empty

- **Step:** When API returns `prize_type: "empty"`.
- **Expected:** Friendly text "Аз энэ удаа таараагүй 😄 Дахин оролдоорой"; no expires_at for empty.

### 2.5 Idempotency

- **Step:** Simulate slow network; trigger spin, then retry (e.g. same tap again or network retry) with same Idempotency-Key (e.g. by replay or backend support).
- **Expected:** Backend returns same result for same key; no double credit deduction.

### 2.6 Timeout retry

- **Step:** Force a timeout (e.g. slow backend or network), then allow retry.
- **Expected:** Client retries spin once with the same Idempotency-Key; no double spin on success.

---

## 3. Spin Result screen (SpinResultScreen)

### 3.1 Expires_at

- **Step:** Check any non-empty result.
- **Expected:** "Хүчинтэй: &lt;formatted date&gt;" (localized date).

### 3.2 CTAs

- **Step:** Tap "Prize Wallet руу очих" (when prize is not empty).
- **Expected:** Navigate to Prize Wallet screen.
- **Step:** Tap "Буцах".
- **Expected:** Navigate back to Lucky Wheel screen.

### 3.3 Eligibility refresh

- **Step:** After viewing result, go back to Lucky Wheel.
- **Expected:** Eligibility refetched (or cache invalidated); spin credits decreased by 1 if spin was successful.

---

## 4. Prize Wallet (PrizeWalletScreen)

### 4.0 No hook errors / no crash

- **Step:** Profile → "Шагналын түрийвч" (or navigate from Spin Result "Prize Wallet руу очих").
- **Expected:** Prize Wallet opens without crash; no "change in the order of Hooks" or invalid hook call. Loading state (skeleton/spinner) may show briefly, then content or empty state.

### 4.1 Open from Profile

- **Step:** Profile → "Шагналын түрийвч".
- **Expected:** Prize Wallet opens; list from AsyncStorage key `lucky_prize_wallet:{warehouse_id}`.

### 4.2 List content

- **Step:** After at least one spin with a prize, open Prize Wallet.
- **Expected:** Each item shows prize_type icon, name/label, state ("Хүлээгдэж буй" / "Авсан" / "Хугацаа дууссан"), and expires_at.

### 4.3 Instruction text

- **Step:** Check static text on Prize Wallet.
- **Expected:** "Дэлгүүр дээр очоод энэхүү шагналыг үзүүлнэ үү".

### 4.4 Empty state

- **Step:** Open Prize Wallet with no prizes stored for current warehouse.
- **Expected:** Empty state message (e.g. "Одоогоор шагнал байхгүй"); no crash.

### 4.5 Per-warehouse scope

- **Step:** Add prize for warehouse A, switch to warehouse B, open Prize Wallet.
- **Expected:** Only prizes for current warehouse (B); warehouse A prizes not shown.

---

## 5. Error handling

### 5.1 400 / 409

- **Step:** Trigger spin when backend returns 400 or 409 (e.g. not allowed, conflict).
- **Expected:** Toast/Alert: "Оролдох боломжгүй байна"; Spin button re-enabled.

### 5.2 401

- **Step:** Use expired or invalid token so spin (or eligibility) returns 401.
- **Expected:** Global logout flow; user taken to login.

### 5.3 500

- **Step:** Backend returns 500 (or server error).
- **Expected:** Toast/Alert: "Системийн алдаа. Дахин оролдоно уу"; Spin button re-enabled.

---

## 6. Don’ts (sanity check)

- **Eligibility:** Never compute eligibility on client; always use GET `/api/v1/lucky-wheel/eligibility`.
- **Prize:** Never generate or decide prize on client; only display server result.
- **Spin:** Never allow spin without server confirmation (no client-only spin).
- **Redemption:** Customer app does not redeem; only show instruction to show prize at store.

---

## 7. API summary (for QA / backend alignment)

| Action              | Method | Endpoint                              | Notes                          |
|---------------------|--------|----------------------------------------|--------------------------------|
| Check eligibility   | GET    | `/api/v1/lucky-wheel/eligibility?warehouse_id=` | Cache 60s; invalidated on Lucky Wheel focus, after spin, and after checkout success |
| Spin                | POST   | `/api/v1/lucky-wheel/spin`            | Body: `{ warehouse_id }`; header: `Idempotency-Key: <uuid>` |
