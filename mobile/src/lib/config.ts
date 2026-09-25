import Constants from 'expo-constants';

export const DEFAULT_API_BASE_URL = 'https://cnm-essentials-staging.netlify.app';

/** EXPO_PUBLIC_* vars are inlined at build time by Metro. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

export const IS_STAGING = /staging|localhost|127\.0\.0\.1|deploy-preview/i.test(API_BASE_URL);

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export const WEB_BASE_URL = 'https://cnmessentials.com';
