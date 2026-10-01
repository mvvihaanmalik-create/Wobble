// The shared wall: plate photos from every finished shift, and a board of the
// best shifts by tips. Storage is a Redis-compatible REST store (Upstash or
// Vercel KV). Nothing about the player is kept beyond the name they type.

import { createHash } from 'node:crypto';

export const LIMITS = {
  plates: 48, // newest plate photos kept
  leaders: 100, // shifts kept on the board
  show: { plates: 24, leaders: 10 },
  img: 60000, // max characters per photo data URL
  platesPerRun: 3,
  perMinute: 6, // posts per visitor per minute
};

const KEYS = { plates: 'squishi:plates', leaders: 'squishi:leaders', rate: 'squishi:rate:' };
const SPECIES = ['cat', 'shiba', 'bunny', 'bear', 'panda', 'fox'];

export function cleanName(s) {
  const name = String(s || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} ._'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name || 'Anon';
}

const int = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
};

const isPhoto = (s) => typeof s === 'string' && s.length <= LIMITS.img && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s);

export function validateRun(body) {
  if (!body || typeof body !== 'object') return { error: 'Bad request.' };
  const plates = Array.isArray(body.plates) ? body.plates.slice(0, LIMITS.platesPerRun) : [];
  const clean = plates
    .filter((p) => p && isPhoto(p.img))
    .map((p) => ({
      img: p.img,
      score: int(p.score, 0, 100),
      guest: cleanName(p.guest).slice(0, 12),
      species: SPECIES.includes(p.species) ? p.species : 'cat',
    }));
  if (!clean.length) return { error: 'No plates to post.' };
  return {
    run: {
      name: cleanName(body.name),
      day: int(body.day, 0, 2),
      tips: int(body.tips, 0, 99999),
      avg: int(body.avg, 0, 100),
      plates: clean,
    },
  };
}

const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function getWall(store) {
  const [plates, leaders] = await store.exec([
    ['LRANGE', KEYS.plates, 0, LIMITS.show.plates - 1],
    ['ZREVRANGE', KEYS.leaders, 0, LIMITS.show.leaders - 1],
  ]);
  return { plates: parseAll(plates), leaders: parseAll(leaders) };
}

export async function postRun(store, run) {
  const at = Date.now();
  const runId = id();
  const entry = { id: runId, name: run.name, day: run.day, tips: run.tips, avg: run.avg, at };
  const cmds = run.plates.map((p) => ['LPUSH', KEYS.plates, JSON.stringify({ id: id(), run: runId, name: run.name, day: run.day, at, ...p })]);
  cmds.push(['LTRIM', KEYS.plates, 0, LIMITS.plates - 1]);
  // Ties go to the earlier shift: a tiny fraction off for later posts.
  cmds.push(['ZADD', KEYS.leaders, run.tips - at / 1e14, JSON.stringify(entry)]);
  cmds.push(['ZREMRANGEBYRANK', KEYS.leaders, 0, -(LIMITS.leaders + 1)]);
  cmds.push(['ZREVRANGE', KEYS.leaders, 0, LIMITS.leaders - 1]);
  const res = await store.exec(cmds);
  const board = parseAll(res[res.length - 1]);
  const rank = board.findIndex((e) => e.id === runId);
  return { id: runId, rank: rank < 0 ? null : rank + 1 };
}

// One request in, one response out. Shared by the Vercel function and the
// dev server.
export async function handle(method, body, visitor, store) {
  try {
    if (method === 'GET') return { status: 200, json: { shared: true, ...(await getWall(store)) } };
    if (method !== 'POST') return { status: 405, json: { error: 'Use GET or POST.' } };
    const key = KEYS.rate + createHash('sha256').update(String(visitor)).digest('hex').slice(0, 16);
    const [count] = await store.exec([['INCR', key], ['EXPIRE', key, 60]]);
    if (count > LIMITS.perMinute) return { status: 429, json: { error: 'Too many posts. Try again in a minute.' } };
    const { run, error } = validateRun(body);
    if (error) return { status: 400, json: { error } };
    const out = await postRun(store, run);
    return { status: 200, json: { shared: true, ...out, ...(await getWall(store)) } };
  } catch (e) {
    return { status: 502, json: { error: 'The wall is not reachable right now.' } };
  }
}

function parseAll(list) {
  return (list || []).map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// Upstash / Vercel KV REST API: one pipeline request per call.
export function restStore(url, token) {
  return {
    async exec(commands) {
      const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands),
      });
      if (!r.ok) throw new Error(`store ${r.status}`);
      const out = await r.json();
      return out.map((x) => {
        if (x.error) throw new Error(x.error);
        return x.result;
      });
    },
  };
}

export function storeFromEnv(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? restStore(url, token) : null;
}

// In-memory stand-in with the same commands, for the dev server and tests.
export function memoryStore() {
  const lists = new Map();
  const zsets = new Map();
  const counters = new Map();
  const list = (k) => lists.get(k) || (lists.set(k, []), lists.get(k));
  const zset = (k) => zsets.get(k) || (zsets.set(k, []), zsets.get(k));
  const slice = (arr, a, b) => {
    const n = arr.length;
    const s = a < 0 ? Math.max(0, n + a) : a;
    const e = b < 0 ? n + b : Math.min(n - 1, b);
    return arr.slice(s, e + 1);
  };
  const run = ([cmd, k, ...a]) => {
    switch (cmd) {
      case 'LPUSH':
        list(k).unshift(...a.reverse());
        return list(k).length;
      case 'LTRIM':
        lists.set(k, slice(list(k), a[0], a[1]));
        return 'OK';
      case 'LRANGE':
        return slice(list(k), a[0], a[1]);
      case 'ZADD': {
        const z = zset(k).filter((e) => e.m !== a[1]);
        z.push({ s: Number(a[0]), m: a[1] });
        z.sort((x, y) => x.s - y.s);
        zsets.set(k, z);
        return 1;
      }
      case 'ZREMRANGEBYRANK': {
        const z = zset(k);
        const gone = slice(z, a[0], a[1]);
        zsets.set(k, z.filter((e) => !gone.includes(e)));
        return gone.length;
      }
      case 'ZREVRANGE':
        return slice([...zset(k)].reverse(), a[0], a[1]).map((e) => e.m);
      case 'INCR':
        counters.set(k, (counters.get(k) || 0) + 1);
        return counters.get(k);
      case 'EXPIRE':
        setTimeout(() => counters.delete(k), a[0] * 1000).unref?.();
        return 1;
      default:
        throw new Error(`unknown ${cmd}`);
    }
  };
  return { exec: async (commands) => commands.map(run) };
}
