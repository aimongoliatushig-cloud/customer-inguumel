import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

/** Base URL for API client – NO trailing /api (paths include /api/v1/...). Single source: use config.baseUrl everywhere. */
export const config = {
  apiBaseUrl: extra.apiBaseUrl ?? 'http://72.62.247.95:8069',
  /** Alias for apiBaseUrl – use this so all requests go to one host (no 127.0.0.1 elsewhere). */
  get baseUrl() {
    return this.apiBaseUrl;
  },
  env: extra.env ?? 'development',
  /** Override in app.config.js extra if backend uses different paths */
  registerEndpoint: extra.registerEndpoint ?? '/api/v1/auth/register',
  loginEndpoint: extra.loginEndpoint ?? '/api/v1/auth/login',
};

export const REGISTER_ENDPOINT = config.registerEndpoint;
export const LOGIN_ENDPOINT = config.loginEndpoint;

export const isDev = config.env === 'development';

export const API_TIMEOUT_MS = 30_000;
