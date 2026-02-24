import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredPrizeItem } from '~/types';

const WALLET_KEY_PREFIX = 'lucky_prize_wallet:';

function walletKey(warehouseId: number): string {
  return `${WALLET_KEY_PREFIX}${warehouseId}`;
}

/** Load prize wallet for warehouse from AsyncStorage. */
export async function getPrizeWallet(warehouseId: number): Promise<StoredPrizeItem[]> {
  const key = walletKey(warehouseId);
  const raw = await AsyncStorage.getItem(key);
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredPrizeItem[];
  } catch {
    return [];
  }
}

/** Save full prize wallet for warehouse. */
export async function setPrizeWallet(
  warehouseId: number,
  items: StoredPrizeItem[]
): Promise<void> {
  const key = walletKey(warehouseId);
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

/** Append one prize to wallet and persist. */
export async function appendPrizeToWallet(
  warehouseId: number,
  prize: StoredPrizeItem
): Promise<void> {
  const items = await getPrizeWallet(warehouseId);
  const state = getPrizeState(prize.expires_at);
  items.push({ ...prize, state });
  await setPrizeWallet(warehouseId, items);
}

/** Derive display state from expires_at. */
export function getPrizeState(expiresAt: string): 'pending' | 'claimed' | 'expired' {
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return 'pending';
  return exp < Date.now() ? 'expired' : 'pending';
}
