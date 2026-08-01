/** WinBanner — full-stage overlay for tiered win celebration and count-up. */
import { Container, Graphics } from 'pixi.js';
import { GlyphText, type GlyphFont } from './GlyphText';
import { THEME } from './palette';
import { tween, easeOutCubic } from './tween';

/** Low to high. The index is the tier, and the count-up climbs through it. */
const TIERS = ['NICE', 'BIG WIN', 'MEGA WIN', 'EPIC WIN', 'MOLTEN WIN',
  'MAX MOLTEN CROWN'] as const;

export function tierName(x: number): string {
  // no interpunct: the display face carries A-Z, digits and a few marks only
  return x >= 15000 ? 'MAX MOLTEN CROWN'
    : x >= 1500 ? 'MOLTEN WIN'
    : x >= 300 ? 'EPIC WIN'
    : x >= 75 ? 'MEGA WIN'
    : x >= 20 ? 'BIG WIN'
    : 'NICE';
}

/**
 * How long the counter runs. A 2000× win that resolves as fast as a 25× one
 * tells the player they are the same size, which is the opposite of the job.
 */
function countDuration(win: number): number {
  return win >= 15000 ? 4200
    : win >= 1500 ? 3200
    : win >= 300 ? 2400
    : win >= 75 ? 1700
    : win >= 20 ? 1200
    : 800;
}

export interface BannerHooks {
  /** Fired the instant the running total crosses into a new tier. */
  onTier?: (name: string, tier: number) => void;
}

export class WinBanner extends Container {
  private scrim = new Graphics();
  /**
   * A rotating burst behind the number.
   *
   * A scrim with two lines of text on it is a dialog box, not a celebration.
   * Every commercial big-win screen puts something MOVING behind the total —
   * rays, a glow, a spinning halo — because the number cannot carry the moment
   * alone. Drawn as wedges rather than a texture so it costs one geometry and
   * scales to any stage.
   */
  private rays = new Graphics();
  private halo = new Graphics();
  private tag: GlyphText | null = null;
  private big: GlyphText | null = null;
  private bigSize = 56;
  /** Ray span, so the burst is rebuilt only on resize. */
  private raySpan = 0;

  constructor(font?: GlyphFont | null) {
    super();
    this.visible = false;
    this.addChild(this.scrim, this.halo, this.rays);
    if (font) {
      this.tag = new GlyphText(font, {
        size: 15, tint: THEME.amber2, align: 'center', letterSpacing: 6,
      });
      this.big = new GlyphText(font, {
        size: this.bigSize, tint: THEME.gold, align: 'center', letterSpacing: 3,
      });
      this.addChild(this.tag, this.big);
    }
  }

  resize(w: number, h: number): void {
    this.scrim.clear();
    this.scrim.rect(0, 0, w, h).fill({ color: 0x060402, alpha: 0.72 });

    // burst + halo, centred on where the number lands
    const cx = w / 2, cy = h / 2 + 10;
    this.raySpan = Math.max(w, h) * 0.72;
    const g = this.rays;
    g.clear();
    const BLADES = 16;
    for (let i = 0; i < BLADES; i++) {
      const a = (i / BLADES) * Math.PI * 2;
      const spread = ((Math.PI * 2) / BLADES) * 0.34;
      g.poly([
        0, 0,
        Math.cos(a - spread) * this.raySpan, Math.sin(a - spread) * this.raySpan,
        Math.cos(a + spread) * this.raySpan, Math.sin(a + spread) * this.raySpan,
      ]).fill({ color: 0xffc46a, alpha: 0.09 });
    }
    g.position.set(cx, cy);
    const hl = this.halo;
    hl.clear();
    // stacked discs stand in for a radial gradient: Graphics has no smooth one
    for (let i = 8; i > 0; i--) {
      hl.circle(0, 0, this.raySpan * 0.09 * i)
        .fill({ color: 0xff9a2e, alpha: 0.05 });
    }
    hl.position.set(cx, cy);
    // sized off the stage: a 56px number is a headline on a phone and a caption
    // on a desktop, and the celebration has to read as huge on both
    this.bigSize = Math.round(Math.max(34, Math.min(76, Math.min(w * 0.075, h * 0.115))));
    // the tier name is the headline; the number is the evidence
    this.tag?.setSize(Math.round(this.bigSize * 0.42));
    this.big?.setSize(this.bigSize);
    this.tag?.position.set(w / 2, h / 2 - this.bigSize * 0.8);
    this.big?.position.set(w / 2, h / 2 + this.bigSize * 0.6);
  }

  /**
   * `climb` turns the counter into an ESCALATION rather than a readout.
   *
   * Every win used to look the same: one tier name fixed up front, one 700ms
   * linear count, done. Commercial games run the number THROUGH the tiers as it
   * rises — the caption changes from BIG to MEGA to EPIC under the player while
   * the total is still climbing, each crossing punched — and the whole thing
   * takes longer the more it is worth. That escalation is the celebration; the
   * banner around it is furniture.
   *
   * Fixed-caption uses (BONUS, RETRIGGER, THE POUR) leave `climb` off and keep
   * the old behaviour, because those captions are statements of fact rather
   * than a running score.
   */
  async show(tag: string, win: number,
             ctx: { shouldSkip: () => boolean; reduced: boolean },
             climb = false, hooks?: BannerHooks): Promise<void> {
    if (this.tag) this.tag.text = climb ? TIERS[0] : tag;
    if (this.big) { this.big.text = win > 0 ? '0.00×' : ''; this.big.scale.set(1); }
    const dressed = win > 0 && !ctx.reduced;
    this.rays.visible = dressed;
    this.halo.visible = dressed;
    this.rays.rotation = 0;
    this.rays.scale.set(0.6);
    this.halo.scale.set(0.6);
    this.visible = true;
    this.alpha = 0;
    await tween({
      duration: 160, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { this.alpha = t; },
    });
    if (win > 0) {
      const duration = ctx.reduced ? 300 : countDuration(win);
      // punch state tracked in TIME rather than in frames, so the pop is the
      // same length at 30 Hz and at 144 Hz
      let punchAt = -1;
      let tier = -1;
      await tween({
        duration, ease: easeOutCubic,
        shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
        onUpdate: (t) => {
          const v = win * t;
          if (this.big) this.big.text = v.toFixed(2) + '×';
          if (climb) {
            const next = TIERS.indexOf(tierName(v) as typeof TIERS[number]);
            if (next > tier) {
              tier = next;
              punchAt = t;
              if (this.tag) this.tag.text = TIERS[next];
              // white-hot at the top of the ladder, gold below it
              this.big?.setTint(next >= 4 ? 0xfff4d2 : THEME.gold);
              hooks?.onTier?.(TIERS[next], next);
            }
          }
          // 240ms of pop after each crossing, in this tween's own units
          const age = punchAt < 0 ? 9 : ((t - punchAt) * duration) / 240;
          const punch = Math.max(0, 1 - age);
          this.big?.scale.set(1 + punch * punch * 0.26);
          // the burst opens up and keeps turning while the total climbs
          this.rays.rotation = t * duration * 0.00022;
          const open = 0.6 + 0.4 * t;
          this.rays.scale.set(open + punch * 0.08);
          this.halo.scale.set(open + punch * 0.14);
        },
      });
      this.big?.scale.set(1);
    }
    // the hold is not dead air: the burst keeps turning under the total
    await tween({
      duration: win >= 300 ? 900 : 500,
      shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { if (dressed) this.rays.rotation += 0.0035 * (1 - t * 0.4); },
    });
    await tween({
      duration: 200, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { this.alpha = 1 - t; },
    });
    this.visible = false;
    this.big?.setTint(THEME.gold);
  }
}
