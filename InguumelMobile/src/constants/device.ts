import Constants from 'expo-constants';

export const DEVICE_ID =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.deviceId ??
  Constants.sessionId ??
  `rn-${Constants.expoConfig?.slug ?? 'app'}-${Date.now()}`;

export const CLIENT_VERSION = '1.0.0';
