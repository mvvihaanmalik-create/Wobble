import { Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WEIGHT } from './config.js';

// A heavy dark block dropped from above. It lands, sinks into the jelly while
// the jelly pushes back, bounces off and leaves the frame.
export class Weight {
  constructor() {
    const [w, h, d] = WEIGHT.size;
    this.hx = w / 2;
    this.hy = h / 2;
    this.hz = d / 2;
    this.r = WEIGHT.radius;
    const mat = new MeshStandardMaterial({ color: 0x24211e, metalness: 0.55, roughness: 0.38 });
    this.group = new Group();
    const body = new Mesh(new RoundedBoxGeometry(w, h, d, 4, WEIGHT.radius), mat);
    const handle = new Mesh(new TorusGeometry(h * 0.26, h * 0.07, 10, 28), mat);
    handle.position.y = h / 2 + h * 0.12;
    this.group.add(body, handle);
    this.group.visible = false;
    this.active = false;
    this.pressed = 0;
    this.onImpact = null;
  }

  drop(x, top, frameHalfWidth) {
    this.x = x;
    this.z = 0;
    this.top = top;
    this.y = top + WEIGHT.dropHeight + this.hy;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.spin = 0;
    this.angle = 0;
    this.contact = false;
    this.bounced = false;
    this.maxPen = 0;
    this.frameHalfWidth = frameHalfWidth;
    this.active = true;
    this.group.visible = true;
    this.sync();
  }

  substep(dt) {
    let ay = -WEIGHT.gravity;
    const bottom = this.y - this.hy;
    const pen = this.bounced ? 0 : this.top - bottom;
    if (pen > 0) {
      if (!this.contact) {
        this.contact = true;
        if (this.onImpact) this.onImpact(this, -this.vy);
      }
      ay += WEIGHT.contactStiffness * pen - WEIGHT.contactDamping * this.vy;
      this.maxPen = Math.max(this.maxPen, pen);
    } else if (this.contact && !this.bounced) {
      // Leaving the surface: fling it sideways toward the nearer edge, hard
      // enough to clear the frame before it comes back down.
      this.bounced = true;
      this.vy = Math.max(this.vy, 6.5);
      const side = this.x === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(this.x);
      const air = (2 * this.vy) / WEIGHT.gravity;
      const travel = this.frameHalfWidth + this.hx * 3 - side * this.x;
      this.vx = side * Math.max(WEIGHT.kickSideways, travel / (air * 0.8));
      this.vz = 0.6;
      this.spin = -side * WEIGHT.spin;
    }
    this.vy += ay * dt;
    this.y += this.vy * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.angle += this.spin * dt;
    if (this.bounced && (this.y < -4 || Math.abs(this.x) > this.frameHalfWidth + 4)) {
      this.active = false;
      this.group.visible = false;
    }
  }

  sync() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.z = this.angle;
  }
}
