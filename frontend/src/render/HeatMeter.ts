/**
 * HeatMeter — the single "earned multiplier" gauge (doubles as progress cue).
 *
 * It used to hang in its own strip BELOW the housing, where it read as a stray
 * loading bar that happened to be near the game. It now sits in the bottom rail
 * of the cabinet, as a channel machined into the metal: a dark groove, notches
 * marking the way up, and a hot fill that runs along it. A meter that is part
 * of the furniture is a meter the player reads without being asked to.
 */
import { Container, FillGradient, Graphics } from 'pixi.js';
import type { GlyphFont } from './GlyphText';
import { GlyphText } from './GlyphText';
import { THEME } from './palette';
import { tween } from './tween';

export class HeatMeter extends Container {
  private track = new Graphics();
  private fill = new Graphics();
  private txt: GlyphText | null;
  private w = 200; private h = 12;
  /** Where the channel starts — the label owns everything left of it. */
  private x0 = 0;
  /**
   * A narrow rail cannot carry the word. On a portrait board the cabinet band
   * is ~12px, which puts "HEAT ×1" at six pixels — present, unreadable, and
   * worse than saying less. Below that the caption drops to the multiplier
   * alone, which is the part that changes.
   */
  private terse = false;
  private cap = 25;
  private cur = 1;
  private hot = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
    colorStops: [
      { offset: 0, color: 0xd8500f },
      { offset: 0.55, color: THEME.amber2 },
      { offset: 1, color: 0xfff3d0 },
    ],
    textureSpace: 'local',
  });

  constructor(width: number, height = 14, font?: GlyphFont | null) {
    super();
    this.txt = font ? new GlyphText(font, {
      size: 12, tint: THEME.amber2, letterSpacing: 2 }) : null;
    this.addChild(this.track, this.fill);
    if (this.txt) this.addChild(this.txt);
    this.layout(width, height);
  }

  /**
   * Geometry, in the coordinate space of whatever the gauge is parented to.
   * Driven by `ReelFrame.gaugeSlot()` so the channel tracks the rail exactly.
   */
  layout(width: number, height: number): void {
    this.w = width; this.h = height;
    const labelW = Math.min(width * 0.3, height * 6.4);
    this.x0 = labelW;
    const cw = Math.max(20, width - labelW);
    const r = height / 2;
    const g = this.track;
    g.clear();
    // the groove, cut into the rail: black inside, a lit lip on the near edge
    g.roundRect(labelW, 0, cw, height, r).fill({ color: 0x05070a, alpha: 0.92 });
    g.roundRect(labelW, 0, cw, height, r)
      .stroke({ width: Math.max(1, height * 0.1), color: 0x000000, alpha: 0.8 });
    g.moveTo(labelW + r, height - 1).lineTo(labelW + cw - r, height - 1)
      .stroke({ width: Math.max(1, height * 0.09), color: 0x8fa4bd, alpha: 0.3 });
    // notches: the gauge has a scale, so a half-full one means something
    for (let i = 1; i < 5; i++) {
      const x = labelW + (cw * i) / 5;
      g.moveTo(x, height * 0.22).lineTo(x, height * 0.78)
        .stroke({ width: Math.max(1, height * 0.08), color: 0x9fb2c9, alpha: 0.22 });
    }
    if (this.txt) {
      // the glyph face draws UP from its baseline, so this y is the baseline —
      // set so the caps sit centred against the channel
      this.txt.setSize(Math.max(9, Math.round(height * 0.78)));
      this.txt.position.set(0, height * 0.9);
      this.terse = height < 13;
      this.txt.text = this.caption();
    }
    this.redraw(this.cur / this.cap);
  }

  setCap(cap: number): void { this.cap = cap; }

  private caption(): string {
    return this.terse ? `×${this.cur}` : `HEAT ×${this.cur}`;
  }

  private redraw(frac: number): void {
    this.fill.clear();
    const cw = Math.max(20, this.w - this.x0);
    const t = Math.max(0, Math.min(1, frac));
    const fw = Math.max(this.h, cw * t);
    const r = this.h / 2;
    this.fill.roundRect(this.x0, 0, fw, this.h, r).fill(this.hot);
    // the leading edge glows — the gauge is molten, not painted
    this.fill.circle(this.x0 + fw - r, this.h / 2, this.h * 1.15)
      .fill({ color: 0xffd98a, alpha: 0.22 + 0.3 * t });
  }

  async set(heat: number, ctx: { shouldSkip: () => boolean; reduced: boolean }): Promise<void> {
    const from = this.cur; this.cur = heat;
    if (this.txt) this.txt.text = this.caption();
    await tween({
      duration: 220, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => this.redraw((from + (heat - from) * t) / this.cap),
    });
  }

  reset(heat = 1): void {
    this.cur = heat;
    if (this.txt) this.txt.text = this.caption();
    this.redraw(heat / this.cap);
  }
}
