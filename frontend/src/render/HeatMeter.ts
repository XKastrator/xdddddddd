/** HeatMeter — the single "earned multiplier" gauge (doubles as progress cue). */
import { Container, Graphics } from 'pixi.js';
import type { GlyphFont } from './GlyphText';
import { GlyphText } from './GlyphText';
import { THEME } from './palette';
import { tween } from './tween';

export class HeatMeter extends Container {
  private track = new Graphics();
  private fill = new Graphics();
  private txt: GlyphText | null;
  private w: number; private h: number;
  private cap = 25;
  private cur = 1;

  constructor(width: number, height = 14, font?: GlyphFont | null) {
    super();
    this.w = width; this.h = height;
    this.track.roundRect(0, 0, width, height, height / 2).fill({ color: 0x20180f })
      .roundRect(0, 0, width, height, height / 2).stroke({ width: 1, color: THEME.line });
    this.txt = font ? new GlyphText(font, {
      size: Math.round(height * 0.8), tint: THEME.amber2, letterSpacing: 2 }) : null;
    if (this.txt) { this.txt.text = 'HEAT ×1'; this.txt.position.set(0, -6); }
    this.addChild(this.track, this.fill);
    if (this.txt) this.addChild(this.txt);
    this.redraw(this.cur / this.cap);
  }

  setCap(cap: number): void { this.cap = cap; }

  private redraw(frac: number): void {
    this.fill.clear();
    const fw = Math.max(this.h, this.w * Math.min(1, frac));
    // amber → white toward the top of the gauge
    const col = frac > 0.75 ? 0xfff2cc : frac > 0.4 ? THEME.amber2 : THEME.amber;
    this.fill.roundRect(0, 0, fw, this.h, this.h / 2).fill({ color: col });
  }

  async set(heat: number, ctx: { shouldSkip: () => boolean; reduced: boolean }): Promise<void> {
    const from = this.cur; this.cur = heat;
    if (this.txt) this.txt.text = `HEAT ×${heat}`;
    await tween({
      duration: 220, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => this.redraw((from + (heat - from) * t) / this.cap),
    });
  }

  reset(heat = 1): void {
    this.cur = heat;
    if (this.txt) this.txt.text = `HEAT ×${heat}`;
    this.redraw(heat / this.cap);
  }
}
