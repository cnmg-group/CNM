// POST /api/recommend — scent finder. Body: { families[], room, moods[], budget, notes }.
import { recommend } from '../lib/ai/recommend.mjs';
import { productsMap } from '../lib/catalogue.mjs';
import { assertCsrf, clientIp, fail, handler, json, readJson } from '../lib/http.mjs';
import { rateLimit } from '../lib/ratelimit.mjs';

export default handler(async (req, context) => {
  if (req.method !== 'POST') fail(405, 'method', 'Method not allowed.');
  assertCsrf(req);
  await rateLimit('ai', clientIp(req, context));
  const body = await readJson(req, 4 * 1024);
  const products = [...(await productsMap()).values()];
  const result = await recommend(products, body);
  return json(result);
});

export const config = { path: '/api/recommend' };
