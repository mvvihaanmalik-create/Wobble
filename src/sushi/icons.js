// Hand-drawn style icons for the bar's UI. Chunky shapes, warm ink outlines,
// flat fills with one highlight, the way a cozy cooking game draws them.

const INK = '#3b2417';
const o = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body, vb = '0 0 48 48') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export function starPath(cx, cy, r1, r2) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return `${d}Z`;
}

export const ICONS = {
  // Pochi, the shiba sous chef, in his toque.
  pochi: svg(`
    <path d="M8 24 L10 8 L21 16Z" fill="#eb9c56" ${o}/><path d="M11.5 13 L12.5 19 L17 17Z" fill="#fff1de"/>
    <path d="M40 24 L38 8 L27 16Z" fill="#eb9c56" ${o}/><path d="M36.5 13 L35.5 19 L31 17Z" fill="#fff1de"/>
    <ellipse cx="24" cy="29" rx="18" ry="15" fill="#eb9c56" ${o}/>
    <ellipse cx="24" cy="34" rx="10.5" ry="8" fill="#fff4e4"/>
    <ellipse cx="17.5" cy="22.5" rx="2" ry="1.3" fill="#fff4e4"/><ellipse cx="30.5" cy="22.5" rx="2" ry="1.3" fill="#fff4e4"/>
    <circle cx="17" cy="28" r="2.8" fill="${INK}"/><circle cx="31" cy="28" r="2.8" fill="${INK}"/>
    <circle cx="18" cy="27" r="1" fill="#fff"/><circle cx="32" cy="27" r="1" fill="#fff"/>
    <ellipse cx="11.5" cy="33" rx="3" ry="1.8" fill="#ff8fa8" opacity=".7"/><ellipse cx="36.5" cy="33" rx="3" ry="1.8" fill="#ff8fa8" opacity=".7"/>
    <ellipse cx="24" cy="31.5" rx="2.2" ry="1.5" fill="${INK}"/>
    <path d="M20.5 34.5 q1.75 2 3.5 0 q1.75 2 3.5 0" fill="none" ${o} stroke-width="1.8"/>
    <path d="M16 15 h16 v-3 h-16Z" fill="#fff" ${o}/>
    <circle cx="18.5" cy="8.5" r="4.5" fill="#fff" ${o}/><circle cx="29.5" cy="8.5" r="4.5" fill="#fff" ${o}/><circle cx="24" cy="6" r="5.5" fill="#fff" ${o}/>
    <path d="M17.5 12 h13" stroke="#fff" stroke-width="3"/>`),

  coin: svg(`
    <circle cx="24" cy="25.5" r="19" fill="#c97a0e" ${o}/>
    <circle cx="24" cy="23" r="19" fill="#ffc83d" ${o}/>
    <circle cx="24" cy="23" r="13.5" fill="none" stroke="#e8a321" stroke-width="2.4"/>
    <path d="M17.5 14.5 L24 23 L30.5 14.5 M24 23 V32.5 M18.5 24.5 H29.5 M18.5 28.5 H29.5" fill="none" stroke="#9a5a08" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 17 a13 13 0 0 1 8 -7" fill="none" stroke="#fff3c4" stroke-width="2.6" stroke-linecap="round"/>`),

  heart: svg(`<path d="M24 41 C8 31 4 22 8 14 C12 7 21 8 24 15 C27 8 36 7 40 14 C44 22 40 31 24 41Z" fill="#ff5c7a" ${o}/><path d="M12 16 a6 6 0 0 1 6 -4" fill="none" stroke="#ffd0da" stroke-width="2.6" stroke-linecap="round"/>`),

  plate: svg(`<ellipse cx="24" cy="30" rx="19" ry="9" fill="#fff8ea" ${o}/><ellipse cx="24" cy="26" rx="11" ry="6" fill="#fff" ${o}/><path d="M13 24 C14 16 34 16 35 24 C30 21 18 21 13 24Z" fill="#ff7a45" ${o}/><path d="M18 20 l3 3 M24 19 l3 3 M30 20 l2 2.5" stroke="#ffd2b8" stroke-width="2" stroke-linecap="round"/>`),

  plateEmpty: svg(`<ellipse cx="24" cy="30" rx="19" ry="9" fill="#ead9bb" stroke="#b89a7a" stroke-width="2.6"/><ellipse cx="24" cy="28.5" rx="11" ry="5" fill="none" stroke="#d2bb96" stroke-width="2"/>`),

  soundOn: svg(`<path d="M9 19 h7 l9 -8 v26 l-9 -8 h-7Z" fill="#fff8ea" ${o}/><path d="M31 18 q4 6 0 12 M35.5 14 q7 10 0 20" fill="none" ${o}/>`),
  music: svg(`<path d="M19 33 V12 l18 -4 v21" fill="none" ${o} stroke-width="3.4"/><path d="M19 15 l18 -4" ${o} stroke-width="5"/><ellipse cx="14.5" cy="33.5" rx="5.5" ry="4.5" fill="#fff8ea" ${o}/><ellipse cx="32.5" cy="29.5" rx="5.5" ry="4.5" fill="#fff8ea" ${o}/>`),
  musicOff: svg(`<path d="M19 33 V12 l18 -4 v21" fill="none" ${o} stroke-width="3.4"/><ellipse cx="14.5" cy="33.5" rx="5.5" ry="4.5" fill="#fff8ea" ${o}/><ellipse cx="32.5" cy="29.5" rx="5.5" ry="4.5" fill="#fff8ea" ${o}/><path d="M8 8 L40 40" stroke="#e2483a" stroke-width="4.6" stroke-linecap="round"/>`),
  udon: svg(`<path d="M6 22 h36 a18 16 0 0 1 -36 0Z" fill="#e2483a" ${o}/><path d="M9 22 C13 17 19 24 24 18 C29 24 35 17 39 22" fill="none" stroke="#fff6e0" stroke-width="3.2" stroke-linecap="round"/><path d="M12 22 C16 14 22 20 26 15 C30 20 34 15 37 19" fill="none" stroke="#fff6e0" stroke-width="2.6" stroke-linecap="round"/><path d="M6 22 h36" ${o}/><path d="M17 38 h14" ${o}/><path d="M30 6 L36 20 M35 5 L39 19" ${o} stroke-width="2.4"/>`),
  gyoza: svg(`<path d="M6 30 C6 18 16 12 24 12 C32 12 42 18 42 30 C36 34 12 34 6 30Z" fill="#f6eedc" ${o}/><path d="M7 30 C13 34 35 34 41 30 C38 36 10 36 7 30Z" fill="#c9792a" ${o}/><path d="M12 19 l3 4 M18 15 l2 5 M24 13.5 v5 M30 15 l-2 5 M36 19 l-3 4" ${o} stroke-width="2.2"/>`),
  ramen: svg(`<path d="M6 22 h36 a18 16 0 0 1 -36 0Z" fill="#2f4f8a" ${o}/><path d="M9 22 c2 -3 4 3 6 0 s4 3 6 0 s4 3 6 0 s4 3 6 0 s4 3 5 0" fill="none" stroke="#f5d66a" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="17" r="5" fill="#fdfaf5" ${o} stroke-width="2.2"/><path d="M16 17 m-2 0 a2 2 0 1 1 2 2" fill="none" stroke="#ff5c8a" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="31" cy="18" rx="5.5" ry="4" fill="#fbf5ea" ${o} stroke-width="2.2"/><circle cx="31" cy="18" r="2.2" fill="#f39a1e"/><path d="M6 22 h36" ${o}/><path d="M17 38 h14" ${o}/>`),
  takoyaki: svg(`<path d="M5 30 h38 l-4 8 h-30Z" fill="#ecd6a8" ${o}/><circle cx="14" cy="25" r="7" fill="#c9802e" ${o}/><circle cx="24" cy="22" r="7" fill="#c9802e" ${o}/><circle cx="34" cy="25" r="7" fill="#c9802e" ${o}/><path d="M9 22 q5 -4 10 0 M19 19 q5 -4 10 0 M29 22 q5 -4 10 0" fill="none" stroke="#5a2610" stroke-width="3" stroke-linecap="round"/><path d="M10 25 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3" fill="none" stroke="#fff6dc" stroke-width="1.6" stroke-linecap="round"/>`),
  onigiri: svg(`<path d="M24 6 C29 6 42 28 41 34 C40 40 8 40 7 34 C6 28 19 6 24 6Z" fill="#fffdf6" ${o}/><path d="M13 30 h22 v8 c-6 2 -16 2 -22 0Z" fill="#1f2a1c" ${o} stroke-width="2.2"/><circle cx="24" cy="19" r="3.4" fill="#d63a4a"/>`),
  stove: svg(`<rect x="5" y="33" width="38" height="9" rx="3" fill="#f2e9da" ${o}/><path d="M10 33 v-14 h28 v14" fill="#dfe3e8" ${o}/><path d="M8 19 h32" ${o} stroke-width="3.2"/><path d="M13 14 q2 -4 0 -7 M24 13 q2 -4 0 -7 M35 14 q2 -4 0 -7" fill="none" stroke="#b6c3cc" stroke-width="2.4" stroke-linecap="round"/><circle cx="15" cy="37.5" r="2" fill="#e2483a"/><circle cx="33" cy="37.5" r="2" fill="#e2483a"/>`),
  soundOff: svg(`<path d="M9 19 h7 l9 -8 v26 l-9 -8 h-7Z" fill="#fff8ea" ${o}/><path d="M31 19 l9 10 M40 19 l-9 10" fill="none" ${o}/>`),
  pause: svg(`<rect x="13" y="11" width="8" height="26" rx="3" fill="#fff8ea" ${o}/><rect x="27" y="11" width="8" height="26" rx="3" fill="#fff8ea" ${o}/>`),
  record: svg(`<circle cx="24" cy="24" r="15" fill="#fff8ea" ${o}/><circle cx="24" cy="24" r="8.5" fill="#e2483a" ${o}/>`),
  camera: svg(`<path d="M8 17 h8 l3 -5 h10 l3 5 h8 v20 h-32Z" fill="#fff8ea" ${o}/><circle cx="24" cy="26" r="7" fill="#7fb6e6" ${o}/><circle cx="22" cy="24" r="2" fill="#fff"/>`),

  lock: svg(`<path d="M16 22 v-5 a8 8 0 0 1 16 0 v5" fill="none" ${o} stroke-width="3.4"/><rect x="11" y="21" width="26" height="20" rx="5" fill="#ffc83d" ${o}/><circle cx="24" cy="30" r="2.6" fill="${INK}"/><path d="M24 31 v4" ${o}/>`),
  check: svg(`<path d="M12 25 l8 8 l16 -18" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),

  // Stations.
  counter: svg(`<rect x="11" y="6" width="26" height="36" rx="3" fill="#fff8ea" ${o}/><path d="M11 12 h26" stroke="#e2483a" stroke-width="5"/><path d="M11 6 h26 v6 h-26Z" fill="none" ${o}/><path d="M17 20 h14 M17 26 h14 M17 32 h8" ${o}/>`),
  rice: svg(`<path d="M10 20 C10 10 38 10 38 20Z" fill="#fff" ${o}/><circle cx="18" cy="15" r="1.4" fill="#e9dfc8"/><circle cx="25" cy="13" r="1.4" fill="#e9dfc8"/><circle cx="31" cy="16" r="1.4" fill="#e9dfc8"/><path d="M6 20 h36 a18 18 0 0 1 -36 0Z" fill="#2f4a7a" ${o}/><path d="M11 25 a14 14 0 0 0 8 9" fill="none" stroke="#5f80b8" stroke-width="2.6" stroke-linecap="round"/><path d="M17 38 h14" ${o}/>`),
  knife: svg(`<path d="M7 31 L33 9 C38 6 42 10 38 15 L17 34Z" fill="#e7edf3" ${o}/><path d="M12 30 L33 12" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M17 34 L11 40 a3 3 0 0 1 -4 -4 L13 30Z" fill="#a8693a" ${o}/>`),
  build: svg(`<ellipse cx="24" cy="31" rx="17" ry="8" fill="#fff" ${o}/><path d="M7 27 C8 15 40 15 41 27 C33 23 15 23 7 27Z" fill="#ff7a45" ${o}/><path d="M14 22 l4 4 M22 20 l4 4 M30 21 l3 3.5" stroke="#ffd2b8" stroke-width="2.4" stroke-linecap="round"/><path d="M5 40 h38" ${o}/>`),

  tamago: svg(`<path d="M7 20 L37 16 L41 30 L11 35Z" fill="#ffd84f" ${o}/><path d="M7 20 L37 16 L38 20 L8 24.5Z" fill="#e2a33a" ${o}/><path d="M10 29 L39 25" stroke="#f6b92a" stroke-width="2.4" stroke-linecap="round"/>`),
  tuna: svg(`<path d="M6 30 C8 16 40 12 42 22 C40 30 12 38 6 30Z" fill="#b8283a" ${o}/><path d="M14 22 l5 7 M22 19 l5 7 M30 17 l4 6" stroke="#e8939c" stroke-width="2.2" stroke-linecap="round"/>`),

  unagi: svg(`<path d="M6 30 C8 16 40 12 42 22 C40 30 12 38 6 30Z" fill="#b8642a" ${o}/><path d="M13 21 l3 10 M21 18 l3 10 M29 16 l3 9" stroke="#5a2410" stroke-width="2.6" stroke-linecap="round"/><path d="M12 22 c6 -4 14 -6 22 -6" fill="none" stroke="#ffd09a" stroke-width="2" stroke-linecap="round"/>`),
  maki: svg(`<ellipse cx="24" cy="31" rx="15" ry="8" fill="#1d2416" ${o}/><path d="M9 21 v10 a15 8 0 0 0 30 0 v-10" fill="#1d2416" ${o}/><ellipse cx="24" cy="21" rx="15" ry="8" fill="#fffaf0" ${o}/><ellipse cx="24" cy="21" rx="15" ry="8" fill="none" stroke="#1d2416" stroke-width="3"/><ellipse cx="25" cy="21" rx="5.5" ry="3.2" fill="#ff6a3a" ${o} stroke-width="2"/>`),
  roll: svg(`<rect x="7" y="16" width="34" height="16" rx="8" fill="#1d2416" ${o}/><ellipse cx="38" cy="24" rx="5" ry="8" fill="#fffaf0" ${o}/><ellipse cx="38.5" cy="24" rx="2" ry="3.2" fill="#5fa832"/>`),
  nori: svg(`<rect x="10" y="8" width="28" height="32" rx="3" fill="#1d2416" ${o}/><path d="M15 14 h18 M15 20 h18 M15 26 h18 M15 32 h18" stroke="#3d4a2a" stroke-width="2" stroke-linecap="round"/>`),
  cucumber: svg(`<circle cx="24" cy="24" r="16" fill="#3f8a22" ${o}/><circle cx="24" cy="24" r="12" fill="#d8f0a8"/><circle cx="24" cy="24" r="5" fill="#f4fbe0" stroke="#b8d88a" stroke-width="1.6"/>`),
  flame: svg(`<path d="M24 5 C30 14 38 18 38 29 a14 14 0 0 1 -28 0 C10 22 16 18 18 12 C20 17 22 18 24 18 C24 12 22 9 24 5Z" fill="#ff7a2a" ${o}/><path d="M24 22 C28 26 31 28 31 32 a7 7 0 0 1 -14 0 C17 28 21 26 24 22Z" fill="#ffd34a"/>`),

  // Toppings.
  wasabi: svg(`<path d="M10 31 C8 22 16 15 23 17 C27 11 38 14 38 23 C43 27 39 36 31 35 C25 39 13 38 10 31Z" fill="#8cc63f" ${o}/><path d="M16 24 c2 -3 5 -4 8 -3" fill="none" stroke="#d6f0a8" stroke-width="2.6" stroke-linecap="round"/>`),
  fish: svg(`<path d="M6 30 C8 16 40 12 42 22 C40 30 12 38 6 30Z" fill="#ff7a45" ${o}/><path d="M14 22 l5 7 M22 19 l5 7 M30 17 l4 6" stroke="#ffd2b8" stroke-width="2.6" stroke-linecap="round"/>`),
  ikura: svg(`<circle cx="17" cy="28" r="8" fill="#ff6a1a" ${o}/><circle cx="31" cy="28" r="8" fill="#ff6a1a" ${o}/><circle cx="24" cy="17" r="8" fill="#ff6a1a" ${o}/><circle cx="14.5" cy="25.5" r="2.4" fill="#ffd9b0"/><circle cx="28.5" cy="25.5" r="2.4" fill="#ffd9b0"/><circle cx="21.5" cy="14.5" r="2.4" fill="#ffd9b0"/>`),
  sesame: svg(`<g fill="#f3e2b8" ${o} stroke-width="2.2"><ellipse cx="15" cy="18" rx="3.4" ry="5.4" transform="rotate(-30 15 18)"/><ellipse cx="29" cy="15" rx="3.4" ry="5.4" transform="rotate(25 29 15)"/><ellipse cx="22" cy="29" rx="3.4" ry="5.4" transform="rotate(80 22 29)"/><ellipse cx="35" cy="31" rx="3.4" ry="5.4" transform="rotate(-10 35 31)"/><ellipse cx="12" cy="34" rx="3.4" ry="5.4" transform="rotate(40 12 34)"/></g>`),
  scallion: svg(`<g fill="#c9eba0" ${o} stroke-width="2.4"><circle cx="16" cy="18" r="7"/><circle cx="31" cy="21" r="7"/><circle cx="21" cy="32" r="7"/></g><g fill="#fffbe8"><circle cx="16" cy="18" r="3"/><circle cx="31" cy="21" r="3"/><circle cx="21" cy="32" r="3"/></g>`),
  sauce: svg(`<path d="M24 6 C30 16 37 23 37 30 a13 13 0 0 1 -26 0 C11 23 18 16 24 6Z" fill="#5a2a12" ${o}/><path d="M17 29 a7 7 0 0 0 4 7" fill="none" stroke="#b8714a" stroke-width="2.6" stroke-linecap="round"/>`),
};

export function star(on) {
  return svg(`<path d="${starPath(24, 26, 20, 9)}" fill="${on ? '#c97a0e' : '#5b3a22'}" ${o}/><path d="${starPath(24, 23.5, 20, 9)}" fill="${on ? '#ffc83d' : '#8a6a52'}" ${o}/>${on ? '<path d="M17 16 l3 -1" stroke="#fff6cf" stroke-width="2.6" stroke-linecap="round"/>' : ''}`);
}
