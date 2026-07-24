/**
 * Particles — pooled ember bursts for forging and the Pour.
 *
 * A fixed pool of Graphics is allocated once and recycled, so no allocation
 * happens per frame (mobile GC pressure). Respects reduced motion by emitting
 * nothing when disabled.
 */
import { Container, Graphics } from 'pixi.js';
import { THEME } from './palette';

interface P { g: Graphics; vx: number; vy: number; life: number; ttl: number; }

export class Particles extends Container {
  private pool: P[] = [];
  private active: P[] = [];
  private ticking = false;
  enabled = true;

  constructor(size = 90) {
    super();
    for (let i = 0; i < size; i++) {
      const g = new Graphics();
      g.circle(0, 0, 3).fill({ color: THEME.amber2 });
      g.visible = false;
      this.addChild(g);
      this.pool.push({ g, vx: 0, vy: 0, life: 0, ttl: 1 });
    }
  }

  /** Emit `n` embers from (x, y) in local coordinates. */
  burst(x: number, y: number, n = 10, spread = 2.2, color = THEME.amber2): void {
    if (!this.enabled) return;
    for (let i = 0; i < n; i++) {
      const p = this.pool.pop();
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const s = (0.4 + Math.random()) * spread;
      p.g.position.set(x, y);
      p.g.tint = color;
      p.g.scale.set(0.6 + Math.random() * 0.8);
      p.g.alpha = 1;
      p.g.visible = true;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - 1.1;      // bias upward like rising sparks
      p.ttl = 380 + Math.random() * 320;
      p.life = 0;
      this.active.push(p);
    }
    this.start();
  }

  private start(): void {
    if (this.ticking) return;
    this.ticking = true;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      for (let i = this.active.length - 1; i >= 0; i--) {
        const p = this.active[i];
        p.life += dt;
        const k = p.life / p.ttl;
        if (k >= 1) {
          p.g.visible = false;
          this.active.splice(i, 1);
          this.pool.push(p);
          continue;
        }
        p.g.x += p.vx * (dt / 16);
        p.g.y += p.vy * (dt / 16);
        p.vy += 0.06 * (dt / 16);        // gravity
        p.g.alpha = 1 - k;
      }
      if (this.active.length) requestAnimationFrame(step);
      else this.ticking = false;
    };
    requestAnimationFrame(step);
  }
}
