import * as WebBrowser from 'expo-web-browser';

import { API_BASE_URL } from './config';
import { colors } from '@/theme';

/** Opens a page of the CNM website (same origin as the API) in an in-app browser. */
export function openWebPage(path: string) {
  return WebBrowser.openBrowserAsync(`${API_BASE_URL}${path}`, {
    controlsColor: colors.green,
    toolbarColor: colors.white,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => null);
}
