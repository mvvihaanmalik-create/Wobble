import { Vector3 } from 'three';
import { DAYS, HOT, HOT_TOPPINGS, LAYOUT, UDON } from './config.js';
import { Gyoza, GyozaPlate, UdonBowl, brothY, noodleMaterial, potNoodles, setNoodleCook } from './hot.js';
import { bandScore, hotOf } from './orders.js';
import { Station } from './stations.js';

// 05 Stove: the hot dishes, Cooking Mama style. Each one is a short run of
// steps, each graded.
//
// Udon: tap to drop the noodles in the pot, stir in circles while they boil,
// lift them when the timer is in the green, hold to ladle in the dashi up to
// the line, then add the toppings on the ticket.
//
// Gyoza (three): hold to spoon the filling onto a wrapper, tap on the beat to
// pinch five pleats, then into the pan. When the bottoms are golden add
// water and the lid, and lift the lid when the steam timer is in the green.

const L = LAYOUT.stove;
const U = HOT.udon;
const G = HOT.gyoza;
const _v = new Vector3();
const _w = new Vector3();
const PLEAT_MARKS = Array.from({ length: G.pleats }, (_, i) => (i + 0.5) / G.pleats);
const PLEAT_TOL = 0.07; // how close to a mark is clean
const PAN_SLOTS = [-0.62, 0, 0.62];

export class StoveStation extends Station {
  name = 'stove';
  state = 'none';

  get want() {
    const o = this.g.order;
    return o && o.taken ? hotOf(o)[0] || null : null;
  }

  enter() {
    this.g.stage.goTo(this.view());
  }

  // Frame the dish in hand: pot and bowl for udon, pan and board for gyoza.
  view() {
    const w = this.want;
    return w ? (w.udon ? 'stoveUdon' : 'stoveGyoza') : 'stove';
  }

  exit() {
    this.endPour();
    this.stir = null;
    this.g.ui.meter(null);
    this.g.ui.holdRing(null);
  }

  status() {
    if (!this.want) return null;
    if (this.plated) return 'ready';
    return 'todo';
  }

  // Lay out a fresh dish for the order now in hand.
  begin(want) {
    this.reset();
    const g = this.g;
    this.order = g.order;
    this.dish = want.udon ? 'udon' : 'gyoza';
    this.res = {};
    if (this.dish === 'udon') {
      this.bowl = new UdonBowl(want.udon, 3 + g.orderIndex);
      this.bowl.group.position.set(L.bowl[0], 0, L.bowl[1]);
      g.stage.scene.add(this.bowl.group);
      this.noodleMat = noodleMaterial();
      this.potNoodles = potNoodles(this.noodleMat, 7 + g.orderIndex);
      g.stove.pot.add(this.potNoodles);
      this.potNoodles.position.y = 1.35; // held over the pot
      this.cook = 0;
      this.stirs = 0;
      this.level = 0;
      this.state = 'drop';
    } else {
      this.gyozas = [];
      this.fills = [];
      this.pleatScores = [];
      this.k = 0;
      this.newWrapper();
      this.state = 'fill';
    }
  }

  newWrapper() {
    const gz = new Gyoza();
    gz.group.position.set(L.prep[0], 0.17, L.prep[1]);
    gz.group.rotation.y = 0;
    this.g.stage.scene.add(gz.group);
    this.gz = gz;
    this.fillV = 0;
    this.filling = false;
  }

  update(dt) {
    const g = this.g;
    const want = this.want;
    if (want && this.order !== g.order) {
      this.begin(want);
      if (g.station === 'stove') g.stage.goTo(this.view());
    }
    if (!want && this.state !== 'none' && !this.plated) this.reset();
    const st = this.state;
    const stove = g.stove;
    // Timers run wherever the player is: wander off and the noodles go soft.
    if (st === 'boil') {
      this.cook += U.cookRate * dt;
      setNoodleCook(this.noodleMat, Math.min(1, this.cook * 1.35));
      this.potNoodles.rotation.y += dt * (0.4 + (this.swirl || 0));
      this.swirl = Math.max(0, (this.swirl || 0) - dt * 2);
      if (Math.random() < dt * 5) g.sound.bubble();
      if (this.cook >= 1.02) this.lift(true);
    } else if (st === 'pour' && this.pouring) {
      this.level += U.pourRate * dt;
      this.bowl.setLevel(this.level);
      stove.pour(_v.set(L.bowl[0], brothY(Math.min(1, this.level)), L.bowl[1]), true);
      if (this.level >= 1.04) this.endPour(true);
    } else if (st === 'fill' && this.filling) {
      this.fillV = Math.min(1, this.fillV + G.fillRate * dt);
      this.gz.setFill(this.fillV * 0.95);
      if (this.fillV >= 1) this.finishFill();
    } else if (st === 'pleat') {
      this.cursor += dt / G.pleatTime;
      // A mark that slipped past is pinched anyway, badly.
      const i = this.nextPleat();
      if (i >= 0 && this.cursor > PLEAT_MARKS[i] + PLEAT_TOL * 1.6) this.pinch(i, 0.25, true);
      if (this.nextPleat() < 0 && this.cursor > PLEAT_MARKS[G.pleats - 1] + 0.06) this.finishPleats();
    } else if (st === 'fry') {
      this.brown += G.brownRate * dt;
      for (const gz of this.gyozas) gz.setBrown(this.brown);
      g.sound.sizzle(0.7 + 0.3 * Math.sin(stove.time * 5));
      if (this.brown >= 1.3) this.addWater(true);
    } else if (st === 'steam') {
      this.steam += G.steamRate * dt;
      g.sound.sizzle(0.35);
      if (this.steam >= 1.15) this.lidOff(true);
    }
    stove.boil += ((st === 'boil' ? 1 : st === 'drop' ? 0.35 : 0) - stove.boil) * Math.min(1, dt * 3);
    stove.panSteam.strength += ((st === 'steam' ? 1 : st === 'fry' ? 0.25 : 0) - stove.panSteam.strength) * Math.min(1, dt * 3);
    if (this.bowl) this.bowl.update(dt);
    for (const gz of this.gyozas || []) gz.update(dt);
    if (this.gz && !this.gyozas.includes(this.gz)) this.gz.update(dt);
    if (this.plate) this.plate.update(dt);
    if (g.station === 'stove') this.updateUI();
  }

  updateUI() {
    const g = this.g;
    const ui = g.ui;
    const st = this.state;
    const want = this.want;
    const potTop = () => _v.set(L.pot[0], L.top + 1.3, L.pot[1]);
    if (!g.order || !g.order.taken) {
      ui.hint(g.order ? 'Take the order at the counter first.' : '');
      ui.actions([]);
      ui.meter(null);
      return g.gesture(null);
    }
    if (!want) {
      ui.hint('This order is sushi. Rice, knife, build.');
      ui.actions([{ label: 'To the rice', primary: true, onClick: () => g.goStation('rice') }]);
      ui.meter(null);
      return g.gesture(null);
    }
    let actions = [];
    if (st === 'drop') {
      ui.hint('Tap the pot to drop in the noodles.');
      ui.meter(null);
      g.gesture('tap', potTop());
    } else if (st === 'boil') {
      const done = this.stirs >= U.stirs;
      ui.hint(done ? 'Lift them when the timer is in the green.' : `Stir in circles! (${this.stirs} of ${U.stirs})`);
      ui.meter('Boil', this.cook, U.cookBand, this.cook > 0.92, '●'.repeat(Math.min(U.stirs, this.stirs)) + '○'.repeat(Math.max(0, U.stirs - this.stirs)));
      actions = [{ label: 'Lift', primary: this.cook >= U.cookBand[0], onClick: () => this.lift() }];
      if (!done) g.gesture('circle', potTop());
      else g.gesture(null);
    } else if (st === 'pour') {
      ui.hint(this.pouring ? (this.level > U.pourBand[1] ? 'That is the line!' : 'Pouring...') : 'Hold to ladle in the dashi. Let go at the line.');
      ui.meter('Dashi', this.level, U.pourBand, this.level > U.pourBand[1] + 0.06);
      if (!this.pouring) g.gesture('hold', _v.set(L.bowl[0] + 1.5, 1.0, L.bowl[1] + 0.3));
    } else if (st === 'top') {
      ui.meter(null);
      const asked = Object.keys(want.toppings || {});
      const missing = asked.filter((t) => !this.bowl.tops[t]);
      ui.hint(missing.length ? `Add the toppings: ${missing.map((t) => HOT_TOPPINGS[t].label.toLowerCase()).join(', ')}.` : 'Looks lovely.');
      const kinds = [...new Set((DAYS[g.day].hot?.udon || []).flatMap((k) => UDON[k].toppings))];
      actions = kinds.map((t) => ({ label: HOT_TOPPINGS[t].label, primary: missing.includes(t), disabled: !!this.bowl.tops[t], onClick: () => this.addTopping(t) }));
      g.gesture(null);
    } else if (st === 'fill') {
      ui.hint(this.filling ? 'Spooning...' : `Hold to spoon in the filling. Let go in the green. (${this.k + 1} of ${G.count})`);
      ui.meter('Filling', this.fillV, G.fillBand, this.fillV > G.fillOver, this.gyozaDots());
      if (!this.filling) g.gesture('hold', _v.set(L.prep[0] + 1.3, 0.6, L.prep[1] + 0.4));
    } else if (st === 'pleat') {
      const i = this.nextPleat();
      const m = PLEAT_MARKS[Math.max(0, i)];
      ui.hint(`Tap on each beat to pinch a pleat! (${this.k + 1} of ${G.count})`);
      ui.meter('Pleat', this.cursor, [m - PLEAT_TOL, m + PLEAT_TOL], false, this.pleatDots());
      g.gesture('tap', _v.set(L.prep[0] + 1.3, 0.6, L.prep[1] + 0.4));
    } else if (st === 'fry') {
      ui.hint('Sizzle... when the bottoms turn golden, add water and the lid.');
      ui.meter('Golden', this.brown, G.brownBand, this.brown > G.brownBand[1] + 0.1);
      actions = [{ label: 'Water + lid', primary: this.brown >= G.brownBand[0], onClick: () => this.addWater() }];
      g.gesture(null);
    } else if (st === 'steam') {
      ui.hint('Steaming. Lift the lid when the timer is in the green.');
      ui.meter('Steam', this.steam, G.steamBand, this.steam > G.steamBand[1] + 0.08);
      actions = [{ label: 'Lid off', primary: this.steam >= G.steamBand[0], onClick: () => this.lidOff() }];
      g.gesture(null);
    } else if (st === 'done' || this.plated) {
      ui.hint('Plated. Serve it while it is hot!');
      ui.meter(null);
      actions = [{ label: 'Serve', primary: true, onClick: () => g.serve() }];
      g.gesture(null);
    } else {
      ui.meter(null);
      g.gesture(null);
    }
    ui.actions(actions);
  }

  gyozaDots() {
    return '●'.repeat(this.k) + '○'.repeat(G.count - this.k);
  }

  pleatDots() {
    return [...this.pleated].map((p) => (p ? '●' : '○')).join('');
  }

  // --- Input -------------------------------------------------------------------

  down(e) {
    const g = this.g;
    if (!this.want) return;
    const st = this.state;
    if (st === 'drop') this.drop();
    else if (st === 'boil') this.stir = { last: this.angleOf(e), acc: 0 };
    else if (st === 'pour') this.startPour();
    else if (st === 'fill') this.startFill();
    else if (st === 'pleat') {
      const i = this.nextPleat();
      if (i < 0) return;
      const err = Math.abs(this.cursor - PLEAT_MARKS[i]);
      // Tapping far too early does nothing but a little wobble.
      if (this.cursor < PLEAT_MARKS[i] - PLEAT_TOL * 2.5) {
        this.gz.poke(0.3);
        return;
      }
      this.pinch(i, Math.max(0, 1 - err / (PLEAT_TOL * 2)));
    } else if (st === 'fry') this.addWater();
    else if (st === 'steam') this.lidOff();
    else if (st === 'done') g.serve();
  }

  move(e) {
    if (this.state !== 'boil' || !this.stir) return;
    const a = this.angleOf(e);
    let d = a - this.stir.last;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    this.stir.last = a;
    this.stir.acc += d;
    this.swirl = Math.min(4, (this.swirl || 0) + Math.abs(d) * 1.5);
    if (Math.abs(this.stir.acc) >= Math.PI * 1.85) {
      this.stir.acc = 0;
      this.stirs++;
      const g = this.g;
      g.sound.bubble();
      g.sound.whoosh();
      g.buzz(8);
      const at = _w.set(L.pot[0], L.top + 1.9, L.pot[1]);
      if (this.stirs <= U.stirs) g.popupAt(this.stirs === U.stirs ? 'Stirred!' : `Stir ${this.stirs}`, at, this.stirs === U.stirs ? 'great' : 'good');
      g.fx.burst('droplet', at.clone().setY(L.top + 1.3), 6, { speed: 1.4, up: 1.8, life: 0.5, gravity: 9 });
    }
  }

  up() {
    const st = this.state;
    if (st === 'boil') this.stir = null;
    else if (st === 'pour') this.endPour();
    else if (st === 'fill' && this.filling) this.finishFill();
  }

  // Pointer angle around the pot, on screen.
  angleOf(e) {
    const c = this.g.screenOf(_v.set(L.pot[0], L.top + 1.2, L.pot[1]));
    return Math.atan2(e.clientY - c.y, e.clientX - c.x);
  }

  // --- Udon ----------------------------------------------------------------------

  drop() {
    const g = this.g;
    this.state = 'boil';
    g.stove.setFlame(0, true);
    g.tween({ obj: this.potNoodles, to: new Vector3(0, 0, 0), duration: 0.3, arc: 0.4 });
    g.sound.plop();
    setTimeout(() => g.sound.bubble(), 120);
    g.fx.burst('droplet', new Vector3(L.pot[0], L.top + 1.4, L.pot[1]), 16, { speed: 2, up: 3, life: 0.7, gravity: 9 });
    g.buzz(12);
  }

  lift(auto = false) {
    if (this.state !== 'boil') return;
    const g = this.g;
    const cook = Math.min(1.1, this.cook);
    const t = bandScore(cook, U.cookBand, 0.3);
    this.res.boil = t;
    this.res.stir = Math.min(1, this.stirs / U.stirs);
    const [a] = U.cookBand;
    g.grade(t, t >= 0.95 ? 'Springy, just right' : cook < a ? 'A bit firm' : auto ? 'Left too long: soggy' : 'Soft and soggy', _v.set(L.pot[0], L.top + 2.4, L.pot[1]));
    if (this.stirs < U.stirs) setTimeout(() => g.popupAt('Some stuck together', new Vector3(L.pot[0], L.top + 1.6, L.pot[1]), 'bad'), 500);
    this.state = 'lifting';
    g.stove.setFlame(0, false);
    // Noodles hop from the pot into the bowl.
    const noodles = this.potNoodles;
    g.stage.scene.attach(noodles);
    g.tween({
      obj: noodles,
      to: new Vector3(L.bowl[0], 0.3, L.bowl[1]),
      scale: 0.7,
      duration: 0.5,
      arc: 2.4,
      done: () => {
        noodles.removeFromParent();
        noodles.geometry.dispose();
        // The guest may have left mid-air.
        if (this.potNoodles !== noodles || !this.bowl) return;
        this.potNoodles = null;
        this.bowl.showNoodles(Math.min(1, cook * 1.35));
        g.sound.squelch(0.6);
        g.fx.burst('droplet', new Vector3(L.bowl[0], 0.8, L.bowl[1]), 10, { speed: 1.6, up: 2.2, life: 0.6, gravity: 9 });
        this.state = 'pour';
      },
    });
  }

  startPour() {
    if (this.pouring || this.state !== 'pour') return;
    this.pouring = true;
    this.g.sound.pouring(true);
  }

  endPour(overflow = false) {
    if (!this.pouring) return;
    const g = this.g;
    this.pouring = false;
    g.sound.pouring(false);
    g.stove.pour(null, false);
    if (this.state !== 'pour') return;
    const v = this.level;
    const s = bandScore(v, U.pourBand, 0.3);
    const at = _v.set(L.bowl[0], 1.8, L.bowl[1]);
    const over = overflow || v > U.pourOver;
    this.res.pour = over ? 0.3 : s;
    g.grade(over ? 0.2 : s, over ? 'Over the rim!' : s >= 0.95 ? 'Right to the line' : v < U.pourBand[0] ? 'Not much dashi' : 'A touch too much', at);
    if (over) {
      // Pochi ladles a little back out.
      const bowl = this.bowl;
      g.rescue(() => {
        if (this.bowl !== bowl) return;
        this.level = 0.8;
        bowl.setLevel(0.8);
      }, at.clone().setY(1.2));
    }
    this.state = 'top';
  }

  addTopping(t) {
    if (this.state !== 'top' || this.bowl.tops[t]) return;
    const g = this.g;
    const want = this.want;
    this.bowl.addTopping(t);
    g.sound.plop();
    g.buzz(10);
    const at = _v.set(L.bowl[0], 1.6, L.bowl[1]);
    const asked = Object.keys(want.toppings || {});
    if (!asked.includes(t)) g.grade(0.2, `${HOT_TOPPINGS[t].label} is not on the ticket`, at);
    else g.popupAt(HOT_TOPPINGS[t].label, at, 'good');
    if (asked.every((k) => this.bowl.tops[k])) {
      const extra = Object.keys(this.bowl.tops).filter((k) => !asked.includes(k)).length;
      setTimeout(() => {
        if (this.state !== 'top') return;
        g.grade(extra ? 0.6 : 1, extra ? 'Something extra on top' : 'Everything on top', _w.set(L.bowl[0], 2, L.bowl[1]));
        this.res.toppings = Object.fromEntries(Object.keys(this.bowl.tops).map((k) => [k, true]));
        this.plateUp(this.bowl.group, 'udon');
      }, 450);
    }
  }

  // --- Gyoza ---------------------------------------------------------------------

  startFill() {
    if (this.filling || this.state !== 'fill') return;
    this.filling = true;
    this.fillV = 0;
    this.g.sound.scoop();
  }

  finishFill() {
    if (!this.filling) return;
    const g = this.g;
    this.filling = false;
    const v = this.fillV;
    const s = bandScore(v, G.fillBand, 0.3);
    const over = v > G.fillOver;
    const at = _v.set(L.prep[0], 1.4, L.prep[1]);
    g.grade(over ? 0.2 : s, over ? 'Too full, it will burst' : s >= 0.95 ? 'Just enough' : v < G.fillBand[0] ? 'A bit thin' : 'Generous', at);
    this.fills.push(over ? 0.35 : s);
    g.sound.squelch(0.5);
    this.gz.poke(1);
    if (over) {
      const gz = this.gz;
      g.rescue(() => gz.setFill(0.6), at.clone().setY(0.8));
    }
    // Pleating starts on the next beat.
    this.state = 'pleat';
    this.cursor = -0.15;
    this.pleated = new Array(G.pleats).fill(0);
    this.pleatHits = [];
    this.gz.setFold(0.35);
  }

  nextPleat() {
    return this.pleated ? this.pleated.findIndex((p) => !p) : -1;
  }

  pinch(i, score, missed = false) {
    const g = this.g;
    this.pleated[i] = 1;
    this.pleatHits.push(score);
    this.gz.pleat(i, missed ? 0.4 : 1);
    this.gz.setFold(0.35 + (0.65 * this.pleated.filter(Boolean).length) / G.pleats);
    g.sound.pinch();
    g.buzz(missed ? 4 : 10);
    const at = _v.set(L.prep[0] + (PLEAT_MARKS[i] - 0.5) * 1.6, 1.1, L.prep[1]);
    if (missed) g.popupAt('Missed', at, 'bad');
    else g.popupAt(score > 0.8 ? 'Pinch!' : score > 0.45 ? 'Pinch' : 'Off beat', at, score > 0.8 ? 'great' : score > 0.45 ? 'good' : 'bad');
  }

  finishPleats() {
    const g = this.g;
    const s = this.pleatHits.reduce((a, b) => a + b, 0) / Math.max(1, this.pleatHits.length);
    this.pleatScores.push(s);
    g.grade(s, s >= 0.9 ? 'Pretty pleats' : s >= 0.6 ? 'Neat enough' : 'A bit lumpy', _v.set(L.prep[0], 1.6, L.prep[1]));
    const gz = this.gz;
    gz.setFold(1);
    this.gyozas.push(gz);
    const slot = this.k;
    this.k++;
    this.state = 'toPan';
    // Into the pan, in a row.
    setTimeout(() => {
      if (this.gz !== gz) return;
      g.tween({
        obj: gz.group,
        to: new Vector3(L.pan[0] + PAN_SLOTS[slot], L.top + 0.2, L.pan[1] + 0.05),
        duration: 0.45,
        arc: 1.6,
        done: () => {
          if (!this.gyozas.includes(gz)) return;
          gz.poke(1.2);
          g.sound.squelch(0.4);
          g.stove.setFlame(1, true);
          g.sound.sizzle(0.5);
          setTimeout(() => this.state === 'fry' || g.sound.sizzle(0), 400);
        },
      });
      gz.group.rotation.y = Math.PI / 2;
      if (this.k < G.count) {
        this.newWrapper();
        this.state = 'fill';
      } else {
        this.gz = null;
        this.state = 'fry';
        this.brown = 0;
      }
    }, 500);
  }

  addWater(auto = false) {
    if (this.state !== 'fry') return;
    const g = this.g;
    const b = this.brown;
    const s = bandScore(b, G.brownBand, 0.3);
    this.fry1 = auto ? 0.1 : s;
    const at = _v.set(L.pan[0], 1.8, L.pan[1]);
    g.grade(auto ? 0.1 : s, auto ? 'Burnt!' : s >= 0.95 ? 'Golden bottoms' : b < G.brownBand[0] ? 'Still pale' : 'Quite dark', at);
    // A splash of water: a burst of steam, then the lid.
    g.sound.sizzle(1);
    g.fx.burst('droplet', at.clone().setY(0.9), 16, { speed: 2.2, up: 2.4, life: 0.5, gravity: 10 });
    g.stove.panSteam.strength = 1;
    const lid = g.stove.lid;
    lid.visible = true;
    lid.position.copy(g.stove.lidHome);
    g.tween({ obj: lid, to: g.stove.lidOn, duration: 0.4, arc: 0.6, done: () => g.sound.lid() });
    this.state = 'steam';
    this.steam = 0;
  }

  lidOff(auto = false) {
    if (this.state !== 'steam') return;
    const g = this.g;
    const v = this.steam;
    const s = bandScore(v, G.steamBand, 0.3);
    const fry2 = auto ? 0.2 : s;
    this.res.fry = ((this.fry1 ?? 0.5) + fry2) / 2;
    g.grade(fry2, auto ? 'Steamed too long' : s >= 0.95 ? 'Juicy inside' : v < G.steamBand[0] ? 'Not quite cooked' : 'A little soft', _v.set(L.pan[0], 1.8, L.pan[1]));
    g.sound.lid();
    g.sound.sizzle(0);
    g.stove.setFlame(1, false);
    const lid = g.stove.lid;
    g.tween({ obj: lid, to: g.stove.lidHome, duration: 0.45, arc: 0.6, done: () => (lid.visible = false) });
    g.stove.panSteam.strength = 1.2;
    this.state = 'plating';
    this.res.fill = this.fills.reduce((a, b) => a + b, 0) / this.fills.length;
    this.res.pleat = this.pleatScores.reduce((a, b) => a + b, 0) / this.pleatScores.length;
    // Flip them out onto a plate, browned side up.
    setTimeout(() => {
      if (this.state !== 'plating') return;
      const plate = new GyozaPlate(this.gyozas);
      plate.group.position.set(L.prep[0], 0.1, L.prep[1]);
      g.stage.scene.add(plate.group);
      for (const gz of this.gyozas) gz.poke(1.4);
      g.sound.squelch(0.7);
      this.plate = plate;
      this.plateUp(plate.group, 'gyoza');
    }, 500);
  }

  // --- Plating -----------------------------------------------------------------

  // The finished dish travels down the counter onto the serving board.
  plateUp(group, kind) {
    const g = this.g;
    this.state = 'done';
    const order = this.order;
    const bowl = this.bowl;
    const plate = this.plate;
    const count = (this.gyozas || []).length;
    const geta = g.set.geta;
    const local = new Vector3(-0.55, LAYOUT.geta.h, 0);
    const to = geta.localToWorld(local.clone());
    g.sous.celebrate();
    setTimeout(() => g.sous.setExpression('smile'), 1400);
    g.tween({
      obj: group,
      to,
      duration: 0.9,
      arc: 2.5,
      done: () => {
        // A guest who walked out while it travelled never gets it.
        if (this.order !== order || g.order !== order) {
          group.removeFromParent();
          if (bowl) bowl.dispose();
          if (plate) plate.dispose();
          return;
        }
        geta.attach(group);
        group.position.copy(local);
        g.sound.tap();
        this.plated = true;
        const res = { ...this.res };
        g.hotDish = {
          kind,
          group,
          built: kind === 'udon' ? { udon: bowl.kind, boil: res.boil ?? 0.5, stir: res.stir ?? 0, pour: res.pour ?? 0.5, toppings: res.toppings || {} } : { gyoza: count, fill: res.fill ?? 0.5, pleat: res.pleat ?? 0.5, fry: res.fry ?? 0.5 },
          bowl: kind === 'udon' ? bowl : null,
          plate: kind === 'gyoza' ? plate : null,
        };
        // The station lets go of it; the game owns it until it is eaten.
        this.bowl = null;
        this.plate = null;
        this.gyozas = [];
        if (g.station === 'stove') setTimeout(() => g.station === 'stove' && g.goStation('counter'), 900);
      },
    });
  }

  // Throw away anything half made.
  reset() {
    const g = this.g;
    this.endPour();
    g.sound.sizzle(0);
    if (this.bowl) {
      this.bowl.group.removeFromParent();
      this.bowl.dispose();
    }
    if (this.potNoodles) {
      this.potNoodles.removeFromParent();
      this.potNoodles.geometry.dispose();
    }
    if (this.noodleMat) this.noodleMat.dispose();
    for (const gz of [...(this.gyozas || []), ...(this.gz ? [this.gz] : [])]) {
      gz.group.removeFromParent();
      gz.dispose();
    }
    if (this.plate) this.plate.group.removeFromParent();
    if (g.stove) {
      g.stove.setFlame(0, false);
      g.stove.setFlame(1, false);
      g.stove.lid.visible = false;
      g.stove.lid.position.copy(g.stove.lidHome);
      g.stove.pour(null, false);
    }
    this.bowl = null;
    this.potNoodles = null;
    this.noodleMat = null;
    this.gyozas = [];
    this.gz = null;
    this.plate = null;
    this.plated = false;
    this.pouring = false;
    this.filling = false;
    this.stir = null;
    this.order = null;
    this.state = 'none';
  }
}
