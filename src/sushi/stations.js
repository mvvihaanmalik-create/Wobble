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
import { FISH, KNIFE, LAYOUT, RICE } from './config.js';
import { BLOCKS, FishBlock, FishSlice, Piece, RiceMound } from './food.js';
import { bakeFoodCoords, foodMaterial } from './materials.js';
import { cutScore, scoopScore } from './orders.js';
import { Paw } from './critters.js';

const v3 = () => new Vector3();

class Station {
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
      return;
    }
    if (!g.customer || !g.order) {
      g.ui.hint('');
      g.ui.actions([]);
      return;
    }
    if (!g.customer.seated) {
      g.ui.hint('Someone is coming in.');
      g.ui.actions([]);
    } else if (!g.order.taken) {
      g.ui.hint(`${g.order.look.name} is ready to order.`);
      g.ui.actions([{ label: 'Take order', primary: true, onClick: () => g.takeOrder() }]);
    } else if (g.plateComplete()) {
      g.ui.hint('Plate is ready. Serve it from the build station.');
      g.ui.actions([{ label: 'Serve', primary: true, onClick: () => g.serve() }]);
    } else {
      g.ui.hint('Make the order. Rice first.');
      g.ui.actions([{ label: 'To the rice', onClick: () => g.goStation('rice') }]);
    }
  }

  down(e) {
    const c = this.g.customer;
    if (c && this.g.hitObject(e, c.squishy.mesh)) {
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
    const show = g.station === 'rice' && (this.rice || this.ball);
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
    } else if (show && this.rice && this.state !== 'flying') {
      const top = this.rice.group.position.y + this.rice.body.height;
      tx = LAYOUT.mat.x;
      tz = LAYOUT.mat.z + 0.05;
      const t = performance.now() / 1000;
      if (this.state === 'pressing') {
        ty = top + 0.2 - this.value * 0.45;
        rate = 18;
      } else ty = top + 0.9 + Math.sin(t * 3) * 0.06;
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

  get needed() {
    const g = this.g;
    if (!g.order || !g.order.taken) return 0;
    return g.order.pieces.length - g.pieces.length - (this.rice ? 1 : 0);
  }

  status() {
    return this.needed > 0 || this.rice ? 'todo' : null;
  }

  update(dt) {
    const g = this.g;
    if (this.rice) this.rice.update(dt);
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
      this.rice.body.userMode[1] = this.value * 0.3;
      if (g.station === 'rice') {
        g.ui.meter('Press', this.value, RICE.pressGood, this.value > RICE.pressOver, this.dots());
        g.ui.holdRing(g.pointerPos.x, g.pointerPos.y, this.value, RICE.pressGood, this.value > RICE.pressOver);
      }
      if (this.value >= 1) this.finishPress();
    }
    if (g.station !== 'rice') return;
    if (this.state === 'ready') g.ui.meter('Press', 0, RICE.pressGood, false, this.dots());
    else if (this.state !== 'scooping' && this.state !== 'pressing') g.ui.meter(null);
    // Hints.
    if (!g.order || !g.order.taken) g.ui.hint('Take an order at the counter first.');
    else if (this.state === 'idle' && this.needed > 0) g.ui.hint(`Hold to scoop rice. Let go in the green. (${g.pieces.length + 1} of ${g.order.pieces.length})`);
    else if (this.state === 'scooping') g.ui.hint('Let go in the green band.');
    else if (this.state === 'ready') g.ui.hint('Hold to press. Let go in the green.');
    else if (this.state === 'pressing') g.ui.hint(this.value > RICE.pressOver ? 'Too hard!' : 'Press...');
    else if (this.needed <= 0 && !this.rice) g.ui.hint('Rice is done. On to the knife.');
    g.ui.actions(this.needed <= 0 && !this.rice && g.order && g.order.taken ? [{ label: 'To the knife', primary: true, onClick: () => g.goStation('knife') }] : []);
  }

  dots() {
    const n = this.rice ? this.rice.presses.length : 0;
    return '●'.repeat(n) + '○'.repeat(RICE.presses - n);
  }

  down() {
    const g = this.g;
    if (!g.order || !g.order.taken) return g.ui.toast('Take the order first');
    if (this.state === 'idle' && this.needed > 0) {
      this.state = 'scooping';
      this.value = 0;
      this.ball = new Mesh(scoopBallGeometry(), foodMaterial('rice'));
      this.ball.castShadow = true;
      this.ball.position.set(LAYOUT.tub.x, LAYOUT.tub.height + 0.4, LAYOUT.tub.z);
      g.stage.scene.add(this.ball);
      g.sound.scoop();
    } else if (this.state === 'ready') {
      this.state = 'pressing';
      this.value = 0;
    }
  }

  up() {
    this.g.ui.holdRing(null);
    if (this.state === 'scooping') this.finishScoop();
    else if (this.state === 'pressing') this.finishPress();
  }

  cancelScoop() {
    if (this.ball) this.g.stage.scene.remove(this.ball);
    this.ball = null;
    this.state = 'idle';
  }

  finishScoop() {
    const g = this.g;
    const scoop = this.value;
    const from = this.ball.position.clone();
    g.stage.scene.remove(this.ball);
    this.ball = null;
    this.state = 'flying';
    const rice = new RiceMound(scoop, 1 + Math.floor(Math.random() * 1000));
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
        rice.body.kickAll(0, 2.5, 0);
        g.sound.squelch(0.6);
        this.state = 'ready';
        const at = new Vector3(LAYOUT.mat.x, 0.6, LAYOUT.mat.z);
        g.fx.burst('grain', at, 14, { speed: 2.2, up: 3, life: 0.9 });
        const sc = scoopScore(scoop);
        const [lo] = RICE.scoopTarget;
        if (sc > 0.95) {
          g.popupAt('Perfect scoop', at.clone().setY(1.6), 'great');
          g.fx.burst('glint', at.clone().setY(1.2), 14, { speed: 2, up: 3, gravity: 6, life: 0.9 });
        } else g.popupAt(sc > 0.6 ? 'Good scoop' : scoop < lo ? 'A bit small' : 'Too much', at.clone().setY(1.6), sc > 0.6 ? 'good' : 'bad');
        g.buzz(10);
      },
    });
    g.ui.meter(null);
  }

  finishPress() {
    const g = this.g;
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
    this.rice.body.userMode[1] = 0;
    this.rice.press(quality, over);
    g.sound.squelch(0.5 + v * 0.6);
    const at = new Vector3(LAYOUT.mat.x, 1.5, LAYOUT.mat.z);
    if (over > 0.5) g.popupAt('Too hard', at, 'bad');
    else if (v < a) g.popupAt('Too soft', at, 'bad');
    else if (quality > 0.85) {
      g.popupAt('Perfect', at, 'great');
      g.fx.burst('glint', at.clone().setY(1), 10, { speed: 2, up: 2.5, gravity: 6, life: 0.8 });
    } else g.popupAt('Good', at, 'good');
    g.fx.burst('grain', at.clone().setY(0.5), 5, { speed: 1.6, up: 1.8, life: 0.6 });
    g.buzz(over > 0.5 ? 30 : 14);
    this.state = 'ready';
    if (this.rice.presses.length >= RICE.presses) this.finishPiece();
  }

  finishPiece() {
    const g = this.g;
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
    this.rice = null;
    this.cancelScoop();
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
    return this.g.order && this.g.order.taken && this.needed.total > 0 ? 'todo' : null;
  }

  update(dt) {
    const g = this.g;
    for (const b of Object.values(this.blocks)) if (b.group.visible) b.update(dt);
    const need = this.needed;
    if (g.station === 'knife') {
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
        g.popupAt(verdict, landing.clone().setY(1.4), score.total > 0.85 ? 'great' : score.total > 0.55 ? 'good' : 'bad');
        setTimeout(() => g.toTray(slice), 450);
      },
    });
    if (b.remaining < 1.6) {
      setTimeout(() => {
        g.stage.scene.remove(b.group);
        delete this.blocks[this.kind];
        this.show(this.kind);
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

const TOPPING_TOOLS = ['ikura', 'sesame', 'scallion', 'sauce'];

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

  wanted() {
    const g = this.g;
    if (!g.order) return [];
    const w = new Set();
    for (const p of g.order.pieces) {
      if (p.wasabi) w.add('wasabi');
      for (const t of Object.keys(p.toppings)) w.add(t);
    }
    if (g.pieces.some((p) => !p.slice)) w.add('fish');
    return [...w];
  }

  suggestTool() {
    const g = this.g;
    const bare = g.pieces.filter((p) => !p.slice);
    if (bare.length && g.order && g.order.pieces.some((p) => p.wasabi) && bare.every((p) => p.wasabi.length === 0)) return 'wasabi';
    if (bare.length && g.tray.length) return 'fish';
    const want = this.wanted().filter((t) => TOPPING_TOOLS.includes(t));
    return want[0] || 'fish';
  }

  status() {
    const g = this.g;
    if (!g.order || !g.order.taken) return null;
    if (g.plateComplete()) return 'ready';
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
    const complete = g.plateComplete();
    g.ui.actions([{ label: 'Serve', primary: complete, disabled: !g.pieces.some((p) => p.slice), onClick: () => g.serve() }]);
    if (!g.order || !g.order.taken) return g.ui.hint('Take an order at the counter first.');
    if (!g.pieces.length) return g.ui.hint('No rice yet. Make some at the rice station.');
    if (this.drag) return g.ui.hint('Drop it on the rice.');
    const hints = {
      wasabi: 'Tap the rice to add a dab of wasabi. One per dab.',
      fish: g.tray.length ? 'Drag a slice from the tray onto the rice.' : 'Cut some fish at the knife station.',
      ikura: 'Tap the fish to add ikura.',
      sesame: 'Tap the fish to sprinkle sesame.',
      scallion: 'Tap the fish to add scallion.',
      sauce: 'Drag across the fish to brush on sauce.',
    };
    g.ui.hint(complete ? 'Looks ready. Serve it.' : hints[this.tool]);
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
      }
      return;
    }
    if (this.tool === 'fish') {
      if (!piece.slice && g.tray.length) this.place(g.tray[0], piece, 0);
      return;
    }
    if (!piece.slice) return g.ui.toast('Put the fish on first');
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
    }
  }

  move(e) {
    const g = this.g;
    if (this.drag) {
      const p = g.planeHit(e, new Plane(new Vector3(0, 1, 0), -(LAYOUT.geta.h + 1.3)));
      if (p) this.drag.slice.group.position.lerp(p, 0.6);
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
      return;
    }
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    const pos = d.slice.group.position;
    const free = g.pieces.filter((p) => !p.slice);
    if (!d.moved) {
      if (free.length) this.place(d.slice, free[0], 0, true);
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
    this.place(d.slice, best, Math.max(-0.9, Math.min(0.9, local.x)), true);
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
        g.sound.squelch(0.6);
        g.buzz(14);
        const at = piece.group.getWorldPosition(new Vector3()).add(new Vector3(0, 1.4, 0));
        if (Math.abs(dx) < 0.15) {
          g.popupAt('Neat', at, 'great');
          g.fx.burst('glint', at.clone().setY(1.1), 10, { speed: 1.8, up: 2.2, gravity: 5, life: 0.8 });
        } else if (Math.abs(dx) > 0.45) g.popupAt('Off center', at, 'bad');
        this.tool = this.suggestTool();
        g.layoutTray();
      },
    });
  }
}

