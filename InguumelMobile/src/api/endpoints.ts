import { api, setIdempotencyKey, clearIdempotencyKey } from './client';
import { config, LOGIN_ENDPOINT, isDev } from '~/constants/config';
import { normalizeCartResponse, type NormalizedCart } from '~/store/cartStore';
import type {
  ApiResponse,
  MeData,
  LoginPayload,
  LoginData,
  ProductsData,
  ProductItem,
  AddCartLinePayload,
  CheckoutData,
  Aimag,
  Soum,
  Warehouse,
  Category,
  OwnerWarehouse,
  LuckyEligibilityData,
  LuckySpinResultData,
} from '~/types';

const parse = <T>(res: { data: ApiResponse<T> }): T => {
  const body = res.data;
  if (!body.success || body.data === undefined) {
    throw new Error(body.message ?? 'Request failed');
  }
  return body.data;
};

/** GET /api/v1/auth/me – verify session cookie; 200 = OK, 401 = UNAUTHORIZED. */
export async function getAuthMe(): Promise<{ ok: true }> {
  const res = await api.get<ApiResponse<unknown>>('/api/v1/auth/me');
  const body = res.data;
  if (body && (body as { success?: boolean }).success === false && (body as { code?: string }).code === 'UNAUTHORIZED') {
    throw Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED', status: 401 });
  }
  if (res.status === 200) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[API] auth/me 200 – session verified');
    }
    return { ok: true };
  }
  throw Object.assign(new Error('Auth check failed'), { code: 'AUTH_ME_FAILED', status: res.status });
}

/** GET /api/v1/auth/me – fetch logged-in user profile (phone, address, optional warehouse_ids/warehouses). */
export async function getMe(): Promise<ApiResponse<MeData>> {
  const res = await api.get<ApiResponse<MeData>>('/api/v1/auth/me');
  return res.data;
}

/** GET /api/v1/owner/me – warehouse owner profile (warehouse_ids, warehouse names). Falls back to empty if 404. */
export interface OwnerMeData {
  warehouse_ids: number[];
  warehouses?: OwnerWarehouse[];
}

export async function getOwnerMe(): Promise<OwnerMeData | null> {
  try {
    const res = await api.get<ApiResponse<OwnerMeData>>('/api/v1/owner/me');
    const body = res.data;
    if (!body?.success || body.data == null) return null;
    const data = body.data;
    return {
      warehouse_ids: Array.isArray(data.warehouse_ids) ? data.warehouse_ids : [],
      warehouses: Array.isArray(data.warehouses) ? data.warehouses : undefined,
    };
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number } };
    if (ax.response?.status === 404) return null;
    throw err;
  }
}

/** Auth – POST login only; returns login data. Caller must set token before /auth/me. */
export async function login(payload: LoginPayload): Promise<LoginData> {
  const res = await api.post<ApiResponse<LoginData>>(LOGIN_ENDPOINT, payload);
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('AUTH RAW', res?.status, res?.data);
  }
  const payload_ = res?.data;
  const data = payload_?.data as LoginData | undefined;
  if (!payload_?.success || data?.uid == null) {
    throw Object.assign(new Error('Login response missing required fields'), {
      code: 'AUTH_RESPONSE_MISSING_FIELDS',
    });
  }
  return {
    uid: data.uid,
    partner_id: data.partner_id ?? 0,
    token: data?.token,
    access_token: data?.access_token,
    session_id: data?.session_id,
    expires_in: data?.expires_in,
    user: data?.user,
  };
}

export async function logout(): Promise<void> {
  await api.post('/api/v1/auth/logout').catch(() => {});
}

/** Location – GET /api/v1/mxm/aimags, /api/v1/mxm/soums?aimag_id=, /api/v1/mxm/warehouses?soum_id= */
export async function getAimags(): Promise<Aimag[]> {
  const res = await api.get<ApiResponse<Aimag[]>>('/api/v1/mxm/aimags');
  const data = parse(res);
  return Array.isArray(data) ? data : [];
}

export async function getSoums(aimagId: number): Promise<Soum[]> {
  const res = await api.get<ApiResponse<Soum[]>>('/api/v1/mxm/soums', {
    params: { aimag_id: aimagId },
  });
  const data = parse(res);
  return Array.isArray(data) ? data : [];
}

/** Warehouses by soum – never guess warehouse; use this after soum is selected */
export async function getWarehouses(soumId: number): Promise<Warehouse[]> {
  const res = await api.get<ApiResponse<Warehouse[]>>('/api/v1/mxm/warehouses', {
    params: { soum_id: soumId },
  });
  const data = parse(res);
  return Array.isArray(data) ? data : [];
}

/** Categories – GET /api/v1/mxm/categories (optional warehouse_id; requires session cookie auth) */
export async function fetchCategories(warehouseId?: number | null): Promise<Category[]> {
  const params = warehouseId != null ? { warehouse_id: warehouseId } : {};
  const res = await api.get<ApiResponse<Category[]>>('/api/v1/mxm/categories', { params });
  const data = parse(res);
  return Array.isArray(data) ? data : [];
}

/** Products by warehouse – GET /api/v1/mxm/products?warehouse_id=...&category_id=...&search=&page=&limit= */
export async function fetchProducts(params: {
  warehouseId: number;
  categoryId?: number | null;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsData> {
  const { warehouseId, categoryId, search, page = 1, limit = 50 } = params;
  const requestParams: Record<string, unknown> = { warehouse_id: warehouseId, page, limit };
  if (categoryId != null) requestParams.category_id = categoryId;
  if (search != null && search.trim() !== '') requestParams.search = search.trim();
  const res = await api.get<ApiResponse<unknown>>('/api/v1/mxm/products', {
    params: requestParams,
  });
  const raw = res.data;
  const nested = (raw && typeof raw === 'object' && 'data' in raw)
    ? (raw as { data?: unknown }).data
    : undefined;
  let items: ProductItem[] = [];
  if (Array.isArray(nested)) {
    items = nested.map((item) => {
      const rawItem = (item ?? {}) as Record<string, unknown>;
      const stockCandidate =
        rawItem.stock_qty ??
        rawItem.available_qty ??
        rawItem.qty_free ??
        rawItem.qty_on_hand;
      const stockNum = Number(stockCandidate);
      return {
        id: Number(rawItem.id ?? 0),
        name: String(rawItem.name ?? ''),
        price: Number(rawItem.price ?? 0),
        stock_qty: Number.isNaN(stockNum) ? 0 : stockNum,
        image_url: typeof rawItem.image_url === 'string' ? rawItem.image_url : undefined,
        write_date: typeof rawItem.write_date === 'string' ? rawItem.write_date : undefined,
        category_id:
          typeof rawItem.category_id === 'number' && !Number.isNaN(rawItem.category_id)
            ? rawItem.category_id
            : undefined,
        category_name: typeof rawItem.category_name === 'string' ? rawItem.category_name : undefined,
        category_path: typeof rawItem.category_path === 'string' ? rawItem.category_path : undefined,
      };
    });
  } else if (nested && typeof nested === 'object' && nested !== null && 'items' in nested) {
    items = Array.isArray((nested as { items: unknown }).items) ? ((nested as { items: ProductItem[] }).items) : [];
  }
  const paginationPage = (raw && typeof raw === 'object' && 'pagination' in (raw as { pagination?: unknown }))
    ? ((raw as { pagination?: { page?: number; page_size?: number; total?: number } }).pagination)
    : undefined;
  const meta =
    raw && typeof raw === 'object' && 'meta' in (raw as { meta?: unknown })
      ? ((raw as { meta?: { page?: number; limit?: number; count?: number } }).meta)
      : undefined;
  const pageNum = paginationPage?.page ?? meta?.page ?? page;
  const pageSize = paginationPage?.page_size ?? meta?.limit ?? items.length;
  const totalCount = paginationPage?.total ?? meta?.count ?? items.length;

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[Products] warehouseId:', warehouseId, 'categoryId:', categoryId, 'res.data:', raw, 'items.length:', items.length);
  }
  return {
    items,
    pagination: { page: pageNum, page_size: pageSize, total: totalCount },
  };
}

/** Legacy: getMxmProducts wrapper for backward compatibility */
export async function getMxmProducts(
  warehouseId: number,
  params: { limit?: number; search?: string; category_id?: number | null; page?: number } = {}
): Promise<ProductsData> {
  return fetchProducts({
    warehouseId,
    categoryId: params.category_id,
    search: params.search,
    page: params.page ?? 1,
    limit: params.limit ?? 50,
  });
}

/** Legacy products (no warehouse) – prefer getMxmProducts with warehouse_id */
export async function getProducts(params: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<ProductsData> {
  const res = await api.get<ApiResponse<ProductsData>>('/api/v1/products', { params });
  const data = parse(res);
  if (data && typeof data === 'object' && 'items' in data && 'pagination' in data) {
    return data as ProductsData;
  }
  return { items: [], pagination: { page: 1, page_size: 20, total: 0 } };
}

/** Cart (mxm) – GET /api/v1/mxm/cart?warehouse_id=; POST /api/v1/mxm/cart/lines { product_id, qty } */
const MXM_CART_PATH = '/api/v1/mxm/cart';
const MXM_CART_LINES_PATH = '/api/v1/mxm/cart/lines';

export async function getCart(warehouseId: number): Promise<NormalizedCart> {
  const baseUrl = config.apiBaseUrl;
  const params = { warehouse_id: warehouseId };
  const finalUrl = `${baseUrl.replace(/\/$/, '')}${MXM_CART_PATH}?warehouse_id=${warehouseId}`;
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[CART_DEBUG] getCart URL:', finalUrl, 'method: GET', 'resolved warehouse_id:', warehouseId);
  }
  try {
    const res = await api.get<ApiResponse<Record<string, unknown>>>(MXM_CART_PATH, { params });
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[CART_DEBUG] getCart response status:', res.status, 'data:', JSON.stringify(res.data));
    }
    const body = res.data;
    if (!body?.success || body.data === undefined) {
      throw new Error((body?.message as string) ?? 'Request failed');
    }
    const raw = body.data;
    return normalizeCartResponse(raw, config.apiBaseUrl);
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: unknown } };
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[CART_DEBUG] getCart ERROR status:', ax.response?.status, 'response.data:', ax.response?.data);
    }
    throw err;
  }
}

/** Add to cart – POST /api/v1/mxm/cart/lines. Returns full cart from response (do not ignore). */
export async function addCartLine(payload: AddCartLinePayload): Promise<NormalizedCart> {
  const warehouse_id = payload.warehouse_id;
  if (warehouse_id == null || Number.isNaN(warehouse_id)) {
    const msg = 'Салбараа (агуулхаа) сонгоно уу';
    throw Object.assign(new Error(msg), { code: 'WAREHOUSE_REQUIRED', message: msg });
  }
  const baseUrl = config.apiBaseUrl;
  const finalUrl = `${baseUrl.replace(/\/$/, '')}${MXM_CART_LINES_PATH}`;
  const body = {
    warehouse_id: Number(warehouse_id),
    product_id: payload.product_id,
    qty: payload.qty,
  };
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[CART_DEBUG] addCartLine URL:', finalUrl, 'method: POST', 'body:', JSON.stringify(body), 'resolved warehouse_id:', warehouse_id);
  }
  try {
    const res = await api.post<ApiResponse<Record<string, unknown>>>(MXM_CART_LINES_PATH, body);
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[CART_DEBUG] addCartLine response status:', res.status, 'data:', JSON.stringify(res.data));
    }
    if (!res.data?.success) throw new Error((res.data?.message as string) ?? 'Request failed');
    const raw = res.data?.data;
    const cart = normalizeCartResponse(raw, config.apiBaseUrl);
    return cart;
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: unknown } };
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[CART_DEBUG] addCartLine ERROR status:', ax.response?.status, 'response.data:', ax.response?.data);
    }
    throw err;
  }
}

/** PATCH cart line – server returns full cart in response.data; replace cart state with it. */
export async function updateCartLine(
  lineId: number,
  body: { qty: number },
  warehouseId: number
): Promise<NormalizedCart> {
  const url = `${MXM_CART_LINES_PATH}/${lineId}`;
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[CART_DEBUG] updateCartLine URL:', url, 'method: PATCH', 'warehouse_id:', warehouseId, 'body:', JSON.stringify(body));
  }
  const res = await api.patch<ApiResponse<Record<string, unknown>>>(url, body, { params: { warehouse_id: warehouseId } });
  const raw = res.data?.data;
  return normalizeCartResponse(raw, config.apiBaseUrl);
}

/** DELETE cart line – server returns full cart in response.data; replace cart state with it. */
export async function removeCartLine(lineId: number, warehouseId: number): Promise<NormalizedCart> {
  const url = `${MXM_CART_LINES_PATH}/${lineId}`;
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[CART_DEBUG] removeCartLine URL:', url, 'method: DELETE', 'warehouse_id:', warehouseId);
  }
  const res = await api.delete<ApiResponse<Record<string, unknown>>>(url, { params: { warehouse_id: warehouseId } });
  const raw = res.data?.data;
  return normalizeCartResponse(raw, config.apiBaseUrl);
}

/** Clear cart – DELETE /api/v1/mxm/cart?warehouse_id=# */
export async function clearCart(warehouseId: number): Promise<void> {
  await api.delete(MXM_CART_PATH, { params: { warehouse_id: warehouseId } });
}

/** POST /api/v1/cart/checkout?warehouse_id=# (canonical local checkout route) */
export async function checkout(idempotencyKey: string, warehouseId: number): Promise<CheckoutData> {
  if (warehouseId == null || Number.isNaN(warehouseId)) {
    const msg = 'Салбараа (агуулхаа) сонгоно уу';
    throw Object.assign(new Error(msg), { code: 'WAREHOUSE_REQUIRED', message: msg });
  }
  setIdempotencyKey(idempotencyKey);
  try {
    const url = '/api/v1/cart/checkout';
    const params = { warehouse_id: warehouseId };
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[CART_DEBUG] checkout URL:', config.apiBaseUrl + url + '?warehouse_id=' + warehouseId, 'method: POST');
    }
    const res = await api.post<ApiResponse<CheckoutData>>(url, {}, { params });
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[CART_DEBUG] checkout response status:', res.status, 'data:', JSON.stringify(res.data));
    }
    return parse(res);
  } finally {
    clearIdempotencyKey();
  }
}

/** POST /api/v1/cart/checkout?warehouse_id=# – v1 checkout (returns order_id). */
export async function checkoutV1(idempotencyKey: string, warehouseId: number): Promise<CheckoutData> {
  if (warehouseId == null || Number.isNaN(warehouseId)) {
    const msg = 'Салбараа (агуулхаа) сонгоно уу';
    throw Object.assign(new Error(msg), { code: 'WAREHOUSE_REQUIRED', message: msg });
  }
  setIdempotencyKey(idempotencyKey);
  try {
    const url = '/api/v1/cart/checkout';
    const params = { warehouse_id: warehouseId };
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[CHECKOUT_V1] endpoint=', url, 'status=pending', 'warehouse_id=', warehouseId);
    }
    const res = await api.post<ApiResponse<CheckoutData>>(url, {}, { params });
    if (isDev) {
      const body = res.data as { request_id?: string; code?: string; message?: string };
      // eslint-disable-next-line no-console
      console.log('[CHECKOUT_V1] endpoint=', url, 'status=', res.status, 'request_id=', body?.request_id, 'code=', body?.code, 'message=', body?.message);
    }
    return parse(res);
  } finally {
    clearIdempotencyKey();
  }
}

/** POST /api/v1/orders/{order_id}/address – attach phone + delivery address to order. */
export interface SetOrderAddressPayload {
  phone_primary: string;
  phone_secondary?: string;
  delivery_address: string;
}

export async function setOrderAddress(
  orderId: number,
  payload: SetOrderAddressPayload,
  warehouseId?: number | null
): Promise<void> {
  if (orderId == null || Number.isNaN(orderId)) {
    throw new Error('Order ID required');
  }
  const url = `/api/v1/orders/${orderId}/address`;
  const params = warehouseId != null && !Number.isNaN(warehouseId) ? { warehouse_id: warehouseId } : undefined;
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[ORDER_ADDRESS] endpoint=', url, 'status=pending', 'orderId=', orderId, 'warehouse_id=', warehouseId);
  }
  const res = await api.post<ApiResponse<unknown>>(url, payload, { params });
  if (isDev) {
    const body = res.data as { request_id?: string; code?: string; message?: string };
    // eslint-disable-next-line no-console
    console.log('[ORDER_ADDRESS] endpoint=', url, 'status=', res.status, 'request_id=', body?.request_id, 'code=', body?.code, 'message=', body?.message);
  }
  const body = res.data as ApiResponse<unknown> | undefined;
  if (body && body.success === false) {
    throw Object.assign(new Error(body.message ?? 'Request failed'), {
      code: body.code ?? 'UNKNOWN',
      message: body.message,
      request_id: body.request_id,
      status: res.status,
    });
  }
}

/** POST /api/v1/orders/{order_id}/confirm – confirm order (e.g. payment_method for cash). */
export interface ConfirmOrderPayload {
  payment_method?: 'cod' | 'qpay';
}

/** Normalize order_id from confirm response: { data: { order_id } } | { order_id } | { id } */
function normalizeConfirmOrderId(data: unknown, fallbackOrderId: number): number {
  if (data == null || typeof data !== 'object') return fallbackOrderId;
  const d = data as Record<string, unknown>;
  const inner = d.data;
  if (inner != null && typeof inner === 'object') {
    const innerObj = inner as Record<string, unknown>;
    const fromData = innerObj.order_id ?? innerObj.id;
    if (typeof fromData === 'number' && !Number.isNaN(fromData)) return fromData;
  }
  const top = d.order_id ?? d.id;
  if (typeof top === 'number' && !Number.isNaN(top)) return top;
  return fallbackOrderId;
}

export interface ConfirmOrderResult {
  orderId: number;
}

export async function confirmOrder(
  orderId: number,
  payload?: ConfirmOrderPayload,
  warehouseId?: number | null
): Promise<ConfirmOrderResult> {
  if (orderId == null || Number.isNaN(orderId)) {
    throw new Error('Order ID required');
  }
  const url = `/api/v1/orders/${orderId}/confirm`;
  const body = payload ?? {};
  const params = warehouseId != null && !Number.isNaN(warehouseId) ? { warehouse_id: warehouseId } : undefined;
  const res = await api.post<ApiResponse<unknown>>(url, body, { params });
  const status = res.status;
  const is2xx = status >= 200 && status < 300;
  const resBody = res.data as { request_id?: string; code?: string; message?: string } | undefined;
  const requestId = resBody?.request_id ?? '-';
  const resolvedOrderId = is2xx ? normalizeConfirmOrderId(res.data, orderId) : orderId;
  // eslint-disable-next-line no-console
  console.log('[Order confirm] order_id=', resolvedOrderId, 'status=', status, 'request_id=', requestId);
  if (!is2xx) {
    throw Object.assign(new Error(resBody?.message ?? 'Request failed'), {
      code: resBody?.code ?? 'UNKNOWN',
      message: resBody?.message,
      request_id: resBody?.request_id,
      status,
    });
  }
  return { orderId: resolvedOrderId };
}

/** Create Order – POST /api/v1/mxm/order/create */
export interface CreateOrderPayload {
  warehouse_id: number;
  phone_primary: string;
  phone_secondary?: string;
  delivery_address: string;
  payment_method: 'cod' | 'qpay';
}

export interface CreateOrderResponse {
  order_id: number;
  order_number?: string;
}

/** True if response body contains any order identifier we can use. */
function hasOrderIdentifier(data: unknown): data is Record<string, unknown> {
  if (data == null || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const hasId = typeof d.order_id === 'number' && !Number.isNaN(d.order_id as number);
  const hasIdAlt = typeof d.id === 'number' && !Number.isNaN(d.id as number);
  const hasOrderNumber = typeof d.order_number === 'string' && String(d.order_number).trim() !== '';
  const hasName = typeof d.name === 'string' && String(d.name).trim() !== '';
  return hasId || hasIdAlt || hasOrderNumber || hasName;
}

function extractOrderId(data: Record<string, unknown>): number {
  const raw = data.order_id ?? data.id;
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  return 0;
}

function extractOrderNumber(data: Record<string, unknown>): string | undefined {
  const s = data.order_number ?? data.name;
  if (typeof s === 'string' && s.trim() !== '') return s.trim();
  return undefined;
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
  const { warehouse_id, phone_primary, phone_secondary, delivery_address, payment_method } = payload;

  if (warehouse_id == null || Number.isNaN(warehouse_id)) {
    const msg = 'Салбараа (агуулхаа) сонгоно уу';
    throw Object.assign(new Error(msg), { code: 'WAREHOUSE_REQUIRED', message: msg });
  }

  const body: Record<string, unknown> = {
    warehouse_id: Number(warehouse_id),
    phone_primary,
    delivery_address,
    payment_method,
  };

  if (phone_secondary && phone_secondary.trim()) {
    body.phone_secondary = phone_secondary.trim();
  }

  const url = '/api/v1/mxm/order/create';
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[ORDER_DEBUG] createOrder payload (warehouse_id from locationStore):', JSON.stringify({ url: config.apiBaseUrl + url, body, params: { warehouse_id } }));
  }

  try {
    const res = await api.post<ApiResponse<unknown>>(url, body, { params: { warehouse_id } });
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[ORDER_DEBUG] createOrder response status:', res.status, 'data:', JSON.stringify(res.data));
    }

    const is2xx = res.status >= 200 && res.status < 300;
    const data = (res.data as { data?: unknown })?.data;

    if (is2xx && hasOrderIdentifier(data)) {
      const obj = data as Record<string, unknown>;
      const order_id = extractOrderId(obj);
      const order_number = extractOrderNumber(obj);
      return { order_id, order_number };
    }

    if (!is2xx || !hasOrderIdentifier(data)) {
      const resBody = res.data as { code?: string; message?: string; request_id?: string } | undefined;
      const code = resBody?.code ?? 'UNKNOWN';
      const message = typeof resBody?.message === 'string' ? resBody.message : 'Request failed';
      throw Object.assign(new Error(message), {
        code,
        message,
        request_id: resBody?.request_id,
        status: res.status,
      });
    }

    const obj = data as Record<string, unknown>;
    return { order_id: extractOrderId(obj), order_number: extractOrderNumber(obj) };
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: unknown } };
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[ORDER_DEBUG] createOrder ERROR status:', ax.response?.status, 'response.data:', ax.response?.data);
    }
    throw err;
  }
}

/** MXM Orders – GET /api/v1/mxm/orders?warehouse_id={id}&delivery_tab=all|active|delivered|cancelled. */
export type DeliveryTabParam = 'all' | 'active' | 'delivered' | 'cancelled';

export interface MxmOrderItem {
  id?: number;
  order_id?: number;
  order_number?: string;
  name?: string;
  state?: string;
  status?: string;
  amount_total?: number;
  date_order?: string;
  /** Delivery status from list API (single source for tabs + dots). */
  delivery_status_code?: string | null;
  /** Mongolian label; prefer over local map when present. */
  delivery_status_label_mn?: string | null;
  delivery_is_delivered?: boolean;
  delivery_is_cancelled?: boolean;
  delivery_is_active?: boolean;
  [key: string]: unknown;
}

export async function getMxmOrders(
  warehouseId: number,
  params?: { delivery_tab?: DeliveryTabParam; limit?: number; offset?: number }
): Promise<MxmOrderItem[]> {
  if (warehouseId == null || Number.isNaN(warehouseId)) {
    return [];
  }
  const url = '/api/v1/mxm/orders';
  const query: Record<string, string | number> = { warehouse_id: warehouseId };
  if (params?.delivery_tab && params.delivery_tab !== 'all') {
    query.delivery_tab = params.delivery_tab;
  }
  if (params?.limit != null) query.limit = params.limit;
  if (params?.offset != null) query.offset = params.offset;
  // eslint-disable-next-line no-console
  console.log('[ORDERS_DEBUG] getMxmOrders warehouse_id:', warehouseId, 'delivery_tab:', params?.delivery_tab);

  const res = await api.get<ApiResponse<MxmOrderItem[]>>(url, { params: query });
  const body = res.data;

  // eslint-disable-next-line no-console
  console.log('[ORDERS_DEBUG] status:', res.status, 'response.success:', body?.success, 'Array.isArray(body.data):', Array.isArray(body?.data), 'data length:', Array.isArray(body?.data) ? body.data.length : 'N/A');

  if (!body?.success) {
    throw new Error(body?.message ?? 'Failed to load orders');
  }
  const list = body.data;
  if (!Array.isArray(list)) {
    return [];
  }
  return list;
}

/** Delivery POS – GET /api/v1/pos/online-orders?warehouse_id=&state=pending|delivered|cancelled&limit=&offset=
 * Canonical endpoint for online orders in Delivery POS; returns sale.order rows (same as workbench).
 * Backend must enforce warehouse scope (e.g. x_warehouse_ids). See docs/POS_ONLINE_ORDERS_DEBUG.md.
 */
export type PosOnlineOrderState = 'pending' | 'delivered' | 'cancelled';

export interface PosOnlineOrderItem {
  order_id: number;
  order_number?: string;
  customer_name?: string;
  phone_primary?: string;
  phone_secondary?: string | null;
  delivery_address?: string;
  total_amount?: number;
  mxm_delivery_status?: string | null;
  last_change?: string;
  [key: string]: unknown;
}

export interface PosOnlineOrdersParams {
  state?: PosOnlineOrderState;
  limit?: number;
  offset?: number;
}

export interface PosOnlineOrdersResponse {
  data: PosOnlineOrderItem[];
  meta?: { total?: number };
}

export async function getPosOnlineOrders(
  warehouseId: number,
  params?: PosOnlineOrdersParams
): Promise<PosOnlineOrderItem[]> {
  if (warehouseId == null || Number.isNaN(warehouseId)) {
    return [];
  }
  const url = '/api/v1/pos/online-orders';
  const query: Record<string, string | number> = { warehouse_id: warehouseId };
  if (params?.state) query.state = params.state;
  if (params?.limit != null) query.limit = params.limit;
  if (params?.offset != null) query.offset = params.offset;

  const res = await api.get<ApiResponse<PosOnlineOrderItem[]>>(url, { params: query });
  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message ?? 'Failed to load online orders');
  }
  const list = body.data;
  if (!Array.isArray(list)) {
    return [];
  }
  return list;
}

/** Order detail – GET /api/v1/mxm/orders/{orderId}. Response: { success, data: OrderDetail }. */
export interface OrderLine {
  id?: number;
  product_id?: number;
  product_name?: string;
  name?: string;
  qty?: number;
  uom_id?: [number, string];
  uom?: string;
  price_unit?: number;
  price_subtotal?: number;
  subtotal?: number;
  image_url?: string | null;
  [key: string]: unknown;
}

export interface WarehouseBlock {
  id?: number;
  name?: string;
  [key: string]: unknown;
}

export interface ShippingBlock {
  address_text?: string | null;
  x_delivery_address?: string | null;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  [key: string]: unknown;
}

export interface PaymentBlock {
  payment_method?: string | null;
  payment_status?: string | null;
  payment_method_label_mn?: string | null;
  payment_status_label_mn?: string | null;
  paid?: boolean;
  [key: string]: unknown;
}

export interface OrderDetail {
  id?: number;
  order_number?: string;
  name?: string;
  date_order?: string | null;
  state?: string | null;
  status?: string | null;
  /** Backend-provided Mongolian label for order state; prefer over fallback when present. */
  order_state_label_mn?: string | null;
  amount_untaxed?: number | null;
  amount_tax?: number | null;
  amount_total?: number | null;
  amount_total_mnt?: number | null;
  amounts?: { total?: number };
  warehouse_id?: number | null;
  warehouse?: WarehouseBlock | null;
  order_line?: OrderLine[];
  lines?: OrderLine[];
  shipping?: ShippingBlock | null;
  payment?: PaymentBlock | null;
  x_delivery_address?: string | null;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  /** Backend-provided Mongolian label for payment method. */
  payment_method_label_mn?: string | null;
  /** Backend-provided Mongolian label for payment status. */
  payment_status_label_mn?: string | null;
  paid?: boolean;
  /** Status history for timeline; sorted asc by at. { code, label, at: "YYYY-MM-DD HH:mm:ss" }. */
  status_history?: Array<{ code: string; label: string; at: string }>;
  [key: string]: unknown;
}

export async function getMxmOrderDetail(orderId: number): Promise<OrderDetail> {
  if (orderId == null || Number.isNaN(orderId)) {
    throw new Error('Order ID required');
  }
  const url = `/api/v1/mxm/orders/${orderId}`;
  const res = await api.get<ApiResponse<OrderDetail>>(url);
  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message ?? 'Failed to load order');
  }
  const data = body.data;
  if (data == null || typeof data !== 'object') {
    throw new Error('Invalid order response');
  }
  return data as OrderDetail;
}

/** Legacy orders (optional) */
export async function getOrders(): Promise<unknown[]> {
  const res = await api.get<ApiResponse<unknown[]>>('/api/v1/orders');
  const data = parse(res);
  return Array.isArray(data) ? data : [];
}

export async function getOrder(id: number): Promise<unknown> {
  const res = await api.get<ApiResponse<unknown>>(`/api/v1/orders/${id}`);
  return parse(res);
}

/** Delivery timeline – GET /api/v1/orders/{order_id}/delivery */
export interface DeliveryCurrentStatus {
  code: string;
  label: string;
  at?: string;
}

export interface DeliveryTimelineEntry {
  code: string;
  label: string;
  at?: string;
  is_current?: boolean;
  note?: string;
}

export interface DeliveryResponse {
  current_status: DeliveryCurrentStatus;
  timeline: DeliveryTimelineEntry[];
  last_update_at: string;
  /** Optional; when present prefer over last_update_at for change detection. */
  version?: string;
  /** Optional (new server). When "cod", show COD status block; if absent hide. */
  payment_method?: string;
  /** Optional (new server). When payment_method === "cod": false or absent = "Хүлээгдэж байна", true = "Баталгаажсан". */
  cod_confirmed?: boolean;
  /** Optional (new server). When cod_confirmed === true, display this timestamp. */
  cod_confirmed_at?: string;
}

export async function getOrderDelivery(orderId: number): Promise<DeliveryResponse> {
  if (orderId == null || Number.isNaN(orderId)) {
    throw new Error('Order ID required');
  }
  const url = `/api/v1/orders/${orderId}/delivery`;
  const res = await api.get<ApiResponse<DeliveryResponse>>(url);
  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message ?? 'Failed to load delivery');
  }
  const data = body.data;
  if (data == null || typeof data !== 'object') {
    throw new Error('Invalid delivery response');
  }
  /** Robust parsing: older servers may omit current_status/timeline; new server has them. Default for display. */
  const current_status =
    data.current_status && typeof data.current_status === 'object'
      ? {
          code: String(data.current_status.code ?? '').trim() || 'received',
          label: String(data.current_status.label ?? '').trim() || 'Захиалга авлаа',
          at: typeof data.current_status.at === 'string' ? data.current_status.at : undefined,
        }
      : { code: 'received', label: 'Захиалга авлаа' };
  const timeline = Array.isArray(data.timeline) ? (data.timeline as DeliveryTimelineEntry[]) : [];
  const last_update_at = typeof data.last_update_at === 'string' ? data.last_update_at : '';
  const payment_method = typeof data.payment_method === 'string' ? data.payment_method : undefined;
  const cod_confirmed = typeof data.cod_confirmed === 'boolean' ? data.cod_confirmed : undefined;
  const cod_confirmed_at = typeof data.cod_confirmed_at === 'string' ? data.cod_confirmed_at : undefined;
  return {
    current_status,
    timeline,
    last_update_at,
    version: typeof data.version === 'string' ? data.version : undefined,
    payment_method,
    cod_confirmed,
    cod_confirmed_at,
  } as DeliveryResponse;
}

/** POST /api/v1/orders/{id}/delivery/status – update delivery status (warehouse owner). Throws on 403 with code FORBIDDEN. */
export interface UpdateDeliveryStatusPayload {
  code: string;
}

export async function updateOrderDeliveryStatus(
  orderId: number,
  payload: UpdateDeliveryStatusPayload
): Promise<DeliveryResponse> {
  if (orderId == null || Number.isNaN(orderId)) {
    throw new Error('Order ID required');
  }
  const url = `/api/v1/orders/${orderId}/delivery/status`;
  const res = await api.post<ApiResponse<DeliveryResponse>>(url, payload);
  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message ?? 'Failed to update delivery status');
  }
  const data = body.data;
  if (data == null || typeof data !== 'object' || !data.current_status || !Array.isArray(data.timeline)) {
    throw new Error('Invalid delivery response');
  }
  return data as DeliveryResponse;
}

export async function cancelOrder(id: number): Promise<void> {
  await api.post(`/api/v1/orders/${id}/cancel`);
}

/** Lucky Wheel – GET /api/v1/lucky-wheel/eligibility?warehouse_id= */
const LUCKY_ELIGIBILITY_CACHE_MS = 60_000;
const eligibilityCache: Map<number, { data: LuckyEligibilityData; at: number }> = new Map();

export async function getLuckyEligibility(warehouseId: number): Promise<LuckyEligibilityData> {
  const cached = eligibilityCache.get(warehouseId);
  if (cached && Date.now() - cached.at < LUCKY_ELIGIBILITY_CACHE_MS) {
    return cached.data;
  }
  const res = await api.get<ApiResponse<LuckyEligibilityData>>('/api/v1/lucky-wheel/eligibility', {
    params: { warehouse_id: warehouseId },
  });
  const body = res.data;
  if (!body?.success || body.data == null) {
    throw new Error(body?.message ?? 'Eligibility check failed');
  }
  eligibilityCache.set(warehouseId, { data: body.data, at: Date.now() });
  return body.data;
}

/** Invalidate eligibility cache (e.g. after spin so credits refresh). */
export function invalidateLuckyEligibilityCache(warehouseId: number): void {
  eligibilityCache.delete(warehouseId);
}

/** Lucky Wheel – POST /api/v1/lucky-wheel/spin. Idempotency-Key required. */
export async function spinLuckyWheel(
  warehouseId: number,
  idempotencyKey: string
): Promise<LuckySpinResultData> {
  setIdempotencyKey(idempotencyKey);
  try {
    const res = await api.post<ApiResponse<LuckySpinResultData>>('/api/v1/lucky-wheel/spin', {
      warehouse_id: warehouseId,
    });
    const body = res.data;
    if (!body?.success || body.data == null) {
      throw new Error(body?.message ?? 'Spin failed');
    }
    return body.data;
  } finally {
    clearIdempotencyKey();
  }
}
