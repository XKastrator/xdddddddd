/**
 * juice.ts — the motion vocabulary that separates a prototype from a product.
 *
 * These are the beats a commercial slot spends most of its polish budget on:
 * impact shake, staggered drops, squash-and-stretch on landing, anticipation
 * pulses and celebratory showers. All of it respects reduced motion and skip.
 */
import { Container, Graphics } from 'pixi.js';
import { tween, easeOutCubic } from './tween';

export interface Ctx { shouldSkip: () => boolean; reduced: boolean; }

/**
 * Impact shake on a container.
 *
 * Perturbs `pivot`, not `position`: layout code owns `position`, so a resize
 * (or a second shake) landing mid-animation can never snap the container to a
 * stale coordinate. Decays to zero and always resets, so shakes cannot drift.
 */
export async function shake(
  target: Container, intensity: number, duration: number, ctx: Ctx,
): Promise<void> {
  if (ctx.reduced) return;                       // motion-sensitivity: no shake
  await tween({
    duration, shouldSkip: ctx.shouldSkip,
    onUpdate: (t) => {
      const decay = (1 - t) ** 2;                // hard hit, quick settle
      target.pivot.set(
        (Math.random() * 2 - 1) * intensity * decay,
        (Math.random() * 2 - 1) * intensity * decay,
      );
    },
  });
  target.pivot.set(0, 0);
}

/** Squash-and-stretch: the classic landing accent. */
export async function squash(
  target: Container, amount: number, duration: number, ctx: Ctx,
): Promise<void> {
  if (ctx.reduced) return;
  const sx = target.scale.x, sy = target.scale.y;
  await tween({
    duration, ease: easeOutCubic, shouldSkip: ctx.shouldSkip,
    onUpdate: (t) => {
      // squash hard on impact, overshoot, then settle
      const k = Math.sin(t * Math.PI) * (1 - t) * amount;
      target.scale.set(sx * (1 + k), sy * (1 - k));
    },
  });
  target.scale.set(sx, sy);
}

/** A pulsing highlight used for anticipation (scatters teasing a trigger). */
export async function pulse(
  target: Container, times: number, duration: number, ctx: Ctx,
): Promise<void> {
  const s = target.scale.x;
  await tween({
    duration, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
    onUpdate: (t) => {
      const k = 1 + 0.16 * Math.abs(Math.sin(t * Math.PI * times));
      target.scale.set(s * k);
    },
  });
  target.scale.set(s);
}

/**
 * CoinShower — celebratory fountain for big wins. Pooled, so a long celebration
 * never allocates per frame.
 */
interface Coin { g: Graphics; vx: number; vy: number; spin: number; life: number; ttl: number; }

export class CoinShower extends Container {
  private pool: Coin[] = [];
  private active: Coin[] = [];
  private ticking = false;

  constructor(size = 70) {
    super();
    for (let i = 0; i < size; i++) {
      const g = new Graphics();
      // a coin edge-on reads better than a flat disc when it tumbles
      g.ellipse(0, 0, 9, 9).fill({ color: 0xffd868 });
      g.ellipse(0, 0, 5.5, 5.5).fill({ color: 0xfff8d8 });
      g.visible = false;
      this.addChild(g);
      this.pool.push({ g, vx: 0, vy: 0, spin: 0, life: 0, ttl: 1 });
    }
  }

  /** Erupt `n` coins from a horizontal band at the bottom of (w, h). */
  erupt(w: number, h: number, n = 40): void {
    for (let i = 0; i < n; i++) {
      const c = this.pool.pop();
      if (!c) break;
      c.g.position.set(w * (0.15 + Math.random() * 0.7), h * 0.92);
      c.g.scale.set(0.7 + Math.random() * 0.8);
      c.g.visible = true;
      c.g.alpha = 1;
      c.vx = (Math.random() * 2 - 1) * 3.6;
      c.vy = -(9 + Math.random() * 7);
      c.spin = (Math.random() * 2 - 1) * 0.25;
      c.ttl = 1100 + Math.random() * 700;
      c.life = 0;
      this.active.push(c);
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
      const f = dt / 16;
      for (let i = this.active.length - 1; i >= 0; i--) {
        const c = this.active[i];
        c.life += dt;
        const k = c.life / c.ttl;
        if (k >= 1) {
          c.g.visible = false;
          this.active.splice(i, 1);
          this.pool.push(c);
          continue;
        }
        c.g.x += c.vx * f;
        c.g.y += c.vy * f;
        c.vy += 0.52 * f;                     // gravity
        c.g.rotation += c.spin * f;
        // tumble: squash the coin horizontally as it spins
        c.g.scale.x = Math.abs(Math.cos(c.g.rotation)) * 0.9 + 0.25;
        c.g.alpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      }
      if (this.active.length) requestAnimationFrame(step);
      else this.ticking = false;
    };
    requestAnimationFrame(step);
  }
}
