import { routeForUrl } from '@/lib/deeplinks';

/**
 * Normalises incoming OS links (universal links, app links, cnm://) before
 * Expo Router matches them: strips trailing slashes / tracking params and maps
 * website paths to app routes. Unknown paths pass through (→ +not-found).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return routeForUrl(path) ?? path;
  } catch {
    return path;
  }
}
