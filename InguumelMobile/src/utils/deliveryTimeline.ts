/**
 * Delivery timeline – build OrderTimeline steps from GET /api/v1/orders/{id}/delivery.
 * Single source of truth: delivery.current_status.code.
 * Step order: received → preparing → prepared → out_for_delivery → delivered.
 * Do NOT infer current step from timeline length or last timeline item.
 */

import type { DeliveryResponse } from '~/api/endpoints';
import type { TimelineStep } from '~/components/OrderTimeline';

/** Canonical step order. currentStepIndex = stepCodes.indexOf(delivery.current_status.code). */
export const DELIVERY_STEP_ORDER: readonly string[] = [
  'received',
  'preparing',
  'prepared',
  'out_for_delivery',
  'delivered',
];

export const DELIVERY_LABELS: Record<string, string> = {
  received: 'Захиалга авлаа',
  preparing: 'Бэлтгэж байна',
  prepared: 'Бэлтгэж дууссан',
  out_for_delivery: 'Хүргэлтэд гарсан',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

/** Prefer backend label; fallback to local Mongolian. For hero "Одоогийн төлөв: <label>". Hermes-safe: no ?? with || in same expression. */
export function getDeliveryCurrentStatusLabel(delivery: DeliveryResponse): string {
  const current = delivery?.current_status;
  if (current?.label && String(current.label).trim()) return String(current.label).trim();
  const code = toLowerCode(current?.code);
  const mapped = DELIVERY_LABELS[code];
  const codeLabel = (code && String(code).trim()) ? String(code).trim() : '—';
  const result = (mapped != null && mapped.trim() !== '') ? mapped.trim() : codeLabel;
  return result;
}

/** Format last_update_at for timeline: HH:mm only. */
export function formatDeliveryLastUpdated(at: string | undefined | null): string {
  if (!at || typeof at !== 'string') return '—';
  try {
    const s = at.trim().replace(' ', 'T');
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '—';
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  } catch {
    return '—';
  }
}

/** Format COD confirmed timestamp for display (e.g. "09.02 14:30"). */
export function formatCodConfirmedAt(at: string | undefined | null): string {
  if (!at || typeof at !== 'string') return '';
  try {
    const s = at.trim().replace(' ', 'T');
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month} ${h}:${min}`;
  } catch {
    return '';
  }
}

/** Safely normalize backend code (string | number | null | undefined) to lowercase string. */
function toLowerCode(raw: unknown): string {
  if (raw == null) return '';
  const s = typeof raw === 'string' ? raw : String(raw);
  return s.trim().toLowerCase();
}

/** Parse "at" (YYYY-MM-DD HH:mm:ss or ISO) to HH:mm. Returns undefined on failure. */
function atToTimeText(at: string | undefined | null): string | undefined {
  if (!at || typeof at !== 'string') return undefined;
  try {
    const s = at.trim().replace(' ', 'T');
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return undefined;
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  } catch {
    return undefined;
  }
}

/** Hermes-safe: do not mix ?? with || without parens. */
function labelFor(code: string, backendLabel?: string): string {
  const c = toLowerCode(code);
  if (typeof backendLabel === 'string' && backendLabel.trim()) return backendLabel.trim();
  const fromMap = DELIVERY_LABELS[c];
  return (fromMap != null && fromMap !== '') ? fromMap : (c ? c : '—');
}

/** Map backend synonyms for "delivered" so last step is always correct. */
function normalizeCurrentCode(code: string): string {
  const c = code.trim().toLowerCase();
  if (c === 'delivered' || c === 'completed' || c === 'done') return 'delivered';
  return c;
}

/**
 * Build timeline steps from delivery API response.
 * - Current step is derived ONLY from delivery.current_status.code.
 * - currentStepIndex = stepOrder.indexOf(normalizedCode).
 * - idx < currentStepIndex → done (green)
 * - idx === currentStepIndex → active (current)
 * - idx > currentStepIndex → todo
 * - If cancelled: show RECEIVED(done if exists) + CANCELLED(active), rest todo.
 */
export function buildDeliveryTimelineSteps(delivery: DeliveryResponse): TimelineStep[] {
  const { current_status, timeline } = delivery;
  const rawCode = toLowerCode(current_status?.code);
  const currentCode = normalizeCurrentCode(rawCode);
  const isCancelled = currentCode === 'cancelled';

  if (isCancelled) {
    const steps: TimelineStep[] = [];
    const receivedEntry = timeline.find((e) => toLowerCode(e.code) === 'received');
    const cancelledEntry = timeline.find((e) => toLowerCode(e.code) === 'cancelled');
    steps.push({
      code: 'received',
      label: labelFor('received', receivedEntry?.label),
      state: receivedEntry ? 'done' : 'todo',
      timeText: receivedEntry ? atToTimeText(receivedEntry.at) : undefined,
    });
    steps.push({
      code: 'cancelled',
      label: labelFor('cancelled', cancelledEntry?.label),
      state: 'active',
      timeText: atToTimeText(cancelledEntry?.at ?? current_status?.at),
    });
    for (const code of ['preparing', 'prepared', 'out_for_delivery', 'delivered']) {
      steps.push({ code, label: labelFor(code), state: 'todo' });
    }
    return steps;
  }

  if (currentCode === 'delivered') {
    const timelineByCode = new Map<string, { label?: string; at?: string }>();
    for (const e of timeline) {
      const c = toLowerCode(e.code);
      if (c) timelineByCode.set(c, { label: e.label, at: e.at });
    }
    const stepOrder = DELIVERY_STEP_ORDER as string[];
    const steps: TimelineStep[] = [];
    for (let i = 0; i < stepOrder.length; i++) {
      const code = stepOrder[i];
      const entry = timelineByCode.get(code);
      const label = labelFor(
        code,
        entry?.label ?? (code === 'delivered' ? current_status?.label : undefined)
      );
      steps.push({
        code,
        label,
        state: 'done',
        timeText: atToTimeText(entry?.at),
      });
    }
    return steps;
  }

  const stepOrder = DELIVERY_STEP_ORDER as string[];
  const currentStepIndex = stepOrder.indexOf(currentCode);
  const safeCurrentIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  const timelineByCode = new Map<string, { label?: string; at?: string }>();
  for (const e of timeline) {
    const c = toLowerCode(e.code);
    if (c) timelineByCode.set(c, { label: e.label, at: e.at });
  }

  const steps: TimelineStep[] = [];
  for (let i = 0; i < stepOrder.length; i++) {
    const code = stepOrder[i];
    const entry = timelineByCode.get(code);
    const label = labelFor(
      code,
      entry?.label ?? (currentCode === code ? current_status?.label : undefined)
    );
    const isLastStep = i === stepOrder.length - 1;
    const state: 'done' | 'active' | 'todo' =
      i < safeCurrentIndex
        ? 'done'
        : i === safeCurrentIndex
          ? isLastStep
            ? 'done'
            : 'active'
          : 'todo';
    const timeText =
      state === 'active'
        ? atToTimeText(entry?.at ?? current_status?.at)
        : state === 'done'
          ? atToTimeText(entry?.at)
          : undefined;
    steps.push({ code, label, state, timeText });
  }
  return steps;
}
