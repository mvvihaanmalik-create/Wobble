import { GAME } from './config.js';

// The wall: everyone's plates and the best shifts. Talks to api/gallery when
// the server has storage; otherwise keeps this player's own shifts locally.

const LOCAL = `${GAME.storageKey}.wall`;
const NAME = `${GAME.storageKey}.name`;
const API = 'api/gallery';

function readLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL));
    if (v && Array.isArray(v.plates) && Array.isArray(v.leaders)) return v;
  } catch {
    // Storage blocked or corrupt; start fresh.
  }
  return { plates: [], leaders: [] };
}

function writeLocal(v) {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(v));
  } catch {
    // Full or blocked. The wall still works for this visit.
  }
}

export function savedName() {
  try {
    return localStorage.getItem(NAME) || '';
  } catch {
    return '';
  }
}

function saveName(name) {
  try {
    localStorage.setItem(NAME, name);
  } catch {
    // Not important.
  }
}

function withTimeout(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export async function loadWall() {
  try {
    const r = await fetch(API, { cache: 'no-store', signal: withTimeout(6000) });
    const j = await r.json();
    if (r.ok && j.shared) return { ...j, shared: true };
  } catch {
    // Offline, or no server function: fall through to local.
  }
  return { ...readLocal(), shared: false };
}

// run: { name, day, tips, avg, plates: [{ img, score, guest, species }] }
export async function postRun(run) {
  const name = run.name.trim().slice(0, 16) || 'Anon';
  saveName(name);
  const plates = await Promise.all(run.plates.map(async (p) => ({ ...p, img: await shrink(p.img, 320, 200) })));
  const body = { ...run, name, plates };
  const id = `local-${Date.now().toString(36)}`;
  // Keep a local copy either way, so the player always sees their shifts.
  const local = readLocal();
  const at = Date.now();
  local.plates = [...plates.map((p, i) => ({ ...p, id: `${id}-${i}`, run: id, name, day: run.day, at })), ...local.plates].slice(0, 18);
  local.leaders = [...local.leaders, { id, name, day: run.day, tips: run.tips, avg: run.avg, at }].sort((a, b) => b.tips - a.tips).slice(0, 10);
  writeLocal(local);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: withTimeout(10000) });
    const j = await r.json();
    if (r.ok && j.shared) return { ...j, shared: true };
    return { ...local, shared: false, id, rank: local.leaders.findIndex((e) => e.id === id) + 1, error: j.error };
  } catch {
    return { ...local, shared: false, id, rank: local.leaders.findIndex((e) => e.id === id) + 1 };
  }
}

// Smaller JPEG for posting: plate photos are 480 wide, the wall shows 320.
function shrink(url, w, h) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}
