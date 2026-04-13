/**
 * Use API_BASE_URL (or EXPO_PUBLIC_API_BASE_URL) to point to stage, e.g.:
 * API_BASE_URL=http://192.168.1.100:8069 npx expo start
 */
const { expo } = require('./app.json');
const baseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  expo.extra?.apiBaseUrl ??
  'http://127.0.0.1:8069';
const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
const env =
  process.env.EXPO_PUBLIC_ENV ??
  process.env.NODE_ENV ??
  expo.extra?.env ??
  'development';
const privacyPolicyUrl =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ??
  expo.extra?.privacyPolicyUrl ??
  `${normalizedBaseUrl}/legal/privacy-policy`;
const termsUrl =
  process.env.EXPO_PUBLIC_TERMS_URL ??
  expo.extra?.termsUrl ??
  `${normalizedBaseUrl}/legal/terms`;
const accountDeletionUrl =
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL ??
  expo.extra?.accountDeletionUrl ??
  `${normalizedBaseUrl}/legal/account-deletion`;

module.exports = {
  expo: {
    ...expo,
    extra: {
      ...expo.extra,
      apiBaseUrl: baseUrl,
      env,
      privacyPolicyUrl,
      termsUrl,
      accountDeletionUrl,
    },
  },
};
