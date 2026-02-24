import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setWarehouseId as appStateSetWarehouseId } from '~/storage/appState';
import { cartStore } from '~/store/cartStore';

const AIMAG_KEY = '@inguumel_aimag_id';
const SUM_KEY = '@inguumel_sum_id';
const WAREHOUSE_KEY = '@inguumel_warehouse_id';
const AIMAG_NAME_KEY = '@inguumel_aimag_name';
const SOUM_NAME_KEY = '@inguumel_soum_name';
const WAREHOUSE_NAME_KEY = '@inguumel_warehouse_name';

export interface LocationNames {
  aimag_name?: string;
  soum_name?: string;
  warehouse_name?: string;
}

interface LocationState {
  aimag_id: number | null;
  sum_id: number | null;
  warehouse_id: number | null;
  aimag_name: string | null;
  soum_name: string | null;
  warehouse_name: string | null;
  hydrated: boolean;
  setLocation: (aimagId: number, sumId: number) => Promise<void>;
  setWarehouse: (warehouseId: number, names?: LocationNames) => Promise<void>;
  clearWarehouse: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Resolve warehouse_id from store or AsyncStorage (for checkout when store may not be hydrated yet). */
  getWarehouseIdAsync: () => Promise<number | null>;
}

export const locationStore = create<LocationState>((set, get) => ({
  aimag_id: null,
  sum_id: null,
  warehouse_id: null,
  aimag_name: null,
  soum_name: null,
  warehouse_name: null,
  hydrated: false,

  /** Persist aimag/soum locally only (no backend call). Clears warehouse until user selects. */
  setLocation: async (aimagId: number, sumId: number) => {
    set({ aimag_id: aimagId, sum_id: sumId, warehouse_id: null, aimag_name: null, soum_name: null, warehouse_name: null });
    await AsyncStorage.setItem(AIMAG_KEY, String(aimagId));
    await AsyncStorage.setItem(SUM_KEY, String(sumId));
    await AsyncStorage.removeItem(WAREHOUSE_KEY);
    await AsyncStorage.removeItem(AIMAG_NAME_KEY);
    await AsyncStorage.removeItem(SOUM_NAME_KEY);
    await AsyncStorage.removeItem(WAREHOUSE_NAME_KEY);
    await appStateSetWarehouseId(null);
    cartStore.getState().resetCart();
  },

  setWarehouse: async (warehouseId: number, names?: LocationNames) => {
    const aimag_name = names?.aimag_name ?? null;
    const soum_name = names?.soum_name ?? null;
    const warehouse_name = names?.warehouse_name ?? null;
    set({ warehouse_id: warehouseId, aimag_name, soum_name, warehouse_name });
    await AsyncStorage.setItem(WAREHOUSE_KEY, String(warehouseId));
    if (aimag_name != null) await AsyncStorage.setItem(AIMAG_NAME_KEY, aimag_name);
    else await AsyncStorage.removeItem(AIMAG_NAME_KEY);
    if (soum_name != null) await AsyncStorage.setItem(SOUM_NAME_KEY, soum_name);
    else await AsyncStorage.removeItem(SOUM_NAME_KEY);
    if (warehouse_name != null) await AsyncStorage.setItem(WAREHOUSE_NAME_KEY, warehouse_name);
    else await AsyncStorage.removeItem(WAREHOUSE_NAME_KEY);
    await appStateSetWarehouseId(warehouseId);
    cartStore.getState().resetCart();
  },

  /** Clear warehouse (and location names). Resets cart. RootNavigator will show LocationSelectScreen. */
  clearWarehouse: async () => {
    set({ warehouse_id: null, aimag_name: null, soum_name: null, warehouse_name: null });
    await AsyncStorage.removeItem(WAREHOUSE_KEY);
    await AsyncStorage.removeItem(AIMAG_NAME_KEY);
    await AsyncStorage.removeItem(SOUM_NAME_KEY);
    await AsyncStorage.removeItem(WAREHOUSE_NAME_KEY);
    await appStateSetWarehouseId(null);
    cartStore.getState().resetCart();
  },

  hydrate: async () => {
    const [aimagStr, sumStr, warehouseStr, aimagName, soumName, warehouseName] = await Promise.all([
      AsyncStorage.getItem(AIMAG_KEY),
      AsyncStorage.getItem(SUM_KEY),
      AsyncStorage.getItem(WAREHOUSE_KEY),
      AsyncStorage.getItem(AIMAG_NAME_KEY),
      AsyncStorage.getItem(SOUM_NAME_KEY),
      AsyncStorage.getItem(WAREHOUSE_NAME_KEY),
    ]);
    const aimag_id = aimagStr ? parseInt(aimagStr, 10) : null;
    const sum_id = sumStr ? parseInt(sumStr, 10) : null;
    const warehouse_id = warehouseStr ? parseInt(warehouseStr, 10) : null;
    set({
      aimag_id: Number.isNaN(aimag_id) ? null : aimag_id,
      sum_id: Number.isNaN(sum_id) ? null : sum_id,
      warehouse_id: Number.isNaN(warehouse_id) ? null : warehouse_id,
      aimag_name: aimagName ?? null,
      soum_name: soumName ?? null,
      warehouse_name: warehouseName ?? null,
      hydrated: true,
    });
  },

  getWarehouseIdAsync: async () => {
    const fromStore = get().warehouse_id;
    if (fromStore != null && !Number.isNaN(fromStore)) return fromStore;
    const stored = await AsyncStorage.getItem(WAREHOUSE_KEY);
    if (stored == null) return null;
    const id = parseInt(stored, 10);
    return Number.isNaN(id) ? null : id;
  },
}));
