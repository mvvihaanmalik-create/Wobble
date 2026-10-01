import './style.css';
import { Game } from './game.js';

async function boot() {
  await document.fonts.ready;
  const game = new Game(document.getElementById('gl'));
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.game = game;
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;left:16px;bottom:16px;font-family:monospace;color:#f7efe2">Could not start the bar. Try another browser.</p>');
});
