// GET /api/media/:key — serves admin-uploaded media from Blobs (sandboxed, long-cached).
import { handler, json, segments } from '../lib/http.mjs';
import { store } from '../lib/store.mjs';

export default handler(async (req) => {
  const key = decodeURIComponent(segments(req)[2] || '');
  const rec = await (await store('media')).get(`file/${key}`);
  if (!rec) return json({ error: 'not_found' }, 404);
  const b64 = rec.data.includes(',') ? rec.data.split(',').pop() : rec.data;
  return new Response(Buffer.from(b64, 'base64'), {
    headers: { 'Content-Type': rec.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
  });
});

export const config = { path: '/api/media/:key' };
