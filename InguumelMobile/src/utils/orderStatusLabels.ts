/**
 * Order/delivery status labels for Orders list and detail.
 * Mongolian only; never show raw backend codes.
 * List: prefer API delivery_status_label_mn; fallback to this map.
 * Step order: received(0) → preparing(1) → prepared(2) → out_for_delivery(3) → delivered(4).
 */

/** Labels matching backend delivery payload (Захиалга авлаа, etc.). */
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  received: 'Захиалга авлаа',
  preparing: 'Бэлтгэж байна',
  prepared: 'Бэлтгэж дууссан',
  out_for_delivery: 'Хүргэлтэд гарсан',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

const DELIVERY_STEP_CODES = ['received', 'preparing', 'prepared', 'out_for_delivery', 'delivered'] as const;

/** Step index 0–4 from delivery_status_code. Empty/unknown => 0 (received). Cancelled => -1 (caller hides dots). */
export function getStepIndexFromDeliveryCode(code?: string | null): number {
  const raw = String(code ?? '').trim().toLowerCase();
  if (!raw) return 0;
  if (raw === 'cancelled' || raw === 'cancel' || raw === 'canceled') return -1;
  const idx = (DELIVERY_STEP_CODES as readonly string[]).indexOf(raw);
  return idx >= 0 ? idx : 0;
}

/** For list card: use API delivery_status_label_mn when present; else local Mongolian map. Never show snake_case. */
export function getDeliveryStatusLabelForList(
  deliveryStatusLabelMn?: string | null,
  deliveryStatusCode?: string | null
): string {
  const label = deliveryStatusLabelMn != null && String(deliveryStatusLabelMn).trim()
    ? String(deliveryStatusLabelMn).trim()
    : null;
  if (label) return label;
  const code = String(deliveryStatusCode ?? '').trim().toLowerCase();
  return DELIVERY_STATUS_LABELS[code] ?? 'Тодорхойгүй';
}

/** Map order.state / order.status (from list API) to Mongolian label. No raw codes in UI. */
export function getOrderStatusLabel(state?: string | null, status?: string | null): string {
  const raw = String(state ?? status ?? '').trim().toLowerCase();
  if (!raw) return 'Тодорхойгүй';
  const map: Record<string, string> = {
    sale: 'Баталгаажсан',
    confirmed: 'Баталгаажсан',
    draft: 'Баталгаажсан',
    pending_merchant: 'Баталгаажсан',
    received: 'Баталгаажсан',
    preparing: 'Бэлтгэж байна',
    prepared: 'Бэлтгэж дууссан',
    packed: 'Бэлтгэж дууссан',
    out_for_delivery: 'Хүргэлтэд гарсан',
    sent: 'Хүргэлтэд гарсан',
    delivered: 'Хүргэгдсэн',
    done: 'Хүргэгдсэн',
    completed: 'Хүргэгдсэн',
    complete: 'Хүргэгдсэн',
    cancelled: 'Цуцлагдсан',
    cancel: 'Цуцлагдсан',
    canceled: 'Цуцлагдсан',
    processing: 'Бэлтгэж байна',
  };
  return map[raw] ?? 'Тодорхойгүй';
}

/** Step order for delivery progress. Index 0-4. */
export const DELIVERY_STEP_ORDER_LIST = ['received', 'preparing', 'prepared', 'out_for_delivery', 'delivered'] as const;

/** Map order.state from list to step index (0-4) for mini progress. List has no delivery API; use state as proxy. */
export function getStepIndexFromOrderState(state?: string | null, status?: string | null): number {
  const raw = String(state ?? status ?? '').trim().toLowerCase();
  if (!raw) return 0;
  const map: Record<string, number> = {
    sale: 0,
    confirmed: 0,
    draft: 0,
    pending_merchant: 0,
    received: 0,
    preparing: 1,
    prepared: 2,
    packed: 2,
    out_for_delivery: 3,
    sent: 3,
    delivered: 4,
    done: 4,
    completed: 4,
    complete: 4,
    cancelled: -1,
    cancel: -1,
    canceled: -1,
    processing: 1,
  };
  const idx = map[raw];
  return typeof idx === 'number' && idx >= 0 ? idx : 0;
}

/** Pill color for status (for list/detail badges). */
export function getStatusPillColor(statusLabel: string): 'default' | 'success' | 'danger' {
  if (statusLabel === 'Хүргэгдсэн') return 'success';
  if (statusLabel === 'Цуцлагдсан') return 'danger';
  return 'default';
}
