/**
 * Order Detail display model – single source of truth for OrderDetailScreen.
 * All order/payment status text and tones are derived here; screen only renders VM fields.
 */

import type { OrderDetail, OrderLine } from '~/api/endpoints';
import { formatMnt } from '~/components/cart/formatMoney';
import { config } from '~/constants/config';
import {
  getOrderStateLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getQtyDisplay,
} from '~/utils/orderI18n';
import { orderDetailCopy } from '~/utils/orderI18n';

export type OrderStatusPillTone = 'info' | 'success' | 'warning' | 'danger';

/** Timeline step – same shape as OrderTimeline TimelineStep. */
export interface TimelineStepVM {
  code: string;
  label: string;
  state: 'done' | 'active' | 'todo';
  timeText?: string;
}

export interface OrderDetailVMItem {
  name: string;
  qtyText: string;
  unitPriceText: string;
  lineTotalText: string;
  imageUrl?: string;
}

export interface OrderDetailVM {
  orderNumber: string;
  createdAtText: string;
  orderStatusPillText: string;
  orderStatusPillTone: OrderStatusPillTone;
  /** Timeline steps for OrderTimeline (5–6 steps, done/active/todo). */
  timelineSteps: TimelineStepVM[];
  paymentLine1: string;
  paymentLine2: string;
  paymentBadgeText: string;
  deliveryAddressText: string;
  deliveryPhonePrimaryText: string;
  deliveryPhoneSecondaryText?: string;
  items: OrderDetailVMItem[];
  totalText: string;
  /** Section labels and static copy – screen uses these instead of hardcoding. */
  copy: typeof orderDetailCopy;
  /** Banner text to show when fromCreate; null otherwise. */
  successBannerText: string | null;
  /** Banner text when order is processing; null otherwise. */
  processingBannerText: string | null;
  /** Totals breakdown (for section "Нийт") – optional display. */
  amountUntaxed: number | null;
  amountTax: number | null;
  totalMissing: boolean;
}

function formatDateMn(value: string | undefined | null): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${h}:${min}`;
  } catch {
    return '—';
  }
}

function orderStateToTone(state: string | undefined | null): OrderStatusPillTone {
  const s = (state ?? '').trim().toLowerCase();
  if (['delivered', 'done', 'completed', 'complete'].includes(s)) return 'success';
  if (['cancelled', 'cancel', 'canceled', 'failed'].includes(s)) return 'danger';
  if (['pending_merchant', 'pending', 'preparing', 'draft', 'processing'].includes(s)) return 'warning';
  return 'info';
}

function buildImageUrl(relativePath: string | undefined | null): string | undefined {
  if (relativePath == null || typeof relativePath !== 'string') return undefined;
  const trimmed = relativePath.trim();
  if (trimmed === '') return undefined;
  const base = config.apiBaseUrl.replace(/\/$/, '');
  return trimmed.startsWith('/') ? base + trimmed : base + '/' + trimmed;
}

/** If address contains only Latin/ASCII, prefix with "Хаяг: (латин) ". */
function formatAddress(address: string | undefined | null): string {
  const raw = (address ?? '').trim();
  if (raw === '') return '—';
  const hasNonLatin = /[^\x00-\x7F]/.test(raw);
  if (!hasNonLatin) return `Хаяг: (латин) ${raw}`;
  return raw;
}

/** Mongolian labels for timeline step codes. */
const TIMELINE_LABELS: Record<string, string> = {
  RECEIVED: 'Захиалга авлаа',
  PREPARING: 'Бэлтгэж байна',
  PACKED: 'Бэлтгэж дууссан',
  OUT_FOR_DELIVERY: 'Хүргэлтэд гарсан',
  DELIVERED: 'Хүргэгдсэн',
  CANCELLED: 'Цуцлагдсан',
};

const CANONICAL_STEP_CODES = ['RECEIVED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const;

/** Backend status_history entry: code, label, at ("YYYY-MM-DD HH:mm:ss"). */
interface StatusHistoryEntry {
  code: string;
  label: string;
  at: string;
}

/** Parse "YYYY-MM-DD HH:mm:ss" or ISO; return HH:mm (24h) or undefined. Do not throw. */
function parseAtToTimeText(at: string | undefined | null): string | undefined {
  if (!at || typeof at !== 'string') return undefined;
  try {
    const s = at.trim();
    if (!s) return undefined;
    const d = new Date(s.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return undefined;
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  } catch {
    return undefined;
  }
}

/**
 * Build timeline steps from order. Uses order.status_history as source of truth when present.
 * currentCode = last(status_history).code. Steps before current = done, current = active, after = todo.
 * If any entry has code CANCELLED => RECEIVED(done if exists), CANCELLED(active), others todo.
 */
function buildTimelineSteps(order: OrderDetail): TimelineStepVM[] {
  const history = order.status_history;

  if (Array.isArray(history) && history.length > 0) {
    const lastEntry = history[history.length - 1];
    const currentCode = (lastEntry?.code ?? '').toUpperCase();
    const hasCancelled = history.some((e) => (e.code ?? '').toUpperCase() === 'CANCELLED');

    if (hasCancelled && currentCode === 'CANCELLED') {
      const steps: TimelineStepVM[] = [];
      const receivedEntry = history.find((e) => (e.code ?? '').toUpperCase() === 'RECEIVED');
      const cancelledEntry = history.find((e) => (e.code ?? '').toUpperCase() === 'CANCELLED');
      steps.push({
        code: 'RECEIVED',
        label: (((receivedEntry?.label ?? TIMELINE_LABELS.RECEIVED)?.trim()) || TIMELINE_LABELS.RECEIVED),
        state: receivedEntry ? 'done' : 'todo',
        timeText: receivedEntry ? parseAtToTimeText(receivedEntry.at) : undefined,
      });
      steps.push({
        code: 'CANCELLED',
        label: (((cancelledEntry?.label ?? TIMELINE_LABELS.CANCELLED)?.trim()) || TIMELINE_LABELS.CANCELLED),
        state: 'active',
        timeText: parseAtToTimeText(cancelledEntry?.at),
      });
      for (const code of ['PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
        steps.push({ code, label: TIMELINE_LABELS[code] ?? code, state: 'todo' });
      }
      return steps;
    }

    const canonical = [...CANONICAL_STEP_CODES];
    const codeToEntry = new Map<string, StatusHistoryEntry>();
    for (const e of history) {
      const c = (e.code ?? '').toUpperCase();
      if (c) codeToEntry.set(c, e);
    }
    const currentIndex = Math.max(0, canonical.indexOf(currentCode as (typeof canonical)[number]));

    const steps: TimelineStepVM[] = [];
    for (let i = 0; i < canonical.length; i++) {
      const code = canonical[i];
      const entry = codeToEntry.get(code);
      const rawLabel = (entry?.label ?? (TIMELINE_LABELS[code] ?? code));
      const label = (rawLabel?.trim()) || (TIMELINE_LABELS[code] ?? code);
      const state: 'done' | 'active' | 'todo' =
        i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
      const timeText = state === 'active' ? parseAtToTimeText(entry?.at) : undefined;
      steps.push({ code, label, state, timeText });
    }
    return steps;
  }

  const stateRaw = (order.state ?? order.status ?? '').toString().trim().toLowerCase();
  const createdAt = order.date_order ?? null;
  const steps: TimelineStepVM[] = [];
  const activeCode =
    stateRaw === 'cancelled' || stateRaw === 'cancel' || stateRaw === 'canceled'
      ? 'CANCELLED'
      : stateRaw === 'delivered' || stateRaw === 'done' || stateRaw === 'completed' || stateRaw === 'complete'
        ? 'DELIVERED'
        : stateRaw === 'out_for_delivery'
          ? 'OUT_FOR_DELIVERY'
          : stateRaw === 'packed'
            ? 'PACKED'
            : stateRaw === 'preparing'
              ? 'PREPARING'
              : 'RECEIVED';
  const codes = activeCode === 'CANCELLED'
    ? [...CANONICAL_STEP_CODES]
    : CANONICAL_STEP_CODES.filter((c) => c !== 'CANCELLED');
  const activeIndex = codes.indexOf(activeCode);
  const timeText = parseAtToTimeText(createdAt);
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const label = TIMELINE_LABELS[code] ?? code;
    const state: 'done' | 'active' | 'todo' = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
    steps.push({
      code,
      label,
      state,
      timeText: state === 'active' ? timeText : undefined,
    });
  }
  return steps;
}

function lineToVMItem(line: OrderLine): OrderDetailVMItem {
  const name = line.product_name ?? line.name ?? '—';
  const qty = line.qty ?? 0;
  const uom = line.uom ?? (Array.isArray(line.uom_id) ? line.uom_id[1] : undefined) ?? null;
  const priceUnit = line.price_unit ?? 0;
  const subtotal = line.price_subtotal ?? line.subtotal ?? priceUnit * qty;
  const qtyText = getQtyDisplay(qty, uom);
  const imageUrl = buildImageUrl(line.image_url ?? undefined);
  return {
    name,
    qtyText,
    unitPriceText: formatMnt(priceUnit),
    lineTotalText: formatMnt(subtotal),
    imageUrl,
  };
}

export interface BuildOrderDetailVMOptions {
  fromCreate?: boolean;
  /** Fallback payment method when order detail has none (e.g. fromCreate before backend sync). */
  fallbackPaymentMethod?: 'cod' | 'qpay' | null;
}

/**
 * Builds the Order Detail view model from API response.
 * Single source of truth: all status text and tones come from here.
 */
export function buildOrderDetailVM(
  orderApiResponse: OrderDetail,
  options?: BuildOrderDetailVMOptions
): OrderDetailVM {
  const order = orderApiResponse;
  const orderNum =
    order.order_number ?? order.name ?? `#${order.id ?? ''}`;
  const dateOrder = order.date_order;
  const stateRaw = order.state ?? order.status ?? null;
  const stateLabelMn = order.order_state_label_mn ?? null;
  const orderStatusPillText = getOrderStateLabel(stateRaw, stateLabelMn);
  const orderStatusPillTone = orderStateToTone(stateRaw);

  const lines = Array.isArray(order.order_line)
    ? order.order_line
    : Array.isArray(order.lines)
      ? order.lines
      : [];
  const amountUntaxed = order.amount_untaxed ?? null;
  const amountTax = order.amount_tax ?? null;
  const total =
    order.amount_total ??
    order.amounts?.total ??
    order.amount_total_mnt ??
    0;
  const totalMissing =
    total === 0 &&
    order.amount_total == null &&
    order.amounts?.total == null &&
    order.amount_total_mnt == null;

  const address =
    order.x_delivery_address ??
    order.shipping?.x_delivery_address ??
    order.shipping?.address_text ??
    null;
  const phonePrimary =
    order.phone_primary ?? order.shipping?.phone_primary ?? null;
  const phoneSecondary =
    order.phone_secondary ?? order.shipping?.phone_secondary ?? null;

  const paymentMethodRaw =
    order.payment_method ?? order.payment?.payment_method ?? options?.fallbackPaymentMethod ?? null;
  const paymentStatusRaw =
    order.payment_status ?? order.payment?.payment_status ?? null;
  const paymentMethodLabelMn =
    order.payment_method_label_mn ?? order.payment?.payment_method_label_mn ?? null;
  const paymentStatusLabelMn =
    order.payment_status_label_mn ?? order.payment?.payment_status_label_mn ?? null;
  const paymentLine1 = getPaymentMethodLabel(paymentMethodRaw, paymentMethodLabelMn);
  const paymentLine2 = getPaymentStatusLabel(paymentStatusRaw, paymentStatusLabelMn);
  const paid = order.paid ?? order.payment?.paid ?? false;
  const paymentBadgeText = paid ? orderDetailCopy.paid : orderDetailCopy.unpaid;

  const isProcessing =
    String(stateRaw ?? '').toLowerCase() === 'processing' ||
    String(stateRaw ?? '').toLowerCase() === 'draft';

  return {
    orderNumber: orderNum,
    createdAtText: formatDateMn(dateOrder),
    orderStatusPillText,
    orderStatusPillTone,
    timelineSteps: buildTimelineSteps(order),
    paymentLine1,
    paymentLine2,
    paymentBadgeText,
    deliveryAddressText: formatAddress(address),
    deliveryPhonePrimaryText: phonePrimary != null ? String(phonePrimary).trim() : '',
    deliveryPhoneSecondaryText:
      phoneSecondary != null && String(phoneSecondary).trim() !== ''
        ? String(phoneSecondary).trim()
        : undefined,
    items: lines.map(lineToVMItem),
    totalText: formatMnt(total),
    copy: orderDetailCopy,
    successBannerText: options?.fromCreate === true ? orderDetailCopy.successBanner : null,
    processingBannerText: isProcessing ? orderDetailCopy.processingBanner : null,
    amountUntaxed: amountUntaxed != null && !Number.isNaN(amountUntaxed) ? amountUntaxed : null,
    amountTax: amountTax != null && !Number.isNaN(amountTax) ? amountTax : null,
    totalMissing,
  };
}
