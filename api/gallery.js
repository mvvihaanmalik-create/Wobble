import { handle, storeFromEnv } from '../server/gallery-core.js';

// Vercel function for the shared wall. Needs a Redis REST store: add Upstash
// (or Vercel KV) to the project so KV_REST_API_URL and KV_REST_API_TOKEN, or
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, are set.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const store = storeFromEnv();
  if (!store) return res.status(503).json({ shared: false, error: 'The shared wall is not set up on this server.' });
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const visitor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'anon';
  const out = await handle(req.method, body, visitor, store);
  return res.status(out.status).json(out.json);
}
