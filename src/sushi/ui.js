import { DAYS, FISH, TOPPINGS } from './config.js';
import { FILLINGS } from './maki.js';
import { describePiece } from './orders.js';
import { ICONS, star } from './icons.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => `¥${Math.round(n).toLocaleString('en-US')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TOOL_LIST = [
  { key: 'wasabi', label: 'Wasabi' },
  { key: 'fish', label: 'Fish' },
  { key: 'ikura', label: 'Ikura' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'scallion', label: 'Scallion' },
  { key: 'sauce', label: 'Sauce' },
  { key: 'nori', label: 'Nori' },
];
const FISH_ICON = { salmon: 'fish', tuna: 'tuna', tamago: 'tamago', unagi: 'unagi' };
const JP_DAYS = ['1日目', '2日目', '3日目', '4日目', '5日目', '6日目', '7日目'];

// Count a number up (or down) inside an element.
function countTo(el, to, ms = 600, fmt = (v) => String(Math.round(v))) {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = String(to);
  if (reduced() || from === to) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Restart a one-shot CSS animation class.
function bump(el, cls = 'bump') {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export class GameUI {
  constructor(handlers) {
    this.h = handlers;
    this.hud = $('hud');
    for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';
    // The logo wobbles letter by letter.
    const logo = $('logoBig');
    logo.innerHTML = [...logo.textContent].map((c, i) => `<span style="--i:${i}" aria-hidden="true">${c}</span>`).join('');
    document.querySelectorAll('#stations button').forEach((b) => b.addEventListener('click', () => this.h.onStation(b.dataset.station)));
    $('muteBtn').addEventListener('click', () => this.h.onMute());
    $('musicBtn').addEventListener('click', () => this.h.onMusic());
    $('titleMusicBtn').addEventListener('click', () => this.h.onMusic());
    $('recBtn').addEventListener('click', () => this.h.onRecord());
    $('shotBtn').addEventListener('click', () => this.h.onPhoto());
    $('pauseBtn').addEventListener('click', () => this.h.onPause());
    $('startBtn').addEventListener('click', () => this.h.onStart(this.selectedDay));
    $('wallBtn').addEventListener('click', () => this.h.onWall());
    $('bookBtn').addEventListener('click', () => this.h.onBook());
    $('bookClose').addEventListener('click', () => ($('book').hidden = true));
    $('book').addEventListener('keydown', (e) => e.key === 'Escape' && ($('book').hidden = true));
    this.bookTab = 'dishes';
    for (const t of document.querySelectorAll('#book [role=tab]')) {
      t.addEventListener('click', () => {
        this.bookTab = t.dataset.tab;
        this.renderBook();
      });
    }
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
      const locked = i > progress.unlocked;
      const best = progress.best[i];
      const foot = locked
        ? `<span class="day-foot locked"><span class="ico">${ICONS.lock}</span>Locked</span>`
        : best
          ? `<span class="day-foot"><span class="ico">${ICONS.coin}</span>Best ${yen(best)}</span>`
          : '<span class="day-foot new">New</span>';
      const got = (progress.stars || [])[i] || 0;
      const stars = locked ? '' : `<span class="day-stars" aria-label="${got} of 3 stars">${[0, 1, 2].map((k) => `<i class="${k < got ? 'on' : ''}">★</i>`).join('')}</span>`;
      const tag = d.dish ? `<span class="day-tag">${{ tuna: 'Tuna', tamago: 'Tamago', maki: 'Rolls', unagi: 'Unagi' }[d.dish]}</span>` : d.rush ? '<span class="day-tag rush">Rush</span>' : '';
      b.innerHTML = `<span class="day-num"><b>${i + 1}</b><span lang="ja">${JP_DAYS[i].slice(1)}</span>${tag}</span><span class="day-note">${d.note}</span>${stars}${foot}`;
      b.disabled = locked;
      b.setAttribute('aria-label', `${d.title}. ${d.note}${locked ? ' Locked.' : ''}`);
      b.setAttribute('aria-pressed', String(i === this.selectedDay));
      b.addEventListener('click', () => {
        this.selectedDay = i;
        list.querySelectorAll('.day').forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
      });
      list.appendChild(b);
    });
    // Bring the day you are on into view in the strip.
    const sel = list.children[this.selectedDay];
    if (sel) requestAnimationFrame(() => (list.scrollLeft = Math.max(0, sel.offsetLeft - list.offsetLeft - 12)));
  }

  hideTitle() {
    $('title').hidden = true;
    this.hud.hidden = false;
  }

  // --- HUD -------------------------------------------------------------------

  setDay(i, served, total, tips) {
    $('dayNum').textContent = String(i + 1);
    const plates = $('servedPlates');
    const key = `${served}/${total}`;
    if (plates.dataset.key !== key) {
      const grew = plates.dataset.key && Number(plates.dataset.key.split('/')[0]) < served;
      plates.dataset.key = key;
      plates.innerHTML = Array.from({ length: total }, (_, k) => `<span class="ico${k < served ? ' on' : ''}${grew && k === served - 1 ? ' just' : ''}">${k < served ? ICONS.plate : ICONS.plateEmpty}</span>`).join('');
      plates.parentElement.setAttribute('aria-label', `${served} of ${total} plates served`);
    }
    const t = $('tipsValue');
    if (Number(t.dataset.value || 0) !== tips) {
      if (tips > Number(t.dataset.value || 0)) bump(t.parentElement);
      countTo(t, tips, 900, yen);
    }
  }

  setMusic(on) {
    const b = $('musicBtn');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Music on' : 'Music off');
    b.querySelector('.ico').innerHTML = on ? ICONS.music : ICONS.musicOff;
    const t = $('titleMusicBtn');
    t.setAttribute('aria-pressed', String(on));
    t.querySelector('.ico').innerHTML = on ? ICONS.music : ICONS.musicOff;
    $('titleMusicLabel').textContent = on ? 'Music on' : 'Music off';
  }

  setMuted(m) {
    const b = $('muteBtn');
    b.setAttribute('aria-pressed', String(!m));
    b.setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    b.querySelector('.ico').innerHTML = m ? ICONS.soundOff : ICONS.soundOn;
  }

  setStation(name, status) {
    // The photo matters at the counter and while building; elsewhere it
    // would cover the tub and the block.
    $('ticket').classList.toggle('compact', name === 'rice' || name === 'knife');
    document.querySelectorAll('#stations button').forEach((b) => {
      const s = b.dataset.station;
      b.setAttribute('aria-current', String(s === name));
      const st = status[s] || '';
      if (b.dataset.status !== st) {
        b.dataset.status = st;
        b.querySelector('.flag').innerHTML = st === 'ready' ? ICONS.check : st === 'todo' ? '!' : '';
      }
    });
  }

  hint(text) {
    this.pendingHint = text;
    if (this.sayUntil > performance.now()) return;
    if (text === this.lastHint) return;
    this.lastHint = text;
    const wrap = $('hintWrap');
    $('hint').textContent = text || '';
    wrap.hidden = !text;
    if (text) bump(wrap, 'talk');
  }

  // Pochi speaks up in the hint bubble for a moment, then the hint returns.
  say(text, ms = 1600) {
    const wrap = $('hintWrap');
    const line = typeof text === 'object' ? `${text.jp}  ${text.en}` : text;
    $('hint').textContent = line;
    wrap.hidden = false;
    wrap.classList.add('shout');
    bump(wrap, 'talk');
    this.sayUntil = performance.now() + ms;
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => {
      wrap.classList.remove('shout');
      this.sayUntil = 0;
      this.lastHint = undefined;
      this.hint(this.pendingHint);
    }, ms);
  }

  // A step's grade, stamped where the work happened.
  grade(tier, detail, x, y) {
    const el = document.createElement('div');
    el.className = `popup grade ${tier}`;
    const word = document.createElement('b');
    word.textContent = { perfect: 'Perfect!', great: 'Great!', ok: 'OK', oops: 'Oops!' }[tier];
    el.append(word);
    if (detail) {
      const d = document.createElement('small');
      d.textContent = detail;
      el.append(d);
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // The chef's paw acting out the next move: press, tap, or a stroke from
  // (x, y) by (dx, dy). null hides it.
  gesture(kind, x, y, dx = 0, dy = 0) {
    const el = $('gesture');
    if (!kind) {
      if (!el.hidden) el.hidden = true;
      this.gestureKey = null;
      return;
    }
    const key = `${kind}|${Math.round(x / 4)}|${Math.round(y / 4)}|${Math.round(dx / 4)}|${Math.round(dy / 4)}`;
    if (key === this.gestureKey) return;
    this.gestureKey = key;
    el.dataset.kind = kind;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    el.hidden = false;
  }

  // progress[i]: how far the i-th piece on the board has come, so each
  // request on the slip ticks off as it is done.
  ticket(order, number, progress = []) {
    const t = $('ticket');
    if (!order) {
      t.hidden = true;
      this.ticketKey = null;
      return;
    }
    const key = `${number}|${JSON.stringify(progress)}|${order.photo ? 1 : 0}`;
    if (key === this.ticketKey) return;
    const fresh = !this.ticketKey || !this.ticketKey.startsWith(`${number}|`);
    this.ticketKey = key;
    $('ticketNo').textContent = `#${String(number).padStart(2, '0')}`;
    t.classList.toggle('rush', !!order.rush);
    $('ticketName').textContent = order.look.name;
    const ph = $('ticketPhoto');
    ph.hidden = !order.photo;
    ph.parentElement.classList.toggle('waiting', !order.photo);
    if (order.photo && ph.getAttribute('src') !== order.photo) ph.src = order.photo;
    $('ticketLines').innerHTML = order.pieces
      .map((p, i) => {
        const [main] = describePiece(p);
        const fav = order.look.fav === (p.maki ? `m:${p.maki}` : `n:${p.fish}`) ? `<span class="fav-heart ico" title="${esc(order.look.name)}'s favourite">${ICONS.heart}</span>` : '';
        if (p.maki) return makiLine(p, progress[i] || {}, main + fav);
        const pr = progress[i] || { rice: false, fish: false, wasabi: 0, tops: {} };
        const chips = [];
        const chip = (text, state) => chips.push(`<span class="chip${state ? ` ${state}` : ''}">${state === 'ok' ? '✓ ' : ''}${text}</span>`);
        if (p.wasabi) chip(`Wasabi ${pr.wasabi}/${p.wasabi}`, pr.wasabi === p.wasabi ? 'ok' : pr.wasabi > p.wasabi ? 'over' : '');
        else if (p.fish !== 'tamago' && p.fish !== 'unagi') chip('No wasabi', pr.wasabi ? 'over' : pr.fish ? 'ok' : '');
        let topsOk = true;
        for (const [k, v] of Object.entries(p.toppings)) {
          if (k === 'ikura') {
            const n = pr.tops.ikura || 0;
            chip(`Ikura ${n}/${v}`, n === v ? 'ok' : n > v ? 'over' : '');
            topsOk = topsOk && n === v;
          } else {
            chip(TOPPINGS[k].label, pr.tops[k] ? 'ok' : '');
            topsOk = topsOk && !!pr.tops[k];
          }
        }
        const wasabiOk = pr.wasabi === (p.wasabi || 0);
        const done = pr.fish && wasabiOk && topsOk;
        const steps = `<span class="steps" aria-hidden="true"><i class="${pr.rice ? 'on' : ''}"></i><i class="${pr.fish ? 'on' : ''}"></i></span>`;
        return `<div class="piece${done ? ' done' : ''}">
          <span class="piece-ico ico">${ICONS[FISH_ICON[p.fish]]}</span>
          <div class="piece-text"><b>${main}${fav}${steps}</b><span class="chips">${chips.join('')}</span></div>
          ${done ? '<span class="stamp" lang="ja" aria-label="Done">済</span>' : ''}
        </div>`;
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
    const f = Math.max(0, Math.min(1, frac));
    bar.style.width = `${f * 100}%`;
    const p = bar.closest('.patience');
    p.classList.toggle('mid', f < 0.55 && f >= 0.28);
    p.classList.toggle('low', f < 0.28);
  }

  // Meter with a target band. value and band are 0..1. dots: '●●○' presses.
  meter(label, value, band, over, dots) {
    const m = $('meter');
    if (label == null) {
      // Reset, so the next hold never starts from the last reading.
      m.hidden = true;
      $('meterFill').style.width = '0%';
      m.classList.remove('in', 'over');
      return;
    }
    m.hidden = false;
    $('meterLabel').textContent = label;
    $('meterFill').style.width = `${Math.min(1, value) * 100}%`;
    $('meterBand').style.left = `${band[0] * 100}%`;
    $('meterBand').style.width = `${(band[1] - band[0]) * 100}%`;
    m.classList.toggle('over', !!over);
    m.classList.toggle('in', value >= band[0] && value <= band[1]);
    const d = dots || '';
    if ($('meterDots').dataset.d !== d) {
      $('meterDots').dataset.d = d;
      $('meterDots').innerHTML = [...d].map((c) => `<i class="${c === '●' ? 'on' : ''}"></i>`).join('');
    }
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
      b.innerHTML = `<span class="token ico">${ICONS[t.key]}</span><span class="tool-label">${t.label}</span><i class="want" aria-hidden="true">!</i>`;
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
    const key = list.map((a) => `${a.label}:${a.disabled ? 0 : 1}:${a.primary ? 1 : 0}`).join('|');
    if (key === this.actionKey) return;
    this.actionKey = key;
    const wrap = $('actions');
    wrap.innerHTML = '';
    for (const a of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${a.primary ? ' btn-solid btn-go' : ''}`;
      b.innerHTML = `<span>${esc(a.label)}</span>`;
      b.disabled = !!a.disabled;
      b.addEventListener('click', a.onClick);
      wrap.appendChild(b);
    }
  }

  // --- Cards -------------------------------------------------------------------

  card(html, buttons, kind = '') {
    const screen = $('cardScreen');
    const card = $('card');
    card.className = `panel ${kind}`;
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

  dayIntroCard(i, onGo, extra = {}) {
    const d = DAYS[i];
    const rolls = d.maki ? d.maki.map((f) => `<span class="ingredient"><span class="ico">${ICONS[f === 'kappa' ? 'cucumber' : f === 'tekka' ? 'tuna' : 'fish']}</span>${FILLINGS[f].roll}</span>`).join('') : '';
    const goals = extra.goals ? `<div class="goals">${extra.goals.map((g, k) => `<span class="goal"><span class="mini-stars">${'★'.repeat(k + 1)}</span>${yen(g)}</span>`).join('')}</div>` : '';
    const show = extra.showcase ? `<figure class="showcase"><img src="${extra.showcase.img}" alt="${esc(extra.showcase.name)}" /><figcaption><span class="new-tag">New</span>${esc(extra.showcase.name)}<span lang="ja">${esc(extra.showcase.jp || '')}</span></figcaption></figure>` : '';
    const rush = d.rush ? `<p class="rush-line"><span class="ico">${ICONS.flame}</span>Rush hour comes mid shift. Less patience, bigger tips.</p>` : '';
    const fish = d.fish.map((f) => `<span class="ingredient"><span class="ico">${ICONS[FISH_ICON[f]]}</span>${FISH[f].label}</span>`).join('');
    const tops = d.toppings.length
      ? d.toppings.map((t) => `<span class="ingredient"><span class="ico">${ICONS[t]}</span>${TOPPINGS[t].label}</span>`).join('')
      : '<span class="ingredient none">None yet</span>';
    this.card(
      `<div class="ribbon"><h2>${d.title}</h2><span lang="ja">${JP_DAYS[i]}</span></div>
       <p class="panel-lead">${d.note}</p>
       ${show}
       <div class="guests"><span class="ico">${ICONS.pochi}</span><span><b>${d.customers}</b> guests tonight</span></div>
       <div class="shelf"><span class="shelf-label">Nigiri</span><div class="ingredients">${fish}</div></div>
       ${rolls ? `<div class="shelf"><span class="shelf-label">Rolls</span><div class="ingredients">${rolls}</div></div>` : ''}
       <div class="shelf"><span class="shelf-label">Toppings</span><div class="ingredients">${tops}</div></div>
       ${rush}
       ${goals}
       <p class="tip-line">Match the photo on each ticket. Rice, knife, build, serve.</p>`,
      [{ label: 'Open the door', primary: true, onClick: onGo }],
      'intro',
    );
  }

  pauseCard(dayIndex, onResume, onRestart, onQuit) {
    this.card(
      `<div class="ribbon"><h2>Paused</h2><span lang="ja">休憩</span></div>
       <p class="panel-lead">${DAYS[dayIndex].title}. The guest will wait.</p>
       <p class="tip-line">Esc to resume. 1 to 4 switch stations. Hold Space to scoop and press.</p>`,
      [
        { label: 'Resume', primary: true, onClick: onResume },
        { label: 'Restart day', onClick: onRestart },
        { label: 'Quit to title', onClick: onQuit },
      ],
      'pause',
    );
  }

  scoreCard(name, quote, score, tip, onNext, last, bonuses = [], steps = []) {
    const stars = Math.round(score.total / 20);
    const medal = score.total >= 90 ? 'gold' : score.total >= 75 ? 'silver' : score.total >= 55 ? 'bronze' : null;
    const medalHtml = medal
      ? `<div class="medal-stamp ${medal}" aria-label="${medal} medal"><span>${{ gold: '金', silver: '銀', bronze: '銅' }[medal]}</span></div>${score.total >= 96 ? '<p class="better">Even better than Pochi!</p>' : ''}`
      : '';
    const tally = ['perfect', 'great', 'ok', 'oops']
      .map((t) => [t, steps.filter((x) => x === t).length])
      .filter(([, n]) => n)
      .map(([t, n], i) => `<span class="tally ${t}" style="--d:${0.9 + i * 0.1}s">${{ perfect: 'Perfect', great: 'Great', ok: 'OK', oops: 'Oops' }[t]} <b>×${n}</b></span>`)
      .join('');
    const starHtml = Array.from({ length: 5 }, (_, i) => `<span class="star${i < stars ? ' on' : ''}" style="--d:${0.25 + i * 0.12}s">${star(i < stars)}</span>`).join('');
    const bar = (label, v, i) => `<div class="stat-bar"><span>${label}</span><span class="gauge"><i style="--w:${Math.round(v * 100)}%;--d:${0.5 + i * 0.1}s"></i></span><b>${Math.round(v * 100)}</b></div>`;
    this.card(
      `<div class="ribbon"><h2>${esc(name)}</h2></div>
       ${medalHtml}
       <div class="stars-row" aria-label="${stars} of 5 stars">${starHtml}</div>
       <div class="score-big"><b id="scoreNum">0</b><span>/ 100</span></div>
       <p class="speech">${esc(quote)}</p>
       ${tally ? `<div class="tallies">${tally}</div>` : ''}
       <div class="stat-bars">${bar('Rice', score.parts.rice, 0)}${bar('Cut', score.parts.cut, 1)}${bar('Build', score.parts.build, 2)}${bar('Wait', score.parts.wait, 3)}</div>
       <div class="tip-pill"><span class="ico">${ICONS.coin}</span><span>Tip</span><b>+${yen(tip)}</b></div>
       ${bonuses.length ? `<div class="bonuses">${bonuses.map((b, i) => `<span class="bonus" style="--d:${1.2 + i * 0.15}s">${b.label.startsWith('Combo') ? `<span class="ico">${ICONS.flame}</span>` : ''}${esc(b.label)} <b>${esc(b.value)}</b></span>`).join('')}</div>` : ''}`,
      [{ label: last ? 'Close up' : 'Next guest', primary: true, onClick: onNext }],
      'result',
    );
    countTo($('scoreNum'), score.total, 900);
  }

  summaryCard(dayIndex, stats, rank, hasNext, onNext, onReplay, onTitle, post) {
    const d = DAYS[dayIndex];
    const strip = post.plates.length
      ? `<div class="strip">${post.plates.map((p) => `<figure><img src="${p.img}" alt="Plate for ${esc(p.guest)}" /><figcaption>${p.score}</figcaption></figure>`).join('')}</div>`
      : '';
    this.card(
      `<div class="ribbon"><h2>${d.title} done</h2><span lang="ja">閉店</span></div>
       <div class="takings"><span class="ico">${ICONS.coin}</span><b id="takeNum">¥0</b><span>in tips</span></div>
       ${strip}
       <div class="stat-tiles">
         <div><b>${stats.served}</b><span>Guests</span></div>
         <div><b>${stats.avg}</b><span>Average</span></div>
         <div><b>${stats.best}</b><span>Best plate</span></div>
       </div>
       <div class="day-result">
         <div class="big-stars" aria-label="${stats.stars} of 3 stars">${[0, 1, 2].map((k) => `<span class="star${k < stats.stars ? ' on' : ''}" style="--d:${0.5 + k * 0.25}s">${star(k < stats.stars)}</span>`).join('')}</div>
         <div class="goals">${stats.goals.map((g, k) => `<span class="goal${stats.tips >= g ? ' met' : ''}"><span class="mini-stars">${'★'.repeat(k + 1)}</span>${yen(g)}</span>`).join('')}</div>
       </div>
       ${stats.walkouts ? `<p class="tip-line">${stats.walkouts} guest${stats.walkouts > 1 ? 's' : ''} walked out.</p>` : ''}
       <div class="hanko">${rank}</div>
       ${!hasNext && dayIndex + 1 < DAYS.length ? `<p class="tip-line">Earn one star to unlock Day ${dayIndex + 2}.</p>` : ''}
       ${post.plates.length ? `<form class="post" id="postForm" autocomplete="off">
         <label for="postName">Sign the wall</label>
         <div class="post-row"><input id="postName" maxlength="16" placeholder="Your name" spellcheck="false" /><button class="btn btn-solid" type="submit" id="postBtn">Post</button></div>
         <p class="post-note" id="postNote">Your best plates go up for everyone to see.</p>
       </form>` : ''}`,
      [
        ...(hasNext ? [{ label: `Day ${dayIndex + 2}`, primary: true, onClick: onNext }] : []),
        { label: 'Replay day', primary: !hasNext, onClick: onReplay },
        { label: 'The wall', onClick: post.onWall },
        { label: 'Title', onClick: onTitle },
      ],
      'summary',
    );
    countTo($('takeNum'), stats.tips, 1200, yen);
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

  // Combo badge in the top bar: shows from a two plate streak.
  combo(n) {
    const b = $('comboBadge');
    if (n < 2) {
      b.hidden = true;
      return;
    }
    b.hidden = false;
    $('comboNum').textContent = `×${n}`;
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  }

  // A big banner across the screen for a moment: rush hour, a new dish.
  banner(text, jp = '', kind = '') {
    const el = $('banner');
    el.className = `banner ${kind}`;
    el.innerHTML = `<span class="banner-jp" lang="ja">${esc(jp)}</span><span class="banner-text">${esc(text)}</span>`;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => (el.hidden = true), 2400);
  }

  // --- The Sushi book -----------------------------------------------------------

  showBook(data, refresh = false) {
    this.book = data;
    if (refresh && $('book').hidden) return;
    $('book').hidden = false;
    this.renderBook();
    if (!refresh) $('bookClose').focus({ preventScroll: true });
  }

  renderBook() {
    const data = this.book;
    if (!data) return;
    const dishes = this.bookTab === 'dishes';
    for (const t of document.querySelectorAll('#book [role=tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === this.bookTab));
    const found = data.dishes.filter((d) => d.state === 'found').length;
    const favs = data.guests.filter((g) => g.favFound).length;
    $('bookNote').textContent = dishes ? `${found} of ${data.dishes.length} dishes served.` : `${favs} of ${data.guests.length} favourites found. Serve a regular their favourite well to fill it in.`;
    const photo = (url, cls) => (url ? `<img src="${url}" alt="" class="${cls}" />` : `<span class="book-wait"></span>`);
    $('bookGrid').className = `book-grid ${dishes ? 'book-dishes' : 'book-guests'}`;
    $('bookGrid').innerHTML = dishes
      ? data.dishes
          .map(
            (d, i) => `<figure class="book-card ${d.state}">
              <span class="book-no">No. ${String(i + 1).padStart(2, '0')}</span>
              <div class="book-photo">${photo(d.photo, d.state === 'found' ? '' : 'shadowed')}${d.state === 'locked' ? '<span class="book-q">?</span>' : ''}</div>
              <figcaption>
                <b>${d.state === 'locked' ? '???' : esc(d.name)}</b><span lang="ja">${d.state === 'locked' ? '' : esc(d.jp)}</span>
                <span class="book-meta">${d.state === 'found' ? `Served ${d.served} · Best ${d.best}` : d.state === 'seen' ? 'Not made yet' : `Day ${d.day + 1}`}</span>
              </figcaption>
            </figure>`,
          )
          .join('')
      : data.guests
          .map(
            (g) => `<figure class="book-card guest ${g.met ? 'found' : 'locked'}">
              <div class="book-photo round">${photo(g.photo, g.met ? '' : 'shadowed')}${g.met ? '' : '<span class="book-q">?</span>'}</div>
              <figcaption>
                <b>${g.met ? esc(g.name) : '???'}</b><span>${g.met ? esc(g.kind) : ''}</span>
                <span class="book-meta">${g.met ? `Served ${g.served}` : 'Not met yet'}</span>
                <span class="book-fav${g.favFound ? ' found' : ''}"><span class="ico">${ICONS.heart}</span>${g.favFound ? `Loves ${esc(g.favName.toLowerCase())}` : 'Favourite: ?'}</span>
              </figcaption>
            </figure>`,
          )
          .join('');
  }

  // --- The wall ------------------------------------------------------------------

  showWall(data, mine) {
    $('wall').hidden = false;
    $('wallNote').textContent = data.loading
      ? 'Loading.'
      : data.shared
        ? 'Plates from everyone who played. Newest first.'
        : 'Only your own shifts, saved on this device. The shared wall needs storage on the server.';
    const board = $('wallBoard');
    board.innerHTML = '';
    (data.leaders || []).forEach((e, k) => {
      const li = document.createElement('li');
      li.className = `${e.id === mine ? 'mine' : ''}${k < 3 ? ` medal m${k + 1}` : ''}`;
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(k + 1);
      const name = document.createElement('span');
      name.className = 'who';
      name.textContent = e.name;
      const day = document.createElement('span');
      day.className = 'when';
      day.textContent = `Day ${e.day + 1}`;
      const tips = document.createElement('b');
      tips.textContent = yen(e.tips);
      li.append(rank, name, day, tips);
      board.appendChild(li);
    });
    if (!data.loading && !(data.leaders || []).length) board.innerHTML = '<li class="empty">No shifts yet.</li>';
    const grid = $('wallPlates');
    grid.innerHTML = '';
    for (const p of data.plates || []) {
      if (typeof p.img !== 'string' || !p.img.startsWith('data:image/')) continue;
      const fig = document.createElement('figure');
      fig.className = `polaroid${p.run === mine ? ' mine' : ''}`;
      const img = document.createElement('img');
      img.src = p.img;
      img.loading = 'lazy';
      img.alt = `Plate by ${p.name} for ${p.guest}`;
      const cap = document.createElement('figcaption');
      const who = document.createElement('b');
      who.textContent = p.name;
      const meta = document.createElement('span');
      meta.textContent = `for ${p.guest}`;
      const sc = document.createElement('span');
      sc.className = 'score';
      sc.textContent = String(p.score);
      cap.append(who, meta, sc);
      fig.append(img, cap);
      grid.appendChild(fig);
    }
    if (!data.loading && !grid.children.length) grid.innerHTML = '<p class="empty">No plates yet. Finish a shift and post yours.</p>';
    $('wallClose').focus({ preventScroll: true });
  }

  hideWall() {
    $('wall').hidden = true;
  }

  // Rating that pops from a point on screen. kind: great | good | bad | say.
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
    bump(t, 'show');
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

// A roll on the ticket: filling, rolled, cut into six, plated.
function makiLine(p, pr, main) {
  const chips = [];
  const chip = (text, state) => chips.push(`<span class="chip${state ? ` ${state}` : ''}">${state === 'ok' ? '✓ ' : ''}${text}</span>`);
  const right = pr.filling === p.maki;
  chip(FILLINGS[p.maki].label, pr.filling ? (right ? 'ok' : 'over') : '');
  chip('Rolled', pr.rolled ? 'ok' : '');
  chip(`Cut ${pr.cuts || 0}/5`, (pr.cuts || 0) >= 5 ? 'ok' : '');
  const done = pr.plated && right;
  const steps = `<span class="steps" aria-hidden="true"><i class="${pr.rice ? 'on' : ''}"></i><i class="${pr.rolled ? 'on' : ''}"></i><i class="${pr.plated ? 'on' : ''}"></i></span>`;
  return `<div class="piece${done ? ' done' : ''}">
    <span class="piece-ico ico">${ICONS.maki}</span>
    <div class="piece-text"><b>${main}${steps}</b><span class="chips">${chips.join('')}</span></div>
    ${done ? '<span class="stamp" lang="ja" aria-label="Done">済</span>' : ''}
  </div>`;
}
