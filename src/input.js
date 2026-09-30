import { Plane, Raycaster, Triangle, Vector2, Vector3 } from 'three';
import { INPUT } from './config.js';

// Pointer Events only, so mouse, pen and touch share one path. Each pointer
// that lands on the jelly grabs the surface under it; a press that never
// travels is a tap, and two quick taps drop the weight.
export class Input {
  constructor(canvas, stage, app) {
    this.canvas = canvas;
    this.stage = stage;
    this.app = app;
    this.pointers = new Map();
    this.ray = new Raycaster();
    this.ndc = new Vector2();
    this.lastTap = { t: -1e9, x: 0, y: 0 };
    this.pinch = null;
    this.enabled = true;

    this._a = new Vector3();
    this._b = new Vector3();
    this._c = new Vector3();
    this._p = new Vector3();
    this._bary = new Vector3();
    this._hit = new Vector3();
    this._disp = new Float32Array(3);

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e, false));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('lostpointercapture', (e) => this.up(e, true));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', (e) => this.parallax(e), { passive: true });
  }

  setNdc(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.stage.camera);
  }

  parallax(e) {
    this.stage.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.stage.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.app.onGesture();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointers cannot always be captured.
    }
    const s = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t0: performance.now(),
      slot: -1,
      dragging: false,
      rest: new Vector3(),
      normal: new Vector3(),
      disp0: new Vector3(),
      press: new Vector3(),
      plane: new Plane(),
      glyph: 0,
      pull: 0,
    };
    this.pointers.set(e.pointerId, s);

    const hit = this.pick(e);
    const body = this.app.body;
    if (hit && body) {
      s.rest.copy(hit.rest);
      s.normal.copy(hit.normal);
      s.disp0.copy(hit.local).sub(hit.rest);
      s.glyph = body.glyphOf[hit.vertex];
      // Press direction: mostly into the screen, bent toward the surface normal.
      const dir = this._p.copy(this.ray.ray.direction);
      this.app.mesh.worldToLocal(dir.add(this.app.mesh.getWorldPosition(this._c)));
      s.press.copy(dir).multiplyScalar(0.55).addScaledVector(hit.normal, -0.45).normalize();
      this.stage.camera.getWorldDirection(this._c);
      s.plane.setFromNormalAndCoplanarPoint(this._c.negate(), hit.world);
      s.slot = body.grab(s.rest.x, s.rest.y, s.rest.z, s.glyph);
    }
    this.updatePinch();
  }

  move(e) {
    const s = this.pointers.get(e.pointerId);
    if (!s) return;
    s.x = e.clientX;
    s.y = e.clientY;
    if (!s.dragging && Math.hypot(s.x - s.x0, s.y - s.y0) > INPUT.dragThresholdPx) s.dragging = true;
  }

  up(e, cancelled) {
    const s = this.pointers.get(e.pointerId);
    if (!s) return;
    this.pointers.delete(e.pointerId);
    const body = this.app.body;
    const held = performance.now() - s.t0;
    if (s.slot >= 0 && body) body.release(s.slot);

    if (!cancelled && !s.dragging) {
      if (s.slot >= 0) this.app.onTap(s, held);
      const now = performance.now();
      const lt = this.lastTap;
      if (now - lt.t < INPUT.doubleTapMs && Math.hypot(s.x - lt.x, s.y - lt.y) < INPUT.doubleTapPx) {
        this.app.onDoubleTap(this.localXAt(s.x, s.y));
        lt.t = -1e9;
      } else {
        lt.t = now;
        lt.x = s.x;
        lt.y = s.y;
      }
    } else if (s.slot >= 0) {
      this.app.onRelease(s, s.pull);
    }
    this.updatePinch();
  }

  // Raycast the deformed mesh and map the hit back to rest space.
  pick(e) {
    const mesh = this.app.mesh;
    const body = this.app.body;
    if (!mesh || !body) return null;
    this.setNdc(e);
    const hits = this.ray.intersectObject(mesh, false);
    if (!hits.length) return null;
    const h = hits[0];
    const { a, b, c } = h.face;
    const out = body.out;
    const local = mesh.worldToLocal(this._hit.copy(h.point));
    this._a.fromArray(out, a * 3);
    this._b.fromArray(out, b * 3);
    this._c.fromArray(out, c * 3);
    Triangle.getBarycoord(local, this._a, this._b, this._c, this._bary);
    const w = this._bary;
    const rest = new Vector3();
    const normal = new Vector3();
    for (const [i, k] of [[a, w.x], [b, w.y], [c, w.z]]) {
      rest.x += body.rest[i * 3] * k;
      rest.y += body.rest[i * 3 + 1] * k;
      rest.z += body.rest[i * 3 + 2] * k;
      normal.x += body.restNormal[i * 3] * k;
      normal.y += body.restNormal[i * 3 + 1] * k;
      normal.z += body.restNormal[i * 3 + 2] * k;
    }
    normal.normalize();
    const vertex = w.x >= w.y && w.x >= w.z ? a : w.y >= w.z ? b : c;
    return { rest, normal, local: local.clone(), world: h.point.clone(), vertex };
  }

  // Where a screen point meets the plane of the word, in jelly space.
  localXAt(x, y) {
    this.setNdc({ clientX: x, clientY: y });
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const p = this.ray.ray.intersectPlane(plane, this._p);
    return p ? this.app.mesh.worldToLocal(p).x : 0;
  }

  // Per frame: move each grab toward its pointer.
  update() {
    const body = this.app.body;
    if (!body) return;
    const now = performance.now();
    body.grabMode.fill(0);
    for (const s of this.pointers.values()) {
      if (s.slot < 0) continue;
      if (s.dragging) {
        this.setNdc({ clientX: s.x, clientY: s.y });
        const p = this.ray.ray.intersectPlane(s.plane, this._p);
        if (!p) continue;
        this.app.mesh.worldToLocal(p);
        p.sub(s.rest);
        const len = p.length();
        if (len > INPUT.maxPull) p.multiplyScalar(INPUT.maxPull / len);
        s.pull = Math.min(len, INPUT.maxPull);
        body.setGrabTarget(s.slot, p.x, p.y, p.z);
      } else {
        // Held without moving: sink in slowly.
        const k = Math.min(1, (now - s.t0) / INPUT.pressMaxMs);
        const depth = INPUT.pressDepth * (1 - (1 - k) * (1 - k));
        body.setGrabTarget(
          s.slot,
          s.disp0.x + s.press.x * depth,
          s.disp0.y + s.press.y * depth,
          s.disp0.z + s.press.z * depth,
          0,
        );
      }
    }
    this.updatePinchTarget();
  }

  // Two pointers where at least one missed the jelly: pinch squashes, twist sways.
  updatePinch() {
    const list = [...this.pointers.values()];
    if (list.length === 2 && list.some((p) => p.slot < 0)) {
      const [a, b] = list;
      this.pinch = { a, b, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang0: Math.atan2(b.y - a.y, b.x - a.x) };
    } else {
      if (this.pinch && this.app.body) this.app.body.userMode.fill(0);
      this.pinch = null;
    }
  }

  updatePinchTarget() {
    const p = this.pinch;
    const body = this.app.body;
    if (!p || !body) return;
    const d = Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y);
    const ratio = d / p.d0;
    let ang = Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x) - p.ang0;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    body.userMode[1] = Math.max(-0.22, Math.min(0.26, (1 - ratio) * INPUT.pinchSquash));
    body.userMode[0] = Math.max(-0.25, Math.min(0.25, ang * 0.35));
  }

  cancelAll() {
    const body = this.app.body;
    for (const s of this.pointers.values()) if (s.slot >= 0 && body) body.release(s.slot);
    this.pointers.clear();
    this.pinch = null;
  }
}
