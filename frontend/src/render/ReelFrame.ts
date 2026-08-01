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
 * with the grid on every layout without any separate resize maths.
 *
 * All ornament is proportional to `band` — the thickness of the housing — and
 * NOT to the gutter between symbols. Those were the same number once, which
 * meant tightening the grid dissolved the cabinet: the brackets, rivets and
 * plaque all collapsed to a few pixels and the frame degenerated into a dark
 * outline. The two describe unrelated things and are now independent.
 *
 * `setHeat` retints the accents so the housing visibly cooks as Heat climbs —
 * the frame participates in the round instead of being static furniture.
 */
import { Container, FillGradient, Graphics } from 'pixi.js';
import { GlyphFont, GlyphText } from './GlyphText';

/** Housing thickness as a fraction of one cell. Reserved by computeLayout. */
export const BAND_FRAC = 0.22;

// Cool iron, not warm brown: the housing sits against painted blue-grey basalt
// now, and a brown frame read as a cheap box pasted over the artwork.
//
// The face is a GRADIENT rather than a flat plate. A single fill gave the band
// no direction, so the cabinet read as a cut-out silhouette regardless of how
// thick it was; a top-lit face is what makes it read as a solid object with a
// light source above it, which is the same light the symbols are painted under.
const IRON_DARK = 0x090c11;
const IRON_TOP = 0x46566b;
const IRON_BOT = 0x161d27;
const IRON_LIT = 0x76889e;
const EDGE = 0xc79a52;

export class ReelFrame extends Container {
  private base = new Graphics();
  private accents = new Graphics();
  private title: GlyphText | null = null;
  /**
   * Two readouts machined into the TOP rail, either side of the cartouche.
   *
   * The free-spin count and the vault total used to live in a corner HUD that
   * was deleted for duplicating the control bar — and they went with it. During
   * a bonus the player could not see how many spins were left, and during the
   * super bonus the vault, which is the entire point of that mode, was
   * invisible. The reference game carries a dedicated FreeSpinCounter for
   * exactly this reason. They belong on the cabinet, not in a floating corner.
   */
  private railL: GlyphText | null = null;
  private railR: GlyphText | null = null;
  private w = 0;
  private h = 0;
  private gap = 8;
  private band = 20;
  private heat = 0;
  /**
   * Built once and reused. A FillGradient allocates a texture; making a fresh
   * one on every relayout would leak one per resize event, and resize fires on
   * every orientation change and every window drag frame.
   */
  private face = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: IRON_TOP },
      { offset: 0.42, color: IRON_BOT },
      { offset: 1, color: 0x243040 },
    ],
    textureSpace: 'local',
  });

  constructor(font: GlyphFont | null) {
    super();
    this.addChild(this.base, this.accents);
    this.title = new GlyphText(font, { size: 15, align: 'center', letterSpacing: 3 });
    this.railL = new GlyphText(font, { size: 12, align: 'left', letterSpacing: 2,
      tint: 0xf4ece0 });
    this.railR = new GlyphText(font, { size: 12, align: 'right', letterSpacing: 2,
      tint: 0x37e0c8 });
    this.railL.visible = false;
    this.railR.visible = false;
    this.addChild(this.title, this.railL, this.railR);
  }

  /**
   * Left and right readouts on the top rail. Empty string hides one, so a base
   * round shows a clean rail and a bonus shows the two numbers that matter.
   */
  setRails(left: string, right: string): void {
    if (this.railL) { this.railL.text = left; this.railL.visible = left !== ''; }
    if (this.railR) { this.railR.text = right; this.railR.visible = right !== ''; }
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
  layout(w: number, h: number, gap: number, band: number): void {
    this.w = w; this.h = h; this.gap = gap; this.band = band;
    this.drawBase();
    this.drawAccents();
  }

  /**
   * Where a gauge should sit so it reads as PART of the cabinet: centred on the
   * bottom rail, inset from the corner fittings. Board-local, like everything
   * else here.
   */
  gaugeSlot(): { x: number; y: number; w: number; h: number } {
    const inset = this.armX() * 0.9;
    const gh = Math.max(9, this.band * 0.6);
    return {
      x: inset,
      // centred in the rail: the rail spans h..h+band, so the slot's top edge
      // is half a band down minus half a slot
      y: this.h + this.band * 0.5 - gh * 0.5,
      w: Math.max(40, this.w - inset * 2),
      h: gh,
    };
  }

  /** Outward padding the frame occupies beyond the board rect. */
  static pad(band: number): number { return band; }

  private armX(): number { return Math.min(this.w * 0.2, this.band * 3.4); }

  private drawBase(): void {
    const { w, h, gap, band } = this;
    const r = band * 0.9;
    const g = this.base;
    g.clear();

    // cast shadow so the housing sits above the scene
    g.roundRect(-band + band * 0.16, -band + band * 0.4, w + band * 2, h + band * 2, r + band)
      .fill({ color: 0x000000, alpha: 0.55 });

    // silhouette, then the lit face on top of it — the dark ring left showing
    // around the face is what gives the band an edge instead of a border
    g.roundRect(-band, -band, w + band * 2, h + band * 2, r + band)
      .fill({ color: IRON_DARK });
    const i = band * 0.2;
    g.roundRect(-band + i, -band + i, w + band * 2 - i * 2, h + band * 2 - i * 2,
                r + band * 0.8)
      .fill(this.face);
    // hard specular along the very top of the band: one light, from above
    g.roundRect(-band + i, -band + i, w + band * 2 - i * 2, band * 0.3, r * 0.7)
      .fill({ color: IRON_LIT, alpha: 0.7 });

    // Inner recess: dark enough to seat the symbols, translucent enough that the
    // painted room still reads behind the grid. Fully opaque black here wasted
    // the background art the whole scene is built around.
    g.roundRect(-gap * 0.5, -gap * 0.5, w + gap, h + gap, gap * 2)
      .fill({ color: 0x04060a, alpha: 0.66 });
    // inner bevel — the recess is CUT into the band, so the light that hits the
    // top of the band misses the top of the hole and pools on its lower lip
    g.roundRect(-gap * 0.5, -gap * 0.5, w + gap, h + gap, gap * 2)
      .stroke({ width: Math.max(3, band * 0.22), color: 0x000000, alpha: 0.7 });
    g.moveTo(gap * 2, h + gap * 0.4).lineTo(w - gap * 2, h + gap * 0.4)
      .stroke({ width: Math.max(1, band * 0.09), color: EDGE, alpha: 0.30 });
  }

  /**
   * Fittings, rivets and the cartouche. Split from `drawBase` because these are
   * the parts that retint with Heat, and rebuilding the whole housing every time
   * the gauge moves would be wasteful.
   */
  private drawAccents(): void {
    const { w, h, band, heat } = this;
    const g = this.accents;
    g.clear();

    // hot accents: cool brass at rest, molten amber at full Heat
    const glowA = 0.34 + heat * 0.55;
    const hot = heat > 0.5 ? 0xffb347 : 0xf2c14e;

    // --- corner fittings: an L-bracket bolted over each corner --------------
    const armX = this.armX();
    const armY = Math.min(h * 0.2, band * 3.4);
    const t = band * 0.86;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as [number, number][]) {
      const ox = sx > 0 ? -band : w + band;
      const oy = sy > 0 ? -band : h + band;
      g.poly([
        ox, oy,
        ox + sx * armX, oy,
        ox + sx * armX, oy + sy * t,
        ox + sx * t, oy + sy * t,
        ox + sx * t, oy + sy * armY,
        ox, oy + sy * armY,
      ]).fill({ color: 0x5d6f86 });
      g.poly([
        ox, oy,
        ox + sx * armX, oy,
        ox + sx * armX, oy + sy * t * 0.26,
        ox + sx * t * 0.26, oy + sy * t * 0.26,
        ox + sx * t * 0.26, oy + sy * armY,
        ox, oy + sy * armY,
      ]).fill({ color: EDGE, alpha: 0.7 });
      // bolts holding the bracket down
      this.bolt(g, ox + sx * t * 0.55, oy + sy * t * 0.55, band * 0.2, hot, glowA);
      this.bolt(g, ox + sx * (armX - t * 0.4), oy + sy * t * 0.5, band * 0.16, hot, glowA);
      this.bolt(g, ox + sx * t * 0.5, oy + sy * (armY - t * 0.4), band * 0.16, hot, glowA);
    }

    // --- rivet rhythm along the top and bottom rails ------------------------
    const span = w + band * 2 - armX * 2;
    const n = Math.max(3, Math.round(span / (band * 2.6)));
    for (let k = 0; k <= n; k++) {
      const x = -band + armX + (span * k) / n;
      this.bolt(g, x, -band + band * 0.5, band * 0.15, hot, glowA * 0.85);
    }

    // --- cartouche: a tapered plaque naming the round -----------------------
    // NOTE: frame-local origin is the board's TOP-LEFT, not its centre, so the
    // plaque has to be built around w / 2 explicitly.
    const ccx = w / 2;
    const cw = Math.min(w * 0.46, band * 15);
    const ch = band * 1.32;
    const cy = -band - ch * 0.58;
    const taper = ch * 0.55;
    g.poly([
      ccx - cw / 2 - taper, cy + ch / 2,
      ccx - cw / 2, cy,
      ccx + cw / 2, cy,
      ccx + cw / 2 + taper, cy + ch / 2,
      ccx + cw / 2, cy + ch,
      ccx - cw / 2, cy + ch,
    ]).fill({ color: 0x070a0e });
    g.poly([
      ccx - cw / 2 - taper * 0.8, cy + ch / 2,
      ccx - cw / 2 + band * 0.12, cy + band * 0.14,
      ccx + cw / 2 - band * 0.12, cy + band * 0.14,
      ccx + cw / 2 + taper * 0.8, cy + ch / 2,
      ccx + cw / 2 - band * 0.12, cy + ch - band * 0.14,
      ccx - cw / 2 + band * 0.12, cy + ch - band * 0.14,
    ]).fill({ color: 0x27313f })
      .stroke({ width: Math.max(1, band * 0.1), color: hot, alpha: glowA });
    if (this.title) {
      this.title.setTint(heat > 0.5 ? 0xffe9c2 : 0xf4ece0);
      this.title.position.set(w / 2, cy + ch * 0.5 + band * 0.28);
    }
    // the rail readouts sit inboard of the corner fittings, on the rail's own
    // centre line, so they read as stamped into the metal
    const railY = -band * 0.5 + band * 0.24;
    const inset = armX + band * 0.5;
    if (this.railL) {
      this.railL.setSize(Math.max(9, Math.round(band * 0.5)));
      this.railL.position.set(-band + inset, railY);
    }
    if (this.railR) {
      this.railR.setSize(Math.max(9, Math.round(band * 0.5)));
      this.railR.position.set(w + band - inset, railY);
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
