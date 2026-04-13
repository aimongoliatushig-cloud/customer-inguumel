import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const normalizedBaseUrl = (extra.apiBaseUrl ?? 'http://127.0.0.1:8069').replace(/\/$/, '');

/** Base URL for API client. Paths include /api/v1/... already, so keep host only. */
export const config = {
  apiBaseUrl: normalizedBaseUrl,
  get baseUrl() {
    return this.apiBaseUrl;
  },
  env: extra.env ?? 'development',
  registerEndpoint: extra.registerEndpoint ?? '/api/v1/auth/register',
  loginEndpoint: extra.loginEndpoint ?? '/api/v1/auth/login',
  deleteAccountEndpoint:
    extra.deleteAccountEndpoint ?? '/api/v1/auth/account/delete',
  privacyPolicyUrl:
    extra.privacyPolicyUrl ?? `${normalizedBaseUrl}/legal/privacy-policy`,
  termsUrl: extra.termsUrl ?? `${normalizedBaseUrl}/legal/terms`,
  accountDeletionUrl:
    extra.accountDeletionUrl ?? `${normalizedBaseUrl}/legal/account-deletion`,
};

export const REGISTER_ENDPOINT = config.registerEndpoint;
export const LOGIN_ENDPOINT = config.loginEndpoint;

export const isDev = config.env === 'development';

export const API_TIMEOUT_MS = 30_000;
