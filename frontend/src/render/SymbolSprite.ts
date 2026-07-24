/**
 * SymbolSprite — one board cell.
 *
 * Renders the authored atlas artwork when assets are loaded; if the atlas is
 * missing it falls back to the procedural Graphics shapes, so the game still
 * runs (and stays testable) without any binary assets present.
 */
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { Sym } from '../types/events';
import { symStyle } from './palette';

export type TextureProvider = (sym: Sym) => Texture | undefined;

/** How much of the cell the authored artwork occupies (glow needs headroom). */
const ART_FILL = 1.16;

export class SymbolSprite extends Container {
  private glow = new Graphics();
  private tile = new Graphics();
  private art = new Sprite();
  private txt: Text;
  private size: number;
  sym: Sym = Sym.EMPTY;

  constructor(size: number, private getTexture?: TextureProvider) {
    super();
    this.size = size;
    this.art.anchor.set(0.5);
    this.art.position.set(size / 2, size / 2);
    // the authored art sits inside a padded 256 box, so oversize slightly to
    // make symbols fill the cell without clipping their glow
    this.art.width = this.art.height = size * ART_FILL;
    this.txt = new Text({
      text: '',
      style: { fill: 0x0a0806, fontFamily: 'system-ui, sans-serif',
        fontSize: Math.round(size * 0.34), fontWeight: '800' as const },
    });
    this.txt.anchor.set(0.5);
    this.txt.position.set(size / 2, size / 2);
    this.addChild(this.glow, this.tile, this.art, this.txt);
    this.setSymbol(Sym.EMPTY);
  }

  setSymbol(sym: Sym): void {
    this.sym = sym;
    const tex = sym === Sym.EMPTY ? undefined : this.getTexture?.(sym);
    if (tex) { this.drawFromAtlas(tex); return; }
    this.drawProcedural(sym);
  }

  /** Preferred path: authored artwork from the texture atlas. */
  private drawFromAtlas(tex: Texture): void {
    this.glow.clear();
    this.tile.clear();
    this.txt.text = '';
    this.art.visible = true;
    this.art.texture = tex;
    this.art.width = this.art.height = this.size * ART_FILL;
  }

  /** Fallback: procedural shapes (no binary assets required). */
  private drawProcedural(sym: Sym): void {
    this.art.visible = false;
    const s = this.size;
    const st = symStyle(sym);
    const pad = Math.round(s * 0.06);
    const r = Math.round(s * 0.16);

    this.glow.clear();
    if (st.glow > 0) {
      this.glow.roundRect(-s * 0.08, -s * 0.08, s + s * 0.16, s + s * 0.16, r * 1.6)
        .fill({ color: st.ring, alpha: 0.14 + 0.22 * st.glow });
    }

    this.tile.clear();
    if (sym === Sym.EMPTY) { this.txt.text = ''; return; }
    this.tile.roundRect(pad, pad, s - pad * 2, s - pad * 2, r).fill({ color: st.fill });
    this.tile.roundRect(pad, pad, s - pad * 2, s - pad * 2, r)
      .stroke({ width: Math.max(1, s * 0.03), color: st.ring, alpha: st.ore ? 0.6 : 0.9 });
    if (!st.ore) {
      this.tile.roundRect(pad + s * 0.08, pad + s * 0.08, s - pad * 2 - s * 0.16, s * 0.18, r * 0.6)
        .fill({ color: 0xffffff, alpha: 0.12 });
    }
    this.txt.text = st.label;
    this.txt.style.fill = st.ore ? 0x9c8358 : (sym === Sym.FLUX ? 0x37e0c8 : 0x120a04);
    this.txt.style.fontSize = Math.round(this.size * (st.ore ? 0.26 : 0.34));
  }
}
