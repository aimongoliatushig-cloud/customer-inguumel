/**
 * Decode JWT payload without verification (backend is source of truth).
 * Used to read warehouse_ids from token after login.
 */
export interface JwtPayload {
  sub?: string | number;
  warehouse_ids?: number[];
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const warehouse_ids = parsed.warehouse_ids;
      const out: JwtPayload = { ...parsed };
      if (Array.isArray(warehouse_ids)) {
        out.warehouse_ids = warehouse_ids.filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));
      }
      return out;
    }
    return null;
  } catch {
    return null;
  }
}
