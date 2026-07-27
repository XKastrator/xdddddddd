/**
 * Toast — a message shown ON THE CANVAS.
 *
 * Status used to go to a small DOM strip under the stage. In an operator iframe
 * that strip is easy to miss entirely, so a failing round looked exactly like a
 * dead button: press SPIN, nothing happens, no explanation anywhere the player
 * is looking. Anything the player needs to know has to appear where the player
 * is already looking.
 */
import { Container, Graphics } from 'pixi.js';
import { GlyphFont, GlyphText } from './GlyphText';
import { THEME } from './palette';

export class Toast extends Container {
  private bg = new Graphics();
  /** `label` is taken by Pixi's Container — hence `caption`. */
  private caption: GlyphText | null = null;
  private hideAt = 0;
  private w = 0;

  constructor(font: GlyphFont | null) {
    super();
    this.addChild(this.bg);
    this.caption = new GlyphText(font, { size: 14, align: 'center', letterSpacing: 1.4 });
    this.addChild(this.caption);
    this.visible = false;
    this.eventMode = 'none';       // never steals a click from the controls
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.position.set(w / 2, Math.min(h * 0.16, 150));
  }

  show(message: string, seconds = 5): void {
    if (!this.caption) return;
    this.caption.text = message.toUpperCase();
    const pad = 22;
    const bw = Math.min(this.w * 0.9, this.caption.contentWidth + pad * 2);
    const bh = 44;
    this.bg.clear();
    this.bg.roundRect(-bw / 2, -bh / 2, bw, bh, 10)
      .fill({ color: 0x1a0d08, alpha: 0.95 });
    this.bg.roundRect(-bw / 2, -bh / 2, bw, bh, 10)
      .stroke({ width: 1.5, color: THEME.amber, alpha: 0.8 });
    this.caption.setTint(THEME.amber2);
    this.caption.position.set(0, 5);
    this.alpha = 1;
    this.visible = true;
    this.hideAt = performance.now() + seconds * 1000;
  }

  /** Driven from the ticker; fades out over the last 400 ms. */
  update(): void {
    if (!this.visible) return;
    const left = this.hideAt - performance.now();
    if (left <= 0) { this.visible = false; return; }
    this.alpha = left < 400 ? left / 400 : 1;
  }
}
