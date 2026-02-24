/**
 * Delivery status codes and helpers for Orders list filtering, badges, and progress dots.
 * Single source: normalizeDeliveryCode → step index, isDelivered, isCancelled.
 */

export type DeliveryCode =
  | 'received'
  | 'preparing'
  | 'prepared'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

const VALID_CODES: readonly DeliveryCode[] = [
  'received',
  'preparing',
  'prepared',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

const STEP_CODES: readonly DeliveryCode[] = [
  'received',
  'preparing',
  'prepared',
  'out_for_delivery',
  'delivered',
];

/** Normalize raw code to DeliveryCode or null if unknown. */
export function normalizeDeliveryCode(code: unknown): DeliveryCode | null {
  if (code == null) return null;
  const raw = String(code).trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw as DeliveryCode;
  if (VALID_CODES.includes(normalized)) return normalized;
  if (raw === 'cancel' || raw === 'canceled') return 'cancelled';
  return null;
}

/** Step index 0–4 for progress dots. delivered=4, cancelled => -1 (caller uses cancelled style). */
export function deliveryStepIndex(code: DeliveryCode | null): number {
  if (code == null) return 0;
  if (code === 'cancelled') return -1;
  const idx = (STEP_CODES as readonly string[]).indexOf(code);
  return idx >= 0 ? idx : 0;
}

export function isDelivered(code: DeliveryCode | null): boolean {
  return code === 'delivered';
}

export function isCancelled(code: DeliveryCode | null): boolean {
  return code === 'cancelled';
}
