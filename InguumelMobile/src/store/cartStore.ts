import { create } from 'zustand';
import type { CartLine } from '~/types';

/** Normalized cart shape: exactly what the store holds. No fallback strings or ambiguous numbers. */
export interface NormalizedCart {
  cart_id: number | null;
  lines: CartLine[];
  amount_total: number;
}

/** Raw backend line item (from GET /api/v1/mxm/cart response). */
interface RawCartLine {
  line_id?: number;
  product_id?: number;
  name?: string;
  qty?: number;
  price?: number;
  subtotal?: number;
  image_url?: string;
  [key: string]: unknown;
}

/** Raw backend cart response (data field). */
interface RawCartData {
  cart_id?: number;
  id?: number;
  warehouse_id?: number;
  items?: RawCartLine[];
  total_qty?: number;
  total_amount?: number;
  [key: string]: unknown;
}

interface CartState {
  cart_id: number | null;
  lines: CartLine[];
  amount_total: number;
  setCart: (data: NormalizedCart | null) => void;
  resetCart: () => void;
}

/**
 * Build full image URL from API base URL and relative path.
 * Handles leading slash and missing base trailing slash.
 */
function buildImageUrl(apiBaseUrl: string, relativePath: string | undefined): string | null {
  if (relativePath == null || typeof relativePath !== 'string') {
    return null;
  }
  const trimmed = relativePath.trim();
  if (trimmed === '') {
    return null;
  }
  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  if (trimmed.startsWith('/')) {
    return base + trimmed;
  }
  return base + '/' + trimmed;
}

/**
 * Normalize backend cart response to store shape.
 * - cart_id: data.cart_id or data.id, null if invalid
 * - items: each line has id (line_id), name (string), qty, unit_price, subtotal, image_url (full URL or null)
 * - total_qty / total_amount: from data or computed from lines
 * Hermes-safe: no mixing of ?? and || in the same expression.
 */
export function normalizeCartResponse(data: unknown, apiBaseUrl: string): NormalizedCart {
  const empty: NormalizedCart = { cart_id: null, lines: [], amount_total: 0 };

  if (data == null || typeof data !== 'object') {
    return empty;
  }

  const raw = data as RawCartData;

  // --- cart_id ---
  const cartIdFromCart = raw.cart_id;
  const cartIdFromId = raw.id;
  let cart_id: number | null = null;
  if (typeof cartIdFromCart === 'number' && !Number.isNaN(cartIdFromCart)) {
    cart_id = cartIdFromCart;
  } else if (typeof cartIdFromId === 'number' && !Number.isNaN(cartIdFromId)) {
    cart_id = cartIdFromId;
  }

  // --- items ---
  const rawItems = raw.items;
  const normalizedLines: CartLine[] = [];

  if (Array.isArray(rawItems)) {
    for (const line of rawItems) {
      const lineId = line.line_id;
      const id = typeof lineId === 'number' && !Number.isNaN(lineId) ? lineId : 0;

      const product_id = typeof line.product_id === 'number' ? line.product_id : 0;

      const nameValue = line.name;
      const name =
        typeof nameValue === 'string' && nameValue.trim() !== '' ? nameValue.trim() : '';

      const qtyNum = Number(line.qty);
      const qty = Number.isNaN(qtyNum) ? 0 : qtyNum;

      const priceNum = Number(line.price);
      const unit_price = Number.isNaN(priceNum) ? 0 : priceNum;

      let subtotal: number;
      const subtotalFromApi = line.subtotal;
      if (subtotalFromApi != null) {
        const subtotalNum = Number(subtotalFromApi);
        subtotal = Number.isNaN(subtotalNum) ? qty * unit_price : subtotalNum;
      } else {
        subtotal = qty * unit_price;
      }

      const fullImageUrl = buildImageUrl(apiBaseUrl, line.image_url);

      normalizedLines.push({
        id,
        product_id,
        name,
        qty,
        unit_price,
        subtotal,
        image_url: fullImageUrl !== null ? fullImageUrl : undefined,
      });
    }
  }

  // --- total_amount ---
  let amount_total: number;
  const totalAmountFromApi = raw.total_amount;
  if (totalAmountFromApi != null) {
    const n = Number(totalAmountFromApi);
    amount_total = Number.isNaN(n) ? 0 : n;
  } else {
    let sum = 0;
    for (const l of normalizedLines) {
      const st = l.subtotal;
      sum += typeof st === 'number' && !Number.isNaN(st) ? st : 0;
    }
    amount_total = sum;
  }

  return {
    cart_id,
    lines: [...normalizedLines],
    amount_total,
  };
}

/** Safe defaults so UI never sees undefined. */
const SAFE_DEFAULT_LINES: CartLine[] = [];
const SAFE_DEFAULT_AMOUNT = 0;

export const cartStore = create<CartState>((set) => ({
  cart_id: null,
  lines: SAFE_DEFAULT_LINES,
  amount_total: SAFE_DEFAULT_AMOUNT,

  setCart: (data) => {
    // #region agent log
    try {
      const dl = typeof (data as { lines?: unknown })?.lines;
      const dla = Array.isArray((data as { lines?: unknown })?.lines);
      if (typeof fetch !== 'undefined') {
        fetch('http://127.0.0.1:7245/ingest/ce95ccf8-fa0f-48b0-8903-68f2e746d517', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'cartStore.ts:setCart',
            message: 'setCart called',
            data: { dataIsNull: data == null, dataLinesType: dl, dataLinesIsArray: dla },
            timestamp: Date.now(),
            sessionId: 'cart-debug',
            runId: 'run1',
            hypothesisId: 'H4',
          }),
        }).catch(() => {});
      }
    } catch (_) {}
    // #endregion
    if (data == null) {
      set({ cart_id: null, lines: SAFE_DEFAULT_LINES, amount_total: SAFE_DEFAULT_AMOUNT });
      return;
    }
    const lines = Array.isArray(data.lines) ? data.lines : SAFE_DEFAULT_LINES;
    const amount_total =
      typeof data.amount_total === 'number' && !Number.isNaN(data.amount_total)
        ? data.amount_total
        : SAFE_DEFAULT_AMOUNT;
    set({
      cart_id: data.cart_id ?? null,
      lines,
      amount_total,
    });
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        '[CART_UI_DEBUG] cart set: cart_id=',
        data.cart_id,
        'lines=',
        lines.length,
        'amount_total=',
        amount_total
      );
    }
  },

  resetCart: () => {
    set({ cart_id: null, lines: SAFE_DEFAULT_LINES, amount_total: SAFE_DEFAULT_AMOUNT });
  },
}));
