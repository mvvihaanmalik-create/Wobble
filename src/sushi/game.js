import { Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import { DAYS, GAME, LAYOUT, PERF, CUSTOMER_LOOKS } from './config.js';
import { Stage, TIERS, TIER_ORDER } from './stage.js';
import { SushiSet } from './set.js';
import { Customer } from './customers.js';
import { makeOrders, rankFor, scorePlate, tipFor } from './orders.js';
import { BuildStation, CounterStation, KnifeStation, RiceStation } from './stations.js';
import { GameUI } from './ui.js';
import { BarSound } from './audio.js';
import { Recorder, canShareFile, download, shareOrDownload } from '../record.js';
import { composeBar } from './capture.js';
import { Effects, haptic } from './fx.js';

const STATIONS = ['counter', 'rice', 'knife', 'build'];
const ENTRANCE = new Vector3(-17, LAYOUT.customer.y, LAYOUT.customer.z);
const EXIT = new Vector3(17, LAYOUT.customer.y, LAYOUT.customer.z);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const params = new URLSearchParams(location.search);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.stage = new Stage(canvas, TIERS[params.get('tier')] ? params.get('tier') : coarse ? 'medium' : 'high');
    this.set = new SushiSet(this.stage.scene);
    this.sound = new BarSound();
    this.fx = new Effects(this.stage.scene);
    this.timeScale = 1;
    this.slowFor = 0;
    this.pointerPos = { x: 0, y: 0 };
    this.recorder = new Recorder(canvas);
    this.recorder.compose = composeBar;
    this.ray = new Raycaster();
    this.ndc = new Vector2();
    this.tweens = [];
    this.pieces = [];
    this.tray = [];
    this.progress = loadProgress();
    this.quality = { slowFor: 0, avg: 16, fixed: new URLSearchParams(location.search).has('fixed') || new URLSearchParams(location.search).has('tier') };

    this.ui = new GameUI({
      onStation: (s) => this.goStation(s),
      onMute: () => {
        this.sound.unlock();
        this.sound.setMuted(!this.sound.muted);
        this.ui.setMuted(this.sound.muted);
      },
      onRecord: () => this.record(),
      onPhoto: () => this.photo(),
      onStart: (day) => this.startDay(day),
      onTool: (t) => this.stations.build.setTool(t),
    });
    this.ui.setMuted(this.sound.muted);

    this.stations = {
      counter: new CounterStation(this),
      rice: new RiceStation(this),
      knife: new KnifeStation(this),
      build: new BuildStation(this),
    };
    this.station = 'counter';
    this.bindInput();
    this.stage.resize();
    window.addEventListener('resize', () => this.stage.resize());

    this.showTitle();
    this.last = performance.now();
    this.running = false;
    document.addEventListener('visibilitychange', () => (document.hidden ? this.pause() : this.resume()));
    this.resume();
  }

  // --- Flow ------------------------------------------------------------------

  showTitle() {
    this.mode = 'title';
    this.clearWork();
    this.removeCustomers();
    this.stage.goTo('title', true);
    this.ui.showTitle(this.progress);
    const look = CUSTOMER_LOOKS[Math.floor(Math.random() * CUSTOMER_LOOKS.length)];
    this.customer = this.seatCustomer(look, true);
    this.order = null;
  }

  startDay(dayIndex) {
    this.sound.unlock();
    this.day = dayIndex;
    this.orders = makeOrders(dayIndex);
    this.orderIndex = -1;
    this.tips = 0;
    this.scores = [];
    this.ui.hideTitle();
    this.removeCustomers();
    this.clearWork();
    this.mode = 'intro';
    this.ui.setDay(dayIndex, 0, this.orders.length, 0);
    this.stage.goTo('counter');
    this.ui.dayIntroCard(dayIndex, () => {
      this.ui.hideCard();
      this.mode = 'play';
      this.nextCustomer();
    });
  }

  nextCustomer() {
    this.orderIndex++;
    if (this.orderIndex >= this.orders.length) return this.endDay();
    const order = this.orders[this.orderIndex];
    order.taken = false;
    order.arrived = performance.now();
    this.order = order;
    this.goStation('counter');
    // The guest waiting in line hops in, or someone new walks in.
    let c = this.queue && this.queue.look === order.look ? this.queue : null;
    if (c) this.queue = null;
    else {
      c = new Customer(order.look, this.orderIndex + 1);
      c.group.position.copy(ENTRANCE);
      c.group.scale.setScalar(LAYOUT.customer.scale);
      this.stage.scene.add(c.group);
    }
    this.customer = c;
    c.seated = false;
    this.sound.bell();
    const seat = new Vector3(LAYOUT.customer.x, LAYOUT.customer.y, LAYOUT.customer.z);
    c.group.scale.setScalar(LAYOUT.customer.scale);
    const hops = c.group.position.distanceTo(seat) > 10 ? [new Vector3(-9, seat.y, seat.z), seat] : [seat];
    hops.reduce((p, target) => p.then(() => c.hopTo(target, 0.5, 0.9)), Promise.resolve()).then(() => {
      c.seated = true;
      c.setExpression('smile');
      c.poke(0.6);
      this.sound.voice(0.8);
    });
    // Next guest waits in line.
    const next = this.orders[this.orderIndex + 1];
    if (next && !this.queue) {
      const q = new Customer(next.look, this.orderIndex + 2);
      q.group.position.set(LAYOUT.queue.x + 6, LAYOUT.queue.y, LAYOUT.queue.z);
      q.group.scale.setScalar(LAYOUT.queue.scale);
      this.stage.scene.add(q.group);
      q.hopTo(new Vector3(LAYOUT.queue.x, LAYOUT.queue.y, LAYOUT.queue.z), 0.6, 0.8);
      this.queue = q;
    }
  }

  takeOrder() {
    if (!this.order || this.order.taken || !this.customer.seated) return;
    this.order.taken = true;
    this.sound.plop();
    this.customer.poke(0.5);
    setTimeout(() => {
      if (this.station === 'counter' && this.mode === 'play') this.goStation('rice');
    }, 650);
  }

  goStation(name) {
    if (!STATIONS.includes(name) || this.serving) return;
    if (this.mode !== 'play' && name !== 'counter') return;
    if (name === this.station && this.stationEntered) return;
    this.stations[this.station].exit();
    this.station = name;
    this.stationEntered = true;
    this.stations[name].enter();
    this.sound.whoosh();
    this.ui.actions([]);
  }

  // --- Work in progress ----------------------------------------------------------

  addPiece(piece) {
    const count = this.order.pieces.length;
    const slots = LAYOUT.slots[Math.min(2, count)] || LAYOUT.slots[2];
    const k = this.pieces.length;
    this.pieces.push(piece);
    const local = new Vector3(slots[k] ?? slots[slots.length - 1] + 1.3 * (k - slots.length + 1), LAYOUT.geta.h, 0);
    const target = this.set.geta.localToWorld(local.clone());
    const g = piece.group;
    g.position.copy(piece.rice.group.getWorldPosition(new Vector3()));
    piece.rice.group.position.set(0, 0, 0);
    this.stage.scene.add(g);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), LAYOUT.slotAngle);
    this.tween({
      obj: g,
      to: target,
      quaternion: q,
      duration: 0.55,
      arc: 2,
      done: () => {
        this.set.geta.attach(g);
        g.position.copy(local);
        piece.rice.body.kickAll(0, 2.2, 0);
        this.sound.squelch(0.6);
        if (this.pieces.length >= this.order.pieces.length && this.station === 'rice') {
          setTimeout(() => this.station === 'rice' && this.goStation('knife'), 700);
        }
      },
    });
  }

  toTray(slice) {
    if (!this.tray.includes(slice)) this.tray.push(slice);
    this.stage.scene.attach(slice.group);
    this.layoutTray(true);
    if (this.station === 'knife' && this.slicesNeeded().total === 0) {
      setTimeout(() => this.station === 'knife' && this.goStation('build'), 800);
    }
  }

  // Slices sit across the tray, long side front to back.
  layoutTray(animate) {
    const t = LAYOUT.tray;
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    this.tray.forEach((s, i) => {
      const n = this.tray.length;
      const to = new Vector3(t.x + (i - (n - 1) / 2) * 1.25, 0.16, t.z);
      if (animate) this.tween({ obj: s.group, to, quaternion: q, duration: 0.4, arc: 1, done: () => s.body.kickAll(0, 1.2, 0) });
      else {
        s.group.position.copy(to);
        s.group.quaternion.copy(q);
      }
    });
  }

  slicesNeeded() {
    const byKind = {};
    let total = 0;
    if (!this.order || !this.order.taken) return { byKind, total };
    for (const p of this.order.pieces) byKind[p.fish] = (byKind[p.fish] || 0) + 1;
    for (const s of this.tray) if (byKind[s.kind]) byKind[s.kind]--;
    for (const p of this.pieces) if (p.slice && byKind[p.slice.kind]) byKind[p.slice.kind]--;
    for (const k of Object.keys(byKind)) total += Math.max(0, byKind[k]);
    return { byKind, total };
  }

  nextNeededFish() {
    const n = this.slicesNeeded().byKind;
    return Object.keys(n).find((k) => n[k] > 0) || null;
  }

  dayFish() {
    return DAYS[this.day ?? 0].fish;
  }

  dayToppings() {
    return DAYS[this.day ?? 0].toppings;
  }

  plateComplete() {
    return !!this.order && this.pieces.length >= this.order.pieces.length && this.pieces.every((p) => p.slice);
  }

  clearWork() {
    for (const p of this.pieces) {
      p.group.removeFromParent();
      p.dispose();
    }
    for (const s of this.tray) {
      s.group.removeFromParent();
      s.dispose();
    }
    this.pieces = [];
    this.tray = [];
    if (this.stations) this.stations.rice.reset();
  }

  // --- Serving -----------------------------------------------------------------

  async serve() {
    if (this.serving || !this.order || !this.pieces.some((p) => p.slice)) return;
    this.serving = true;
    this.goStationForce('counter');
    const g = this.set.geta;
    const home = g.position.clone();
    const built = this.pieces.filter((p) => p.slice).map((p) => ({
      fish: p.slice.kind,
      scoop: p.rice.scoop,
      shape: p.rice.shapeScore(),
      cut: p.slice.cutScore ?? 0.5,
      wasabi: p.wasabi.length,
      dx: p.placement ? p.placement.dx : 0,
      toppings: p.slice.toppings.counts,
    }));
    const waited = (performance.now() - this.order.arrived) / 1000;
    const score = scorePlate(this.order, built, waited);
    const tip = tipFor(score.total, this.day);
    await this.wait(350);
    this.sound.whoosh();
    // Back along the customer side of the counter, then across to the guest,
    // so the board never passes through the cutting board.
    const lane = LAYOUT.counter.zCustomer + 1.3;
    await this.tweenP({ obj: g, to: new Vector3(home.x, 0, lane), duration: 0.35, arc: 0.4 });
    await this.tweenP({ obj: g, to: new Vector3(0, 0, lane), duration: 0.6, arc: 0.15 });
    const c = this.customer;
    c.setExpression('open');
    c.body.userMode[2] = 0.18;
    await this.wait(400);
    // Eat each piece in three bites.
    for (const p of this.pieces) {
      for (let bite = 0; bite < 3; bite++) {
        c.setExpression(bite % 2 ? 'chew' : 'open');
        this.sound.chomp();
        c.body.kickAll(0, 1.6, -0.8);
        const s = 1 - (bite + 1) / 3;
        await this.tweenP({ obj: p.group, scale: Math.max(0.001, s), duration: 0.16 });
        await this.wait(200);
      }
      p.group.visible = false;
    }
    c.body.userMode[2] = 0;
    const mood = score.total / 100;
    this.sound.voice(mood);
    if (mood >= 0.8) c.celebrate();
    else if (mood >= 0.5) {
      c.setExpression('smile');
      c.poke(0.8);
    } else {
      c.setExpression('frown');
      c.body.kickAll(0, -0.8, 0);
    }
    this.tips += tip;
    this.scores.push(score.total);
    this.lastScore = score.total;
    await this.wait(400);
    this.sound.coins(Math.max(1, Math.round(mood * 5)));
    const head = c.group.position.clone().add(new Vector3(0, c.body.height * LAYOUT.customer.scale + 0.4, 0));
    this.popupAt(`+¥${tip.toLocaleString('en-US')}`, head, mood >= 0.8 ? 'great' : mood >= 0.5 ? 'good' : 'bad');
    if (mood >= 0.8) this.fx.burst('glint', head, 26, { speed: 3, up: 4, gravity: 5, life: 1.2, size: 1.6 });
    this.buzz(mood >= 0.8 ? 30 : 12);
    this.ui.setDay(this.day, this.scores.length, this.orders.length, this.tips);
    await this.wait(500);
    const last = this.orderIndex >= this.orders.length - 1;
    this.ui.scoreCard(c.look.name, quoteFor(score), score, tip, () => this.afterServe(home), last);
  }

  async afterServe(home) {
    this.ui.hideCard();
    const c = this.customer;
    this.order = null;
    this.ui.ticket(null);
    // Guest leaves, board comes back empty.
    c.setExpression('smile');
    c.seated = false;
    const leave = c.hopTo(new Vector3(9, c.group.position.y, c.group.position.z), 0.5, 1).then(() => c.hopTo(EXIT, 0.5, 1));
    leave.then(() => {
      c.group.removeFromParent();
      c.dispose();
    });
    this.clearWork();
    const lane = this.set.geta.position.z;
    await this.tweenP({ obj: this.set.geta, to: new Vector3(home.x, 0, lane), duration: 0.5, arc: 0.15 });
    await this.tweenP({ obj: this.set.geta, to: home, duration: 0.3, arc: 0.2 });
    this.serving = false;
    this.nextCustomer();
  }

  endDay() {
    this.mode = 'summary';
    this.order = null;
    this.ui.ticket(null);
    const avg = Math.round(this.scores.reduce((a, b) => a + b, 0) / Math.max(1, this.scores.length));
    const best = Math.max(0, ...this.scores);
    const p = this.progress;
    p.best[this.day] = Math.max(p.best[this.day] || 0, this.tips);
    if (avg >= 50) p.unlocked = Math.max(p.unlocked, Math.min(DAYS.length - 1, this.day + 1));
    saveProgress(p);
    const hasNext = this.day + 1 < DAYS.length && p.unlocked > this.day;
    this.ui.summaryCard(
      this.day,
      { tips: this.tips, served: this.scores.length, avg, best },
      rankFor(avg),
      hasNext,
      () => {
        this.ui.hideCard();
        this.startDay(this.day + 1);
      },
      () => {
        this.ui.hideCard();
        this.startDay(this.day);
      },
      () => {
        this.ui.hideCard();
        this.showTitle();
      },
    );
  }

  goStationForce(name) {
    this.stations[this.station].exit();
    this.station = name;
    this.stations[name].enter();
  }

  seatCustomer(look, idle) {
    const c = new Customer(look, 99);
    c.group.position.set(LAYOUT.customer.x, LAYOUT.customer.y, LAYOUT.customer.z);
    c.group.scale.setScalar(LAYOUT.customer.scale);
    c.seated = true;
    c.idle = idle;
    this.stage.scene.add(c.group);
    return c;
  }

  removeCustomers() {
    for (const c of [this.customer, this.queue]) {
      if (!c) continue;
      c.group.removeFromParent();
      c.dispose();
    }
    this.customer = null;
    this.queue = null;
  }

  // --- Input -------------------------------------------------------------------

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pointerPos = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'mouse') this.sound.unlock();
      if (this.activePointer != null) return;
      this.activePointer = e.pointerId;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointers cannot be captured.
      }
      if (this.mode === 'title') {
        if (this.customer && this.hitObject(e, this.customer.squishy.mesh)) {
          this.customer.poke(1);
          this.sound.squelch(0.7);
        }
        return;
      }
      if (this.mode !== 'play' || this.serving) return;
      this.stations[this.station].down(e);
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointer) return;
      this.pointerPos = { x: e.clientX, y: e.clientY };
      if (this.mode === 'play' && !this.serving) this.stations[this.station].move(e);
    });
    const end = (e) => {
      if (e.pointerId !== this.activePointer) return;
      this.activePointer = null;
      if (this.mode === 'play' && !this.serving) this.stations[this.station].up(e);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener(
      'pointermove',
      (e) => {
        this.stage.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.stage.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true },
    );
    for (const type of ['pointerup', 'keydown', 'touchend']) window.addEventListener(type, () => this.sound.unlock(), { passive: true });
    // Keyboard: 1-4 switch stations, space holds.
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'play' || e.repeat) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) this.goStation(STATIONS[i]);
      if (e.code === 'Space' && (this.station === 'rice' || this.station === 'counter')) {
        e.preventDefault();
        this.pointerPos = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
        if (this.station === 'counter') this.takeOrder();
        else this.stations.rice.down();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (this.mode === 'play' && e.code === 'Space' && this.station === 'rice') this.stations.rice.up();
    });
  }

  setRay(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.stage.camera);
  }

  hitObject(e, obj) {
    this.setRay(e);
    const hits = this.ray.intersectObject(obj, true);
    return hits[0] || null;
  }

  pickFirst(e, targets) {
    this.setRay(e);
    let best = null;
    for (const t of targets) {
      const h = this.ray.intersectObject(t.obj, true)[0];
      if (h && (!best || h.distance < best.distance)) best = { ...t, point: h.point, distance: h.distance };
    }
    return best;
  }

  planeHit(e, plane) {
    this.setRay(e);
    return this.ray.ray.intersectPlane(plane, new Vector3());
  }

  // --- Tweens --------------------------------------------------------------------

  tween({ obj, to, quaternion, scale, duration, arc = 0, done }) {
    const t = {
      obj,
      from: obj.position.clone(),
      to: to ? to.clone() : null,
      q0: obj.quaternion.clone(),
      q1: quaternion ? quaternion.clone() : null,
      s0: obj.scale.x,
      s1: scale,
      duration,
      arc,
      k: 0,
      done,
    };
    this.tweens = this.tweens.filter((x) => x.obj !== obj);
    this.tweens.push(t);
    return t;
  }

  tweenP(opts) {
    return new Promise((res) => this.tween({ ...opts, done: () => (opts.done && opts.done(), res()) }));
  }

  wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  stepTweens(dt) {
    for (const t of [...this.tweens]) {
      t.k = Math.min(1, t.k + dt / t.duration);
      const e = t.k < 0.5 ? 2 * t.k * t.k : 1 - Math.pow(-2 * t.k + 2, 2) / 2;
      if (t.to) {
        t.obj.position.lerpVectors(t.from, t.to, e);
        t.obj.position.y += Math.sin(Math.PI * e) * t.arc;
      }
      if (t.q1) t.obj.quaternion.slerpQuaternions(t.q0, t.q1, e);
      if (t.s1 != null) t.obj.scale.setScalar(t.s0 + (t.s1 - t.s0) * e);
      if (t.k >= 1) {
        this.tweens.splice(this.tweens.indexOf(t), 1);
        if (t.done) t.done();
      }
    }
  }

  // --- Capture -------------------------------------------------------------------

  captureInfo() {
    return {
      day: this.day != null ? DAYS[this.day].title : '',
      guest: this.order ? `${this.order.look.name}, No. ${String(this.orderIndex + 1).padStart(2, '0')}` : '',
      tips: this.tips || 0,
      score: this.lastScore,
      url: GAME.url,
    };
  }

  async record() {
    if (this.recorder.busy) return this.recorder.stop();
    this.sound.unlock();
    const crop = { x: 0, y: 0, w: this.stage.width, h: this.stage.height };
    const aspect = crop.w / crop.h;
    this.recStarted = performance.now();
    try {
      const clip = await this.recorder.start(aspect, this.sound.muted ? null : this.sound.stream(), crop);
      this.recStarted = null;
      this.ui.recording(false);
      const file = new File([clip.blob], `squishi-${stamp()}.${clip.ext}`, { type: clip.type });
      this.present(file, true);
    } catch (err) {
      this.recStarted = null;
      this.ui.recording(false);
      this.ui.toast(err.message || 'Recording failed');
    }
  }

  async photo() {
    const crop = { x: 0, y: 0, w: this.stage.width, h: this.stage.height };
    const shot = await this.recorder.screenshot(crop.w / crop.h, crop);
    const file = new File([shot.blob], `squishi-${stamp()}.png`, { type: 'image/png' });
    this.present(file, false);
  }

  present(file, isVideo) {
    const url = URL.createObjectURL(file);
    const close = () => {
      this.ui.hidePreview();
      URL.revokeObjectURL(url);
    };
    this.ui.showPreview(url, isVideo, {
      share: canShareFile(file) ? () => shareOrDownload(file, true) : null,
      download: () => download(file),
      close,
    });
  }

  // --- Loop ----------------------------------------------------------------------

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.1, Math.max(0, raw));
    this.watchPerformance(raw);
    this.tick(dt);
    this.stage.render(dt);
    this.recorder.capture(this.captureInfo());
    if (this.recStarted) this.ui.recording(true, Math.max(0, Math.ceil(6 - (performance.now() - this.recStarted) / 1000)));
  }

  // Brief slow motion for big moments.
  slowMo(scale, seconds) {
    if (this.stage.reducedMotion.matches) return;
    this.timeScale = scale;
    this.slowFor = seconds;
  }

  // World point to screen pixels, for pop-ups.
  screenOf(world) {
    const v = world.clone().project(this.stage.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  popupAt(text, world, kind = 'good') {
    const p = this.screenOf(world);
    this.ui.popup(text, p.x, p.y, kind);
  }

  buzz(ms) {
    haptic(ms);
  }

  // Everything but drawing, so tests can step time without rendering.
  tick(realDt) {
    if (this.slowFor > 0) this.slowFor -= realDt;
    else this.timeScale += (1 - this.timeScale) * (1 - Math.exp(-realDt * 8));
    const dt = realDt * this.timeScale;
    this.fx.update(dt);
    this.stepTweens(dt);
    this.set.update(this.stage.time);
    for (const name of STATIONS) this.stations[name].update(dt);
    for (const p of this.pieces) p.update(dt);
    for (const s of this.tray) s.update(dt);
    const dragging = this.stations.build.drag;
    if (dragging) dragging.slice.update(dt);
    if (this.customer) {
      if (this.order && this.order.taken !== undefined && !this.serving) {
        const waited = (performance.now() - this.order.arrived) / 1000;
        this.customer.impatience = Math.min(1, Math.max(0, waited / this.order.patience - 0.35) / 0.65);
        this.ui.patience(1 - waited / this.order.patience);
        if (this.customer.impatience > 0.7 && this.customer.expression === 'smile') this.customer.setExpression('flat');
      } else this.customer.impatience = 0;
      if (this.customer.idle && Math.random() < dt * 0.25) this.customer.poke(0.4);
      this.customer.update(dt);
    }
    if (this.queue) this.queue.update(dt);

    if (this.mode === 'play') {
      this.ui.ticket(this.order && this.order.taken ? this.order : this.order && this.customer && this.customer.seated ? this.order : null, this.orderIndex + 1, this.order ? this.order.pieces.map((_, i) => i < this.pieces.filter((p) => p.slice).length) : []);
      const status = {};
      for (const s of STATIONS) status[s] = this.stations[s].status ? this.stations[s].status() : null;
      if (this.order && this.customer && this.customer.seated && !this.order.taken) status.counter = 'todo';
      if (this.plateComplete()) status.counter = 'ready';
      this.ui.setStation(this.station, status);
    }

    this.stage.update(realDt);
  }

  watchPerformance(raw) {
    const q = this.quality;
    if (q.fixed || this.recorder.busy || raw > 0.5) return;
    q.avg += (raw * 1000 - q.avg) * 0.05;
    if (q.avg > PERF.slowFrameMs) q.slowFor += raw;
    else q.slowFor = Math.max(0, q.slowFor - raw * 0.5);
    if (q.slowFor < PERF.window) return;
    q.slowFor = 0;
    q.avg = 16;
    const next = TIER_ORDER[TIER_ORDER.indexOf(this.stage.tierName) + 1];
    if (next) this.stage.setTier(next);
  }
}

// What the guest says, led by the weakest part of the plate.
function quoteFor(score) {
  const p = score.parts;
  if (score.missing) return 'Where is the rest of my order?';
  if (score.results.some((r) => r.wrongFish)) return 'That is not the fish I asked for. Tasty, though.';
  if (score.total >= 90) return pick(['Perfect. I am wobbling with joy.', 'Best nigiri on the street.', 'I will tell all my jelly friends.']);
  const worst = Object.entries(p).sort((a, b) => a[1] - b[1])[0][0];
  const lines = {
    rice: ['The rice was a little loose.', 'Rice felt a bit squashed.'],
    cut: ['The slice was a bit uneven.', 'Nice fish, odd cut.'],
    build: ['Not quite what I asked for.', 'Check the ticket next time.'],
    wait: ['Took a while, but worth it.', 'I almost dozed off.'],
  }[worst];
  const lead = score.total >= 70 ? 'Lovely. ' : score.total >= 45 ? 'Not bad. ' : 'Hmm. ';
  return lead + pick(lines);
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(`${GAME.storageKey}.progress`));
    if (p && typeof p.unlocked === 'number') return { unlocked: p.unlocked, best: p.best || [] };
  } catch {
    // No saved progress.
  }
  return { unlocked: 0, best: [] };
}

function saveProgress(p) {
  try {
    localStorage.setItem(`${GAME.storageKey}.progress`, JSON.stringify(p));
  } catch {
    // Progress just will not persist.
  }
}

