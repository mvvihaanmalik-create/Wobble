import './style.css';
import { Game } from './game.js';

const bar = document.getElementById('loadBar');
const text = document.getElementById('loadText');
const step = (k, label) => {
  bar.style.width = `${Math.round(k * 100)}%`;
  bar.parentElement.setAttribute('aria-valuenow', String(Math.round(k * 100)));
  if (label) text.textContent = label;
  // Let the browser paint the progress before the next heavy step.
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
};

async function boot() {
  const t0 = performance.now();
  await step(0.15, 'Opening the shutters');
  await document.fonts.ready;
  await step(0.3, 'Washing the rice');
  performance.mark('fonts');
  const game = new Game(document.getElementById('gl'));
  performance.mark('game');
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.game = game;
  await step(0.45, 'Hanging the noren');
  // Compile every shader the bar will need now, behind this screen, so the
  // first minutes of play never hitch.
  await game.warmUp((k) => step(0.45 + k * 0.53, k < 0.35 ? 'Sharpening the knife' : k < 0.7 ? 'Warming the plates' : 'Lighting the lanterns'));
  performance.mark('warm');
  await step(1, 'Irasshaimase');
  window.__boot = { ready: Math.round(performance.now() - t0) };
  const loading = document.getElementById('loading');
  loading.classList.add('done');
  // Gone for good once the fade has had time, animation or not.
  setTimeout(() => loading.remove(), 700);
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('loading')?.classList.add('done');
  document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;left:16px;bottom:16px;font-family:monospace;color:#f7efe2">Could not start the bar. Try another browser.</p>');
});
