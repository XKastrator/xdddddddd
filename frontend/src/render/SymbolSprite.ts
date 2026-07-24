/**
 * SymbolSprite — one board cell rendered with PixiJS Graphics (placeholder art).
 * Final spritesheets/Spine can replace the draw() internals behind this same API.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { Sym } from '../types/events';
import { symStyle } from './palette';

export class SymbolSprite extends Container {
  private glow = new Graphics();
  private tile = new Graphics();
  private txt: Text;
  private size: number;
  sym: Sym = Sym.EMPTY;

  constructor(size: number) {
    super();
    this.size = size;
    this.txt = new Text({
      text: '',
      style: { fill: 0x0a0806, fontFamily: 'system-ui, sans-serif',
        fontSize: Math.round(size * 0.34), fontWeight: '800' as const },
    });
    this.txt.anchor.set(0.5);
    this.txt.position.set(size / 2, size / 2);
    this.addChild(this.glow, this.tile, this.txt);
    this.setSymbol(Sym.EMPTY);
  }

  setSymbol(sym: Sym): void {
    this.sym = sym;
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
    // a subtle top highlight for relics
    if (!st.ore) {
      this.tile.roundRect(pad + s * 0.08, pad + s * 0.08, s - pad * 2 - s * 0.16, s * 0.18, r * 0.6)
        .fill({ color: 0xffffff, alpha: 0.12 });
    }
    this.txt.text = st.label;
    this.txt.style.fill = st.ore ? 0x9c8358 : (sym === Sym.FLUX ? 0x37e0c8 : 0x120a04);
    this.txt.style.fontSize = Math.round(this.size * (st.ore ? 0.26 : 0.34));
  }
}
