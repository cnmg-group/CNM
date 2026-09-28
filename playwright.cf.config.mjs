// Runs the browser tests against a Cloudflare Pages build served by `wrangler pages dev` on port 8787.
import base from './playwright.config.mjs';
export default { ...base, use: { ...base.use, baseURL: 'http://127.0.0.1:8787' }, webServer: undefined };
