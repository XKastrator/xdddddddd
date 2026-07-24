/**
 * Background — the Deepforge scene behind the board.
 *
 * Holds one sprite per round state and cross-fades between them, so entering
 * Forge Fury or Molten Core is felt before a single word is read. The scene is
 * cover-fitted (never letterboxed) and kept low-contrast in the centre so the
 * grid and HUD stay readable on top.
 *
 * Falls back to a painted gradient when the scene images are absent, so the game
 * still runs without binary assets.
 */
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { THEME } from './palette';
import { tween } from './tween';

export type SceneName = 'base' | 'bonus' | 'super';

export class Background extends Container {
  private layers = new Map<SceneName, Sprite>();
  private fallback = new Graphics();
  private current: SceneName = 'base';
  private w = 0;
  private h = 0;

  constructor(textures: Partial<Record<SceneName, Texture>>) {
    super();
    this.addChild(this.fallback);
    for (const name of ['base', 'bonus', 'super'] as SceneName[]) {
      const tex = textures[name];
      if (!tex) continue;
      const sp = new Sprite(tex);
      sp.anchor.set(0.5);
      sp.alpha = name === 'base' ? 1 : 0;
      this.layers.set(name, sp);
      this.addChild(sp);
    }
  }

  get hasArt(): boolean { return this.layers.size > 0; }

  resize(w: number, h: number): void {
    this.w = w; this.h = h;

    this.fallback.clear();
    this.fallback.rect(0, 0, w, h).fill({ color: THEME.bg0 });
    if (!this.hasArt) {
      // painted stand-in: cavern gradient + forge glow from the floor
      this.fallback.roundRect(w * 0.1, -h * 0.1, w * 0.8, h * 0.5, 40)
        .fill({ color: 0x1c130b, alpha: 0.5 });
      this.fallback.ellipse(w / 2, h * 1.02, w * 0.6, h * 0.35)
        .fill({ color: THEME.amber, alpha: 0.16 });
      return;
    }

    for (const sp of this.layers.values()) {
      const tw = sp.texture.width, th = sp.texture.height;
      const scale = Math.max(w / tw, h / th);          // cover-fit
      sp.scale.set(scale);
      sp.position.set(w / 2, h / 2);
    }
  }

  /** Cross-fade to a scene. Instant when reduced motion is on. */
  async to(name: SceneName, ctx: { shouldSkip: () => boolean; reduced: boolean }): Promise<void> {
    if (name === this.current) return;
    const from = this.layers.get(this.current);
    const to = this.layers.get(name);
    this.current = name;
    if (!to) return;
    if (!from) { to.alpha = 1; return; }
    await tween({
      duration: 520, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { to.alpha = t; from.alpha = 1 - t; },
    });
    to.alpha = 1; from.alpha = 0;
  }

  /** Subtle parallax drift; called from the ticker. */
  drift(seconds: number): void {
    if (!this.hasArt) return;
    const sp = this.layers.get(this.current);
    if (!sp) return;
    sp.x = this.w / 2 + Math.sin(seconds * 0.25) * 6;
    sp.y = this.h / 2 + Math.cos(seconds * 0.18) * 4;
  }
}
