/**
 * ReelFrame — the forged housing the grid sits inside.
 *
 * A bare rounded rectangle around the reels is the single clearest tell of an
 * unfinished slot. Real cabinets have mass: a bevelled outer band, corner
 * fittings bolted on, a rivet rhythm along the rails, a cartouche naming the
 * round, and an inner recess dark enough that the symbols read as sitting IN
 * something rather than floating on top of the background.
 *
 * Drawn in BOARD-LOCAL coordinates and parented next to BoardView, so it scales
 * with the grid on every layout without any separate resize maths. All geometry
 * is proportional to `gap`, which is itself derived from the cell size.
 *
 * `setHeat` retints the accents so the housing visibly cooks as Heat climbs —
 * the frame participates in the round instead of being static furniture.
 */
import { Container, Graphics } from 'pixi.js';
import { GlyphFont, GlyphText } from './GlyphText';

/** Frame band thickness as a multiple of the board gap. */
export const BAND = 2.0;

// Cool iron, not warm brown: the housing sits against painted blue-grey basalt
// now, and a brown frame read as a cheap box pasted over the artwork.
const IRON_DARK = 0x0d1016;
const IRON = 0x1d2530;
const IRON_LIT = 0x3c4a5a;
const EDGE = 0x8a6a3c;

export class ReelFrame extends Container {
  private base = new Graphics();
  private accents = new Graphics();
  private title: GlyphText | null = null;
  private w = 0;
  private h = 0;
  private gap = 8;
  private heat = 0;

  constructor(font: GlyphFont | null) {
    super();
    this.addChild(this.base, this.accents);
    this.title = new GlyphText(font, { size: 13, align: 'center', letterSpacing: 3 });
    this.addChild(this.title);
  }

  /** Text shown in the cartouche above the grid. */
  setTitle(text: string): void {
    if (this.title) this.title.text = text;
  }

  /** 0..1 — how hot the housing runs. Retints accents only. */
  setHeat(t: number): void {
    const next = Math.max(0, Math.min(1, t));
    if (Math.abs(next - this.heat) < 0.02) return;
    this.heat = next;
    this.drawAccents();
  }

  /** `w`/`h` are the BoardView's own dimensions; the frame wraps them. */
  layout(w: number, h: number, gap: number): void {
    this.w = w; this.h = h; this.gap = gap;
    this.drawBase();
    this.drawAccents();
  }

  /** Outward padding the frame occupies beyond the board rect. */
  static pad(gap: number): number { return gap * BAND; }

  private drawBase(): void {
    const { w, h, gap } = this;
    const b = gap * BAND;
    const r = gap * 2.4;
    const g = this.base;
    g.clear();

    // cast shadow so the housing sits above the scene
    g.roundRect(-b + gap * 0.5, -b + gap * 1.2, w + b * 2, h + b * 2, r + b)
      .fill({ color: 0x000000, alpha: 0.45 });

    // outer band, built as three stacked plates: the darkest is the silhouette,
    // the mid plate is the face, and the top sliver is the light catching it
    g.roundRect(-b, -b, w + b * 2, h + b * 2, r + b)
      .fill({ color: IRON_DARK });
    g.roundRect(-b + gap * 0.28, -b + gap * 0.28, w + b * 2 - gap * 0.56,
                h + b * 2 - gap * 0.56, r + b * 0.8)
      .fill({ color: IRON });
    g.roundRect(-b + gap * 0.28, -b + gap * 0.28, w + b * 2 - gap * 0.56, b * 0.7,
                r * 0.8)
      .fill({ color: IRON_LIT, alpha: 0.55 });

    // Inner recess: dark enough to seat the symbols, translucent enough that the
    // painted room still reads behind the grid. Fully opaque black here wasted
    // the background art the whole scene is built around.
    g.roundRect(-gap * 0.5, -gap * 0.5, w + gap, h + gap, r)
      .fill({ color: 0x05070c, alpha: 0.62 });
    // inner bevel — dark on the bottom, hairline highlight along the top
    g.roundRect(-gap * 0.5, -gap * 0.5, w + gap, h + gap, r)
      .stroke({ width: Math.max(2, gap * 0.42), color: 0x000000, alpha: 0.55 });
    g.moveTo(gap, -gap * 0.35).lineTo(w - gap, -gap * 0.35)
      .stroke({ width: Math.max(1, gap * 0.18), color: EDGE, alpha: 0.45 });
  }

  /**
   * Fittings, rivets and the cartouche. Split from `drawBase` because these are
   * the parts that retint with Heat, and rebuilding the whole housing every time
   * the gauge moves would be wasteful.
   */
  private drawAccents(): void {
    const { w, h, gap, heat } = this;
    const b = gap * BAND;
    const g = this.accents;
    g.clear();

    // hot accents: cool brass at rest, molten amber at full Heat
    const glowA = 0.30 + heat * 0.55;
    const hot = heat > 0.5 ? 0xffb347 : 0xf2c14e;

    // --- corner fittings: an L-bracket bolted over each corner --------------
    const armX = Math.min(w * 0.22, gap * 11);
    const armY = Math.min(h * 0.22, gap * 11);
    const t = b * 0.82;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as [number, number][]) {
      const ox = sx > 0 ? -b : w + b;
      const oy = sy > 0 ? -b : h + b;
      g.poly([
        ox, oy,
        ox + sx * armX, oy,
        ox + sx * armX, oy + sy * t,
        ox + sx * t, oy + sy * t,
        ox + sx * t, oy + sy * armY,
        ox, oy + sy * armY,
      ]).fill({ color: IRON_LIT });
      g.poly([
        ox, oy,
        ox + sx * armX, oy,
        ox + sx * armX, oy + sy * t * 0.3,
        ox + sx * t * 0.3, oy + sy * t * 0.3,
        ox + sx * t * 0.3, oy + sy * armY,
        ox, oy + sy * armY,
      ]).fill({ color: EDGE, alpha: 0.55 });
      // bolts holding the bracket down
      this.bolt(g, ox + sx * t * 0.55, oy + sy * t * 0.55, gap * 0.62, hot, glowA);
      this.bolt(g, ox + sx * (armX - t * 0.42), oy + sy * t * 0.5, gap * 0.5, hot, glowA);
      this.bolt(g, ox + sx * t * 0.5, oy + sy * (armY - t * 0.42), gap * 0.5, hot, glowA);
    }

    // --- rivet rhythm along the top and bottom rails ------------------------
    const span = w + b * 2 - armX * 2;
    const n = Math.max(3, Math.round(span / (gap * 7)));
    for (let i = 0; i <= n; i++) {
      const x = -b + armX + (span * i) / n;
      this.bolt(g, x, -b + b * 0.5, gap * 0.46, hot, glowA * 0.8);
      this.bolt(g, x, h + b - b * 0.5, gap * 0.46, hot, glowA * 0.8);
    }

    // --- cartouche: a tapered plaque naming the round -----------------------
    // NOTE: frame-local origin is the board's TOP-LEFT, not its centre, so the
    // plaque has to be built around w / 2 explicitly.
    const ccx = w / 2;
    const cw = Math.min(w * 0.46, gap * 26);
    const ch = b * 1.5;
    const cy = -b - ch * 0.62;
    const taper = ch * 0.55;
    g.poly([
      ccx - cw / 2 - taper, cy + ch / 2,
      ccx - cw / 2, cy,
      ccx + cw / 2, cy,
      ccx + cw / 2 + taper, cy + ch / 2,
      ccx + cw / 2, cy + ch,
      ccx - cw / 2, cy + ch,
    ]).fill({ color: IRON_DARK });
    g.poly([
      ccx - cw / 2 - taper * 0.8, cy + ch / 2,
      ccx - cw / 2 + gap * 0.2, cy + gap * 0.25,
      ccx + cw / 2 - gap * 0.2, cy + gap * 0.25,
      ccx + cw / 2 + taper * 0.8, cy + ch / 2,
      ccx + cw / 2 - gap * 0.2, cy + ch - gap * 0.25,
      ccx - cw / 2 + gap * 0.2, cy + ch - gap * 0.25,
    ]).fill({ color: IRON })
      .stroke({ width: Math.max(1, gap * 0.2), color: hot, alpha: glowA });
    if (this.title) {
      this.title.setTint(heat > 0.5 ? 0xffe9c2 : 0xf4ece0);
      this.title.position.set(w / 2, cy + ch * 0.5 + gap * 0.55);
    }
  }

  private bolt(g: Graphics, x: number, y: number, r: number,
               hot: number, alpha: number): void {
    g.circle(x, y, r * 1.9).fill({ color: hot, alpha: alpha * 0.16 });
    g.circle(x, y, r).fill({ color: 0x0f0b07 });
    g.circle(x, y - r * 0.22, r * 0.72).fill({ color: EDGE });
    g.circle(x, y - r * 0.34, r * 0.34).fill({ color: hot, alpha: 0.55 + alpha * 0.3 });
  }
}
