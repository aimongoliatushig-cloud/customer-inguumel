/**
 * Order lifecycle i18n – contract: docs/order_lifecycle.md
 * Maps order_state, payment_method, payment_status to Mongolian labels.
 * Rule: order_state ≠ payment_status. Unknown → "Тодорхойгүй" + console.warn.
 */

const UNKNOWN = 'Тодорхойгүй';

function normalize(value: string | undefined | null): string {
  if (value == null || typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

/** Order state – contract. Prefer backend label_mn when provided, else fallback. */
export function getOrderStateLabel(state?: string | null, labelMn?: string | null): string {
  const backendLabel = labelMn != null && String(labelMn).trim() !== '' ? String(labelMn).trim() : null;
  if (backendLabel) return backendLabel;
  const s = normalize(state);
  if (!s) return UNKNOWN;
  const map: Record<string, string> = {
    pending_merchant: 'Хүлээгдэж байна',
    confirmed: 'Баталгаажсан',
    preparing: 'Бэлтгэж байна',
    out_for_delivery: 'Хүргэлтэд гарсан',
    delivered: 'Хүргэгдсэн',
    cancelled: 'Цуцалсан',
    sale: 'Баталгаажсан',
    draft: 'Ноорог',
    sent: 'Илгээсэн',
    cancel: 'Цуцалсан',
    canceled: 'Цуцалсан',
    done: 'Дууссан',
    processing: 'Боловсруулах',
  };
  const label = map[s];
  if (label) return label;
  // eslint-disable-next-line no-console
  console.warn('[ORDER_I18N] unknown order state', state);
  return UNKNOWN;
}

/** Helper text when order_state = PENDING_MERCHANT */
export const PENDING_MERCHANT_HELPER = 'Салбар баталгаажуулахыг хүлээж байна.';

/** Returns helper text for PENDING_MERCHANT, else null. */
export function getOrderStateHelperText(state?: string | null): string | null {
  const s = normalize(state);
  if (s === 'pending_merchant') return PENDING_MERCHANT_HELPER;
  return null;
}

/** Payment method – contract. Prefer backend label_mn when provided, else fallback. */
export function getPaymentMethodLabel(method?: string | null, labelMn?: string | null): string {
  const backendLabel = labelMn != null && String(labelMn).trim() !== '' ? String(labelMn).trim() : null;
  if (backendLabel) return backendLabel;
  const m = normalize(method);
  if (!m) return UNKNOWN;
  const map: Record<string, string> = {
    cod: 'Бэлнээр',
    qpay: 'QPay',
    bank: 'Банкаар',
  };
  const label = map[m];
  if (label) return label;
  // eslint-disable-next-line no-console
  console.warn('[ORDER_I18N] unknown payment method', method);
  return UNKNOWN;
}

/** Payment status – contract. Prefer backend label_mn when provided, else fallback. */
export function getPaymentStatusLabel(status?: string | null, labelMn?: string | null): string {
  const backendLabel = labelMn != null && String(labelMn).trim() !== '' ? String(labelMn).trim() : null;
  if (backendLabel) return backendLabel;
  const s = normalize(status);
  if (!s) return UNKNOWN;
  const map: Record<string, string> = {
    pending: 'Хүлээгдэж байна',
    paid: 'Төлөгдсөн',
    failed: 'Амжилтгүй',
    refunded: 'Буцаагдсан',
    cod_pending: 'Хүлээгдэж байна',
    done: 'Төлөгдсөн',
    completed: 'Төлөгдсөн',
    complete: 'Төлөгдсөн',
    cancel: 'Цуцлагдсан',
    canceled: 'Цуцлагдсан',
    cancelled: 'Цуцлагдсан',
  };
  const label = map[s];
  if (label) return label;
  // eslint-disable-next-line no-console
  console.warn('[ORDER_I18N] unknown payment status', status);
  return UNKNOWN;
}

/** Quantity with "ширхэг" suffix. Use when backend sends count only or Unit(s). */
export function formatQty(qty: number): string {
  const n = Number(qty);
  if (Number.isNaN(n) || n < 0) return '0 ширхэг';
  return `${n} ширхэг`;
}

/** Display qty+uom: if uom is Units/Unit/ш or empty, return formatQty(qty); else "qty uom". */
export function getQtyDisplay(qty: number, uom?: string | null): string {
  const u = (uom ?? '').trim().toLowerCase();
  if (u === 'units' || u === 'unit' || u === 'ш' || u === '') return formatQty(qty);
  const n = Number(qty);
  if (Number.isNaN(n)) return UNKNOWN;
  return `${n} ${uom?.trim() ?? ''}`;
}

/** Order Detail screen UI copy – mapping only; no hardcoded Mongolian in screens. */
export const orderDetailCopy = {
  successBanner: 'Захиалга амжилттай үүслээ',
  processingBanner: 'Захиалга боловсруулах шатанд байна',
  sectionProducts: 'Бараа',
  sectionTotals: 'Нийт',
  sectionShipping: 'Хүргэлт',
  sectionPayment: 'Төлбөр',
  totalUntaxed: 'Нийт (татваргүй)',
  totalTax: 'Татвар',
  totalAmount: 'Нийт дүн',
  totalMissing: 'Дүн олдсонгүй',
  noProducts: 'Бараа байхгүй.',
  phoneLabel: 'Утас',
  phoneSecondaryLabel: 'Нэмэлт',
  paid: 'Төлсөн',
  unpaid: 'Төлөгдөөгүй',
  loading: 'Уншиж байна...',
  retry: 'Дахин оролдох',
} as const;
