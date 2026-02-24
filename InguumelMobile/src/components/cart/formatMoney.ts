/** Format number as Mongolian tugrik: "38,180 ₮". No decimal .0; thousands separators. Use everywhere for totals. */
export function formatMnt(amount: number | undefined | null): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  const n = Math.round(Number(amount));
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ₮';
}

/** Alias for list/cart; same as formatMnt. */
export function formatMoney(amount: number): string {
  return formatMnt(amount);
}
