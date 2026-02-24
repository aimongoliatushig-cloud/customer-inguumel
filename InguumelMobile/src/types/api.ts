/**
 * Canonical API response envelope.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  message?: string;
  request_id?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/**
 * Validation error response (no data, errors by field).
 */
export interface ValidationErrorResponse {
  success: false;
  code: 'VALIDATION_ERROR';
  errors: Record<string, string[]>;
  request_id?: string;
}

/**
 * Normalized app error for consistent handling (401 => logout, etc.).
 */
export interface AppError {
  code: string;
  message: string;
  request_id?: string;
  status?: number;
  fieldErrors?: Record<string, string[]>;
}

/** Auth – use LoginRequest from ~/types/auth for { phone, pin } */
export interface LoginPayload {
  phone: string;
  pin: string;
}

export interface LoginUser {
  id: number;
  name: string;
}

/** Warehouse owner: id + optional name from /auth/me or /owner/me */
export interface OwnerWarehouse {
  id: number;
  name?: string | null;
}

/** Profile data from GET /api/v1/auth/me (logged-in user). */
export interface MeData {
  partner_id: number;
  name: string;
  phone_primary: string;
  phone_secondary: string;
  delivery_address: string;
  city?: string;
  aimag_id?: number | null;
  sum_id?: number | null;
  /** Region from backend (e.g. "Дорнод · Хэрлэн"). Preferred over local names when present. */
  region?: string | null;
  /** Current ordering warehouse from backend. */
  warehouse_id?: number | null;
  /** Human-readable warehouse name from backend. */
  warehouse_name?: string | null;
  /** Warehouse owner: IDs the user can manage (from token claims or /auth/me). */
  warehouse_ids?: number[];
  /** Warehouse owner: id + name for display (from /auth/me or /owner/me). */
  warehouses?: OwnerWarehouse[];
}

/** Backend login response data: uid + partner_id (session-cookie auth); token optional. */
export interface LoginData {
  uid: number;
  partner_id?: number;
  token?: string;
  /** Legacy; optional when backend uses session cookies. */
  access_token?: string;
  /** Set by client from Set-Cookie or response body after login request. */
  session_id?: string;
  expires_in?: number;
  user?: LoginUser;
}

/** Location */
export interface Aimag {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface Soum {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface SetLocationPayload {
  aimag_id: number;
  sum_id: number;
}

/** Warehouse (from GET /api/v1/mxm/warehouses?soum_id=...) */
export interface Warehouse {
  id: number;
  name?: string;
  [key: string]: unknown;
}

/** Category (from GET /api/v1/mxm/categories) – icon_url/image_url are relative */
export interface Category {
  id: number;
  name: string;
  parent_id?: number | null;
  sequence?: number;
  image_url?: string | null;
  /** Relative URL for category icon (e.g. /api/v1/mxm/category-icon/<id>?size=128&v=...). */
  icon_url?: string | null;
  /** ISO timestamp when icon was last updated (for cache busting). */
  icon_updated_at?: string | null;
}

/** Products */
export interface ProductItem {
  id: number;
  name: string;
  price: number;
  stock_qty: number;
  image_url?: string;
  write_date?: string;
  category_id?: number;
  category_name?: string;
  category_path?: string;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
}

export interface ProductsData {
  items: ProductItem[];
  pagination: PaginationMeta;
}

/** Cart – backend items use line_id, name, image_url, price, subtotal, qty */
export interface CartLine {
  id: number;
  product_id: number;
  qty: number;
  /** Unit price (backend: price) */
  unit_price?: number;
  /** Product display name (backend: name) */
  name?: string;
  /** Relative image path – prepend API_BASE_URL for full URL */
  image_url?: string;
  /** Unit price from backend */
  price?: number;
  /** Line total (price * qty) from backend */
  subtotal?: number;
  [key: string]: unknown;
}

export interface CartData {
  id: number;
  lines?: CartLine[];
  amount_total?: number;
  /** Backend may return items + total_amount; setCart normalizes to lines + amount_total */
  items?: Array<{ line_id?: number; product_id: number; qty: number; [key: string]: unknown }>;
  total_amount?: number;
  [key: string]: unknown;
}

/** Body for POST /api/v1/mxm/cart/lines – warehouse_id required for stock context. */
export interface AddCartLinePayload {
  warehouse_id: number;
  product_id: number;
  qty: number;
}

export interface AddCartLineData {
  cart_id: number;
  line_id: number;
}

/** Orders */
export type OrderState =
  | 'draft'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'canceled';

export interface OrderItem {
  id: number;
  state: OrderState;
  [key: string]: unknown;
}

export interface CheckoutData {
  order_id: number;
}

/** Lucky Wheel – GET /api/v1/lucky-wheel/eligibility */
export interface LuckyEligibilityData {
  spin_credits: number;
  eligible: boolean;
  accumulated_paid_amount: number;
  threshold_amount: number;
}

/** Lucky Wheel – POST /api/v1/lucky-wheel/spin response data */
export type LuckyPrizeType = 'product' | 'coupon' | 'empty';

export interface LuckySpinProduct {
  id: number;
  name: string;
  image_url?: string | null;
}

export interface LuckySpinResultData {
  prize_id: number;
  prize_type: LuckyPrizeType;
  product?: LuckySpinProduct | null;
  coupon_payload?: Record<string, unknown> | null;
  expires_at: string;
}

/** Stored prize item in AsyncStorage (lucky_prize_wallet:{warehouse_id}) */
export interface StoredPrizeItem {
  prize_id: number;
  prize_type: LuckyPrizeType;
  product?: LuckySpinProduct | null;
  coupon_payload?: Record<string, unknown> | null;
  expires_at: string;
  /** Display state: pending | claimed | expired */
  state?: 'pending' | 'claimed' | 'expired';
}
