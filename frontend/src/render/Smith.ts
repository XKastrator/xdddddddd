/**
 * Smith — the Emberwright, rendered from a single painted illustration.
 *
 * This replaces the earlier bone rig (`Rig.ts`). The rig existed because the
 * figure was assembled from procedurally-drawn parts and had to be posed;
 * the delivered artwork is one illustration, and cutting it into limbs to drive
 * the same skeleton would visibly tear the painting at every joint.
 *
 * What a static sprite still needs, and gets here, is LIFE: he breathes, he
 * sways, the forge light on him pulses, and he reacts to the hammer landing and
 * to a big win. Presenting the same API as the rig (`play`, `update`) keeps the
 * presenter unchanged.
 */
import { Container, Sprite, Texture } from 'pixi.js';

type Anim = 'idle' | 'strike' | 'cheer';

export class Smith extends Container {
  private sprite: Sprite;
  private t = 0;
  /** Seconds left on the current one-shot reaction. */
  private reactLeft = 0;
  private reactTotal = 0;
  private anim: Anim = 'idle';

  constructor(texture: Texture) {
    super();
    this.sprite = new Sprite(texture);
    // anchored at the feet: layout positions him ON the floor line, and every
    // scale change then grows him upward instead of sinking him into the stone
    this.sprite.anchor.set(0.5, 1);
    this.addChild(this.sprite);
  }

  /** Native size of the illustration, for the layout maths. */
  get artWidth(): number { return this.sprite.texture.width; }
  get artHeight(): number { return this.sprite.texture.height; }

  play(anim: Anim): void {
    if (anim === 'idle') { this.anim = 'idle'; this.reactLeft = 0; return; }
    this.anim = anim;
    this.reactTotal = anim === 'strike' ? 0.42 : 0.9;
    this.reactLeft = this.reactTotal;
  }

  update(dt: number): void {
    this.t += dt;

    // breathing: a slow vertical squash-and-stretch about the feet
    const breath = Math.sin(this.t * 1.15);
    let sy = 1 + breath * 0.012;
    let sx = 1 - breath * 0.008;
    let rot = Math.sin(this.t * 0.62) * 0.012;
    let dy = 0;

    if (this.reactLeft > 0) {
      this.reactLeft = Math.max(0, this.reactLeft - dt);
      const p = 1 - this.reactLeft / this.reactTotal;   // 0..1
      if (this.anim === 'strike') {
        // drive down hard, recover soft — the hammer landing, not a bounce
        const drop = p < 0.28 ? p / 0.28 : (1 - (p - 0.28) / 0.72) ** 2;
        dy = drop * 14;
        sy -= drop * 0.045;
        sx += drop * 0.03;
        rot += drop * 0.05;
      } else {
        // cheer: two decaying hops
        const hop = Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p) ** 1.2;
        dy = -hop * 26;
        sy += hop * 0.05;
      }
      if (this.reactLeft === 0) this.anim = 'idle';
    }

    this.sprite.scale.set(sx, sy);
    this.sprite.rotation = rot;
    this.sprite.y = dy;

    // the forge breathing on him: a slow warm flicker, never a colour shift
    const flick = 0.94 + Math.sin(this.t * 2.3) * 0.03 + Math.sin(this.t * 5.7) * 0.02;
    this.sprite.tint = tintFromWarmth(flick);
  }
}

/** Multiply-tint that dims toward a warm shadow instead of toward grey. */
function tintFromWarmth(k: number): number {
  const r = Math.round(255 * Math.min(1, k * 1.03));
  const g = Math.round(255 * k);
  const b = Math.round(255 * Math.max(0, k * 0.95));
  return (r << 16) | (g << 8) | b;
}
