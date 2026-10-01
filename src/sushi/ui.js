import { DAYS, FISH, TOPPINGS } from './config.js';
import { describePiece } from './orders.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => `¥${n.toLocaleString('en-US')}`;

const TOOL_LIST = [
  { key: 'wasabi', label: 'Wasabi', color: '#9cbf43' },
  { key: 'fish', label: 'Fish', color: '#ff8a5a' },
  { key: 'ikura', label: 'Ikura', color: '#ff6a1a' },
  { key: 'sesame', label: 'Sesame', color: '#ead6a6' },
  { key: 'scallion', label: 'Scallion', color: '#7cc34a' },
  { key: 'sauce', label: 'Sauce', color: '#3a170a' },
];

export class GameUI {
  constructor(handlers) {
    this.h = handlers;
    this.hud = $('hud');
    document.querySelectorAll('#stations button').forEach((b) => b.addEventListener('click', () => this.h.onStation(b.dataset.station)));
    $('muteBtn').addEventListener('click', () => this.h.onMute());
    $('recBtn').addEventListener('click', () => this.h.onRecord());
    $('shotBtn').addEventListener('click', () => this.h.onPhoto());
    $('startBtn').addEventListener('click', () => this.h.onStart(this.selectedDay));
    $('wallBtn').addEventListener('click', () => this.h.onWall());
    $('wallClose').addEventListener('click', () => this.hideWall());
    $('wall').addEventListener('keydown', (e) => e.key === 'Escape' && this.hideWall());
    this.buildTools();
    this.selectedDay = 0;
  }

  // --- Title -----------------------------------------------------------------

  showTitle(progress) {
    this.hud.hidden = true;
    $('cardScreen').hidden = true;
    $('title').hidden = false;
    const list = $('dayList');
    list.innerHTML = '';
    this.selectedDay = Math.min(progress.unlocked, DAYS.length - 1);
    DAYS.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      const best = progress.best[i];
      b.innerHTML = `<span class="mono">${d.title}</span><span class="note">${d.note}</span><span class="mono">${i > progress.unlocked ? 'Locked' : best ? `Best ${yen(best)}` : 'New'}</span>`;
      b.disabled = i > progress.unlocked;
      b.setAttribute('aria-pressed', String(i === this.selectedDay));
      b.addEventListener('click', () => {
        this.selectedDay = i;
        list.querySelectorAll('.day').forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
      });
      list.appendChild(b);
    });
  }

  hideTitle() {
    $('title').hidden = true;
    this.hud.hidden = false;
  }

  // --- HUD -------------------------------------------------------------------

  setDay(i, served, total, tips) {
    $('dayLabel').textContent = DAYS[i].title;
    $('servedValue').textContent = `${served} / ${total}`;
    $('tipsValue').textContent = yen(tips);
  }

  setMuted(m) {
    $('muteBtn').setAttribute('aria-pressed', String(!m));
    $('muteBtn').textContent = m ? 'Muted' : 'Sound';
  }

  setStation(name, status) {
    document.querySelectorAll('#stations button').forEach((b) => {
      const s = b.dataset.station;
      b.setAttribute('aria-current', String(s === name));
      b.classList.toggle('todo', status[s] === 'todo');
      b.classList.toggle('ready', status[s] === 'ready');
    });
  }

  hint(text) {
    if (text === this.lastHint) return;
    this.lastHint = text;
    $('hint').textContent = text || '';
  }

  ticket(order, number, done) {
    const t = $('ticket');
    if (!order) {
      t.hidden = true;
      this.ticketKey = null;
      return;
    }
    const key = `${number}|${done.join(',')}|${order.photo ? 1 : 0}`;
    if (key === this.ticketKey) return;
    const fresh = !this.ticketKey || !this.ticketKey.startsWith(`${number}|`);
    this.ticketKey = key;
    $('ticketNo').textContent = `No. ${String(number).padStart(2, '0')}`;
    $('ticketName').textContent = order.look.name;
    const ph = $('ticketPhoto');
    ph.hidden = !order.photo;
    if (order.photo && ph.getAttribute('src') !== order.photo) ph.src = order.photo;
    $('ticketLines').innerHTML = order.pieces
      .map((p, i) => {
        const [main, ...sub] = describePiece(p);
        return `<div class="piece-lines${done[i] ? ' done' : ''}"><div class="main"><span>${main}</span></div>${sub.map((s) => `<div class="sub">${s}</div>`).join('')}</div>`;
      })
      .join('');
    if (fresh) {
      t.hidden = true;
      void t.offsetWidth;
    }
    t.hidden = false;
  }

  patience(frac) {
    const bar = $('patienceBar');
    bar.style.width = `${Math.max(0, frac) * 100}%`;
    bar.parentElement.classList.toggle('low', frac < 0.3);
  }

  // Meter with a target band. value and band are 0..1.
  meter(label, value, band, over, dots) {
    const m = $('meter');
    if (label == null) {
      m.hidden = true;
      return;
    }
    m.hidden = false;
    $('meterLabel').textContent = label;
    $('meterFill').style.width = `${Math.min(1, value) * 100}%`;
    $('meterBand').style.left = `${band[0] * 100}%`;
    $('meterBand').style.width = `${(band[1] - band[0]) * 100}%`;
    m.classList.toggle('over', !!over);
    $('meterDots').textContent = dots || '';
  }

  // --- Build tools -------------------------------------------------------------

  buildTools() {
    const wrap = $('tools');
    for (const t of TOOL_LIST) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.dataset.tool = t.key;
      b.setAttribute('role', 'radio');
      b.innerHTML = `<span class="sw" style="background:${t.color}"></span>${t.label}`;
      b.addEventListener('click', () => this.h.onTool(t.key));
      wrap.appendChild(b);
    }
  }

  tools(visible, active, available, wanted) {
    const wrap = $('tools');
    wrap.hidden = !visible;
    if (!visible) return;
    wrap.querySelectorAll('.tool').forEach((b) => {
      const k = b.dataset.tool;
      b.hidden = !available.includes(k);
      b.setAttribute('aria-checked', String(k === active));
      b.classList.toggle('wanted', wanted.includes(k));
    });
  }

  actions(list) {
    const key = list.map((a) => `${a.label}:${a.disabled ? 0 : 1}`).join('|');
    if (key === this.actionKey) return;
    this.actionKey = key;
    const wrap = $('actions');
    wrap.innerHTML = '';
    for (const a of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${a.primary ? ' btn-solid' : ''}`;
      b.textContent = a.label;
      b.disabled = !!a.disabled;
      b.addEventListener('click', a.onClick);
      wrap.appendChild(b);
    }
  }

  // --- Cards -------------------------------------------------------------------

  card(html, buttons) {
    const screen = $('cardScreen');
    const card = $('card');
    card.innerHTML = html;
    const row = document.createElement('div');
    row.className = 'row';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `btn${b.primary ? ' btn-solid' : ''}`;
      el.textContent = b.label;
      el.addEventListener('click', b.onClick);
      row.appendChild(el);
    }
    card.appendChild(row);
    screen.hidden = false;
    const first = row.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }

  hideCard() {
    $('cardScreen').hidden = true;
  }

  dayIntroCard(i, onGo) {
    const d = DAYS[i];
    const fish = d.fish.map((f) => FISH[f].label).join(', ');
    const tops = d.toppings.length ? d.toppings.map((t) => TOPPINGS[t].label).join(', ') : 'None yet';
    this.card(
      `<p class="mono">${d.title} · ${d.customers} guests</p>
       <h2>${d.note}</h2>
       <div class="breakdown">
         <div class="line"><span class="mono">Fish</span><span>${fish}</span><span></span></div>
         <div class="line"><span class="mono">Toppings</span><span>${tops}</span><span></span></div>
       </div>
       <p class="quote">Read the ticket, then work left to right: rice, knife, build, serve.</p>`,
      [{ label: 'Open the door', primary: true, onClick: onGo }],
    );
  }

  scoreCard(name, quote, score, tip, onNext, last) {
    const stars = Math.round(score.total / 20);
    const starHtml = Array.from({ length: 5 }, (_, i) => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('');
    const bar = (label, v) => `<div class="line"><span class="mono">${label}</span><span class="bar"><i style="width:${Math.round(v * 100)}%"></i></span><span class="v">${Math.round(v * 100)}</span></div>`;
    this.card(
      `<p class="mono">${name} says</p>
       <p class="quote">${quote}</p>
       <div class="score-big"><span class="num">${score.total}</span><span class="stars" aria-label="${stars} of 5 stars">${starHtml}</span></div>
       <div class="breakdown">${bar('Rice', score.parts.rice)}${bar('Cut', score.parts.cut)}${bar('Build', score.parts.build)}${bar('Wait', score.parts.wait)}</div>
       <div class="tip"><span>Tip</span><b>+${yen(tip)}</b></div>`,
      [{ label: last ? 'Close up' : 'Next guest', primary: true, onClick: onNext }],
    );
  }

  summaryCard(dayIndex, stats, rank, hasNext, onNext, onReplay, onTitle, post) {
    const d = DAYS[dayIndex];
    const strip = post.plates.length
      ? `<div class="strip">${post.plates.map((p) => `<figure><img src="${p.img}" alt="Plate for ${p.guest}" /><figcaption class="mono">${p.score}</figcaption></figure>`).join('')}</div>`
      : '';
    this.card(
      `<p class="mono">${d.title} · closed</p>
       <h2>${yen(stats.tips)} in tips.</h2>
       ${strip}
       <div class="breakdown">
         <div class="line"><span class="mono">Guests</span><span>${stats.served}</span><span></span></div>
         <div class="line"><span class="mono">Average</span><span>${stats.avg} / 100</span><span></span></div>
         <div class="line"><span class="mono">Best plate</span><span>${stats.best} / 100</span><span></span></div>
       </div>
       <div class="hanko">${rank}</div>
       ${post.plates.length ? `<form class="post" id="postForm" autocomplete="off">
         <label class="mono" for="postName">Sign the wall</label>
         <div class="post-row"><input id="postName" maxlength="16" placeholder="Your name" spellcheck="false" /><button class="btn btn-solid" type="submit" id="postBtn">Post</button></div>
         <p class="mono post-note" id="postNote">Your best plates go up for everyone to see.</p>
       </form>` : ''}`,
      [
        ...(hasNext ? [{ label: `Day ${dayIndex + 2}`, primary: true, onClick: onNext }] : []),
        { label: 'Replay day', primary: !hasNext, onClick: onReplay },
        { label: 'The wall', onClick: post.onWall },
        { label: 'Title', onClick: onTitle },
      ],
    );
    const form = $('postForm');
    if (!form) return;
    $('postName').value = post.name;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('postBtn');
      btn.disabled = true;
      btn.textContent = 'Posting';
      const res = await post.onPost($('postName').value);
      btn.textContent = 'Posted';
      $('postNote').textContent = res.shared
        ? res.rank ? `Up on the wall. No. ${res.rank} on the board.` : 'Up on the wall.'
        : 'Saved on this device. The shared wall is not set up on this server.';
    });
  }

  // --- The wall ------------------------------------------------------------------

  showWall(data, mine) {
    $('wall').hidden = false;
    $('wallNote').textContent = data.loading
      ? 'Loading.'
      : data.shared
        ? 'From everyone who played. Newest first.'
        : 'Only your own shifts, saved on this device. The shared wall needs storage on the server.';
    const board = $('wallBoard');
    board.innerHTML = '';
    for (const e of data.leaders || []) {
      const li = document.createElement('li');
      li.className = e.id === mine ? 'mine' : '';
      const name = document.createElement('span');
      name.textContent = e.name;
      const day = document.createElement('span');
      day.className = 'mono';
      day.textContent = `Day ${e.day + 1}`;
      const tips = document.createElement('b');
      tips.textContent = yen(e.tips);
      li.append(name, day, tips);
      board.appendChild(li);
    }
    if (!data.loading && !(data.leaders || []).length) board.innerHTML = '<li class="empty mono">No shifts yet.</li>';
    const grid = $('wallPlates');
    grid.innerHTML = '';
    for (const p of data.plates || []) {
      if (typeof p.img !== 'string' || !p.img.startsWith('data:image/')) continue;
      const fig = document.createElement('figure');
      fig.className = `plate-card${p.run === mine ? ' mine' : ''}`;
      const img = document.createElement('img');
      img.src = p.img;
      img.loading = 'lazy';
      img.alt = `Plate by ${p.name} for ${p.guest}`;
      const cap = document.createElement('figcaption');
      const who = document.createElement('span');
      who.textContent = p.name;
      const meta = document.createElement('span');
      meta.className = 'mono';
      meta.textContent = `for ${p.guest} · ${p.score}`;
      cap.append(who, meta);
      fig.append(img, cap);
      grid.appendChild(fig);
    }
    if (!data.loading && !grid.children.length) grid.innerHTML = '<p class="empty mono">No plates yet. Finish a shift and post yours.</p>';
    $('wallClose').focus({ preventScroll: true });
  }

  hideWall() {
    $('wall').hidden = true;
  }

  // Rating that floats up from a point on screen. kind: great | good | bad.
  // text may be { jp, en } for a spoken line: Japanese with a small gloss.
  popup(text, x, y, kind = 'good') {
    const el = document.createElement('div');
    el.className = `popup ${kind}`;
    if (typeof text === 'object') {
      const jp = document.createElement('span');
      jp.className = 'jp';
      jp.lang = 'ja';
      jp.textContent = text.jp;
      const en = document.createElement('span');
      en.className = 'gloss';
      en.textContent = text.en;
      el.append(jp, en);
    } else el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), kind === 'say' ? 1900 : 1300);
  }

  // Ring under the finger while holding. value and band are 0..1.
  holdRing(x, y, value, band, over) {
    const ring = $('holdRing');
    if (x == null) {
      ring.hidden = true;
      return;
    }
    ring.hidden = false;
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    const C = 2 * Math.PI * 40;
    $('holdProg').style.strokeDasharray = `${C * Math.min(1, value)} ${C}`;
    $('holdBand').style.strokeDasharray = `0 ${C * band[0]} ${C * (band[1] - band[0])} ${C}`;
    ring.classList.toggle('over', !!over);
    ring.classList.toggle('in', value >= band[0] && value <= band[1]);
  }

  toast(text, ms = 1800) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  recording(on, secondsLeft) {
    $('recFrame').hidden = !on;
    if (on) $('recCount').textContent = String(secondsLeft);
  }

  showPreview(url, isVideo, { share, download, close }) {
    const media = $('previewMedia');
    media.innerHTML = '';
    const el = document.createElement(isVideo ? 'video' : 'img');
    el.src = url;
    if (isVideo) Object.assign(el, { autoplay: true, loop: true, muted: true, playsInline: true, controls: true });
    else el.alt = 'Photo of the counter';
    media.appendChild(el);
    $('previewTitle').textContent = isVideo ? 'Clip ready' : 'Photo ready';
    $('previewShare').hidden = !share;
    $('previewShare').onclick = share;
    $('previewDownload').onclick = download;
    $('previewClose').onclick = close;
    $('preview').hidden = false;
  }

  hidePreview() {
    $('preview').hidden = true;
    $('previewMedia').innerHTML = '';
  }
}
