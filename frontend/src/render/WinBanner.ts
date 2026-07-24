/** WinBanner — full-stage overlay for tiered win celebration and count-up. */
import { Container, Graphics, Text } from 'pixi.js';
import { THEME } from './palette';
import { tween, wait } from './tween';

export function tierName(x: number): string {
  return x >= 15000 ? 'MAX · MOLTEN CROWN'
    : x >= 1500 ? 'MOLTEN WIN'
    : x >= 300 ? 'EPIC WIN'
    : x >= 75 ? 'MEGA WIN'
    : x >= 20 ? 'BIG WIN'
    : 'NICE';
}

export class WinBanner extends Container {
  private scrim = new Graphics();
  private tag: Text;
  private big: Text;
  constructor() {
    super();
    this.visible = false;
    this.tag = new Text({ text: '', style: {
      fill: THEME.amber2, fontFamily: 'system-ui, sans-serif', fontSize: 18,
      fontWeight: '700' as const, letterSpacing: 4 } });
    this.big = new Text({ text: '', style: {
      fill: THEME.gold, fontFamily: 'system-ui, sans-serif', fontSize: 64,
      fontWeight: '900' as const } });
    this.tag.anchor.set(0.5); this.big.anchor.set(0.5);
    this.addChild(this.scrim, this.tag, this.big);
  }

  resize(w: number, h: number): void {
    this.scrim.clear();
    this.scrim.rect(0, 0, w, h).fill({ color: 0x060402, alpha: 0.72 });
    this.tag.position.set(w / 2, h / 2 - 56);
    this.big.position.set(w / 2, h / 2);
    this.big.style.fontSize = Math.min(72, w * 0.13);
  }

  async show(tag: string, win: number, ctx: { shouldSkip: () => boolean; reduced: boolean }): Promise<void> {
    this.tag.text = tag; this.visible = true; this.alpha = 0;
    await tween({ duration: 160, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { this.alpha = t; } });
    await tween({ duration: 700, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { this.big.text = (win * t).toFixed(2) + '×'; } });
    await wait(500, ctx.shouldSkip, ctx.reduced);
    await tween({ duration: 200, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { this.alpha = 1 - t; } });
    this.visible = false;
  }
}
