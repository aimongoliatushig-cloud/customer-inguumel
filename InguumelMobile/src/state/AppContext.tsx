import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { setGlobalLogoutCallback } from '~/api/client';
import { getAuthMe } from '~/api/endpoints';
import { getToken, getWarehouseId } from '~/storage/appState';
import { authStore } from '~/store/authStore';
import { cartStore } from '~/store/cartStore';
import { locationStore } from '~/store/locationStore';
import type { LocationNames } from '~/store/locationStore';

const LOGOUT_MESSAGE = 'Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.';
const UNAUTHORIZED_ALERT_DEBOUNCE_MS = 30000;
const LOGOUT_GUARD_RELEASE_MS = 1000;

/** Singleton guard: avoid multiple logout flows and loops. */
let logoutInProgress = false;
/** Only one Alert per 30s. */
let lastUnauthorizedAt = 0;

interface AppContextValue {
  token: string | null;
  warehouseId: number | null;
  hydrated: boolean;
  setAuthToken: (token: string | null) => void;
  selectWarehouse: (warehouseId: number, names?: LocationNames) => Promise<void>;
  clearWarehouse: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [warehouseId, setWarehouseIdState] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const setTokenStateRef = useRef(setTokenState);
  setTokenStateRef.current = setTokenState;

  useEffect(() => {
    setGlobalLogoutCallback(() => {
      if (logoutInProgress) return;
      logoutInProgress = true;
      cartStore.getState().resetCart();
      authStore.getState().clearSessionOnly().then(() => {
        setTokenStateRef.current(null);
        const now = Date.now();
        if (now - lastUnauthorizedAt >= UNAUTHORIZED_ALERT_DEBOUNCE_MS) {
          lastUnauthorizedAt = now;
          Alert.alert('Нэвтрэлт дууссан', LOGOUT_MESSAGE);
        }
        setTimeout(() => {
          logoutInProgress = false;
        }, LOGOUT_GUARD_RELEASE_MS);
      });
    });
  }, []);

  /** On start and resume: load token, call /api/v1/auth/me ONCE. 401 → global logout. 200 → LOGGED_IN. */
  const checkAuthOnce = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setTokenState(null);
      return;
    }
    try {
      await getAuthMe();
      setTokenState(t);
      authStore.setState({ status: 'LOGGED_IN', token: t });
    } catch {
      setTokenState(await getToken());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([authStore.getState().hydrate(), locationStore.getState().hydrate()]);
      if (cancelled) return;
      const [t, w] = await Promise.all([getToken(), getWarehouseId()]);
      if (cancelled) return;
      setTokenState(t);
      setWarehouseIdState(w);
      setHydrated(true);
      await checkAuthOnce();
      if (cancelled) return;
      setTokenState(await getToken());
    })();
    return () => { cancelled = true; };
  }, [checkAuthOnce]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkAuthOnce().then(() => {
          getToken().then(setTokenState);
        });
      }
    });
    return () => sub.remove();
  }, [checkAuthOnce]);

  const setAuthToken = useCallback((t: string | null) => {
    setTokenState(t);
  }, []);

  const selectWarehouse = useCallback(async (id: number, names?: LocationNames) => {
    await locationStore.getState().setWarehouse(id, names);
    setWarehouseIdState(id);
  }, []);

  const clearWarehouse = useCallback(async () => {
    await locationStore.getState().clearWarehouse();
    setWarehouseIdState(null);
  }, []);

  const value: AppContextValue = {
    token,
    warehouseId,
    hydrated,
    setAuthToken,
    selectWarehouse,
    clearWarehouse,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
