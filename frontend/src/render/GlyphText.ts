/**
 * GlyphText — lays out the authored "Emberwright Slab" display face.
 *
 * PixiJS `Text` rasterises through the OS font stack, which is exactly the tell
 * that makes a slot look unfinished. This renders our own glyph atlas instead:
 * one sprite per character, tinted at use-site (the atlas is white with a grey
 * bevel, so multiply-tint yields a shaded metal letter for free).
 *
 * Digits share a fixed advance (tabular figures) so a counting-up win counter
 * does not jitter.
 */
import { Container, Rectangle, Sprite, Text, Texture } from 'pixi.js';

export interface FontMeta {
  image: string;
  cell: number;
  baseline: number;
  capHeight: number;
  space: number;
  /** px from the cell's left edge to where the glyph ink starts. */
  bearing: number;
  glyphs: Record<string, { x: number; y: number; w: number; h: number; advance: number }>;
}

export class GlyphFont {
  readonly textures = new Map<string, Texture>();
  constructor(readonly meta: FontMeta, sheet: Texture) {
    for (const [ch, g] of Object.entries(meta.glyphs)) {
      this.textures.set(ch, new Texture({
        source: sheet.source, frame: new Rectangle(g.x, g.y, g.w, g.h),
      }));
    }
  }
  /** Scale factor that renders cap height at `px`. */
  scaleFor(px: number): number { return px / this.meta.capHeight; }
}

export interface GlyphTextOpts {
  size: number;                 // cap height in px
  tint?: number;
  letterSpacing?: number;       // extra px between glyphs
  align?: 'left' | 'center' | 'right';
}

export class GlyphText extends Container {
  private sprites: Sprite[] = [];
  private pool: Sprite[] = [];
  private _text = '';
  private opts: Required<GlyphTextOpts>;
  /**
   * Stand-in used when the display face did not load.
   *
   * The authored face is the whole point of this class, but EVERY control in
   * the bar draws its caption through it — so a single 404 on font.png used to
   * take the entire control bar with it, leaving a game with no buttons. Losing
   * the typeface must cost looks, never the ability to play.
   */
  private fallback: Text | null = null;
  contentWidth = 0;

  constructor(private font: GlyphFont | null, opts: GlyphTextOpts) {
    super();
    this.opts = {
      size: opts.size,
      tint: opts.tint ?? 0xffffff,
      letterSpacing: opts.letterSpacing ?? 1,
      align: opts.align ?? 'left',
    };
    if (!font) {
      this.fallback = new Text({
        text: '',
        style: {
          fill: this.opts.tint, fontFamily: 'system-ui, sans-serif',
          fontSize: Math.round(this.opts.size * 1.15), fontWeight: '700',
          letterSpacing: this.opts.letterSpacing,
        },
      });
      // the glyph face draws from its baseline; Text draws from its top
      this.fallback.anchor.set(
        this.opts.align === 'center' ? 0.5 : this.opts.align === 'right' ? 1 : 0, 1);
      this.addChild(this.fallback);
    }
  }

  get text(): string { return this._text; }

  set text(value: string) {
    if (value === this._text) return;
    this._text = value;
    this.layout();
  }

  setTint(tint: number): void {
    this.opts.tint = tint;
    if (this.fallback) { this.fallback.style.fill = tint; return; }
    for (const s of this.sprites) s.tint = tint;
  }

  private acquire(): Sprite {
    const s = this.pool.pop() ?? new Sprite();
    s.visible = true;
    this.addChild(s);
    return s;
  }

  private layout(): void {
    if (this.fallback) {
      this.fallback.text = this._text;
      this.contentWidth = this.fallback.width;
      return;
    }
    for (const s of this.sprites) { s.visible = false; this.pool.push(s); this.removeChild(s); }
    this.sprites = [];

    const { meta } = this.font!;
    const scale = this.font!.scaleFor(this.opts.size);
    const upper = this._text.toUpperCase();

    let x = 0;
    for (const ch of upper) {
      if (ch === ' ') { x += meta.space * scale + this.opts.letterSpacing; continue; }
      const tex = this.font!.textures.get(ch);
      const g = meta.glyphs[ch];
      if (!tex || !g) { x += meta.space * scale + this.opts.letterSpacing; continue; }
      const sp = this.acquire();
      sp.texture = tex;
      sp.tint = this.opts.tint;
      sp.scale.set(scale);
      // Place so the baseline sits on y = 0 and the INK (not the cell's empty
      // margin) starts at the pen position. Both metrics are stored in atlas
      // pixels, so they scale exactly like the sprite does.
      sp.position.set(x - (meta.bearing ?? 0) * scale, -meta.baseline * scale);
      this.sprites.push(sp);
      x += g.advance * scale + this.opts.letterSpacing;
    }
    this.contentWidth = Math.max(0, x - this.opts.letterSpacing);

    // alignment is applied by shifting children, so `position` stays the anchor
    const shift = this.opts.align === 'center' ? -this.contentWidth / 2
      : this.opts.align === 'right' ? -this.contentWidth : 0;
    for (const s of this.sprites) s.x += shift;
  }
}
