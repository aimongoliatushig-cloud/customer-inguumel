/**
 * Single source of truth for Bearer token (persistence).
 * AsyncStorage read is allowed ONLY in hydrate() – request path reads memory cache in client.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@inguumel_access_token';

export async function getAccessToken(): Promise<string | null> {
  const v = await AsyncStorage.getItem(TOKEN_KEY);
  return v != null && v !== '' ? v : null;
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (token != null && token !== '') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function clearAccessToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
