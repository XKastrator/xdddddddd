/** WinBanner — full-stage overlay for tiered win celebration and count-up. */
import { Container, Graphics } from 'pixi.js';
import { GlyphText, type GlyphFont } from './GlyphText';
import { THEME } from './palette';
import { tween, wait } from './tween';

export function tierName(x: number): string {
  // no interpunct: the display face carries A-Z, digits and a few marks only
  return x >= 15000 ? 'MAX MOLTEN CROWN'
    : x >= 1500 ? 'MOLTEN WIN'
    : x >= 300 ? 'EPIC WIN'
    : x >= 75 ? 'MEGA WIN'
    : x >= 20 ? 'BIG WIN'
    : 'NICE';
}

export class WinBanner extends Container {
  private scrim = new Graphics();
  private tag: GlyphText | null = null;
  private big: GlyphText | null = null;

  constructor(font?: GlyphFont | null) {
    super();
    this.visible = false;
    this.addChild(this.scrim);
    if (font) {
      this.tag = new GlyphText(font, {
        size: 15, tint: THEME.amber2, align: 'center', letterSpacing: 6,
      });
      this.big = new GlyphText(font, {
        size: 56, tint: THEME.gold, align: 'center', letterSpacing: 3,
      });
      this.addChild(this.tag, this.big);
    }
  }

  resize(w: number, h: number): void {
    this.scrim.clear();
    this.scrim.rect(0, 0, w, h).fill({ color: 0x060402, alpha: 0.72 });
    this.tag?.position.set(w / 2, h / 2 - 46);
    this.big?.position.set(w / 2, h / 2 + 34);
  }

  async show(tag: string, win: number,
             ctx: { shouldSkip: () => boolean; reduced: boolean }): Promise<void> {
    if (this.tag) this.tag.text = tag;
    if (this.big) this.big.text = win > 0 ? '0.00×' : '';
    this.visible = true;
    this.alpha = 0;
    await tween({
      duration: 160, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { this.alpha = t; },
    });
    if (win > 0) {
      await tween({
        duration: 700, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
        onUpdate: (t) => { if (this.big) this.big.text = (win * t).toFixed(2) + '×'; },
      });
    }
    await wait(500, ctx.shouldSkip, ctx.reduced);
    await tween({
      duration: 200, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { this.alpha = 1 - t; },
    });
    this.visible = false;
  }
}
