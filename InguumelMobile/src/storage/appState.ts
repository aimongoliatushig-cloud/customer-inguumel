import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken, setAccessToken } from '~/storage/tokenStorage';

const WAREHOUSE_KEY = '@inguumel_warehouse_id';

/** Token is stored in tokenStorage (single source). This is a convenience for AppContext. */
export async function getToken(): Promise<string | null> {
  return getAccessToken();
}

export async function setToken(value: string | null): Promise<void> {
  await setAccessToken(value);
}

export async function getWarehouseId(): Promise<number | null> {
  const v = await AsyncStorage.getItem(WAREHOUSE_KEY);
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export async function setWarehouseId(value: number | null): Promise<void> {
  if (value != null) {
    await AsyncStorage.setItem(WAREHOUSE_KEY, String(value));
  } else {
    await AsyncStorage.removeItem(WAREHOUSE_KEY);
  }
}
