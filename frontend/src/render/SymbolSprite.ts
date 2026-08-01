/**
 * SymbolSprite — one board cell.
 *
 * Renders the authored atlas artwork when assets are loaded; if the atlas is
 * missing it falls back to the procedural Graphics shapes, so the game still
 * runs (and stays testable) without any binary assets present.
 */
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { Deform } from './Deform';
import { Sym } from '../types/events';
import { mix, symStyle, type SymStyle } from './palette';

export type TextureProvider = (sym: Sym) => Texture | undefined;
/** Win-loop frames for a symbol, when the art pass has produced them. */
export type WinLoopProvider = (sym: Sym) => Texture[] | undefined;

/**
 * How much of the cell the authored artwork occupies.
 *
 * The source art is drawn inside a padded 256 box. This was pushed to 1.22 to
 * cancel that padding, because the symbols were sitting in visible black moats
 * — but the moat was the real problem and the fix was the wrong one. The
 * symbols now sit on a PLATE that fills the cell, which is what the moat should
 * always have been, so the art can go back to roughly its authored size and
 * stay inside its own frame instead of spilling over the plate's edge.
 */
const ART_FILL = 1.1;

export class SymbolSprite extends Container {
  private glow = new Graphics();
  private tile = new Graphics();
  /**
   * The scatter's own halo, and only the scatter's.
   *
   * A scatter is on this board 30% of the time — measured over 30,000 base
   * books — and the single loudest piece of feedback on the game was that it
   * has "no scatter at all". It was there; nothing said so. On a reference
   * board the scatter is the most elaborately animated symbol by a wide margin,
   * moving CONSTANTLY, so it is the one thing on a still board that draws the
   * eye. This ring is that, and it exists only on scatter cells.
   */
  private ring = new Graphics();
  private ringT = 0;
  /** Landing pop: 1 at the instant it lands, decaying to 0. */
  private pop = 0;
  private art = new Sprite();
  private txt: Text;
  private size: number;
  sym: Sym = Sym.EMPTY;

  /** Frames of the win loop while one is playing; null the rest of the time. */
  private loop: Texture[] | null = null;
  private loopT = 0;
  /**
   * Mesh stand-in for the art sprite, created on first impact and reused.
   *
   * A mesh is its own draw call where thirty sprites batch into one or two, so
   * this is NOT the resting representation: the sprite draws until something
   * hits the symbol, the mesh takes over for the ~400ms the bend lasts, and the
   * sprite comes back. Only the handful of cells actually being struck ever pay
   * for it, which matters on the devices the frame-rate guard exists for.
   */
  private deform: Deform | null = null;
  /** True when the atlas supplied artwork — the procedural path has none. */
  private hasArt = false;

  constructor(size: number, private getTexture?: TextureProvider,
              private getWinLoop?: WinLoopProvider) {
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
    this.ring.visible = false;
    this.addChild(this.glow, this.ring, this.tile, this.art, this.txt);
    this.setSymbol(Sym.EMPTY);
  }

  /**
   * Motion blur, the way a reel actually does it: the strip is stretched along
   * the axis it is travelling and dimmed, so a fast column reads as a smear
   * rather than as thirty legible pictures flickering. A real blur filter would
   * be a render-target round trip per column per frame, which is exactly the
   * cost this renderer already had to be rescued from.
   */
  setBlur(amount: number): void {
    const b = Math.max(0, Math.min(1, amount));
    this.scale.set(1, 1 + b * 0.42);
    this.alpha = 1 - b * 0.2;
  }

  /** True for relics: they are hot metal and get idle life. Ore stays inert. */
  get animatable(): boolean {
    return this.sym >= Sym.BRONZE && this.sym <= Sym.CINDER;
  }

  /** Announce a landing: a hard flash that decays over ~350ms. */
  flash(): void { this.pop = 1; }

  /**
   * Per-frame life that is NOT the idle breath: the scatter's turning halo and
   * any landing flash. Runs for every cell because the flash applies to all of
   * them, but the halo geometry is only ever built for a scatter.
   */
  tickSpecial(dt: number, reduced: boolean): void {
    const scatter = this.sym === Sym.CINDER;
    if (this.pop > 0) {
      this.pop = Math.max(0, this.pop - dt * 2.8);
      const k = this.pop * this.pop;
      this.glow.alpha = 1 + k * 2.2;
      if (!scatter && k <= 0) this.glow.alpha = 1;
    }
    if (!scatter || reduced) {
      if (this.ring.visible && (!scatter || reduced)) this.ring.visible = false;
      return;
    }
    this.ringT += dt;
    this.ring.visible = true;
    const s = this.size;
    const g = this.ring;
    g.clear();
    // two counter-rotating arcs plus a breathing disc: cheap, and it never
    // stops, which is the entire point
    const beat = 0.5 + 0.5 * Math.sin(this.ringT * 3.1);
    g.circle(s / 2, s / 2, s * (0.36 + 0.05 * beat))
      .fill({ color: 0xff9a2e, alpha: 0.16 + 0.16 * beat + this.pop * 0.5 });
    for (const [dir, r0, w] of [[1, 0.44, 0.05], [-1, 0.5, 0.033]] as
      [number, number, number][]) {
      const a0 = this.ringT * 1.9 * dir;
      for (let i = 0; i < 3; i++) {
        const a = a0 + (i * Math.PI * 2) / 3;
        g.arc(s / 2, s / 2, s * r0, a, a + 0.7)
          .stroke({ width: s * w, color: 0xffd98a,
            alpha: 0.55 + 0.3 * beat + this.pop * 0.4, cap: 'round' });
      }
    }
  }

  /**
   * Drive the artwork white-hot. Used while a group is being consumed by a
   * fusion: the metal is being heated, so it should LOOK heated rather than
   * have a line drawn to it.
   */
  setHot(t: number): void {
    const k = Math.max(0, Math.min(1, t));
    // tint MULTIPLIES, so the hot end has to stay near white or the artwork
    // goes dark instead of bright; the heat reads through the glow behind it
    this.art.tint = mix(0xffffff, 0xffdca6, k);
    this.glow.alpha = 1 + k * 3.4;
  }

  /**
   * Hit this symbol so the ARTWORK bends — squash on the impact axis, bulge on
   * the other, a decaying ring, then a spring back to rest.
   *
   * Returns false when there is nothing to bend (no atlas artwork), so the
   * caller can fall back to scaling the whole cell instead.
   */
  strike(power: number, vertical = true): boolean {
    if (!this.hasArt) return false;
    const tex = this.art.texture;
    if (!tex || tex === Texture.EMPTY) return false;
    if (!this.deform) {
      this.deform = new Deform(tex);
      // directly above the sprite it replaces, below the label
      this.addChildAt(this.deform.mesh, this.getChildIndex(this.art) + 1);
    } else {
      this.deform.setTexture(tex);
    }
    this.deform.setSize(this.size * ART_FILL);
    this.deform.mesh.position.set(this.size / 2, this.size / 2);
    this.deform.mesh.visible = true;
    this.art.visible = false;
    this.deform.strike(power, vertical);
    return true;
  }

  /** Put the sprite back and drop any residual bend. */
  private endDeform(): void {
    if (!this.deform) return;
    this.deform.reset();
    this.deform.mesh.visible = false;
    if (this.hasArt) this.art.visible = true;
  }

  /**
   * Idle life, driven by the board's ticker. Applied to the ART sprite only, so
   * it never fights the tweens that animate the sprite container itself
   * (forge pull-in, squash, celebrate pulse all move `this`).
   */
  setIdle(scale: number, glowAlpha: number): void {
    if (!this.hasArt) return;
    const base = this.size * ART_FILL;
    this.art.width = this.art.height = base * scale;
    this.glow.alpha = glowAlpha;
  }

  /**
   * Start or stop the win loop.
   *
   * A winning symbol that only pulses its scale is the loudest remaining tell
   * that this is not a finished game, so where authored frames exist they are
   * played instead. Where they do not, this is a no-op and the caller's pulse
   * still runs — the art pass can land one symbol at a time.
   */
  setWinning(on: boolean): void {
    this.loop = on ? this.getWinLoop?.(this.sym) ?? null : null;
    this.loopT = 0;
    if (!on) {
      const tex = this.sym === Sym.EMPTY ? undefined : this.getTexture?.(this.sym);
      if (tex) this.art.texture = tex;
    }
  }

  /**
   * Per-frame work for this cell: the mesh bend, then the win loop. Driven by
   * the board's ticker; both branches are no-ops when nothing is running.
   */
  tickWin(dt: number): boolean {
    if (this.deform && this.deform.mesh.visible) {
      this.deform.update(dt);
      if (!this.deform.active) this.endDeform();
    }
    if (!this.loop) return false;
    this.loopT += dt;
    const fps = 18;
    this.art.texture = this.loop[Math.floor(this.loopT * fps) % this.loop.length];
    return true;
  }

  setSymbol(sym: Sym): void {
    this.loop = null;
    // a cell being repainted must not keep the previous symbol's bend
    this.endDeform();
    this.setHot(0);
    this.pop = 0;
    if (sym !== Sym.CINDER) { this.ring.visible = false; this.ring.clear(); }
    this.sym = sym;
    const tex = sym === Sym.EMPTY ? undefined : this.getTexture?.(sym);
    if (tex) { this.drawFromAtlas(tex); return; }
    this.drawProcedural(sym);
  }

  /** Preferred path: authored artwork from the texture atlas. */
  private drawFromAtlas(tex: Texture): void {
    const s = this.size;
    const st = symStyle(this.sym);
    this.glow.clear();
    // a soft ember behind hot metal, so the idle flicker has something to modulate
    if (st.glow > 0) {
      // The painted artwork already carries its own light, so this is only a
      // faint bed for the idle flicker to modulate — anything stronger reads as
      // a halo pasted behind the illustration.
      this.glow.circle(s / 2, s / 2, s * 0.42)
        .fill({ color: st.ring, alpha: 0.05 + 0.07 * st.glow });
    }
    this.glow.alpha = 1;
    this.drawPlate(st);
    this.txt.text = '';
    this.hasArt = true;
    this.art.visible = true;
    this.art.texture = tex;
    this.art.width = this.art.height = s * ART_FILL;
  }

  /**
   * The plate the symbol stands on.
   *
   * On a reference board every symbol carries its own framed tile, and the
   * tile's colour and weight encode the paytable: a low symbol gets a plain
   * dark slate with a dim rim, a premium gets a bright rim and corner studs,
   * and a wild or scatter gets a different SILHOUETTE — an octagon, not a
   * rectangle — so a special is legible before you have looked at the artwork
   * inside it. Ours had one identical socket behind all thirty cells, which is
   * why a grid of five differently-coloured crystals read as a puzzle game
   * rather than as a paytable.
   *
   * Drawn per symbol rather than into the board's static background because
   * that is the only way the plate can change with what is in the cell.
   */
  private drawPlate(st: SymStyle): void {
    const s = this.size;
    const g = this.tile;
    g.clear();
    if (st.rank < 0) return;              // EMPTY: no plate at all
    const special = st.rank >= 7;
    const pad = s * 0.03;
    const w = s - pad * 2;
    const r = s * 0.13;
    // The plate is TINTED toward the symbol's own colour. On a reference board
    // the tiles are visibly different hues — blue behind the sword, purple
    // behind the royals, amber behind the mug — so the paytable is legible
    // across the whole grid at a glance, before any artwork has been read. A
    // single slate behind all thirty cells threw that away. Kept dark: 14% on
    // ore, 22% on a relic, which is enough to separate the families and not
    // enough to compete with the illustration standing on it.
    const body = mix(0x121a26, st.fill, st.ore ? 0.14 : 0.22);

    if (special) {
      // an octagon: a different outline, readable at a glance across the grid
      const k = w * 0.29;
      const pts: number[] = [
        pad + k, pad, pad + w - k, pad,
        pad + w, pad + k, pad + w, pad + w - k,
        pad + w - k, pad + w, pad + k, pad + w,
        pad, pad + w - k, pad, pad + k,
      ];
      g.poly(pts).fill({ color: 0x101a22, alpha: 0.95 });
      g.poly(pts).stroke({ width: Math.max(2, s * 0.035), color: st.ring, alpha: 0.95 });
      g.poly(pts).fill({ color: st.ring, alpha: 0.07 });
      return;
    }

    g.roundRect(pad, pad, w, w, r).fill({ color: body, alpha: 0.94 });
    // light from above runs down the face and dies out
    g.roundRect(pad, pad, w, w * 0.5, r).fill({ color: 0x9db4d4, alpha: 0.06 });
    // the rim carries the value: dim brass on ore, bright metal on a premium
    const rim = Math.max(1.5, s * (st.ore ? 0.018 : 0.028));
    g.roundRect(pad + rim / 2, pad + rim / 2, w - rim, w - rim, r * 0.9)
      .stroke({ width: rim, color: st.ring, alpha: st.ore ? 0.34 : 0.72 });
    // and a hot inner line on the top ranks, so a crown is never mistaken for iron
    if (st.rank >= 4) {
      g.roundRect(pad + rim * 1.9, pad + rim * 1.9, w - rim * 3.8, w - rim * 3.8, r * 0.7)
        .stroke({ width: Math.max(1, s * 0.008), color: st.ring, alpha: 0.3 });
    }
    // corner studs, on relics only — the fixings that hold a real plate down
    if (!st.ore) {
      const d = s * 0.115;
      const rr = Math.max(1.2, s * 0.017);
      for (const [cx, cy] of [[pad + d, pad + d], [pad + w - d, pad + d],
                              [pad + d, pad + w - d], [pad + w - d, pad + w - d]]) {
        g.circle(cx, cy, rr).fill({ color: 0x0b0e14 });
        g.circle(cx, cy - rr * 0.25, rr * 0.62).fill({ color: st.ring, alpha: 0.75 });
      }
    }
  }

  /** Fallback: procedural shapes (no binary assets required). */
  private drawProcedural(sym: Sym): void {
    this.hasArt = false;
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
