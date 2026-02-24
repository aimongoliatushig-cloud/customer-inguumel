/**
 * Use API_BASE_URL (or EXPO_PUBLIC_API_BASE_URL) to point to stage, e.g.:
 * API_BASE_URL=http://192.168.1.100:8069 npx expo start
 */
const { expo } = require('./app.json');
const baseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  expo.extra?.apiBaseUrl ??
  'http://72.62.247.95:8069';
const env = process.env.EXPO_PUBLIC_ENV ?? process.env.NODE_ENV ?? expo.extra?.env ?? 'development';

module.exports = {
  expo: {
    ...expo,
    extra: {
      ...expo.extra,
      apiBaseUrl: baseUrl,
      env,
    },
  },
};
