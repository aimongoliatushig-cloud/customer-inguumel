/**
 * Single axios instance for ALL API calls (auth, mxm/categories, mxm/products, mxm/cart, etc.).
 * Bearer token ONLY; no cookies. Token from memory cache (sync); AsyncStorage read only in hydrate().
 * 401 / UNAUTHORIZED → one global logout (deduped). Cancelled requests → silent (no UI, no logout).
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { config, API_TIMEOUT_MS } from '~/constants/config';
import { DEVICE_ID, CLIENT_VERSION } from '~/constants/device';
import { normalizeError } from '~/utils/errors';
import type { AppError } from '~/types';

/** Memory token cache. Request interceptor reads ONLY this (sync). AsyncStorage read allowed ONLY in hydrate(). */
let memoryToken: string | null = null;

export function setMemoryToken(token: string | null): void {
  memoryToken = token != null && token !== '' ? token : null;
}

export function getMemoryToken(): string | null {
  return memoryToken;
}

let onGlobalLogout: (() => void) | null = null;

export function setGlobalLogoutCallback(cb: () => void): void {
  onGlobalLogout = cb;
}

/** Cancel all in-flight requests. Call on logout to avoid stale callbacks. */
let cancelSource = axios.CancelToken.source();

export function cancelAllPendingRequests(): void {
  cancelSource.cancel('LOGOUT');
  cancelSource = axios.CancelToken.source();
}

export function getCancelToken() {
  return cancelSource.token;
}

/** True if error is from axios cancel / AbortError. Do not show network error UI or trigger logout. */
export function isCancelError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  const e = err as { code?: string; message?: string; name?: string };
  return (
    e?.name === 'AbortError' ||
    e?.code === 'ERR_CANCELED' ||
    e?.message === 'canceled' ||
    e?.message === 'LOGOUT' ||
    (e as { __CANCEL__?: boolean }).__CANCEL__ === true
  );
}

/** Reject with CANCELLED so UI can treat silently (no error, no logout). */
const CANCELLED_CODE = 'CANCELLED';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: API_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': CLIENT_VERSION,
    'X-Device-Id': DEVICE_ID,
  },
});

function buildFinalUrl(baseURL: string | undefined, url: string | undefined, params?: Record<string, unknown>): string {
  const base = (baseURL ?? '').replace(/\/$/, '');
  const path = (url ?? '').startsWith('http') ? url! : base + (url?.startsWith('/') ? url : '/' + (url ?? ''));
  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) search.set(k, String(v));
    }
    const q = search.toString();
    return q ? `${path}?${q}` : path;
  }
  return path;
}

function maskToken(token: string | null): string {
  if (!token || token.length < 8) return token ? '***' : 'null';
  return token.slice(0, 8) + '...';
}

/** Request: attach Bearer from memory ONLY (sync, zero await). Instrumentation: method, url, authHeader, token mask. */
api.interceptors.request.use(
  (req: InternalAxiosRequestConfig) => {
    const token = getMemoryToken();
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    req.cancelToken = req.cancelToken ?? cancelSource.token;
    const method = (req.method ?? 'GET').toUpperCase();
    const url = buildFinalUrl(req.baseURL, req.url, req.params as Record<string, unknown> | undefined);
    const authHeader = !!(req.headers?.Authorization ?? req.headers?.authorization);
    // eslint-disable-next-line no-console
    console.log(`[HTTP OUT] ${method} ${url} authHeader=${authHeader} token=${maskToken(token)}`);
    return req;
  },
  (err) => Promise.reject(err)
);

/** Response: log status/code/url/request_id. 401 or UNAUTHORIZED → global logout. Cancel → silent reject. */
api.interceptors.response.use(
  (res) => {
    const body = res.data as Record<string, unknown> | undefined;
    const url = buildFinalUrl(res.config.baseURL, res.config.url, res.config.params as Record<string, unknown> | undefined);
    const apiCode = body?.code != null ? String(body.code) : '-';
    const requestId = body?.request_id != null ? String(body.request_id) : '-';
    // eslint-disable-next-line no-console
    console.log(`[HTTP IN] status=${res.status} apiCode=${apiCode} url=${url} request_id=${requestId}`);
    if (body && body.success === false && body.code === 'UNAUTHORIZED') {
      onGlobalLogout?.();
      return Promise.reject(
        Object.assign(new Error('UNAUTHORIZED'), {
          code: 'UNAUTHORIZED',
          status: 401,
          message: body.message ?? 'Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.',
        })
      );
    }
    return res;
  },
  (err: AxiosError) => {
    const url = err.config
      ? buildFinalUrl(err.config.baseURL, err.config.url, err.config.params as Record<string, unknown> | undefined)
      : '-';
    const status = err.response?.status ?? '-';
    const data = err.response?.data as Record<string, unknown> | undefined;
    const apiCode = data?.code != null ? String(data.code) : '-';
    const requestId = data?.request_id != null ? String(data.request_id) : '-';
    const message = data?.message != null ? String(data.message) : '-';
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[HTTP IN] endpoint=${url} status=${status} request_id=${requestId} code=${apiCode} message=${message}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[HTTP IN] status=${status} apiCode=${apiCode} url=${url} request_id=${requestId}`);
    }
    const isCanceled = isCancelError(err);
    if (isCanceled) {
      return Promise.reject(
        Object.assign(new Error('Request cancelled'), { code: CANCELLED_CODE, name: 'AbortError' })
      );
    }
    if (!err.response) {
      return Promise.reject(normalizeError(err, undefined));
    }
    const statusCode = err.response.status;
    const dataCode = data?.code === 'UNAUTHORIZED' || statusCode === 401;
    if (dataCode) {
      onGlobalLogout?.();
      return Promise.reject(
        Object.assign(new Error('UNAUTHORIZED'), {
          code: 'UNAUTHORIZED',
          status: 401,
          message: (data?.message as string) ?? 'Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.',
        })
      );
    }
    const appError: AppError = normalizeError(err, statusCode);
    return Promise.reject(appError);
  }
);

/** Sync axios default header. Token is always set from memory in request interceptor; this is for consistency. */
export function setApiToken(token: string | null): void {
  api.defaults.headers.common.Authorization = token ? `Bearer ${token}` : '';
}

export function setIdempotencyKey(key: string): void {
  api.defaults.headers.common['Idempotency-Key'] = key;
}

export function clearIdempotencyKey(): void {
  delete api.defaults.headers.common['Idempotency-Key'];
}
