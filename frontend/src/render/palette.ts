/**
 * Symbol → placeholder visual mapping (colors, labels, glow) derived from
 * ART_BIBLE.md. These are functional PROCEDURAL placeholders drawn with PixiJS
 * Graphics — not final art. Final assets (spritesheets/Spine) drop in behind the
 * same SymbolSprite API without touching the presenter.
 */
import { Sym } from '../types/events';

export const THEME = {
  bg0: 0x0a0806,
  bg1: 0x14100c,
  panel: 0x14100c,
  line: 0x2a2018,
  amber: 0xff7a18,
  amber2: 0xffb347,
  teal: 0x37e0c8,
  gold: 0xf2c14e,
  txt: 0xf4ece0,
  dim: 0x9a8c78,
};

export interface SymStyle {
  fill: number;
  ring: number;
  label: string;
  glow: number;     // 0..1 emissive strength (relics glow, ore doesn't)
  ore: boolean;
  /**
   * Rank on the paytable, 0 (ore) to 6 (crown); specials are 7.
   *
   * Used to key the SHAPE and the rim weight of the plate a symbol sits on.
   * Reference boards make value readable before the artwork is: the plate
   * behind a low symbol and the plate behind a premium are different colours
   * and different weights, and a wild or scatter is a different silhouette
   * entirely. Ours had one plate for all thirty cells, so the only thing
   * separating a crown from a rock was the illustration inside it.
   */
  rank: number;
}

// Ore variants: distinct enough to tell apart, dark enough to read as "fuel that
// doesn't pay". Each carries its own glyph so colour is never the only cue
// (colour-blind requirement, ART_BIBLE §3).
const ORE_TINTS = [0x4a3218, 0x3f3a2a, 0x513024, 0x36302b, 0x45391f];
const ORE_GLYPHS = ['▲', '■', '◆', '⬢', '●'];

export function symStyle(sym: Sym): SymStyle {
  if (sym >= Sym.O1 && sym <= Sym.O5) {
    const i = sym - Sym.O1;
    return { fill: ORE_TINTS[i], ring: 0x6b5433, label: ORE_GLYPHS[i], glow: 0, ore: true, rank: 0 };
  }
  switch (sym) {
    case Sym.BRONZE: return { fill: 0xb08d57, ring: 0xd8b57e, label: 'I', glow: 0.35, ore: false, rank: 1 };
    case Sym.IRON: return { fill: 0x9fa7ad, ring: 0xd7dee3, label: 'II', glow: 0.45, ore: false, rank: 2 };
    case Sym.SILVER: return { fill: 0xd6dde3, ring: 0xffffff, label: 'III', glow: 0.6, ore: false, rank: 3 };
    case Sym.GOLD: return { fill: 0xf2c14e, ring: 0xfff0c0, label: 'IV', glow: 0.8, ore: false, rank: 4 };
    case Sym.MYTHRIL: return { fill: 0x6fe3c8, ring: 0xbafff0, label: 'V', glow: 0.9, ore: false, rank: 5 };
    case Sym.CROWN: return { fill: 0xffcf6b, ring: 0xff7a18, label: '♛', glow: 1, ore: false, rank: 6 };
    case Sym.FLUX: return { fill: 0x0c2b28, ring: 0x37e0c8, label: '≈', glow: 0.7, ore: false, rank: 7 };
    case Sym.CINDER: return { fill: 0x3a1e05, ring: 0xffb347, label: '✦', glow: 0.85, ore: false, rank: 7 };
    default: return { fill: 0x0f0b07, ring: 0x2a2018, label: '', glow: 0, ore: true, rank: -1 };
  }
}

/**
 * Blend two packed RGB colours. `t` 0 keeps `a`, 1 keeps `b`.
 *
 * Used to tint a symbol's plate toward the symbol's own colour without letting
 * it get bright enough to compete with the artwork standing on it.
 */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t);
}
