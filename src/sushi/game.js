import { Quaternion, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { DAYS, DISHES, GAME, LAYOUT, PERF, RUSH, CUSTOMER_LOOKS, UNLOCK_ALL, dishKey, usesStove } from './config.js';
import { guessTier, Stage, TIERS, TIER_ORDER } from './stage.js';
import { SushiSet } from './set.js';
import { contactShadow, Customer, Paw, SousChef } from './critters.js';
import { hotOf, makeOrders, makiOf, nigiriOf, onigiriOf, orderSize, scoopScore, perfectDay, plateLayout, rankFor, scorePlate, starsFor, tipFor } from './orders.js';
import { MAKI, makiSpots, MakiSheet, platedMaki } from './maki.js';
import { BuildStation, CounterStation, KnifeStation, RiceStation } from './stations.js';
import { StoveStation } from './stove.js';
import { Stove, warmHot } from './hot.js';
import { GameUI } from './ui.js';
import { BarSound } from './audio.js';
import { LofiMusic } from './music.js';
import { Recorder, canShareFile, download, shareOrDownload } from '../record.js';
import { composeBar } from './capture.js';
import { Effects, haptic } from './fx.js';
import { PhotoBooth } from './booth.js';
import { warmFoods } from './food.js';
import { loadWall, postRun, savedName } from './wall.js';

const STATIONS = ['counter', 'rice', 'knife', 'build', 'stove'];

// The dish each day introduces, for the intro card's photo.
const SHOWCASE = {
  tuna: { name: 'Maguro nigiri', jp: '鮪', pieces: [{ fish: 'tuna', wasabi: 1, toppings: { scallion: true } }] },
  tamago: { name: 'Tamago nigiri', jp: '玉子', pieces: [{ fish: 'tamago', wasabi: 0, toppings: { nori: true } }] },
  maki: { name: 'Hosomaki rolls', jp: '細巻き', pieces: [{ maki: 'kappa', wasabi: 0, toppings: {} }] },
  unagi: { name: 'Unagi nigiri', jp: '鰻', pieces: [{ fish: 'unagi', wasabi: 0, toppings: { sauce: true, nori: true, sesame: true } }] },
  udon: { name: 'Kitsune udon', jp: 'きつねうどん', pieces: [{ udon: 'kitsune', toppings: { kamaboko: true, scallion: true, aburaage: true } }] },
  gyoza: { name: 'Gyoza', jp: '餃子', pieces: [{ gyoza: 3 }] },
  onigiri: { name: 'Ume onigiri', jp: '梅おにぎり', pieces: [{ onigiri: 'ume' }] },
  ramen: { name: 'Shoyu ramen', jp: '醤油ラーメン', pieces: [{ ramen: 'shoyu', toppings: { chashu: true, naruto: true, menma: true, scallion: true } }] },
  takoyaki: { name: 'Takoyaki', jp: 'たこ焼き', pieces: [{ takoyaki: 6, toppings: { sauce: true, mayo: true, katsuobushi: true, aonori: true } }] },
};
const ENTRANCE = new Vector3(-17, LAYOUT.customer.y, LAYOUT.customer.z);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const params = new URLSearchParams(location.search);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    // Start on the lower of what the GPU suggests and what last worked here.
    const forced = TIERS[params.get('tier')] ? params.get('tier') : null;
    const saved = loadTier();
    const guess = guessTier(coarse);
    const start = forced || TIER_ORDER[Math.max(TIER_ORDER.indexOf(guess), saved ? TIER_ORDER.indexOf(saved) : 0)];
    this.stage = new Stage(canvas, start);
    this.stage.onFailure = () => this.stepDown();
    // A GPU reset (the driver gave up on a long frame) loses everything on the
    // card. Reload one tier lower rather than sit on a dead canvas.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.pause();
      const next = TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(this.stage.tierName) + 1)];
      saveTier(next);
      this.ui.toast('Graphics reset. Reloading with lighter settings.', 4000);
      setTimeout(() => location.reload(), 900);
    });
    this.set = new SushiSet(this.stage.scene);
    this.stove = new Stove();
    this.stage.scene.add(this.stove.group);
    this.sound = new BarSound();
    this.music = new LofiMusic(this.sound);
    // The band starts with the first tap or key (browsers need a gesture).
    this.sound.onUnlock = () => this.music.sync();
    this.fx = new Effects(this.stage.scene);
    this.booth = new PhotoBooth(this.stage, this.set);
    this.stage.beforeRender = () => this.booth.flush();
    this.sous = new SousChef();
    this.stage.scene.add(this.sous.group);
    // The guest leans on the far edge of the counter: a soft shade there
    // grounds them, since their own shadow falls behind it.
    this.leavers = [];
    this.counterShade = contactShadow();
    // On the ledge, where the guest's paws rest.
    this.counterShade.position.set(0, -0.69, LAYOUT.counter.zCustomer - 1.75);
    this.stage.scene.add(this.counterShade);
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
    this.rolls = [];
    this.onigiri = [];
    this.progress = loadProgress();
    this.quality = { slowFor: 0, avg: 16, fixed: new URLSearchParams(location.search).has('fixed') || new URLSearchParams(location.search).has('tier') };

    this.ui = new GameUI({
      onStation: (s) => this.goStation(s),
      onMute: () => {
        this.sound.unlock();
        this.sound.setMuted(!this.sound.muted);
        this.ui.setMuted(this.sound.muted);
        this.music.sync();
      },
      onMusic: () => {
        this.sound.unlock();
        this.music.setOn(!this.music.on);
        this.ui.setMusic(this.music.on);
      },
      onRecord: () => this.record(),
      onPhoto: () => this.photo(),
      onStart: (day) => this.startDay(day),
      onTool: (t) => this.stations.build.setTool(t),
      onWall: () => this.openWall(),
      onBook: () => this.openBook(),
      onPause: () => this.openPause(),
    });
    this.ui.setMuted(this.sound.muted);
    this.ui.setMusic(this.music.on);

    this.stations = {
      counter: new CounterStation(this),
      rice: new RiceStation(this),
      knife: new KnifeStation(this),
      build: new BuildStation(this),
      stove: new StoveStation(this),
    };
    this.station = 'counter';
    this.bindInput();
    this.stage.resize();
    window.addEventListener('resize', () => this.stage.resize());

    this.showTitle();
    this.last = performance.now();
    this.running = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else if (this.mode !== 'paused') this.resume();
      this.music.sync();
    });
    this.resume();
  }

  // Loading is two steps. Behind the loading screen: the bar itself and one
  // frame through the post chain, so the title comes up fast. Then, while the
  // title is showing, one of every dish compiles in the background, a piece
  // at a time so the title never freezes. Starting a stage waits for it.
  async warmUp(progress = () => {}) {
    const r = this.stage.renderer;
    await progress(0.1);
    try {
      if (r.compileAsync) await r.compileAsync(this.stage.scene, this.stage.camera);
    } catch (err) {
      console.warn('Shader warm-up skipped', err);
    }
    performance.mark('warm-scene');
    await progress(0.7);
    this.stage.render(1 / 60);
    performance.mark('warm-frame');
    await progress(1);
    this.last = performance.now();
    this.warming = this.warmFood()
      .catch((err) => console.warn('Food warm-up skipped', err))
      .finally(() => {
        this.warming = null;
        performance.mark('warm-food');
      });
  }

  async warmFood() {
    const r = this.stage.renderer;
    const frame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
    await frame();
    const parts = [...warmFoods().children, new Paw().group, platedMaki('kappa'), platedMaki('tekka'), platedMaki('sake'), ...warmHot().children];
    const sheet = new MakiSheet();
    sheet.addFilling('kappa');
    parts.push(sheet.group);
    // Compile against the bar's lights and environment without ever adding
    // the dishes to it, so nothing pops up on the title screen.
    for (const part of parts) {
      const tmp = new Scene();
      part.traverse((o) => {
        o.visible = true;
        o.frustumCulled = false;
        if (o.isMesh) o.castShadow = true;
      });
      tmp.add(part);
      if (r.compileAsync) await r.compileAsync(tmp, this.stage.camera, this.stage.scene);
      else r.compile(tmp, this.stage.camera, this.stage.scene);
      await frame();
    }
    if (r.compileAsync) await r.compileAsync(this.booth.scene, this.booth.camera);
    await frame();
    // A ticket photo compiles what the photo booth uses.
    // Draw the frame ourselves: the main loop may be paused.
    const photo = this.booth.orderPhoto({ pieces: [{ fish: 'salmon', wasabi: 1, toppings: { ikura: 5, sesame: true } }, { fish: 'tuna', wasabi: 0, toppings: { scallion: true, sauce: true } }] }, 96, 60);
    this.stage.render(1 / 60);
    await photo;
  }

  // --- Flow ------------------------------------------------------------------

  showTitle() {
    this.session = (this.session || 0) + 1;
    this.mode = 'title';
    this.music.setMood('chill');
    this.music.setDucked(false);
    this.clearWork();
    this.removeCustomers();
    this.stage.goTo('title', true);
    this.ui.showTitle(this.progress);
    const look = CUSTOMER_LOOKS[Math.floor(Math.random() * CUSTOMER_LOOKS.length)];
    this.customer = this.seatCustomer(look, true);
    this.order = null;
    this.placeSous(LAYOUT.sousTitle);
  }

  placeSous(at, hop) {
    const g = this.sous.group;
    g.scale.setScalar(at.scale);
    g.rotation.y = at.turn;
    const to = new Vector3(at.x, at.y, at.z);
    if (hop) this.sous.hopTo(to, 0.6, 1.4);
    else g.position.copy(to);
  }

  startDay(dayIndex) {
    // The dishes are still compiling: start the moment they are ready.
    if (this.warming) {
      this.ui.toast('Warming the plates...', 1500);
      if (this.pendingStart == null) {
        this.warming.then(() => {
          const d = this.pendingStart;
          this.pendingStart = null;
          if (this.mode === 'title') this.startDay(d);
        });
      }
      this.pendingStart = dayIndex;
      return;
    }
    this.session = (this.session || 0) + 1;
    this.sound.unlock();
    this.day = dayIndex;
    this.orders = makeOrders(dayIndex);
    this.orderIndex = -1;
    this.tips = 0;
    this.scores = [];
    this.served = [];
    this.combo = 0;
    this.walkouts = 0;
    this.perfect = perfectDay(this.orders, dayIndex);
    this.music.setMood('groove');
    this.music.setDucked(false);
    this.ui.hideTitle();
    this.removeCustomers();
    this.clearWork();
    this.mode = 'intro';
    this.placeSous(LAYOUT.sous, true);
    this.ui.setDay(dayIndex, 0, this.orders.length, 0);
    this.ui.showStations(usesStove(DAYS[dayIndex]) ? STATIONS : STATIONS.filter((s) => s !== 'stove'));
    this.stage.goTo('counter');
    const go = () => {
      this.ui.hideCard();
      this.mode = 'play';
      this.nextCustomer();
    };
    const dish = DAYS[dayIndex].dish && SHOWCASE[DAYS[dayIndex].dish];
    this.ui.dayIntroCard(dayIndex, go, { goals: this.goals() });
    // A glamour shot of the day's new dish, dropped in once it is rendered.
    if (dish) {
      const session = this.session;
      this.booth.orderPhoto({ pieces: dish.pieces }, 640, 360).then((img) => {
        if (this.session === session && this.mode === 'intro') this.ui.dayIntroCard(dayIndex, go, { goals: this.goals(), showcase: { img, name: dish.name, jp: dish.jp } });
      });
    }
  }

  nextCustomer() {
    this.orderIndex++;
    if (this.orderIndex >= this.orders.length) return this.endDay();
    const order = this.orders[this.orderIndex];
    order.taken = false;
    this.photograph(order);
    // The next guest's picture waits until this one has settled in, so the
    // two builds never land in the same frame.
    const upcoming = this.orders[this.orderIndex + 1];
    const session = this.session;
    if (upcoming) setTimeout(() => this.session === session && this.photograph(upcoming), 2500);
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
    this.sousSays({ jp: 'いらっしゃいませ', en: 'Welcome in' }, 'open', 900);
    const prev = this.orders[this.orderIndex - 1];
    this.music.setMood(order.rush ? 'rush' : 'groove');
    if (order.rush && !(prev && prev.rush)) {
      this.ui.banner('Rush hour!', 'ラッシュ', 'rush');
      this.sound.bell();
      setTimeout(() => this.sound.bell(), 180);
      this.stage.addShake(0.05);
    }
    const seat = new Vector3(LAYOUT.customer.x, LAYOUT.customer.y, LAYOUT.customer.z);
    // From the door: two hops along the counter. From the line: one hop over.
    const hops = c.group.position.x < -12 ? [new Vector3(-9, seat.y, seat.z), seat] : [seat];
    hops.reduce((p, target) => p.then(() => !c.leaving && c.hopTo(target, 0.5, 0.9, LAYOUT.customer.scale)), Promise.resolve()).then(() => {
      if (c.leaving || this.customer !== c) return;
      c.seated = true;
      c.setExpression('smile');
      c.poke(0.6);
      c.emote(order.rush ? 'surprise' : 'note', 1200);
      this.sound.voice(0.8);
    });
    // Next guest waits in line.
    const next = this.orders[this.orderIndex + 1];
    if (next && !this.queue) {
      const q = new Customer(next.look, this.orderIndex + 2);
      q.group.position.set(LAYOUT.queue.x + 6, LAYOUT.queue.y + 0.22, LAYOUT.queue.z);
      q.group.scale.setScalar(LAYOUT.queue.scale);
      this.stage.scene.add(q.group);
      q.hopTo(new Vector3(LAYOUT.queue.x, LAYOUT.queue.y + 0.22, LAYOUT.queue.z), 0.6, 0.8);
      this.queue = q;
    }
  }

  takeOrder() {
    if (!this.order || this.order.taken || !this.customer.seated) return;
    this.order.taken = true;
    this.sound.plop();
    this.customer.poke(0.5);
    const next = hotOf(this.order).length ? 'stove' : 'rice';
    setTimeout(() => {
      if (this.station === 'counter' && this.mode === 'play') this.goStation(next);
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
    const slots = plateLayout(this.order).nigiri;
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
        if (this.stations.rice.needed <= 0 && this.station === 'rice') {
          setTimeout(() => this.station === 'rice' && this.goStation('knife'), 700);
        }
      },
    });
  }

  // A finished onigiri hops onto the serving board, standing up.
  addOnigiri(oni) {
    const k = this.onigiri.length;
    const n = onigiriOf(this.order).length;
    this.onigiri.push(oni);
    const local = new Vector3(-0.55 + (k - (n - 1) / 2) * 1.9, LAYOUT.geta.h, 0);
    const target = this.set.geta.localToWorld(local.clone());
    this.tween({
      obj: oni.group,
      to: target,
      duration: 0.55,
      arc: 2,
      done: () => {
        if (!this.onigiri.includes(oni)) return;
        this.set.geta.attach(oni.group);
        oni.group.position.copy(local);
        oni.group.rotation.set(0, 0, 0);
        oni.rice.body.kickAll(0, 2.2, 0);
        this.sound.squelch(0.6);
        if (this.station === 'rice' && this.stations.rice.needed <= 0 && !nigiriOf(this.order || { pieces: [] }).length) setTimeout(() => this.station === 'rice' && this.goStation('counter'), 700);
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
    for (const p of nigiriOf(this.order)) byKind[p.fish] = (byKind[p.fish] || 0) + 1;
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

  dayFillings() {
    return DAYS[this.day ?? 0].maki || [];
  }

  dayToppings() {
    return DAYS[this.day ?? 0].toppings;
  }

  // How far each ticket line has come, in ticket order.
  orderProgress() {
    if (!this.order) return [];
    let n = 0;
    let m = 0;
    let k = 0;
    const stove = this.stations.stove;
    return this.order.pieces.map((want) => {
      if (want.udon || want.ramen || want.gyoza || want.takoyaki) {
        const st = stove.order === this.order ? stove.state : 'none';
        const plated = !!this.hotDish;
        const dish = stove.order === this.order ? stove.bowl || stove.boat : null;
        const tops = plated ? this.hotDish.built.toppings || {} : dish ? Object.fromEntries(Object.keys(dish.tops).map((k) => [k, true])) : {};
        if (want.udon || want.ramen) return { hot: true, boiled: plated || ['pour', 'top', 'done'].includes(st), dashi: plated || ['top', 'done'].includes(st), tops, plated };
        if (want.takoyaki) {
          const turned = plated ? want.takoyaki : st === 'turn' ? stove.balls.filter((b) => b.turned).length : ['toBoat', 'top', 'done'].includes(st) ? want.takoyaki : 0;
          return { hot: true, batter: plated || ['tako', 'turn', 'toBoat', 'top', 'done'].includes(st), turned, tops, plated };
        }
        const made = plated ? want.gyoza : stove.order === this.order ? stove.k || 0 : 0;
        return { hot: true, made, fried: plated, plated };
      }
      if (want.onigiri) {
        const o = this.onigiri[k++];
        if (o) return { rice: true, filling: o.filling, wrapped: true, plated: true };
        const live = k === this.onigiri.length + 1 ? this.stations.rice.oni : null;
        return live ? { rice: true, filling: live.filling || null, wrapped: !!live.nori, plated: false } : { rice: false };
      }
      if (want.maki) {
        const r = this.rolls[m++];
        const sheet = !r && m === this.rolls.length + 1 ? this.stations.rice.sheet : null;
        return { maki: true, rice: !!(r || (sheet && sheet.riceLayer.visible)), filling: r ? r.filling : sheet ? sheet.filling : null, rolled: !!r, cuts: r ? r.cuts.length : 0, plated: !!(r && r.plated) };
      }
      const p = this.pieces[n++];
      if (!p) return { rice: false, fish: false, wasabi: 0, tops: {} };
      return { rice: true, fish: !!p.slice, wasabi: p.wasabi.length, tops: p.tops };
    });
  }

  // Every line matches its ticket: fish on, wasabi count, toppings; rolls
  // with the right filling, cut and plated.
  plateMatches() {
    if (!this.plateComplete()) return false;
    const hot = hotOf(this.order)[0];
    if (hot) {
      const b = this.hotDish.built;
      if (b.key !== dishKey(hot)) return false;
      if (!hot.toppings) return true;
      const given = Object.keys(b.toppings || {});
      return given.length === Object.keys(hot.toppings).length && given.every((t) => hot.toppings[t]);
    }
    if (!onigiriOf(this.order).every((want, i) => this.onigiri[i] && this.onigiri[i].filling === want.onigiri)) return false;
    const rollsOk = makiOf(this.order).every((want, i) => this.rolls[i] && this.rolls[i].filling === want.maki);
    return (
      rollsOk &&
      nigiriOf(this.order).every((want, i) => {
        const p = this.pieces[i];
        const tops = p.tops;
        if (p.wasabi.length !== (want.wasabi || 0)) return false;
        return Object.entries(want.toppings).every(([k, v]) => (k === 'ikura' ? tops.ikura === v : !!tops[k]));
      })
    );
  }

  plateComplete() {
    if (!this.order) return false;
    if (hotOf(this.order).length) return !!this.hotDish;
    const o = onigiriOf(this.order).length;
    if (o && this.onigiri.length < o) return false;
    const n = nigiriOf(this.order).length;
    const m = makiOf(this.order).length;
    return this.pieces.length >= n && this.pieces.every((p) => p.slice) && this.rolls.filter((r) => r.plated).length >= m;
  }

  // Something on the board to serve.
  hasFood() {
    return !!this.hotDish || this.onigiri.length > 0 || this.pieces.some((p) => p.slice) || this.rolls.some((r) => r.plated);
  }

  // --- Rolls -------------------------------------------------------------------

  // A fresh roll goes from the mat to the cutting board.
  addRoll(log, sheet) {
    log.scoop = sheet.scoop ?? 0.65;
    log.spreadQuality = sheet.spreadQuality;
    this.rolls.push(log);
    this.stage.scene.attach(log.group);
    this.stage.scene.remove(sheet.group);
    const target = new Vector3(LAYOUT.block.x + 3.4, LAYOUT.board.h + MAKI.radius, LAYOUT.block.z + 0.25);
    const session = this.session;
    this.tween({
      obj: log.group,
      to: target,
      quaternion: new Quaternion(),
      duration: 0.6,
      arc: 1.6,
      done: () => {
        if (this.session !== session) return;
        log.onBoard = true;
        log.squash = 1;
        this.sound.tap();
        if (this.station === 'knife') this.stations.knife.show(this.stations.knife.kind);
        if (this.station === 'rice' && this.stations.rice.needed <= 0) setTimeout(() => this.station === 'rice' && this.goStation('knife'), 500);
      },
    });
  }

  // Six cut pieces stand up on the serving board, cut face up.
  plateRoll(roll) {
    // The guest may have walked out while the last cut landed.
    if (!this.order || !this.rolls.includes(roll)) return;
    const layout = plateLayout(this.order);
    const spots = makiSpots(layout.maki ?? 0);
    const up = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
    let landed = 0;
    roll.pieces.forEach((p, i) => {
      this.stage.scene.attach(p);
      const local = spots[i].clone().setY(LAYOUT.geta.h + roll.pieceLen / 2);
      const to = this.set.geta.localToWorld(local.clone());
      setTimeout(() => {
        this.tween({
          obj: p,
          to,
          quaternion: up,
          duration: 0.45,
          arc: 1.4,
          done: () => {
            this.set.geta.attach(p);
            p.position.copy(local);
            p.userData.plated = true;
            p.scale.set(1.15, 0.8, 1.15);
            this.tween({ obj: p, scaleVec: new Vector3(1, 1, 1), duration: 0.25 });
            this.sound.tap();
            if (++landed === roll.pieces.length) {
              roll.plated = true;
              roll.onBoard = false;
              this.popupAt(roll.cutScore > 0.8 ? 'Beautiful roll' : 'Plated', this.set.geta.localToWorld(spots[1].clone().setY(1.6)), roll.cutScore > 0.8 ? 'great' : 'good');
              if (roll.cutScore > 0.8) this.fx.burst('glint', this.set.geta.localToWorld(spots[1].clone().setY(1.2)), 14, { speed: 2, up: 2.6, gravity: 5, life: 0.9 });
              if (this.station === 'knife') {
                if (this.slicesNeeded().total > 0) this.stations.knife.show(this.nextNeededFish());
                else setTimeout(() => this.station === 'knife' && this.goStation(this.plateComplete() && !this.pieces.length ? 'counter' : 'build'), 600);
              }
            }
          },
        });
      }, i * 70);
    });
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
    for (const r of this.rolls || []) {
      r.group.removeFromParent();
      for (const p of r.pieces) p.removeFromParent();
    }
    for (const o of this.onigiri) {
      o.group.removeFromParent();
      o.dispose();
    }
    this.onigiri = [];
    if (this.hotDish) {
      this.hotDish.group.removeFromParent();
      if (this.hotDish.bowl) this.hotDish.bowl.dispose();
      if (this.hotDish.plate) this.hotDish.plate.dispose();
      if (this.hotDish.boat) this.hotDish.boat.dispose();
      this.hotDish = null;
    }
    this.pieces = [];
    this.tray = [];
    this.rolls = [];
    if (this.stations) {
      this.stations.rice.reset();
      this.stations.stove.reset();
    }
  }

  // --- Serving -----------------------------------------------------------------

  async serve() {
    if (this.serving || !this.order || !this.hasFood()) return;
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
      toppings: p.tops,
    }));
    for (const r of this.rolls.filter((x) => x.plated)) built.push({ maki: r.filling, scoop: r.scoop, shape: r.spreadQuality, cut: r.cutScore, wasabi: 0, dx: 0, toppings: {} });
    if (this.hotDish) built.push(this.hotDish.built);
    for (const o of this.onigiri) built.push({ key: `o:${o.filling}`, parts: [scoopScore(o.rice.scoop) * 0.4 + o.rice.shapeScore() * 0.6, o.fillScore ?? 0.5, 1] });
    const score = scorePlate(this.order, built, this.order.waited || 0);
    // Tip: the plate, then rush, combo and speed on top.
    const bonuses = [];
    let mult = 1;
    if (this.order.rush) {
      mult *= RUSH.tip;
      bonuses.push({ label: 'Rush', value: `×${RUSH.tip}` });
    }
    this.combo = score.total >= RUSH.comboAt ? (this.combo || 0) + 1 : 0;
    if (this.combo >= 2) {
      const c = Math.min(RUSH.comboMax, 1 + RUSH.comboStep * (this.combo - 1));
      mult *= c;
      bonuses.push({ label: `Combo ${this.combo}`, value: `×${c.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}` });
    }
    const look = this.order.look;
    const favDone = this.order.pieces.some((p) => dishKey(p) === look.fav) && score.total >= RUSH.favouriteAt;
    if (favDone) {
      mult *= 1 + RUSH.favouriteTip;
      bonuses.push({ label: 'Favourite', value: `+${Math.round(RUSH.favouriteTip * 100)}%` });
    }
    if ((this.order.waited || 0) < this.order.patience * RUSH.speedy && score.total >= 60) {
      mult *= 1 + RUSH.speedyTip;
      bonuses.push({ label: 'Speedy', value: `+${Math.round(RUSH.speedyTip * 100)}%` });
    }
    const tip = Math.round((tipFor(score.total, this.day, orderSize(this.order)) * mult) / 10) * 10;
    this.ui.combo(this.combo);
    const photo = this.booth.platePhoto(480, 300, this.rolls.length || this.hotDish ? 2 : this.pieces.length);
    photo.then((img) => (this.served = [...(this.served || []), { img, score: score.total, tip, guest: this.order.look.name, species: this.order.look.species, day: this.day }]));
    await this.wait(350);
    this.sound.whoosh();
    // Back along the customer side of the counter, then across to the guest,
    // so the board never passes through the cutting board.
    const lane = LAYOUT.counter.zCustomer + 1.3;
    await this.tweenP({ obj: g, to: new Vector3(home.x, 0, lane), duration: 0.35, arc: 0.4 });
    await this.tweenP({ obj: g, to: new Vector3(0, 0, lane), duration: 0.6, arc: 0.15 });
    const c = this.customer;
    c.setExpression('wow');
    c.emote('surprise', 700);
    c.setPose('eat', 6);
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
    // Onigiri in three bites each.
    for (const o of this.onigiri) {
      for (let bite = 0; bite < 3; bite++) {
        c.setExpression(bite % 2 ? 'chew' : 'open');
        this.sound.chomp();
        c.body.kickAll(0, 1.6, -0.8);
        await this.tweenP({ obj: o.group, scale: Math.max(0.001, 1 - (bite + 1) / 3), duration: 0.16 });
        await this.wait(200);
      }
      o.group.visible = false;
    }
    // Udon in three big slurps; gyoza one at a time.
    const hd = this.hotDish;
    if (hd && hd.bowl) {
      for (let k = 1; k <= 3; k++) {
        c.setExpression(k % 2 ? 'open' : 'chew');
        this.sound.slurp();
        c.body.kickAll(0, 1.4, -0.9);
        const from = (k - 1) / 3;
        for (let f = 0; f <= 6; f++) {
          hd.bowl.eat(from + (f / 6) * (1 / 3));
          await this.wait(40);
        }
        await this.wait(260);
      }
    } else if (hd && hd.boat) {
      // Takoyaki: one at a time, hot, hot, hot.
      const n = hd.boat.balls.length;
      for (let k = 1; k <= n; k++) {
        c.setExpression(k % 2 ? 'open' : 'chew');
        this.sound.chomp();
        c.body.kickAll(0, 1.5, -0.8);
        hd.boat.eat(k / n);
        await this.wait(k === 1 ? 420 : 230);
        if (k === 1) c.emote && c.emote('sweat');
      }
    } else if (hd && hd.plate) {
      for (const gz of hd.plate.gyozas) {
        c.setExpression('open');
        this.sound.chomp();
        c.body.kickAll(0, 1.6, -0.8);
        await this.tweenP({ obj: gz.group, scale: 0.001, duration: 0.18 });
        gz.group.visible = false;
        c.setExpression('chew');
        await this.wait(260);
      }
    }
    // Rolls go two pieces a bite.
    const rollPieces = this.rolls.flatMap((r) => (r.plated ? r.pieces : []));
    for (let k = 0; k < rollPieces.length; k += 2) {
      c.setExpression(k % 4 ? 'chew' : 'open');
      this.sound.chomp();
      c.body.kickAll(0, 1.4, -0.7);
      const pair = rollPieces.slice(k, k + 2);
      await Promise.all(pair.map((p) => this.tweenP({ obj: p, scale: 0.001, duration: 0.16 })));
      pair.forEach((p) => (p.visible = false));
      await this.wait(180);
    }
    c.body.userMode[2] = 0;
    c.setPose('rest', 0);
    const mood = score.total / 100;
    this.sound.voice(mood);
    if (mood >= 0.8) {
      c.celebrate();
      this.popupAt({ jp: 'おいしい！', en: 'So good' }, c.group.position.clone().add(new Vector3(-3.2, c.height * LAYOUT.customer.scale * 0.8, 0)), 'say');
      this.sous.celebrate();
      setTimeout(() => this.sous.setExpression('smile'), 1600);
    } else if (mood >= 0.5) {
      c.setExpression('smile');
      c.poke(0.8);
    } else {
      c.setExpression('frown');
      c.emote('gloom', 2200);
      c.body.kickAll(0, -0.8, 0);
      this.sousSays(null, 'frown', 1600);
      this.sous.emote('sweat', 1600);
    }
    this.tips += tip;
    this.scores.push(score.total);
    this.recordInBook(built, score.total, favDone);
    this.lastScore = score.total;
    await this.wait(400);
    this.sound.coins(Math.max(1, Math.round(mood * 5)));
    // Beside the guest, so it never lands on the score card.
    const head = c.group.position.clone().add(new Vector3(3.6, c.height * LAYOUT.customer.scale * 0.72, 0));
    this.popupAt(`+¥${tip.toLocaleString('en-US')}`, head, mood >= 0.8 ? 'great' : mood >= 0.5 ? 'good' : 'bad');
    if (mood >= 0.8) this.fx.burst('glint', head, 26, { speed: 3, up: 4, gravity: 5, life: 1.2, size: 1.6 });
    this.buzz(mood >= 0.8 ? 30 : 12);
    this.ui.setDay(this.day, this.scores.length, this.orders.length, this.tips);
    await this.wait(500);
    const last = this.orderIndex >= this.orders.length - 1;
    this.ui.scoreCard(c.look.name, quoteFor(score), score, tip, () => this.afterServe(home), last, bonuses, (this.order && this.order.steps) || []);
  }

  async afterServe(home) {
    this.ui.hideCard();
    const c = this.customer;
    this.order = null;
    this.ui.ticket(null);
    // Guest leaves, board comes back empty.
    c.setExpression('smile');
    c.seated = false;
    this.sousSays({ jp: 'ありがとうございました', en: 'Thank you' }, 'grin', 1200);
    this.sendOff(c, [new Vector3(-9, c.group.position.y, c.group.position.z), ENTRANCE], 0.5);
    this.clearWork();
    const lane = this.set.geta.position.z;
    await this.tweenP({ obj: this.set.geta, to: new Vector3(home.x, 0, lane), duration: 0.5, arc: 0.15 });
    await this.tweenP({ obj: this.set.geta, to: home, duration: 0.3, arc: 0.2 });
    this.serving = false;
    this.nextCustomer();
  }

  endDay() {
    this.mode = 'summary';
    this.ui.gesture(null);
    this.music.setMood('chill');
    this.order = null;
    this.ui.ticket(null);
    const avg = Math.round(this.scores.reduce((a, b) => a + b, 0) / Math.max(1, this.scores.length));
    const best = Math.max(0, ...this.scores);
    const p = this.progress;
    const stars = starsFor(this.tips, this.perfect);
    p.best[this.day] = Math.max(p.best[this.day] || 0, this.tips);
    p.stars[this.day] = Math.max(p.stars[this.day] || 0, stars);
    // One star, or a decent average, opens the next day.
    if (stars >= 1 || avg >= 50) p.unlocked = Math.max(p.unlocked, Math.min(DAYS.length - 1, this.day + 1));
    saveProgress(p);
    const hasNext = this.day + 1 < DAYS.length && p.unlocked > this.day;
    if (stars === 3) this.fx.burst('glint', this.stage.camera.position.clone().add(new Vector3(0, -2, -8)), 40, { speed: 4, up: 5, gravity: 4, life: 1.6, size: 2 });
    this.ui.summaryCard(
      this.day,
      { tips: this.tips, served: this.scores.length, avg, best, stars, goals: this.goals(), walkouts: this.walkouts },
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
      {
        plates: this.todaysPlates(),
        name: savedName(),
        onWall: () => this.openWall(),
        onPost: async (name) => {
          const res = await postRun({ name, day: this.day, tips: this.tips, avg, plates: this.todaysPlates() });
          this.openWall(res);
          return res;
        },
      },
    );
  }

  // The Sushi book: every dish served and every regular met, saved with
  // progress. New entries get a toast.
  recordInBook(built, total, favDone) {
    const book = this.progress.book;
    const news = [];
    for (const b of built) {
      const key = b.key || dishKey(b);
      const d = (book.dishes[key] ||= { served: 0, best: 0 });
      if (!d.served) news.push(DISHES.find((x) => x.key === key)?.name);
      d.served++;
      d.best = Math.max(d.best, total);
    }
    const look = this.order.look;
    const gst = (book.guests[look.name] ||= { served: 0, fav: false });
    if (!gst.served) news.push(look.name);
    gst.served++;
    if (favDone && !gst.fav) {
      gst.fav = true;
      const dish = DISHES.find((x) => x.key === look.fav);
      setTimeout(() => this.ui.toast(`Sushi book: ${look.name} loves ${dish.name.toLowerCase()}!`, 3000), 1600);
    } else if (news.filter(Boolean).length) setTimeout(() => this.ui.toast(`New in the Sushi book: ${news.filter(Boolean).join(', ')}`, 2600), 1600);
    saveProgress(this.progress);
  }

  // Everything the book shows, from progress. Photos are added as they render.
  bookData() {
    const book = this.progress.book;
    const unlocked = this.progress.unlocked;
    const dishes = DISHES.map((d) => {
      const rec = book.dishes[d.key];
      return { ...d, state: rec ? 'found' : d.day <= unlocked ? 'seen' : 'locked', served: rec ? rec.served : 0, best: rec ? rec.best : 0, photo: this.bookPhotos[d.key] };
    });
    const guests = CUSTOMER_LOOKS.map((g) => {
      const rec = book.guests[g.name];
      const fav = DISHES.find((x) => x.key === g.fav);
      return { ...g, met: !!rec, served: rec ? rec.served : 0, favFound: !!(rec && rec.fav), favName: fav.name, photo: this.bookPhotos[`g:${g.name}`] };
    });
    return { dishes, guests };
  }

  async openBook() {
    this.bookPhotos ||= {};
    this.ui.showBook(this.bookData());
    // Shoot the missing photos one at a time so the frame never stalls long.
    for (const d of DISHES) {
      if (this.bookPhotos[d.key]) continue;
      this.bookPhotos[d.key] = await this.booth.orderPhoto({ pieces: [d.piece] }, 360, 240);
      this.ui.showBook(this.bookData(), true);
    }
    for (const g of CUSTOMER_LOOKS) {
      const k = `g:${g.name}`;
      if (this.bookPhotos[k]) continue;
      this.bookPhotos[k] = await this.booth.critterPhoto(g, 280, 280);
      this.ui.showBook(this.bookData(), true);
    }
  }

  goals() {
    return RUSH.stars.map((k) => Math.round((this.perfect * k) / 10) * 10);
  }

  // Patience ran out: the guest leaves, the streak breaks, no tip.
  async walkout() {
    if (this.serving || !this.order || !this.customer) return;
    this.serving = true;
    const c = this.customer;
    const order = this.order;
    order.walked = true;
    this.walkouts = (this.walkouts || 0) + 1;
    this.combo = 0;
    this.ui.combo(0);
    this.goStationForce('counter');
    c.setExpression('angry');
    c.emote('anger', 2400);
    c.body.kickAll(0, -1.2, 0);
    this.sound.voice(0.05);
    const head = c.group.position.clone().add(new Vector3(-3, c.height * LAYOUT.customer.scale * 0.8, 0));
    this.popupAt({ jp: 'もういい！', en: 'Forget it!' }, head, 'say');
    this.ui.toast(`${order.look.name} gave up and left.`, 2600);
    this.sousSays(null, 'frown', 1800);
    this.scores.push(0);
    this.ui.setDay(this.day, this.scores.length, this.orders.length, this.tips);
    await this.wait(1400);
    this.order = null;
    this.ui.ticket(null);
    c.seated = false;
    this.sendOff(c, [new Vector3(-9, c.group.position.y, c.group.position.z), ENTRANCE], 0.5);
    this.clearWork();
    this.serving = false;
    this.nextCustomer();
  }

  // Up to three of today's plates, best first.
  todaysPlates() {
    return (this.served || [])
      .filter((p) => p.day === this.day)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ img, score, guest, species }) => ({ img, score, guest, species }));
  }

  async openWall(posted) {
    if (posted) return this.ui.showWall(posted, posted.id);
    this.ui.showWall({ loading: true });
    this.ui.showWall(await loadWall());
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

  // A guest on the way out. They keep animating (and stay out of the next
  // guest's way) until they are off screen, then they are freed.
  sendOff(c, path, duration) {
    if (this.customer === c) this.customer = null;
    c.leaving = true;
    c.seated = false;
    c.impatience = 0;
    this.leavers.push(c);
    path.reduce((p, target) => p.then(() => c.hopTo(target, duration, 1)), Promise.resolve()).then(() => this.dropLeaver(c));
  }

  dropLeaver(c) {
    const i = this.leavers.indexOf(c);
    if (i < 0) return;
    this.leavers.splice(i, 1);
    c.group.removeFromParent();
    c.dispose();
  }

  removeCustomers() {
    for (const c of [this.customer, this.queue, ...this.leavers]) {
      if (!c) continue;
      c.group.removeFromParent();
      c.dispose();
    }
    this.customer = null;
    this.queue = null;
    this.leavers = [];
  }

  // --- Input -------------------------------------------------------------------

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.lastInput = performance.now();
      this.ui.gesture(null);
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
        if (this.customer && this.hitObject(e, this.customer.inner)) {
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
      this.lastInput = performance.now();
      if (e.key === 'Escape' && !e.repeat) {
        if (this.mode === 'paused') return this.closePause();
        if (this.mode === 'play') return this.openPause();
      }
      if (this.mode !== 'play' || e.repeat || e.target.tagName === 'INPUT') return;
      const i = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (i >= 0 && this.ui.stationShown(STATIONS[i])) this.goStation(STATIONS[i]);
      if (e.code === 'Space' && (this.station === 'rice' || this.station === 'counter' || this.station === 'stove')) {
        e.preventDefault();
        this.pointerPos = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
        if (this.station === 'counter') this.takeOrder();
        else if (this.station === 'stove') {
          // Space lifts the noodles while they boil, like the button.
          if (this.stations.stove.state === 'boil') this.stations.stove.lift();
          else this.stations.stove.down({ clientX: this.pointerPos.x, clientY: this.pointerPos.y });
        } else this.stations.rice.down();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (this.mode === 'play' && e.code === 'Space' && this.station === 'rice') this.stations.rice.up();
      if (this.mode === 'play' && e.code === 'Space' && this.station === 'stove') this.stations.stove.up();
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

  tween({ obj, to, quaternion, scale, scaleVec, duration, arc = 0, done }) {
    const t = {
      obj,
      sv0: scaleVec ? obj.scale.clone() : null,
      sv1: scaleVec ? scaleVec.clone() : null,
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
      if (t.sv1) t.obj.scale.lerpVectors(t.sv0, t.sv1, e);
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

  // A graded step, the Cooking Mama way: one word for how it went, a few
  // for why, and a sound for each grade. score is 0..1.
  grade(score, detail, world) {
    const tier = score >= 0.9 ? 'perfect' : score >= 0.7 ? 'great' : score >= 0.45 ? 'ok' : 'oops';
    const p = this.screenOf(world);
    this.ui.grade(tier, detail, p.x, p.y);
    this.sound.grade(tier);
    if (this.order) (this.order.steps ||= []).push(tier);
    // Pochi cheers a run of perfect steps and steadies you after a slip.
    this.perfectRun = tier === 'perfect' ? (this.perfectRun || 0) + 1 : 0;
    if (this.perfectRun === 3) {
      this.sousSays({ jp: 'すごい！', en: 'Amazing!' }, 'grin', 1000);
      this.sous.emote('sparkle', 1200);
      this.sous.setPose('banzai', 1);
    } else if (tier === 'perfect') this.sousSays(null, 'grin', 700);
    else if (tier === 'oops') {
      this.sousSays(null, 'frown', 800);
      this.sous.emote('sweat', 1200);
    }
    return tier;
  }

  // Cooking Mama's "Don't worry, Mama will fix it!": Pochi rescues a botched
  // step. The plate looks fine again; the score keeps the slip.
  rescue(fix, world) {
    const at = world.clone();
    setTimeout(() => {
      if (this.mode !== 'play') return;
      this.sousSays({ jp: 'だいじょうぶ！', en: "Don't worry, I'll fix it!" }, 'open', 1400);
      this.sous.poke(0.8);
    }, 450);
    setTimeout(() => {
      if (this.mode !== 'play') return;
      fix();
      this.sound.squelch(0.5);
      this.fx.burst('glint', at, 10, { speed: 1.6, up: 2, gravity: 5, life: 0.7 });
    }, 1100);
  }

  // The paw that shows what to do, once the player has been still a moment.
  gesture(kind, from, to = null) {
    const idle = performance.now() - (this.lastInput || 0) > 1600 && this.activePointer == null && this.mode === 'play' && !this.serving;
    if (!kind || !idle || !from) return this.ui.gesture(null);
    const a = this.screenOf(from);
    const b = to ? this.screenOf(to) : a;
    this.ui.gesture(kind, a.x, a.y, b.x - a.x, b.y - a.y);
  }

  // World point to screen pixels, for pop-ups.
  screenOf(world) {
    const v = world.clone().project(this.stage.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  // Pause: stop the clock and the loop. Not while a plate is on its way,
  // since serving is a sequence of timed moves.
  openPause() {
    if (this.mode !== 'play' || this.serving || !document.getElementById('cardScreen').hidden) return;
    // Let go of anything in hand: finish a hold, drop a slice, drop the knife.
    const { rice, knife, build } = this.stations;
    if (rice.state === 'scooping' || rice.state === 'pressing') rice.up();
    if (knife.stroke) {
      knife.stroke = null;
      knife.knife.visible = false;
      this.fx.trail.end();
    }
    if (build.drag) build.dropBack();
    build.sauce = null;
    this.activePointer = null;
    this.ui.holdRing(null);
    this.mode = 'paused';
    this.ui.gesture(null);
    this.music.setDucked(true);
    this.pause();
    this.stage.render(0);
    this.ui.pauseCard(
      this.day,
      () => this.closePause(),
      () => {
        this.ui.hideCard();
        this.startDay(this.day);
        this.resume();
      },
      () => {
        this.ui.hideCard();
        this.showTitle();
        this.resume();
      },
    );
  }

  closePause() {
    if (this.mode !== 'paused') return;
    this.music.setDucked(false);
    this.ui.hideCard();
    this.mode = 'play';
    this.resume();
  }

  // The picture on the ticket: the plate as it should come out.
  photograph(order) {
    if (order.photoing) return;
    order.photoing = true;
    this.booth.orderPhoto(order).then((url) => {
      order.photo = url;
      this.ui.ticketKey = null;
    });
  }

  // The sous chef reacts: a face for a moment, and maybe a line.
  sousSays(text, face, ms) {
    const s = this.sous;
    s.setExpression(face);
    s.poke(0.7);
    clearTimeout(this.sousTimer);
    this.sousTimer = setTimeout(() => s.setExpression('smile'), ms);
    if (text && (this.station === 'counter' || this.mode !== 'play')) {
      const head = s.group.position.clone().add(new Vector3(0, s.height * LAYOUT.sous.scale + 0.9, 0));
      this.popupAt(text, head, 'say');
    } else if (text) this.ui.say(text, Math.max(1200, ms));
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
    for (const r of this.rolls) r.update(dt);
    this.stove.update(dt);
    if (this.hotDish) (this.hotDish.bowl || this.hotDish.plate || this.hotDish.boat).update(dt);
    for (const o of this.onigiri) o.update(dt);
    const dragging = this.stations.build.drag;
    if (dragging) dragging.slice.update(dt);
    if (this.customer) {
      if (this.order && this.order.taken !== undefined && !this.serving) {
        // Patience runs on game time, so a hidden tab or a pause costs nothing.
        if (this.mode === 'play' && this.customer.seated) this.order.waited = (this.order.waited || 0) + dt;
        const waited = this.order.waited || 0;
        this.customer.impatience = Math.min(1, Math.max(0, waited / this.order.patience - 0.35) / 0.65);
        this.ui.patience(1 - waited / this.order.patience);
        if (this.customer.impatience > 0.7 && this.customer.expression === 'smile') this.customer.setExpression('flat');
        if (waited >= this.order.patience && this.order.taken !== undefined && this.mode === 'play' && !this.order.walked) this.walkout();
        if (this.customer.impatience > 0.88 && !this.order.fumed && !this.order.walked) {
          this.order.fumed = true;
          this.customer.setExpression('angry');
          this.customer.emote('anger', 2600);
        }
        if (this.customer.impatience > 0.6 && !this.order.warned && !this.order.walked) {
          this.order.warned = true;
          this.customer.emote('sweat', 2400);
          this.ui.toast(`${this.order.look.name} is getting hungry. Speed up.`, 2600);
          this.sousSays({ jp: '急いで！', en: 'Hurry!' }, 'open', 900);
        }
      } else this.customer.impatience = 0;
      if (this.customer.idle && Math.random() < dt * 0.25) this.customer.poke(0.4);
      this.customer.update(dt);
    }
    if (this.queue) this.queue.update(dt);
    for (const l of this.leavers) l.update(dt);
    const c = this.customer;
    const shade = this.counterShade;
    if (c && c.group.parent) {
      const near = Math.max(0, 1 - Math.abs(c.group.position.z - LAYOUT.customer.z) / 3);
      shade.position.x = c.group.position.x;
      shade.scale.set(c.width * c.group.scale.x * 0.62, 1.5, 1);
      shade.material.opacity = 0.75 * near / (1 + Math.max(0, c.inner.position.y) * 1.5);
    } else shade.material.opacity = 0;
    if (Math.random() < dt * 0.12) this.sous.poke(0.3);
    this.sous.update(dt);

    if (this.mode === 'play') {
      const showTicket = this.order && (this.order.taken || (this.customer && this.customer.seated));
      this.ui.ticket(showTicket ? this.order : null, this.orderIndex + 1, showTicket ? this.orderProgress() : []);
      const status = {};
      for (const s of STATIONS) status[s] = this.stations[s].status ? this.stations[s].status() : null;
      if (this.order && this.customer && this.customer.seated && !this.order.taken) status.counter = 'todo';
      if (this.plateMatches()) status.counter = 'ready';
      this.ui.setStation(this.station, status);
    }

    this.stage.update(realDt);
  }

  watchPerformance(raw) {
    const q = this.quality;
    if (q.fixed || this.recorder.busy || raw > 3) return; // > 3 s: the tab was asleep
    // Give shaders a moment to compile after loading or a tier change.
    q.settle = (q.settle ?? PERF.settle) - raw;
    if (q.settle > 0) return;
    const ms = Math.min(raw, 0.5) * 1000;
    q.avg += (ms - q.avg) * 0.1;
    if (q.avg > PERF.slowFrameMs) q.slowFor += Math.min(raw, 0.5);
    else q.slowFor = Math.max(0, q.slowFor - raw * 0.5);
    if (q.slowFor >= PERF.window) this.stepDown();
  }

  stepDown() {
    const q = this.quality;
    q.slowFor = 0;
    q.avg = 16;
    q.settle = PERF.settle;
    const next = TIER_ORDER[TIER_ORDER.indexOf(this.stage.tierName) + 1];
    if (!next) return;
    this.stage.setTier(next);
    saveTier(next);
  }
}

// What the guest says, led by the weakest part of the plate.
function quoteFor(score) {
  const p = score.parts;
  if (score.missing) return 'Where is the rest of my order?';
  if (score.results.some((r) => r.wrongFish)) return 'That is not the fish I asked for. Tasty, though.';
  if (score.total >= 90) return pick(['Perfect. I am wobbling with joy.', 'Best nigiri on the street.', 'I will tell all my friends.']);
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

// The lowest tier this browser needed, so the next visit starts there.
const TIER_KEY = `${GAME.storageKey}.tier`;
function loadTier() {
  try {
    const t = localStorage.getItem(TIER_KEY);
    return TIERS[t] ? t : null;
  } catch {
    return null;
  }
}
function saveTier(t) {
  try {
    localStorage.setItem(TIER_KEY, t);
  } catch {
    // Not important.
  }
}

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(`${GAME.storageKey}.progress`));
    if (p && typeof p.unlocked === 'number') return { unlocked: UNLOCK_ALL ? DAYS.length - 1 : Math.min(p.unlocked, DAYS.length - 1), best: p.best || [], stars: p.stars || [], book: { dishes: {}, guests: {}, ...(p.book || {}) } };
  } catch {
    // No saved progress.
  }
  return { unlocked: UNLOCK_ALL ? DAYS.length - 1 : 0, best: [], stars: [], book: { dishes: {}, guests: {} } };
}

function saveProgress(p) {
  try {
    localStorage.setItem(`${GAME.storageKey}.progress`, JSON.stringify(p));
  } catch {
    // Progress just will not persist.
  }
}

