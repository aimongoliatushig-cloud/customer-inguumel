/**
 * Auth state machine: LOGGED_OUT | LOGGED_IN | LOGGING_OUT (transient).
 * Bearer token ONLY; cookies/session_id ignored.
 * Warehouse owner: warehouse_ids from decoded token + /auth/me or /owner/me.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthMe, getMe, getOwnerMe, login as apiLogin, logout as apiLogout } from '~/api/endpoints';
import { setApiToken, setMemoryToken, cancelAllPendingRequests } from '~/api/client';
import { getAccessToken, setAccessToken, clearAccessToken } from '~/storage/tokenStorage';
import { setToken as appStateSetToken } from '~/storage/appState';
import { decodeJwtPayload } from '~/utils/jwt';
import type { LoginUser, OwnerWarehouse } from '~/types';

export type AuthStatus = 'LOGGED_OUT' | 'LOGGED_IN' | 'LOGGING_OUT';

const USER_KEY = '@inguumel_user';
const UID_KEY = '@inguumel_uid';
const PARTNER_ID_KEY = '@inguumel_partner_id';
const LAST_ORDER_PROFILE_KEY = '@inguumel_last_order_profile';
const LAST_ORDER_META_KEY = '@inguumel_last_order_meta';
const WAREHOUSE_IDS_KEY = '@inguumel_warehouse_ids';
const OWNER_WAREHOUSES_KEY = '@inguumel_owner_warehouses';

export const TOKEN_MISSING_CODE = 'TOKEN_MISSING';
export const AUTH_RESPONSE_MISSING_FIELDS_CODE = 'AUTH_RESPONSE_MISSING_FIELDS';

export interface LastOrderProfile {
  phone_primary: string;
  phone_secondary: string;
  delivery_address: string;
}

/** Last order meta – persisted after successful confirm for UI clarity and troubleshooting. */
export interface LastOrderMeta {
  last_order_payment_method: 'cod' | 'qpay';
  last_order_id: number;
  last_order_created_at: string;
  last_order_warehouse_id: number;
}

export interface OwnerWarehouseItem {
  id: number;
  name?: string | null;
}

interface AuthState {
  status: AuthStatus;
  uid: number | null;
  partner_id: number | null;
  token: string | null;
  user: LoginUser | null;
  /** Warehouse owner: IDs from token claims or /auth/me. Client does not rely on this for security; backend is source of truth. */
  warehouse_ids: number[];
  /** Warehouse owner: id + name for UI (from /auth/me or /owner/me). */
  owner_warehouses: OwnerWarehouseItem[];
  hydrated: boolean;
  login: (phone: string, pin: string) => Promise<string | null>;
  setSession: (access_token: string | null, user: LoginUser) => Promise<void>;
  logout: () => Promise<void>;
  /** Local-only: clear token and state, reset to Login. No API call. Used on 401. */
  clearSessionOnly: () => Promise<void>;
  hydrate: () => Promise<void>;
  setLastOrderProfile: (profile: LastOrderProfile) => Promise<void>;
  getLastOrderProfile: () => Promise<LastOrderProfile | null>;
  setLastOrderMeta: (meta: LastOrderMeta) => Promise<void>;
  getLastOrderMeta: () => Promise<LastOrderMeta | null>;
}

function normalizeOwnerWarehouses(raw: OwnerWarehouse[] | OwnerWarehouseItem[] | undefined): OwnerWarehouseItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((w) => ({
    id: Number(w.id),
    name: typeof w.name === 'string' ? w.name : (w.name ?? null),
  }));
}

export const authStore = create<AuthState>((set, get) => ({
  status: 'LOGGED_OUT',
  uid: null,
  partner_id: null,
  token: null,
  user: null,
  warehouse_ids: [],
  owner_warehouses: [],
  hydrated: false,

  login: async (phone: string, pin: string): Promise<string | null> => {
    const data = await apiLogin({ phone, pin });
    const uid = data?.uid;
    if (uid == null) {
      await AsyncStorage.removeItem(UID_KEY);
      await AsyncStorage.removeItem(PARTNER_ID_KEY);
      throw Object.assign(new Error('Login response missing required fields'), {
        code: AUTH_RESPONSE_MISSING_FIELDS_CODE,
      });
    }
    const partnerId = data?.partner_id ?? 0;
    const token =
      (data?.access_token != null && data?.access_token !== '')
        ? String(data.access_token)
        : (data?.token != null && data?.token !== '')
          ? String(data.token)
          : null;
    if (token == null || token === '') {
      throw Object.assign(new Error('Login response has no access_token'), { code: TOKEN_MISSING_CODE });
    }
    await AsyncStorage.setItem(UID_KEY, String(uid));
    await AsyncStorage.setItem(PARTNER_ID_KEY, String(partnerId));
    await setAccessToken(token);
    setMemoryToken(token);
    setApiToken(token);
    let warehouse_ids: number[] = [];
    const payload = decodeJwtPayload(token);
    if (payload?.warehouse_ids && Array.isArray(payload.warehouse_ids)) {
      warehouse_ids = payload.warehouse_ids.filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));
    }
    set({
      status: 'LOGGED_IN',
      uid: Number(uid),
      partner_id: Number(partnerId),
      token,
      user: data?.user ?? null,
      warehouse_ids,
      owner_warehouses: [],
    });
    if (data?.user != null) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    await AsyncStorage.setItem(WAREHOUSE_IDS_KEY, JSON.stringify(warehouse_ids));
    await appStateSetToken(token);
    try {
      await getAuthMe();
    } catch (err) {
      const e = err as { code?: string };
      await clearAccessToken();
      setMemoryToken(null);
      setApiToken(null);
      set({ status: 'LOGGED_OUT', token: null, uid: null, partner_id: null, user: null, warehouse_ids: [], owner_warehouses: [] });
      await appStateSetToken(null);
      await AsyncStorage.multiRemove([USER_KEY, UID_KEY, PARTNER_ID_KEY, WAREHOUSE_IDS_KEY, OWNER_WAREHOUSES_KEY]);
      if (e.code === 'UNAUTHORIZED') {
        throw Object.assign(new Error('Нэвтрэлт тогтоогүй'), { code: 'AUTH_ME_UNAUTHORIZED', status: 401 });
      }
      throw err;
    }
    try {
      const meRes = await getMe();
      const meData = meRes?.data;
      if (meData && typeof meData === 'object') {
        const fromMe = (meData as { warehouse_ids?: number[]; warehouses?: OwnerWarehouse[] }).warehouse_ids;
        const fromMeWarehouses = (meData as { warehouses?: OwnerWarehouse[] }).warehouses;
        if (Array.isArray(fromMe) && fromMe.length > 0) {
          warehouse_ids = fromMe;
          await AsyncStorage.setItem(WAREHOUSE_IDS_KEY, JSON.stringify(warehouse_ids));
        }
        const ownerWarehouses = normalizeOwnerWarehouses(fromMeWarehouses);
        if (ownerWarehouses.length > 0) {
          set((s) => ({ ...s, warehouse_ids, owner_warehouses: ownerWarehouses }));
          await AsyncStorage.setItem(OWNER_WAREHOUSES_KEY, JSON.stringify(ownerWarehouses));
        }
      }
    } catch {
      // optional: /auth/me profile may not include warehouses
    }
    try {
      const ownerMe = await getOwnerMe();
      if (ownerMe && Array.isArray(ownerMe.warehouse_ids) && ownerMe.warehouse_ids.length > 0) {
        warehouse_ids = ownerMe.warehouse_ids;
        await AsyncStorage.setItem(WAREHOUSE_IDS_KEY, JSON.stringify(warehouse_ids));
        const ownerWarehouses = normalizeOwnerWarehouses(ownerMe.warehouses);
        set((s) => ({ ...s, warehouse_ids, owner_warehouses: ownerWarehouses.length > 0 ? ownerWarehouses : s.owner_warehouses }));
        if (ownerWarehouses.length > 0) {
          await AsyncStorage.setItem(OWNER_WAREHOUSES_KEY, JSON.stringify(ownerWarehouses));
        }
      }
    } catch {
      // optional: /owner/me may 404 for non-owners
    }
    return token;
  },

  setSession: async (access_token: string | null, user: LoginUser) => {
    const token = access_token != null && access_token !== '' ? String(access_token) : null;
    if (token != null) {
      await setAccessToken(token);
      setMemoryToken(token);
      setApiToken(token);
      const payload = decodeJwtPayload(token);
      let warehouse_ids: number[] = [];
      if (payload?.warehouse_ids && Array.isArray(payload.warehouse_ids)) {
        warehouse_ids = payload.warehouse_ids.filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));
      }
      set({ status: 'LOGGED_IN', token, user, warehouse_ids, owner_warehouses: get().owner_warehouses });
      await AsyncStorage.setItem(WAREHOUSE_IDS_KEY, JSON.stringify(warehouse_ids));
    } else {
      await clearAccessToken();
      setMemoryToken(null);
      setApiToken(null);
      set({ status: 'LOGGED_OUT', token: null, user: null, warehouse_ids: [], owner_warehouses: [] });
      await AsyncStorage.multiRemove([WAREHOUSE_IDS_KEY, OWNER_WAREHOUSES_KEY]);
    }
    if (user != null) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    await appStateSetToken(token);
  },

  logout: async () => {
    set({ status: 'LOGGING_OUT' });
    cancelAllPendingRequests();
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    await clearAccessToken();
    setMemoryToken(null);
    setApiToken(null);
    await appStateSetToken(null);
    set({ status: 'LOGGED_OUT', uid: null, partner_id: null, token: null, user: null, warehouse_ids: [], owner_warehouses: [] });
    await AsyncStorage.multiRemove([USER_KEY, UID_KEY, PARTNER_ID_KEY, WAREHOUSE_IDS_KEY, OWNER_WAREHOUSES_KEY, LAST_ORDER_META_KEY]);
  },

  clearSessionOnly: async () => {
    set({ status: 'LOGGING_OUT' });
    cancelAllPendingRequests();
    await clearAccessToken();
    setMemoryToken(null);
    setApiToken(null);
    await appStateSetToken(null);
    set({ status: 'LOGGED_OUT', uid: null, partner_id: null, token: null, user: null, warehouse_ids: [], owner_warehouses: [] });
    await AsyncStorage.multiRemove([USER_KEY, UID_KEY, PARTNER_ID_KEY, WAREHOUSE_IDS_KEY, OWNER_WAREHOUSES_KEY, LAST_ORDER_META_KEY]);
  },

  setLastOrderProfile: async (profile: LastOrderProfile) => {
    try {
      await AsyncStorage.setItem(
        LAST_ORDER_PROFILE_KEY,
        JSON.stringify({
          phone_primary: profile.phone_primary ?? '',
          phone_secondary: profile.phone_secondary ?? '',
          delivery_address: profile.delivery_address ?? '',
        })
      );
    } catch {
      // ignore
    }
  },

  getLastOrderProfile: async (): Promise<LastOrderProfile | null> => {
    try {
      const raw = await AsyncStorage.getItem(LAST_ORDER_PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { phone_primary?: string; phone_secondary?: string; delivery_address?: string };
      return {
        phone_primary: parsed.phone_primary ?? '',
        phone_secondary: parsed.phone_secondary ?? '',
        delivery_address: parsed.delivery_address ?? '',
      };
    } catch {
      return null;
    }
  },

  setLastOrderMeta: async (meta: LastOrderMeta) => {
    try {
      await AsyncStorage.setItem(LAST_ORDER_META_KEY, JSON.stringify({
        last_order_payment_method: meta.last_order_payment_method ?? 'cod',
        last_order_id: meta.last_order_id,
        last_order_created_at: meta.last_order_created_at,
        last_order_warehouse_id: meta.last_order_warehouse_id,
      }));
    } catch {
      // ignore
    }
  },

  getLastOrderMeta: async (): Promise<LastOrderMeta | null> => {
    try {
      const raw = await AsyncStorage.getItem(LAST_ORDER_META_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        last_order_payment_method?: string;
        last_order_id?: number;
        last_order_created_at?: string;
        last_order_warehouse_id?: number;
      };
      const pm = (parsed.last_order_payment_method ?? 'cod').trim().toLowerCase();
      const paymentMethod = (pm === 'qpay' ? 'qpay' : 'cod') as 'cod' | 'qpay';
      const orderId = typeof parsed.last_order_id === 'number' && !Number.isNaN(parsed.last_order_id)
        ? parsed.last_order_id
        : 0;
      const warehouseId = typeof parsed.last_order_warehouse_id === 'number' && !Number.isNaN(parsed.last_order_warehouse_id)
        ? parsed.last_order_warehouse_id
        : 0;
      if (orderId <= 0) return null;
      return {
        last_order_payment_method: paymentMethod,
        last_order_id: orderId,
        last_order_created_at: parsed.last_order_created_at ?? new Date().toISOString(),
        last_order_warehouse_id: warehouseId,
      };
    } catch {
      return null;
    }
  },

  hydrate: async () => {
    const token = await getAccessToken();
    const [userStr, uidStr, partnerIdStr, warehouseIdsStr, ownerWarehousesStr] = await Promise.all([
      AsyncStorage.getItem(USER_KEY),
      AsyncStorage.getItem(UID_KEY),
      AsyncStorage.getItem(PARTNER_ID_KEY),
      AsyncStorage.getItem(WAREHOUSE_IDS_KEY),
      AsyncStorage.getItem(OWNER_WAREHOUSES_KEY),
    ]);
    let user: LoginUser | null = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr) as LoginUser;
      } catch {
        // ignore
      }
    }
    let warehouse_ids: number[] = [];
    if (warehouseIdsStr) {
      try {
        const parsed = JSON.parse(warehouseIdsStr) as unknown;
        warehouse_ids = Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number' && !Number.isNaN(id)) : [];
      } catch {
        // ignore
      }
    }
    if (warehouse_ids.length === 0 && token) {
      const payload = decodeJwtPayload(token);
      if (payload?.warehouse_ids && Array.isArray(payload.warehouse_ids)) {
        warehouse_ids = payload.warehouse_ids.filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));
      }
    }
    let owner_warehouses: OwnerWarehouseItem[] = [];
    if (ownerWarehousesStr) {
      try {
        const parsed = JSON.parse(ownerWarehousesStr) as unknown;
        owner_warehouses = normalizeOwnerWarehouses(Array.isArray(parsed) ? parsed : []);
      } catch {
        // ignore
      }
    }
    const uid = uidStr != null && uidStr !== '' ? Number(uidStr) : null;
    const partner_id = partnerIdStr != null && partnerIdStr !== '' ? Number(partnerIdStr) : null;
    const status: AuthStatus = token ? 'LOGGED_IN' : 'LOGGED_OUT';
    set({ status, uid, partner_id, token, user, warehouse_ids, owner_warehouses, hydrated: true });
    if (token) {
      setMemoryToken(token);
      setApiToken(token);
    } else {
      setMemoryToken(null);
      setApiToken(null);
    }
  },
}));
