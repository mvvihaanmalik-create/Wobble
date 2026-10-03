import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Plane,
  Quaternion,
  RepeatWrapping,
  Vector3,
  IcosahedronGeometry,
  BufferAttribute,
} from 'three';
import { DAYS, FISH, KNIFE, LAYOUT, ONIGIRI, RICE, menuKinds } from './config.js';
import { BLOCKS, FishBlock, FishSlice, Onigiri, Piece, RiceMound } from './food.js';
import { bakeFoodCoords, foodMaterial } from './materials.js';
import { cutScore, hotOf, makiOf, nigiriOf, onigiriOf, scoopScore } from './orders.js';
import { FILLINGS, MAKI, MakiSheet } from './maki.js';
import { Paw } from './critters.js';

const _v = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();

const v3 = () => new Vector3();

export class Station {
  constructor(game) {
    this.g = game;
  }
  enter() {}
  exit() {}
  update() {}
  down() {}
  move() {}
  up() {}
}

// ---------------------------------------------------------------------------
// 01 Counter: greet, take the order, serve.

export class CounterStation extends Station {
  name = 'counter';

  enter() {
    this.g.stage.goTo('counter');
  }

  update() {
    const g = this.g;
    if (g.station !== 'counter') return;
    if (g.serving) {
      g.ui.hint('');
      g.ui.actions([]);
      g.gesture(null);
      return;
    }
    if (!g.customer || !g.order) {
      g.gesture(null);
      g.ui.hint('');
      g.ui.actions([]);
      return;
    }
    if (g.order.taken || !g.customer.seated) g.gesture(null);
    if (!g.customer.seated) {
      g.ui.hint('Someone is coming in.');
      g.ui.actions([]);
    } else if (!g.order.taken) {
      const c = g.customer;
      g.gesture('tap', c.group.position.clone().add(new Vector3(c.width * c.group.scale.x * 0.3, c.height * c.group.scale.y * 0.3, 1)));
      g.ui.hint(`${g.order.look.name} is ready to order.`);
      g.ui.actions([{ label: 'Take order', primary: true, onClick: () => g.takeOrder() }]);
    } else if (g.plateComplete()) {
      g.ui.hint('Plate is ready. Serve it from the build station.');
      g.ui.actions([{ label: 'Serve', primary: true, onClick: () => g.serve() }]);
    } else if (hotOf(g.order).length) {
      g.ui.hint('This one is cooked at the stove.');
      g.ui.actions([{ label: 'To the stove', primary: true, onClick: () => g.goStation('stove') }]);
    } else {
      g.ui.hint('Make the order. Rice first.');
      g.ui.actions([{ label: 'To the rice', onClick: () => g.goStation('rice') }]);
    }
  }

  down(e) {
    const c = this.g.customer;
    if (c && this.g.hitObject(e, c.inner)) {
      c.poke(1);
      c.setExpression('open');
      clearTimeout(this.faceTimer);
      this.faceTimer = setTimeout(() => c.setExpression('smile'), 600);
      this.g.sound.squelch(0.7);
      if (c.seated && this.g.order && !this.g.order.taken) this.g.takeOrder();
    }
  }
}

// ---------------------------------------------------------------------------
// 02 Rice: hold to scoop from the tub, then hold and release to press, three
// times. Release inside the green band for a clean press.

export class RiceStation extends Station {
  name = 'rice';
  state = 'idle';
  value = 0;
  rice = null;

  enter() {
    this.g.stage.goTo('rice');
  }

  // The chef's paw hovers over the work and does the pressing.
  updatePaw(dt) {
    const g = this.g;
    if (!this.paw) {
      this.paw = new Paw();
      this.paw.group.scale.setScalar(1.1);
      this.paw.group.rotation.y = 0.55;
      this.paw.group.position.set(LAYOUT.mat.x + 1, 3, LAYOUT.mat.z + 2);
      g.stage.scene.add(this.paw.group);
    }
    const p = this.paw.group;
    const show = g.station === 'rice' && (this.rice || this.ball || (this.sheet && this.state === 'pressing'));
    p.visible = !!show || p.position.y < 5.5;
    let tx = LAYOUT.mat.x + 1.6;
    let ty = 6.5;
    let tz = LAYOUT.mat.z + 2.4;
    let rate = 8;
    if (show && this.ball) {
      // Cup the scoop from the side so it stays in view.
      tx = this.ball.position.x + 0.55 * this.ball.scale.x + 0.8;
      ty = this.ball.position.y - 0.1;
      tz = this.ball.position.z + 0.1;
    } else if (show && this.sheet && this.state === 'pressing') {
      tx = LAYOUT.mat.x;
      tz = LAYOUT.mat.z;
      ty = 0.75 - this.value * 0.25;
      rate = 16;
    } else if (show && this.rice && this.state !== 'flying') {
      const top = this.rice.group.position.y + this.rice.body.height;
      tx = LAYOUT.mat.x;
      tz = LAYOUT.mat.z + 0.05;
      const t = performance.now() / 1000;
      if (this.state === 'pressing') {
        ty = top + 0.2 - this.value * 0.45;
        rate = 18;
      } else {
        // Wait beside the rice, not over it, so the shape stays in view.
        tx = LAYOUT.mat.x + 1.5;
        tz = LAYOUT.mat.z + 1.1;
        ty = top + 0.5 + Math.sin(t * 3) * 0.06;
      }
    }
    const k = 1 - Math.exp(-dt * rate);
    p.position.x += (tx - p.position.x) * k;
    p.position.y += (ty - p.position.y) * k;
    p.position.z += (tz - p.position.z) * k;
    // Squash the paw a little as it pushes.
    const sq = this.state === 'pressing' ? this.value * 0.12 : 0;
    p.scale.set(1.1 * (1 + sq * 0.5), 1.1 * (1 - sq), 1.1 * (1 + sq * 0.5));
  }

  exit() {
    this.g.ui.meter(null);
    this.g.ui.holdRing(null);
    if (this.state === 'scooping') this.cancelScoop();
  }

  get nigiriNeeded() {
    const g = this.g;
    if (!g.order || !g.order.taken) return 0;
    return nigiriOf(g.order).length - g.pieces.length - (this.rice ? 1 : 0);
  }

  get makiNeeded() {
    const g = this.g;
    if (!g.order || !g.order.taken) return 0;
    return makiOf(g.order).length - g.rolls.length - (this.sheet && this.sheet.riceLayer.visible ? 1 : 0);
  }

  get onigiriNeeded() {
    const g = this.g;
    if (!g.order || !g.order.taken) return 0;
    return onigiriOf(g.order).length - g.onigiri.length - (this.oni ? 1 : 0);
  }

  // The filling the next onigiri wants.
  get wantedOnigiri() {
    const want = onigiriOf(this.g.order)[this.g.onigiri.length];
    return want ? want.onigiri : null;
  }

  get needed() {
    return this.nigiriNeeded + this.makiNeeded + this.onigiriNeeded;
  }

  // Which roll the ticket wants next, for the fill step.
  get wantedFilling() {
    const g = this.g;
    const want = makiOf(g.order)[g.rolls.length];
    return want ? want.maki : null;
  }

  status() {
    return this.needed > 0 || this.rice || this.sheet ? 'todo' : null;
  }

  // A fresh nori sheet, waiting on the mat for the roll's rice.
  ensureSheet() {
    if (this.sheet) return;
    this.sheet = new MakiSheet();
    this.sheet.group.position.set(LAYOUT.mat.x, 0.2, LAYOUT.mat.z);
    this.sheet.riceLayer.visible = false;
    this.g.stage.scene.add(this.sheet.group);
  }

  update(dt) {
    const g = this.g;
    if (this.oni) this.oni.update(dt);
    else if (this.rice) this.rice.update(dt);
    if (!this.sheet && this.state === 'idle' && g.station === 'rice' && this.nigiriNeeded <= 0 && this.makiNeeded > 0) this.ensureSheet();
    if (this.sheet) this.sheet.update(dt);
    this.updatePaw(dt);
    if (this.ball) {
      const s = 0.25 + this.value * 0.75;
      this.ball.scale.setScalar(s);
      this.ball.position.y = LAYOUT.tub.height + 0.4 + this.value * 0.6;
    }
    if (this.state === 'scooping') {
      this.value = Math.min(1, this.value + RICE.scoopRate * dt);
      if (g.station === 'rice') {
        g.ui.meter('Scoop', this.value, RICE.scoopTarget, false, '');
        g.ui.holdRing(g.pointerPos.x, g.pointerPos.y, this.value, RICE.scoopTarget, false);
      }
      if (this.value >= 1) this.finishScoop();
    } else if (this.state === 'pressing') {
      this.value = Math.min(1, this.value + RICE.pressRate * dt);
      if (this.rice) this.rice.body.userMode[1] = this.value * 0.3;
      if (this.sheet) this.sheet.setSpread(0.12 + this.value * 0.5);
      if (g.station === 'rice') {
        g.ui.meter(this.sheet ? 'Spread' : 'Press', this.value, RICE.pressGood, this.value > RICE.pressOver, this.sheet ? '' : this.dots());
        g.ui.holdRing(g.pointerPos.x, g.pointerPos.y, this.value, RICE.pressGood, this.value > RICE.pressOver);
      }
      if (this.value >= 1) this.finishPress();
    }
    if (g.station !== 'rice') return;
    if (this.state === 'ready') g.ui.meter(this.sheet ? 'Spread' : 'Press', 0, RICE.pressGood, false, this.sheet ? '' : this.dots());
    else if (this.state !== 'scooping' && this.state !== 'pressing') g.ui.meter(null);
    // Hints.
    const makingMaki = this.sheet || (this.nigiriNeeded <= 0 && this.makiNeeded > 0);
    if (!g.order || !g.order.taken) g.ui.hint('Take an order at the counter first.');
    else if (this.state === 'idle' && this.needed > 0) {
      const n = nigiriOf(g.order).length;
      const oniTime = this.nigiriNeeded <= 0 && this.onigiriNeeded > 0;
      g.ui.hint(makingMaki ? 'Roll time. Hold to scoop rice onto the nori.' : oniTime ? 'Onigiri time. Hold to scoop rice. Let go in the green.' : `Hold to scoop rice. Let go in the green. (${g.pieces.length + 1} of ${n})`);
    } else if (this.state === 'scooping') g.ui.hint('Let go in the green band.');
    else if (this.state === 'ready') g.ui.hint(this.sheet ? 'Hold to spread the rice. Let go in the green.' : 'Hold to press. Let go in the green.');
    else if (this.state === 'pressing') g.ui.hint(this.value > RICE.pressOver ? 'Too hard!' : this.sheet ? 'Spread...' : 'Press...');
    else if (this.state === 'fill') g.ui.hint(`Lay the filling. The ticket wants ${FILLINGS[this.wantedFilling]?.label.toLowerCase() || 'a filling'}.`);
    else if (this.state === 'roll') g.ui.hint('Swipe up across the mat to roll it.');
    else if (this.state === 'stuff') g.ui.hint(`Press in the filling. The ticket wants ${ONIGIRI[this.wantedOnigiri]?.filling.toLowerCase() || 'a filling'}.`);
    else if (this.state === 'wrap') g.ui.hint('Tap to wrap the nori round it.');
    else if (this.state === 'rolling') g.ui.hint('Rolling...');
    else if (this.needed <= 0 && !this.rice && !this.sheet) g.ui.hint(g.order && !nigiriOf(g.order).length && !makiOf(g.order).length ? 'Plated. Serve it at the counter.' : 'Rice is done. On to the knife.');
    const taken = g.order && g.order.taken;
    if (taken && this.state === 'idle' && this.needed > 0) g.gesture('hold', _v.set(LAYOUT.tub.x, LAYOUT.tub.height + 0.5, LAYOUT.tub.z));
    else if (this.state === 'ready') g.gesture('hold', _v.set(LAYOUT.mat.x, 0.9, LAYOUT.mat.z));
    else if (this.state === 'wrap') g.gesture('tap', _v.set(LAYOUT.mat.x + 1.2, 0.8, LAYOUT.mat.z + 0.4));
    else if (this.state === 'roll') g.gesture('stroke', _v.set(LAYOUT.mat.x, 0.4, LAYOUT.mat.z + 1.1), _v2.set(LAYOUT.mat.x, 0.4, LAYOUT.mat.z - 1.1));
    else g.gesture(null);
    if (this.state === 'stuff') {
      g.ui.actions(menuKinds(DAYS[g.day], 'o').map((k) => ({ label: ONIGIRI[k].filling, primary: k === this.wantedOnigiri, onClick: () => this.stuff(k) })));
    } else if (this.state === 'fill') {
      g.ui.actions(g.dayFillings().map((k) => ({ label: FILLINGS[k].label, primary: k === this.wantedFilling, onClick: () => this.fill(k) })));
    } else if (this.needed <= 0 && !this.rice && !this.sheet && g.order && g.order.taken) {
      const onlyOni = !nigiriOf(g.order).length && !makiOf(g.order).length;
      g.ui.actions([onlyOni ? { label: 'Serve', primary: true, onClick: () => g.serve() } : { label: 'To the knife', primary: true, onClick: () => g.goStation('knife') }]);
    } else g.ui.actions([]);
  }

  dots() {
    const n = this.rice ? this.rice.presses.length : 0;
    return '●'.repeat(n) + '○'.repeat(RICE.presses - n);
  }

  down() {
    const g = this.g;
    if (!g.order || !g.order.taken) return g.ui.toast('Take the order first');
    if (this.state === 'roll') {
      this.rollFrom = { x: g.pointerPos.x, y: g.pointerPos.y };
      return;
    }
    if (this.state === 'wrap') return this.wrapOnigiri();
    if (this.state === 'idle' && this.needed > 0) {
      // Nigiri rice first; once those are on the board, the roll.
      if (this.nigiriNeeded <= 0 && this.makiNeeded > 0) this.ensureSheet();
      this.state = 'scooping';
      this.value = 0;
      this.ball = new Mesh(scoopBallGeometry(), foodMaterial('rice'));
      this.ball.castShadow = true;
      this.ball.position.set(LAYOUT.tub.x, LAYOUT.tub.height + 0.4, LAYOUT.tub.z);
      g.stage.scene.add(this.ball);
      g.sound.scoop();
      g.ui.meter('Scoop', 0, RICE.scoopTarget, false, '');
    } else if (this.state === 'ready') {
      this.state = 'pressing';
      this.value = 0;
      g.ui.meter('Press', 0, RICE.pressGood, false, this.dots());
    }
  }

  up() {
    const g = this.g;
    g.ui.holdRing(null);
    if (this.state === 'scooping') this.finishScoop();
    else if (this.state === 'pressing') this.finishPress();
    else if (this.state === 'roll' && this.rollFrom) {
      const dy = g.pointerPos.y - this.rollFrom.y;
      this.rollFrom = null;
      if (dy < -40) this.doRoll();
      else g.ui.toast('Swipe up across the mat to roll it');
    }
  }

  // Lay the filling on the spread rice.
  fill(kind) {
    if (this.state !== 'fill' || !this.sheet) return;
    const g = this.g;
    this.sheet.addFilling(kind);
    g.sound.plop();
    g.buzz(10);
    const at = new Vector3(LAYOUT.mat.x, 1.3, LAYOUT.mat.z);
    if (kind !== this.wantedFilling) g.grade(0.2, 'Not what the ticket says', at);
    else g.grade(1, `${FILLINGS[kind].label}, as ordered`, at);
    this.state = 'roll';
  }

  async doRoll() {
    const g = this.g;
    const sheet = this.sheet;
    this.state = 'rolling';
    g.sound.whoosh();
    g.fx.burst('grain', new Vector3(LAYOUT.mat.x, 0.6, LAYOUT.mat.z), 10, { speed: 2, up: 2.5, life: 0.8 });
    const log = await sheet.roll();
    if (this.sheet !== sheet) return; // reset while rolling
    g.grade(sheet.spreadQuality > 0.85 ? 0.95 : Math.max(0.5, sheet.spreadQuality), sheet.spreadQuality > 0.85 ? 'Tight roll' : 'Rolled up', new Vector3(LAYOUT.mat.x, 1.4, LAYOUT.mat.z));
    g.buzz(16);
    this.sheet = null;
    this.state = 'idle';
    g.addRoll(log, sheet);
  }

  cancelScoop() {
    if (this.ball) this.g.stage.scene.remove(this.ball);
    this.ball = null;
    if (this.state === 'scooping') this.state = 'idle';
  }

  finishScoop() {
    const g = this.g;
    if (!this.ball) {
      this.state = 'idle';
      return;
    }
    if (this.sheet) return this.finishMakiScoop();
    const scoop = this.value;
    const from = this.ball.position.clone();
    g.stage.scene.remove(this.ball);
    this.ball = null;
    this.state = 'flying';
    const onigiri = this.nigiriNeeded <= 0 && this.onigiriNeeded > 0;
    const rice = new RiceMound(scoop, 1 + Math.floor(Math.random() * 1000), onigiri ? 'onigiri' : 'nigiri');
    rice.group.position.copy(from);
    rice.group.scale.setScalar(0.6);
    g.stage.scene.add(rice.group);
    this.rice = rice;
    g.tween({
      obj: rice.group,
      to: new Vector3(LAYOUT.mat.x, 0.22, LAYOUT.mat.z),
      scale: 1,
      duration: 0.42,
      arc: 1.2,
      done: () => {
        if (this.rice !== rice) return; // the station was reset mid-flight
        rice.body.kickAll(0, 2.5, 0);
        g.sound.squelch(0.6);
        this.state = 'ready';
        if (onigiri) {
          // An onigiri gets its filling before it is shaped.
          const oni = new Onigiri(rice);
          oni.group.position.copy(rice.group.position);
          rice.group.position.set(0, 0, 0);
          g.stage.scene.add(oni.group);
          this.oni = oni;
          this.state = 'stuff';
        }
        const at = new Vector3(LAYOUT.mat.x, 0.6, LAYOUT.mat.z);
        g.fx.burst('grain', at, 14, { speed: 2.2, up: 3, life: 0.9 });
        const sc = scoopScore(scoop);
        const [lo] = RICE.scoopTarget;
        g.grade(sc > 0.95 ? 1 : sc, sc > 0.95 ? 'Just the right scoop' : sc > 0.6 ? 'Nice scoop' : scoop < lo ? 'A bit small' : 'Too much rice', at.clone().setY(1.6));
        if (sc > 0.95) g.fx.burst('glint', at.clone().setY(1.2), 14, { speed: 2, up: 3, gravity: 6, life: 0.9 });
        g.buzz(10);
      },
    });
    g.ui.meter(null);
  }

  // The scoop lands on the nori as a lump, ready to spread.
  finishMakiScoop() {
    const g = this.g;
    const scoop = this.value;
    const ball = this.ball;
    const sheet = this.sheet;
    this.ball = null;
    this.state = 'flying';
    sheet.scoop = scoop;
    g.ui.meter(null);
    g.tween({
      obj: ball,
      to: new Vector3(LAYOUT.mat.x, 0.5, LAYOUT.mat.z),
      duration: 0.42,
      arc: 1.2,
      done: () => {
        g.stage.scene.remove(ball);
        if (this.sheet !== sheet) return;
        sheet.riceLayer.visible = true;
        sheet.setSpread(0.12);
        g.sound.squelch(0.6);
        this.state = 'ready';
        const at = new Vector3(LAYOUT.mat.x, 0.6, LAYOUT.mat.z);
        g.fx.burst('grain', at, 14, { speed: 2.2, up: 3, life: 0.9 });
        const sc = scoopScore(scoop);
        g.grade(sc > 0.95 ? 1 : sc, sc > 0.95 ? 'Just the right scoop' : sc > 0.6 ? 'Nice scoop' : 'Off scoop', at.clone().setY(1.6));
      },
    });
  }

  finishPress() {
    const g = this.g;
    if (!this.rice && !this.sheet) {
      this.state = 'idle';
      return;
    }
    const v = this.value;
    const [a, b] = RICE.pressGood;
    let quality;
    let over = 0;
    if (v < a) quality = 0.25 + 0.4 * (v / a);
    else if (v <= b) quality = 1 - (Math.abs(v - (a + b) / 2) / ((b - a) / 2)) * 0.25;
    else {
      quality = 0.45;
      over = Math.min(1, (v - b) / (1 - b)) * (v > RICE.pressOver ? 1.4 : 0.6);
    }
    if (this.sheet) {
      this.sheet.spread(quality, over);
      g.sound.squelch(0.4 + v * 0.5);
      const at = new Vector3(LAYOUT.mat.x, 1.3, LAYOUT.mat.z);
      g.grade(over > 0.5 ? 0.2 : quality > 0.85 ? 0.95 : quality, over > 0.5 ? 'Squashed' : v < a ? 'Patchy' : quality > 0.85 ? 'Even spread' : 'Spread', at);
      g.fx.burst('grain', at.clone().setY(0.5), 6, { speed: 1.8, up: 1.6, life: 0.6 });
      this.state = 'fill';
      return;
    }
    this.rice.body.userMode[1] = 0;
    this.rice.press(quality, over);
    g.sound.squelch(0.5 + v * 0.6);
    const at = new Vector3(LAYOUT.mat.x, 1.5, LAYOUT.mat.z);
    g.grade(over > 0.5 ? 0.2 : quality > 0.85 ? 0.95 : quality, over > 0.5 ? 'Too hard' : v < a ? 'Too soft' : quality > 0.85 ? 'Firm and neat' : 'Nicely pressed', at);
    if (over > 0.5) {
      const rice = this.rice;
      g.rescue(() => rice.fix(), at.clone().setY(0.8));
    } else if (quality > 0.85) g.fx.burst('glint', at.clone().setY(1), 10, { speed: 2, up: 2.5, gravity: 6, life: 0.8 });
    g.fx.burst('grain', at.clone().setY(0.5), 5, { speed: 1.6, up: 1.8, life: 0.6 });
    g.buzz(over > 0.5 ? 30 : 14);
    this.state = 'ready';
    if (this.rice.presses.length >= RICE.presses) this.finishPiece();
  }

  // Press the filling in: the button picks it.
  stuff(kind) {
    if (this.state !== 'stuff' || !this.oni) return;
    const g = this.g;
    this.oni.addFilling(kind, ONIGIRI[kind].color);
    g.sound.plop();
    g.buzz(10);
    const at = new Vector3(LAYOUT.mat.x, 1.5, LAYOUT.mat.z);
    const right = kind === this.wantedOnigiri;
    this.oni.fillScore = right ? 1 : 0.2;
    g.grade(right ? 1 : 0.2, right ? `${ONIGIRI[kind].filling}, as ordered` : 'Not what the ticket says', at);
    this.state = 'ready';
  }

  // Wrap the nori round the bottom and send it to the board.
  wrapOnigiri() {
    if (this.state !== 'wrap' || !this.oni) return;
    const g = this.g;
    const oni = this.oni;
    oni.wrap();
    g.sound.plop();
    g.sound.squelch(0.4);
    g.buzz(14);
    g.grade(1, 'Wrapped snug', new Vector3(LAYOUT.mat.x, 1.7, LAYOUT.mat.z));
    this.oni = null;
    this.rice = null;
    this.state = 'idle';
    g.ui.meter(null);
    g.addOnigiri(oni);
  }

  finishPiece() {
    const g = this.g;
    if (this.oni) {
      this.state = 'wrap';
      return;
    }
    const rice = this.rice;
    this.rice = null;
    this.state = 'idle';
    g.ui.meter(null);
    const piece = new Piece(rice);
    g.addPiece(piece);
  }

  reset() {
    if (this.rice) {
      this.g.stage.scene.remove(this.rice.group);
      this.rice.dispose();
    }
    if (this.sheet) this.g.stage.scene.remove(this.sheet.group);
    if (this.oni) this.oni.group.removeFromParent();
    this.oni = null;
    this.sheet = null;
    this.rice = null;
    this.cancelScoop();
    // Drop any hold in progress, so a reset mid-press never finishes a
    // press on rice that is gone.
    this.state = 'idle';
    this.value = 0;
    this.rollFrom = null;
    this.g.ui.meter(null);
    this.g.ui.holdRing(null);
  }
}

function scoopBallGeometry() {
  const g = new IcosahedronGeometry(0.55, 4);
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const r = 1 + 0.12 * Math.sin(p[i] * 9) * Math.cos(p[i + 1] * 8 + p[i + 2] * 5);
    p[i] *= r;
    p[i + 1] *= r * 0.85;
    p[i + 2] *= r;
  }
  g.computeVertexNormals();
  g.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(g, 1), 3));
  return g;
}

// ---------------------------------------------------------------------------
// 03 Knife: swipe down through the block along the dashed guide.

export class KnifeStation extends Station {
  name = 'knife';
  blocks = {};
  kind = 'salmon';
  stroke = null;

  constructor(game) {
    super(game);
    this.origin = new Vector3(LAYOUT.block.x, LAYOUT.board.h, LAYOUT.block.z);
    this.guide = makeGuide();
    game.stage.scene.add(this.guide);
    this.knife = game.set.knife;
  }

  enter() {
    this.g.stage.goTo('knife');
    const next = this.g.nextNeededFish();
    this.show(next || this.kind);
  }

  // Blocks go back in the case when you leave, so they never hide the plate.
  exit() {
    this.guide.visible = false;
    this.knife.visible = false;
    for (const b of Object.values(this.blocks)) b.group.visible = false;
    for (const gd of this.rollGuides || []) gd.visible = false;
  }

  // A rolled log waiting on the board to be cut.
  get roll() {
    return this.g.rolls.find((r) => r.onBoard && !r.cutDone) || null;
  }

  placeRollGuides(roll) {
    if (!this.rollGuides) {
      this.rollGuides = Array.from({ length: MAKI.pieces - 1 }, () => {
        const gd = makeGuide();
        this.g.stage.scene.add(gd);
        return gd;
      });
    }
    const cut = new Set(roll.cuts.map((c) => c.index));
    const len = MAKI.radius * 2 + 0.35;
    roll.guides.forEach((x, i) => {
      const gd = this.rollGuides[i];
      gd.scale.set(1, len, 1);
      gd.rotation.set(0, 0, 0);
      gd.material.map.repeat.set(1, len * 3);
      gd.position.set(roll.group.position.x + x + (roll.pieces[i + 1].position.x - roll.pieces[i + 1].userData.rest), roll.group.position.y, roll.group.position.z + MAKI.radius + 0.03);
      gd.visible = this.g.station === 'knife' && !cut.has(i);
    });
  }

  block(kind) {
    if (!this.blocks[kind]) {
      const b = new FishBlock(kind);
      b.group.position.copy(this.origin);
      this.g.stage.scene.add(b.group);
      this.blocks[kind] = b;
    }
    return this.blocks[kind];
  }

  show(kind) {
    this.kind = kind;
    // A roll on the board comes first: the fish waits in the case.
    if (this.roll) {
      for (const b of Object.values(this.blocks)) b.group.visible = false;
      this.guide.visible = false;
      this.placeRollGuides(this.roll);
      return;
    }
    for (const gd of this.rollGuides || []) gd.visible = false;
    for (const [k, b] of Object.entries(this.blocks)) b.group.visible = k === kind;
    this.block(kind).group.visible = true;
    this.placeGuide();
  }

  placeGuide() {
    const b = this.block(this.kind);
    const ideal = BLOCKS[this.kind];
    const rad = (ideal.angle * Math.PI) / 180;
    const off = ideal.thickness / Math.cos(rad);
    const x0 = b.end[0] - off;
    const x1 = b.end[1] - off;
    const len = Math.hypot(x1 - x0, b.H);
    this.guide.scale.set(1, len, 1);
    this.guide.position.set(this.origin.x + (x0 + x1) / 2, this.origin.y + b.H / 2, this.origin.z + b.D / 2 + 0.02);
    this.guide.rotation.set(0, 0, -Math.atan2(x1 - x0, b.H));
    this.guide.material.map.repeat.set(1, len * 3);
    this.guide.visible = this.g.station === 'knife';
  }

  get needed() {
    return this.g.slicesNeeded();
  }

  status() {
    return this.g.order && this.g.order.taken && (this.needed.total > 0 || this.roll) ? 'todo' : null;
  }

  update(dt) {
    const g = this.g;
    for (const b of Object.values(this.blocks)) if (b.group.visible) b.update(dt);
    const need = this.needed;
    const roll = this.roll;
    if (g.station === 'knife' && roll) {
      this.placeRollGuides(roll);
      g.ui.actions([]);
      g.ui.hint(this.stroke ? 'Straight down through the roll.' : `Cut the roll on each dashed line. (${roll.cuts.length} of ${MAKI.pieces - 1})`);
      const done = new Set(roll.cuts.map((c) => c.index));
      const i = roll.guides.findIndex((_, k) => !done.has(k));
      if (i >= 0 && !this.stroke) {
        const x = roll.group.position.x + roll.guides[i];
        const y = roll.group.position.y;
        const z = roll.group.position.z + MAKI.radius;
        g.gesture('stroke', _v.set(x, y + MAKI.radius * 2.4, z), _v2.set(x, y - MAKI.radius * 0.6, z));
      } else g.gesture(null);
    } else if (g.station === 'knife') {
      const kinds = g.dayFish();
      g.ui.actions([
        ...(kinds.length > 1 ? kinds.map((k) => ({ label: `${FISH[k].label}${need.byKind[k] ? ` ×${need.byKind[k]}` : ''}`, primary: k === this.kind, onClick: () => this.show(k) })) : []),
        ...(g.order && g.order.taken && need.total === 0 ? [{ label: 'To build', primary: true, onClick: () => g.goStation('build') }] : []),
      ]);
      if (!g.order || !g.order.taken) g.ui.hint('Take an order at the counter first.');
      else if (need.total === 0) g.ui.hint('Slices are ready. Build the plate.');
      else if (!need.byKind[this.kind]) g.ui.hint(`No ${FISH[this.kind].label.toLowerCase()} on this ticket. Switch fish.`);
      else if (this.stroke) g.ui.hint('Pull all the way through.');
      else g.ui.hint(`Swipe down through the ${FISH[this.kind].label.toLowerCase()} along the dashes.`);
      if (g.order && g.order.taken && need.byKind[this.kind] && !this.stroke && this.guide.visible) {
        this.guide.updateWorldMatrix(true, false);
        g.gesture('stroke', this.guide.localToWorld(_v.set(0, 0.6, 0)), this.guide.localToWorld(_v2.set(0, -0.6, 0)));
      } else g.gesture(null);
    }
  }

  // Ray onto the front of the roll, in world space.
  rollPoint(e, roll) {
    const plane = new Plane(new Vector3(0, 0, 1), -(roll.group.position.z + MAKI.radius));
    return this.g.planeHit(e, plane);
  }

  downRoll(e, roll) {
    const p = this.rollPoint(e, roll);
    if (!p) return;
    this.stroke = { pts: [p], roll };
    this.knife.visible = true;
    this.g.fx.trail.start();
    this.g.fx.trail.add(p.clone().setZ(p.z + 0.05));
    this.knife.position.set(p.x, p.y, p.z + 0.3);
    this.knife.rotation.set(0, 0, Math.PI / 2 + Math.PI);
  }

  upRoll(roll) {
    const g = this.g;
    const pts = this.stroke.pts;
    this.stroke = null;
    g.fx.trail.end();
    setTimeout(() => (this.knife.visible = false), 160);
    const ys = pts.map((p) => p.y);
    if (Math.max(...ys) - Math.min(...ys) < MAKI.radius * 1.2) return g.ui.toast('Swipe all the way down through the roll');
    const x = pts.reduce((sum, p) => sum + p.x, 0) / pts.length - roll.group.position.x;
    const cut = new Set(roll.cuts.map((c) => c.index));
    let best = -1;
    let bd = Infinity;
    roll.guides.forEach((gx, i) => {
      if (cut.has(i)) return;
      const shifted = gx + (roll.pieces[i + 1].position.x - roll.pieces[i + 1].userData.rest);
      const d = Math.abs(x - shifted);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0 || bd > roll.pieceLen * 0.55) return g.ui.toast('Cut on one of the dashed lines');
    const score = Math.max(0, Math.min(1, 1 - bd / (roll.pieceLen * 0.5)));
    roll.cut(best, score);
    g.sound.slice(0.8);
    g.stage.addShake(0.03);
    g.buzz(14);
    const at = roll.group.position.clone().add(new Vector3(roll.guides[best], MAKI.radius + 0.4, MAKI.radius));
    if (score > 0.8) g.fx.burst('glint', at, 8, { speed: 1.8, up: 2, gravity: 5, life: 0.7 });
    g.grade(score, score > 0.9 ? 'On the line' : score > 0.7 ? 'Clean cut' : score > 0.45 ? 'A little off the line' : 'Wobbly cut', at.clone().setY(at.y + 0.6));
    if (roll.cutDone) {
      const session = g.session;
      setTimeout(() => g.session === session && g.plateRoll(roll), 550);
    }
  }

  // Ray onto the block's front face, in block space.
  facePoint(e) {
    const b = this.block(this.kind);
    const plane = new Plane(new Vector3(0, 0, 1), -(this.origin.z + b.D / 2));
    const p = this.g.planeHit(e, plane);
    return p ? p.sub(this.origin) : null;
  }

  down(e) {
    const g = this.g;
    if (!g.order || !g.order.taken) return g.ui.toast('Take the order first');
    if (this.roll) return this.downRoll(e, this.roll);
    const p = this.facePoint(e);
    if (!p) return;
    this.stroke = { pts: [p], t0: performance.now() };
    this.knife.visible = true;
    g.fx.trail.start();
    g.fx.trail.add(this.worldOf(p));
    this.moveKnife(p, p);
  }

  move(e) {
    if (!this.stroke) return;
    if (this.stroke.roll) {
      const p = this.rollPoint(e, this.stroke.roll);
      if (!p) return;
      this.stroke.pts.push(p);
      this.g.fx.trail.add(p.clone().setZ(p.z + 0.05));
      this.knife.position.set(p.x, p.y, p.z + 0.3);
      return;
    }
    const p = this.facePoint(e);
    if (!p) return;
    const pts = this.stroke.pts;
    pts.push(p);
    this.moveKnife(pts[0], p);
    this.g.fx.trail.add(this.worldOf(p));
  }

  worldOf(p) {
    const b = this.block(this.kind);
    return new Vector3(this.origin.x + p.x, this.origin.y + p.y, this.origin.z + b.D / 2 + 0.05);
  }

  moveKnife(a, p) {
    const b = this.block(this.kind);
    const dir = new Vector3().subVectors(p, a);
    const ang = dir.lengthSq() > 0.01 ? Math.atan2(dir.y, dir.x) : -Math.PI / 2 - 0.6;
    this.knife.position.set(this.origin.x + p.x, this.origin.y + p.y, this.origin.z + b.D / 2 + 0.35);
    this.knife.rotation.set(0, 0, ang + Math.PI);
  }

  up() {
    if (!this.stroke) return;
    if (this.stroke.roll) return this.upRoll(this.stroke.roll);
    const pts = this.stroke.pts;
    this.stroke = null;
    this.g.fx.trail.end();
    setTimeout(() => (this.knife.visible = false), 160);
    const g = this.g;
    const b = this.block(this.kind);
    const a = pts[0];
    const z = pts[pts.length - 1];
    if (pts.length < 2 || Math.abs(z.y - a.y) < b.H * 0.5) return g.ui.toast('Swipe all the way down through the fish');
    const slope = (z.x - a.x) / (z.y - a.y);
    const xAt = (y) => a.x + (y - a.y) * slope;
    const xc0 = xAt(0);
    const xc1 = xAt(b.H);
    const angle = (Math.atan2(xc1 - xc0, b.H) * 180) / Math.PI;
    const rad = (angle * Math.PI) / 180;
    const thickness = ((b.end[0] + b.end[1]) / 2 - (xc0 + xc1) / 2) * Math.cos(rad);
    if (xc0 >= b.end[0] - 0.05 || xc1 >= b.end[1] - 0.05 || thickness < KNIFE.minThickness) return g.ui.toast('Too thin. Cut a little further in.');
    if (thickness > KNIFE.maxThickness || xc0 < 0.3 || xc1 < 0.3) return g.ui.toast('Too thick. Cut closer to the end.');
    this.cut(xc0, xc1, angle, thickness);
  }

  cut(xc0, xc1, angle, thickness) {
    const g = this.g;
    const b = this.block(this.kind);
    const quad = [
      [xc0, 0],
      [b.end[0], 0],
      [b.end[1], b.H],
      [xc1, b.H],
    ];
    const slice = new FishSlice(this.kind, quad, b.D);
    const score = cutScore(angle, thickness, BLOCKS[this.kind]);
    slice.cutScore = score.total;
    slice.cutInfo = { angle, thickness };
    b.end = [xc0, xc1];
    b.rebuild();
    b.wobble(1);
    this.placeGuide();
    g.sound.slice(1);
    g.slowMo(0.25, 0.28);
    g.stage.addShake(0.06);
    g.buzz(22);
    const top = new Vector3(this.origin.x + xc1, this.origin.y + b.H, this.origin.z + b.D / 2);
    if (score.total > 0.85) g.fx.burst('glint', top, 16, { speed: 2.4, up: 2.5, gravity: 4, life: 0.9 });
    // Start inside the block, tip over onto the board, then go to the tray.
    slice.group.position.copy(this.origin).add(slice.blockPose.position);
    slice.group.quaternion.copy(slice.blockPose.quaternion);
    g.stage.scene.add(slice.group);
    const landing = new Vector3(this.origin.x + (xc0 + b.end[1]) / 2 + 0.9, LAYOUT.board.h, LAYOUT.board.z + 1.25);
    g.tween({
      obj: slice.group,
      to: landing,
      quaternion: new Quaternion(),
      duration: 0.42,
      arc: 0.8,
      done: () => {
        g.sound.tap();
        slice.body.kickAll(0, 2, 0);
        slice.body.impulse(0, slice.thickness, 0, 0, -1, 0, 1.2, 0.5);
        const verdict = score.total > 0.85 ? 'Clean cut' : score.angle < 0.5 ? 'Watch the angle' : score.thickness < 0.5 ? (thickness > BLOCKS[this.kind].thickness ? 'A bit thick' : 'A bit thin') : 'Nice cut';
        g.grade(score.total, verdict, landing.clone().setY(1.4));
        const session = g.session;
        setTimeout(() => g.session === session && g.toTray(slice), 450);
      },
    });
    if (b.remaining < 1.6) {
      // Swap in a fresh block of the same fish, even if the player has
      // switched fish in the meantime.
      const kind = this.kind;
      setTimeout(() => {
        g.stage.scene.remove(b.group);
        if (this.blocks[kind] === b) delete this.blocks[kind];
        if (g.station === 'knife' && this.kind === kind) this.show(kind);
        g.ui.toast('Fresh block');
      }, 900);
    }
  }
}

function makeGuide() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, 0, 8, 18);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  const m = new Mesh(new PlaneGeometry(0.05, 1), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  m.renderOrder = 5;
  m.visible = false;
  return m;
}

// ---------------------------------------------------------------------------
// 04 Build: wasabi on the rice, drag the fish on, then toppings.

const TOPPING_TOOLS = ['ikura', 'sesame', 'scallion', 'sauce', 'nori'];

export class BuildStation extends Station {
  name = 'build';
  tool = 'wasabi';
  drag = null;
  sauce = null;

  enter() {
    this.g.stage.goTo('build');
    this.tool = this.suggestTool();
  }

  exit() {
    this.g.ui.tools(false);
    if (this.drag) this.dropBack();
  }

  available() {
    return ['wasabi', 'fish', ...TOPPING_TOOLS.filter((t) => this.g.dayToppings().includes(t))];
  }

  // Tools the ticket still needs: flagged with a "!" until done.
  wanted() {
    const g = this.g;
    if (!g.order) return [];
    const w = new Set();
    nigiriOf(g.order).forEach((want, i) => {
      const p = g.pieces[i];
      if (!p) {
        if (want.wasabi) w.add('wasabi');
        w.add('fish');
        for (const k of Object.keys(want.toppings)) w.add(k);
        return;
      }
      if (!p.slice) {
        if (p.wasabi.length < (want.wasabi || 0)) w.add('wasabi');
        w.add('fish');
      }
      const tops = p.tops;
      for (const [k, v] of Object.entries(want.toppings)) if (k === 'ikura' ? (tops.ikura || 0) < v : !tops[k]) w.add(k);
    });
    return [...w];
  }

  // The next thing the ticket still needs, in the order a chef would do it.
  suggestTool() {
    const g = this.g;
    if (!g.order) return 'fish';
    for (let i = 0; i < g.pieces.length; i++) {
      const p = g.pieces[i];
      const want = nigiriOf(g.order)[i];
      if (!want) continue;
      if (!p.slice) {
        if (p.wasabi.length < (want.wasabi || 0)) return 'wasabi';
        continue;
      }
    }
    if (g.pieces.some((p) => !p.slice) && g.tray.length) return 'fish';
    for (let i = 0; i < g.pieces.length; i++) {
      const p = g.pieces[i];
      const want = nigiriOf(g.order)[i];
      if (!want || !p.slice) continue;
      const tops = p.tops;
      for (const [k, v] of Object.entries(want.toppings)) if (k === 'ikura' ? (tops.ikura || 0) < v : !tops[k]) return k;
    }
    return this.tool || 'fish';
  }

  // After a step, move to the next tool if this one has done its job.
  advance() {
    const next = this.suggestTool();
    if (next !== this.tool) this.tool = next;
  }

  status() {
    const g = this.g;
    if (!g.order || !g.order.taken) return null;
    if (g.plateMatches()) return 'ready';
    return g.pieces.length && (g.tray.length || g.pieces.some((p) => !p.slice)) ? 'todo' : null;
  }

  setTool(t) {
    this.tool = t;
    this.g.sound.plop();
  }

  update() {
    const g = this.g;
    if (g.station !== 'build') return;
    g.ui.tools(true, this.tool, this.available(), this.wanted());
    const complete = g.plateMatches();
    g.ui.actions([{ label: 'Serve', primary: complete, disabled: !g.hasFood(), onClick: () => g.serve() }]);
    if (!g.order || !g.order.taken) return g.ui.hint('Take an order at the counter first.');
    if (hotOf(g.order).length) {
      g.gesture(null);
      return g.ui.hint(complete ? 'Hot and ready. Serve it.' : 'This one is cooked at the stove.');
    }
    if (!nigiriOf(g.order).length && !makiOf(g.order).length) {
      g.gesture(null);
      return g.ui.hint(complete ? 'Onigiri on the board. Serve it.' : 'Onigiri are shaped at the rice station.');
    }
    if (!g.pieces.length && !g.rolls.length) return g.ui.hint('No rice yet. Make some at the rice station.');
    if (!g.pieces.length) return g.ui.hint(complete ? 'Looks ready. Serve it.' : 'The roll is on its way. Finish it at the knife.');
    if (this.drag) return g.ui.hint('Drop it on the rice.');
    if (this.placing) return;
    const hints = {
      wasabi: 'Tap the rice to add a dab of wasabi. One per dab.',
      fish: g.tray.length ? 'Drag a slice from the tray onto the rice.' : 'Cut some fish at the knife station.',
      ikura: 'Tap the fish to add ikura.',
      sesame: 'Tap the fish to sprinkle sesame.',
      scallion: 'Tap the fish to add scallion.',
      sauce: 'Drag across the fish to brush on sauce.',
      nori: 'Tap the fish to wrap a nori belt round it.',
    };
    g.ui.hint(complete ? 'Looks ready. Serve it.' : hints[this.tool]);
    this.showGesture(complete);
  }

  // Act out the current tool on the piece that needs it.
  showGesture(complete) {
    const g = this.g;
    if (complete || !g.order) return g.gesture(null);
    const wants = nigiriOf(g.order);
    const i = g.pieces.findIndex((p, k) => {
      const want = wants[k];
      if (!want) return false;
      if (this.tool === 'fish') return !p.slice;
      if (this.tool === 'wasabi') return !p.slice && p.wasabi.length < (want.wasabi || 0);
      const v = want.toppings[this.tool];
      if (!p.slice || !v) return false;
      return this.tool === 'ikura' ? (p.tops.ikura || 0) < v : !p.tops[this.tool];
    });
    const piece = g.pieces[i];
    if (!piece) return g.gesture(null);
    const at = piece.group.getWorldPosition(_v).add(_v3.set(0, 0.5, 0));
    if (this.tool === 'fish') {
      const slice = g.tray[0];
      if (!slice) return g.gesture(null);
      return g.gesture('drag', slice.group.getWorldPosition(_v2).add(_v3.set(0, 0.2, 0)), at);
    }
    if (this.tool === 'sauce') return g.gesture('stroke', _v2.copy(at).add(_v3.set(-0.6, 0, 0)), at.add(_v3.set(0.6, 0, 0)));
    g.gesture('tap', at);
  }

  // Everything the pointer could touch here.
  pick(e) {
    const g = this.g;
    const targets = [];
    for (const s of g.tray) targets.push({ obj: s.squishy.mesh, kind: 'tray', ref: s });
    for (const p of g.pieces) {
      if (p.slice) targets.push({ obj: p.slice.squishy.mesh, kind: 'fish', ref: p });
      targets.push({ obj: p.rice.squishy.mesh, kind: 'rice', ref: p });
    }
    for (const [k, bowl] of Object.entries(g.set.bowls)) targets.push({ obj: bowl, kind: 'bowl', ref: k });
    return g.pickFirst(e, targets);
  }

  down(e) {
    const g = this.g;
    const hit = this.pick(e);
    if (!hit) return;
    if (hit.kind === 'bowl') {
      const k = hit.ref;
      if (this.available().includes(k)) this.setTool(k);
      return;
    }
    if (hit.kind === 'tray') {
      this.startDrag(hit.ref, e);
      return;
    }
    const piece = hit.ref;
    if (this.tool === 'wasabi') {
      if (piece.slice) return g.ui.toast('Wasabi goes under the fish');
      if (piece.addWasabi()) {
        g.sound.squelch(0.35);
        piece.rice.body.kickAll(0, 0.6, 0);
        this.advance();
      }
      return;
    }
    if (this.tool === 'fish') {
      // Take the slice this piece's ticket line asks for, if there is one.
      const want = g.order && nigiriOf(g.order)[g.pieces.indexOf(piece)];
      const slice = g.tray.find((x) => want && x.kind === want.fish) || g.tray[0];
      if (!piece.slice && slice) this.place(slice, piece, 0);
      return;
    }
    if (!piece.slice) return g.ui.toast('Put the fish on first');
    if (this.tool === 'nori') {
      if (piece.addNori()) {
        g.sound.squelch(0.3);
        piece.rice.body.kickAll(0, 0.8, 0);
        this.advance();
      }
      return;
    }
    const local = piece.slice.group.worldToLocal(hit.point.clone());
    const tops = piece.slice.toppings;
    if (this.tool === 'sauce') {
      this.sauce = { piece };
      tops.addSaucePoint(local.x, local.z);
      return;
    }
    const added = this.tool === 'ikura' ? tops.addRoe(local.x, local.z) : this.tool === 'sesame' ? tops.addSesame(local.x, local.z) : tops.addScallion(local.x, local.z);
    if (added) {
      if (this.tool === 'ikura') g.sound.plop();
      else g.sound.sprinkle();
      piece.slice.body.impulse(local.x, piece.slice.thickness, local.z, 0, -1, 0, 0.6, 0.3);
      this.advance();
    }
  }

  move(e) {
    const g = this.g;
    if (this.drag) {
      // Aim at the height of the rice tops, so the drop lands where the
      // pointer is, then carry the slice a little above that point.
      const p = g.planeHit(e, new Plane(new Vector3(0, 1, 0), -(LAYOUT.geta.h + 0.55)));
      if (p) {
        this.drag.aim = p;
        this.drag.slice.group.position.lerp(p.clone().setY(p.y + 0.75), 0.6);
      }
      this.drag.moved = true;
      return;
    }
    if (this.sauce) {
      const s = this.sauce.piece.slice;
      const hit = g.hitObject(e, s.squishy.mesh);
      if (hit) {
        const local = s.group.worldToLocal(hit.point.clone());
        s.toppings.addSaucePoint(local.x, local.z);
      }
    }
  }

  up(e) {
    const g = this.g;
    if (this.sauce) {
      this.sauce = null;
      g.sound.squelch(0.3);
      this.advance();
      return;
    }
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    const pos = d.aim || d.slice.group.position;
    const free = g.pieces.filter((p) => !p.slice);
    if (!d.moved) {
      // A tap on a slice sends it to the first rice that wants that fish.
      const fits = free.find((p) => g.order && nigiriOf(g.order)[g.pieces.indexOf(p)]?.fish === d.slice.kind) || free[0];
      if (fits) this.place(d.slice, fits, 0, true);
      else this.dropBack(d.slice);
      return;
    }
    let best = null;
    let bd = 2.2;
    for (const p of free) {
      const w = p.group.getWorldPosition(v3());
      const dist = Math.hypot(w.x - pos.x, w.z - pos.z);
      if (dist < bd) {
        bd = dist;
        best = p;
      }
    }
    if (!best) return this.dropBack(d.slice);
    const local = best.group.worldToLocal(pos.clone());
    // Fingers are not precise: near the middle snaps to dead center, and
    // anything else is pulled most of the way in.
    const dx = Math.abs(local.x) < 0.2 ? 0 : local.x * 0.6;
    this.place(d.slice, best, Math.max(-0.9, Math.min(0.9, dx)), true);
  }

  startDrag(slice, e) {
    const g = this.g;
    g.tray.splice(g.tray.indexOf(slice), 1);
    g.stage.scene.attach(slice.group);
    this.drag = { slice, moved: false };
    slice.group.quaternion.identity();
    slice.body.kickAll(0, -1.2, 0);
    g.sound.squelch(0.3);
    this.move(e);
  }

  dropBack(slice = this.drag && this.drag.slice) {
    this.drag = null;
    if (slice) this.g.toTray(slice);
  }

  place(slice, piece, dx, fromHand = false) {
    const g = this.g;
    this.placing = (this.placing || 0) + 1;
    if (!fromHand) g.tray.splice(g.tray.indexOf(slice), 1);
    const target = piece.fishGroup.localToWorld(new Vector3(dx, 0, 0));
    g.stage.scene.attach(slice.group);
    g.tween({
      obj: slice.group,
      to: target,
      quaternion: piece.group.getWorldQuaternion(new Quaternion()),
      duration: 0.25,
      arc: 0.6,
      done: () => {
        piece.setSlice(slice, dx, 0);
        this.placing--;
        g.sound.squelch(0.6);
        g.buzz(14);
        const at = piece.group.getWorldPosition(new Vector3()).add(new Vector3(0, 1.4, 0));
        const off = Math.abs(dx);
        g.grade(off < 0.15 ? 1 : off > 0.45 ? 0.3 : 0.75, off < 0.15 ? 'Right in the middle' : off > 0.45 ? 'Off center' : 'Nearly centered', at);
        if (off < 0.15) g.fx.burst('glint', at.clone().setY(1.1), 10, { speed: 1.8, up: 2.2, gravity: 5, life: 0.8 });
        this.tool = this.suggestTool();
        g.layoutTray();
      },
    });
  }
}

