# Delivery timeline – polling and error handling

Order detail timeline is driven by **GET /api/v1/orders/{order_id}/delivery**. This doc describes the polling lifecycle, backoff, terminal stop, change detection, and error handling.

---

## Data contract

**GET /api/v1/orders/{order_id}/delivery** returns:

```ts
{
  success: true,
  data: {
    current_status: { code: string; label: string; at?: string },
    timeline: Array<{ code: string; label: string; at?: string; is_current?: boolean; note?: string }>,
    last_update_at: string,
    version?: string   // optional; when present prefer over last_update_at for change detection
  }
}
```

**Canonical statuses (backend):** `received`, `preparing`, `prepared`, `out_for_delivery`, `delivered`, `cancelled`.

**Mongolian labels (fallback when backend omits label):**

| code            | label              |
|-----------------|--------------------|
| received        | Захиалга авлаа     |
| preparing       | Бэлтгэж байна      |
| prepared        | Бэлтгэж дууссан    |
| out_for_delivery| Хүргэлтэд гарсан   |
| delivered       | Хүргэгдсэн         |
| cancelled       | Цуцлагдсан         |

---

## Polling lifecycle

1. **On focus**  
   When the Order Detail screen gains focus (`useFocusEffect`):
   - `fetchDelivery()` runs **once** immediately.
   - A **12s** interval is started that calls `fetchDelivery()` while the app is in the foreground (`AppState.currentState === 'active'`).
   - After **60s**, the 12s interval is cleared and a **25s** interval is started (backoff to reduce server load).

2. **Terminal status – stop polling**  
   If `current_status.code` is **`delivered`** or **`cancelled`**, polling is stopped immediately:
   - The delivery interval (and backoff timeout, if still pending) is cleared.
   - No further delivery requests are made until the user leaves and re-enters the screen or pulls to refresh.

3. **Change detection (version / last_update_at)**  
   We only update UI when the backend data has changed:
   - **Prefer `data.version`** when the backend provides it; otherwise use `data.last_update_at`.
   - `versionKey = data.version ?? data.last_update_at`. If `versionKey !== lastVersionRef.current`, we set `lastVersionRef.current = versionKey` and call `setDelivery(data)`.
   - If unchanged, we do not call `setDelivery` (avoids unnecessary re-renders and preserves stable reference when nothing changed).

4. **On blur / unmount**  
   The cleanup of `useFocusEffect` clears both the delivery interval and the 60s backoff timeout. No polling runs when the screen is not focused or the app is backgrounded.

5. **Pull-to-refresh**  
   User pull triggers both `fetchDetail(true, false)` and `fetchDelivery()`, so order data and delivery timeline are refreshed together. Polling is not restarted by pull; it continues (or stays stopped if terminal) until blur.

---

## Backoff schedule

| Phase        | Duration | Interval |
|-------------|----------|----------|
| First 1 min | 0–60 s   | 12 s     |
| After 1 min | 60 s+    | 25 s     |

Polling stops when status is **delivered** or **cancelled**, or when the screen loses focus / unmounts.

---

## Error handling

- **Request failure (network, 4xx/5xx):**  
  - We set `deliveryError` (e.g. message or "Сүлжээ тасарсан") so the UI can show the offline hint.
  - We **do not** clear `delivery`: the last successful response stays in state (cached timeline).

- **Offline hint:**  
  Shown only when **both** `deliveryError != null` and `delivery != null` (i.e. we have cached timeline but the latest fetch failed). Text: **"Сүлжээ тасарсан"**.

- **Cancel / logout:**  
  `isCancelError(e)` is used to ignore axios cancel and logout-induced cancellations; we do not set `deliveryError` in that case.

- **Fallback when no delivery data:**  
  If we have never received a successful delivery response (`delivery == null`), the timeline is built from order detail `status_history` (existing VM logic). As soon as the first delivery response succeeds, the timeline switches to delivery-driven steps.

---

## Files touched

| Area        | File |
|------------|------|
| API        | `src/api/endpoints.ts` – `DeliveryResponse`, `getOrderDelivery()` |
| API mock   | `src/api/__mocks__/deliveryMock.ts` – example payloads for UI test |
| Util       | `src/utils/deliveryTimeline.ts` – `buildDeliveryTimelineSteps()` |
| Screen     | `src/screens/OrderDetailScreen.tsx` – delivery state, polling, offline hint, timeline source |
| Component  | `src/components/OrderTimeline.tsx` – unchanged (still receives `steps`) |
| Doc        | `docs/DELIVERY_TIMELINE_POLLING.md` – this file |

---

## Example mock for UI test

To test the timeline without the real API, temporarily set delivery from mock:

```ts
// In OrderDetailScreen, for quick UI test (remove in production):
import { deliveryMockPreparing } from '~/api/__mocks__/deliveryMock';
// Then e.g. useState<DeliveryResponse | null>(() => deliveryMockPreparing);
```

Or point the app at a mock server that returns the shape from `deliveryMockPreparing` / `deliveryMockOutForDelivery` / `deliveryMockDelivered` / `deliveryMockCancelled`.

---

## Lifecycle summary (focus / blur / terminal stop / backoff)

- **Focus:** Fetch once, then poll every 12s. After 60s, switch to polling every 25s.
- **Blur / unmount:** Clear 12s/25s interval and 60s backoff timeout; no polling.
- **Terminal stop:** If `current_status.code` is `delivered` or `cancelled`, clear interval and timeout immediately; no further polling until refocus or pull-to-refresh.
- **Change detection:** Update UI only when `data.version ?? data.last_update_at` changes; otherwise do not setState.
- **Offline:** Show cached timeline and "Сүлжээ тасарсан" when we have cached delivery but the latest fetch failed. Debug banner remains `__DEV__` only.
