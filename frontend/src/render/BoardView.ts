/**
 * BoardView — the 6×5 grid of SymbolSprites and its animations
 * (reveal, forge pulse + product placement, gravity drop). It renders the state
 * carried by events; it never decides outcomes.
 */
import { Container, FillGradient, Graphics } from 'pixi.js';
import type { Board, Fusion, Spawned } from '../types/events';
import { Sym } from '../types/events';
import { SymbolSprite, type TextureProvider, type WinLoopProvider } from './SymbolSprite';
import { tween, wait, easeOutBack, easeOutCubic } from './tween';
import { squash, pulse } from './juice';

export interface AnimCtx { shouldSkip: () => boolean; reduced: boolean; }

export class BoardView extends Container {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  /** Row gutter — tight, because nothing is drawn between the rows. */
  readonly gap: number;
  /** Column gutter — wider, because a post stands in it. */
  readonly gapX: number;
  private cells: SymbolSprite[] = [];
  private bg = new Graphics();
  /**
   * Symbols live in their own masked layer so they can travel from ABOVE the
   * grid into it. Without the mask the only affordable reveal is a fade, and a
   * board that fades in reads as a picture being swapped rather than as
   * symbols arriving — which is the single loudest tell that a slot is a
   * prototype. The mask is grid-sized, not full-screen.
   */
  private symbolLayer = new Container();
  private clip = new Graphics();
  /** Drawn ABOVE the symbols: the chain that shows which cells combined. */
  private links = new Graphics();
  /**
   * The posts between the columns, drawn IN FRONT of the symbols.
   *
   * A 6x5 grid with nothing between the columns is one field of tiles; the
   * reference boards run a physical divider down each column boundary, which is
   * what makes six reels read as six reels. They are in front on purpose — a
   * post that occludes the edge of a symbol is a post the symbol is behind,
   * and that is the whole cue. Static, so this is built once.
   */
  private posts = new Graphics();

  constructor(cols: number, rows: number, cell: number, gap: number, gapX: number,
              getTexture?: TextureProvider, getWinLoop?: WinLoopProvider) {
    super();
    this.cols = cols; this.rows = rows; this.cell = cell;
    this.gap = gap; this.gapX = gapX;
    const w = cols * cell + (cols + 1) * gapX;
    const h = rows * cell + (rows + 1) * gap;
    // The reel window is LIT, not translucent.
    //
    // It used to be a 35%-alpha black rectangle on the theory that the painted
    // room behind the grid was part of the composition. On screen it was not:
    // the room was already dark there, so the whole board resolved to one flat
    // near-black slab with no direction and no depth, and the symbols read as
    // stickers on a rectangle. The window now has its own light — cold at the
    // top, warm at the bottom, because the forge is below and the room is above
    // — which is the same light the symbol artwork is painted under.
    this.bg.roundRect(0, 0, w, h, gap * 2)
      .fill(new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: 0x0a1018 },
          { offset: 0.55, color: 0x0d0f14 },
          { offset: 1, color: 0x1c1109 },
        ],
        textureSpace: 'local',
      }));
    // Per-cell sockets. Without them the recess is one flat rectangle and the
    // symbols read as stickers floating on a panel; a shallow inset behind each
    // one gives the grid structure and makes a gap in a fused group visible.
    // Everything here scales with CELL, not with the gutter: the gutter is now
    // hairline-thin by design and ornament tied to it disappeared with it.
    // The sockets are now only a SHADOW under each plate. Every symbol carries
    // its own framed tile (see SymbolSprite.drawPlate), so the elaborate carved
    // well that used to be drawn here would double up with it — two frames per
    // cell, which reads as noise. What is left is the hole the plate sits in.
    const r = Math.max(3, cell * 0.11);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = gapX + col * (cell + gapX);
        const y = gap + row * (cell + gap);
        this.bg.roundRect(x, y, cell, cell, r).fill({ color: 0x05080e, alpha: 0.72 });
      }
    }
    this.addChild(this.bg);
    this.clip.roundRect(gapX * 0.3, gap * 0.4, w - gapX * 0.6, h - gap * 0.8, gap * 1.4)
      .fill({ color: 0xffffff });
    this.symbolLayer.mask = this.clip;
    this.addChild(this.clip, this.symbolLayer);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sp = new SymbolSprite(cell, getTexture, getWinLoop);
        sp.position.set(gapX + c * (cell + gapX), gap + r * (cell + gap));
        this.cells.push(sp);
        this.symbolLayer.addChild(sp);
      }
    }
    this.buildPosts(w, h);
    this.addChild(this.posts, this.links);
  }

  /** Column dividers plus the rails that cap them. */
  private buildPosts(w: number, h: number): void {
    const { cols, cell, gapX } = this;
    const g = this.posts;
    // Fills most of the gutter. It used to be a fraction of the CELL while the
    // gutter was five pixels wide, so the post was a hairline that happened to
    // sit between two columns — present in the code, invisible on screen.
    const pw = Math.max(6, gapX * 0.82);
    for (let c = 1; c < cols; c++) {
      // centred on the gutter between two columns
      const x = gapX + c * (cell + gapX) - gapX / 2 - pw / 2;
      g.rect(x, 0, pw, h).fill({ color: 0x0c1119 });
      // one light source, above and to the left: lit edge left, shadow right
      g.rect(x, 0, pw * 0.3, h).fill({ color: 0x4a5a70, alpha: 0.65 });
      g.rect(x + pw * 0.72, 0, pw * 0.28, h).fill({ color: 0x000000, alpha: 0.5 });
      // brass collars, so the post is built rather than extruded
      for (const y of [h * 0.02, h * 0.5 - pw * 0.6, h - h * 0.02 - pw * 1.2]) {
        g.rect(x - pw * 0.22, y, pw * 1.44, pw * 1.2).fill({ color: 0x2a3444 });
        g.rect(x - pw * 0.22, y, pw * 1.44, pw * 0.34)
          .fill({ color: 0xc79a52, alpha: 0.55 });
      }
    }
    // top and bottom rails tie the posts together into one structure
    const rail = Math.max(3, cell * 0.05);
    g.rect(0, 0, w, rail).fill({ color: 0x0c1119, alpha: 0.9 });
    g.rect(0, 0, w, rail * 0.34).fill({ color: 0x4a5a70, alpha: 0.5 });
    g.rect(0, h - rail, w, rail).fill({ color: 0x0c1119, alpha: 0.9 });
  }

  /** Home position of a cell in board-local coordinates. */
  private homeOf(r: number, c: number): { x: number; y: number } {
    return { x: this.gapX + c * (this.cell + this.gapX),
             y: this.gap + r * (this.cell + this.gap) };
  }

  get width2(): number { return this.cols * this.cell + (this.cols + 1) * this.gapX; }
  get height2(): number { return this.rows * this.cell + (this.rows + 1) * this.gap; }

  private at(r: number, c: number): SymbolSprite { return this.cells[r * this.cols + c]; }

  /** Centre of a cell in BoardView-local coordinates (for particle emission). */
  cellCenter(r: number, c: number): { x: number; y: number } {
    return {
      x: this.gapX + c * (this.cell + this.gapX) + this.cell / 2,
      y: this.gap + r * (this.cell + this.gap) + this.cell / 2,
    };
  }

  /**
   * Per-frame idle life. Relics breathe and flicker (they are hot metal); ore
   * stays inert because it is fuel and must read as dead weight. Each cell gets
   * a phase offset from its index so the grid never pulses in lockstep.
   */
  tickIdle(elapsed: number, reduced: boolean, dt = 0): void {
    for (const sp of this.cells) sp.tickWin(dt);
    if (reduced) return;
    for (let i = 0; i < this.cells.length; i++) {
      const sp = this.cells[i];
      if (!sp.animatable) continue;
      const phase = i * 0.7;
      sp.setIdle(1 + 0.018 * Math.sin(elapsed * 1.9 + phase),
                 0.9 + 0.10 * Math.sin(elapsed * 2.7 + phase * 1.3));
    }
  }

  setBoard(board: Board): void {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const sp = this.at(r, c);
        sp.setSymbol(board[r]?.[c] ?? Sym.EMPTY);
        sp.scale.set(1); sp.alpha = 1;
      }
  }

  /**
   * The spin reveal: symbols stream down into the grid, column by column.
   *
   * This replaced `setBoard` on the reveal event, which placed the whole board
   * in a single frame. A slot whose board teleports has no spin — the player
   * sees a picture change, and every other piece of polish is wasted on top of
   * that. The motion follows the shape commercial reels use: a short
   * acceleration, a brief travel, then an ease-out into the stop, staggered
   * across columns so the board resolves left to right instead of all at once.
   *
   * `holdFrom` is the anticipation hook. Columns from that index on take far
   * longer and arrive one at a time, which is the deliberate slowing every slot
   * uses when the reels still standing could complete a trigger. It is driven
   * by the scatter count already in the event stream, so it never promises
   * something the round cannot deliver.
   */
  async reveal(board: Board, ctx: AnimCtx, holdFrom = -1): Promise<void> {
    this.setBoard(board);
    // Reduced motion — and the frame-rate guard, which routes through the same
    // flag — SHORTENS this. It must not delete it: a board that appears in one
    // frame is the exact failure this method exists to fix, and the players on
    // the weakest devices would have been the only ones still getting it.
    const brisk = ctx.reduced;
    const travel = this.height2 + this.cell;
    const held = (c: number) => holdFrom >= 0 && c >= holdFrom;
    // Column start times, in units of one column's own fall duration.
    const starts: number[] = [];
    let t = 0;
    for (let c = 0; c < this.cols; c++) {
      starts.push(t);
      // a held column does not overlap the next one — it lands alone, which is
      // what makes the pause read as suspense rather than as lag
      t += held(c) ? 1.35 : 0.34;
    }
    const span = starts[this.cols - 1] + (held(this.cols - 1) ? 1.35 : 1);
    // Brisk mode collapses the reveal into one short move instead of merely
    // shortening each column. Keeping the stagger and cutting the fall still
    // cost ~240ms PER SPIN, and a resumed bonus round replays a hundred of
    // them — the catch-up replay went from instant to over a minute, which is
    // a hang as far as the player is concerned.
    const fall = brisk ? 60 / span : 300;
    const total = Math.max(60, Math.round(fall * span));

    const entries: { sp: SymbolSprite; homeY: number; start: number; slow: boolean }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const sp = this.at(r, c);
        const home = this.homeOf(r, c);
        sp.y = home.y - travel;
        // rows inside a column arrive as a stack, top first, like a strip
        entries.push({ sp, homeY: home.y, start: starts[c] + r * 0.05, slow: held(c) });
      }
    }

    await tween({
      duration: total, ease: (x) => x, shouldSkip: ctx.shouldSkip,
      onUpdate: (x) => {
        const now = x * span;
        for (const e of entries) {
          const local = Math.max(0, Math.min(1, (now - e.start) / (e.slow ? 1.25 : 1)));
          e.sp.y = e.homeY - travel * (1 - easeOutCubic(local));
        }
      },
    });
    for (const e of entries) e.sp.y = e.homeY;
    // the bottom row carries the impact; squashing all thirty would be noise
    if (brisk) return;
    await Promise.all(
      Array.from({ length: this.cols }, (_, c) => this.at(this.rows - 1, c))
        .map((sp) => this.land(sp, 0.5, ctx)));
  }

  /**
   * A symbol arriving: bend the ARTWORK if it can be bent, otherwise scale the
   * whole cell.
   *
   * The scale tween was the only landing we had, and a picture that gets
   * briefly shorter is not the same as an object with mass hitting a surface —
   * it is the tell that separates our symbols from a studio's. A mesh bend
   * compresses along the impact axis, bulges across it and rings out, which is
   * what a Spine rig does to a single-piece symbol. Where there is no artwork
   * to bend (the procedural fallback) the old squash still runs, so nothing
   * regresses when assets are missing.
   */
  private async land(sp: SymbolSprite, power: number, ctx: AnimCtx): Promise<void> {
    if (ctx.reduced) return;
    if (sp.strike(power)) {
      // the bend runs on the ticker; hold the beat, not the whole settle
      await wait(170, ctx.shouldSkip, ctx.reduced);
      return;
    }
    await squash(sp, 0.16, 170, ctx);
  }

  /**
   * Clear the grid by dropping everything out of the bottom.
   *
   * Entering a bonus used to be a background cross-fade with a banner over a
   * board that never moved — the round changed but the game did not visibly
   * change with it. Sweeping the old board out gives the transition a beginning,
   * and leaves the grid empty for the next reveal to fill, so the two motions
   * read as one sequence instead of a banner interrupting a static picture.
   */
  async sweepOut(ctx: AnimCtx): Promise<void> {
    const drop = this.height2 + this.cell;
    const cells: { sp: SymbolSprite; homeY: number; delay: number }[] = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        cells.push({ sp: this.at(r, c), homeY: this.homeOf(r, c).y,
          // bottom row leaves first, so the board empties downward
          delay: (this.rows - 1 - r) * 0.10 + c * 0.02 });
      }
    const span = 1 + Math.max(...cells.map((e) => e.delay));
    await tween({
      duration: ctx.reduced ? 60 : 420, ease: (t) => t, shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        const now = t * span;
        for (const e of cells) {
          const local = Math.max(0, Math.min(1, now - e.delay));
          e.sp.y = e.homeY + drop * (local * local);
        }
      },
    });
    for (const e of cells) { e.sp.setSymbol(Sym.EMPTY); e.sp.y = e.homeY; }
  }

  /**
   * Hold a column under the spotlight while the round decides.
   *
   * Pulsing the cells that are still to come is what turns "two scatters
   * landed" into a moment. It is presentation only: the outcome was decided by
   * the server before the first symbol moved, and the pulse is driven by the
   * scatter count the book already carries.
   */
  async anticipate(fromCol: number, ctx: AnimCtx): Promise<void> {
    if (ctx.reduced || fromCol < 0 || fromCol >= this.cols) return;
    const cells: SymbolSprite[] = [];
    for (let c = fromCol; c < this.cols; c++)
      for (let r = 0; r < this.rows; r++) cells.push(this.at(r, c));
    await tween({
      duration: 620, shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        const beat = 1 + 0.07 * Math.sin(t * Math.PI * 6) * (1 - t);
        for (const sp of cells) sp.scale.set(beat);
      },
    });
    for (const sp of cells) sp.scale.set(1);
  }

  async forge(fusions: Fusion[], ctx: AnimCtx): Promise<void> {
    // ---- 1. IGNITE ALONG THE CHAIN ---------------------------------------
    // The old version flared every cell at once and slid them all inward, so a
    // fusion read as "some things moved" — you could not see WHICH cells
    // combined, which is the one thing the animation exists to say. Now a light
    // runs the chain, cell to cell, in order of distance from the anchor, and
    // each cell ignites as it is reached. Cause, then effect.
    const chains = fusions.map((f) => {
      const a = this.cellCenter(f.anchor[0], f.anchor[1]);
      const all = [...f.cells, ...f.wildCells];
      const nodes = all
        .map(([r, c]) => ({ r, c, sp: this.at(r, c), p: this.cellCenter(r, c) }))
        .sort((x, y) => (Math.hypot(y.p.x - a.x, y.p.y - a.y))
                      - (Math.hypot(x.p.x - a.x, x.p.y - a.y)));
      return { anchor: a, nodes, value: f.value };
    });
    const all = chains.flatMap((c) => c.nodes);
    const home = all.map((n) => ({ x: n.sp.x, y: n.sp.y }));

    if (!ctx.reduced) {
      await tween({
        duration: 420, shouldSkip: ctx.shouldSkip,
        onUpdate: (t) => {
          const g = this.links;
          g.clear();
          for (const ch of chains) {
            const n = ch.nodes.length;
            // how far the spark has travelled along this chain, in nodes
            const head = t * n;
            const pts = [...ch.nodes.map((x) => x.p), ch.anchor];
            // the trail behind the spark, drawn as a warm cord
            for (let i = 0; i < pts.length - 1; i++) {
              const seg = Math.max(0, Math.min(1, head - i));
              if (seg <= 0) break;
              const a = pts[i], b = pts[i + 1];
              g.moveTo(a.x, a.y)
                .lineTo(a.x + (b.x - a.x) * seg, a.y + (b.y - a.y) * seg)
                .stroke({ width: 3 + 3 * seg, color: 0xffc46a,
                  alpha: 0.85, cap: 'round' });
            }
            // each cell lights the instant the spark reaches it
            for (let i = 0; i < ch.nodes.length; i++) {
              const lit = Math.max(0, Math.min(1, head - i));
              if (lit <= 0) continue;
              const p = pts[i];
              g.circle(p.x, p.y, this.cell * (0.30 + 0.22 * lit))
                .fill({ color: 0xffe0a0, alpha: 0.34 * (1 - lit) + 0.10 });
              ch.nodes[i].sp.scale.set(1 + 0.22 * Math.sin(lit * Math.PI));
            }
          }
        },
      });
    }

    // ---- 2. DRAW THE CHAIN INTO THE ANCHOR --------------------------------
    await tween({
      duration: ctx.reduced ? 90 : 300, ease: easeOutCubic,
      shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        const pull = t * t;
        let i = 0;
        for (const ch of chains) {
          for (const n of ch.nodes) {
            const h = home[i];
            n.sp.x = h.x + (ch.anchor.x - this.cell / 2 - h.x) * pull;
            n.sp.y = h.y + (ch.anchor.y - this.cell / 2 - h.y) * pull;
            n.sp.scale.set(1 - 0.55 * pull);
            n.sp.alpha = 1 - 0.7 * pull;
            i++;
          }
        }
        // the cord tightens as the cells are swallowed
        this.links.alpha = 1 - t;
      },
    });
    this.links.clear();
    this.links.alpha = 1;
    for (let i = 0; i < all.length; i++) {
      all[i].sp.x = home[i].x; all[i].sp.y = home[i].y;
      all[i].sp.alpha = 1; all[i].sp.scale.set(1);
    }

    // ---- 3. THE PRODUCT ARRIVES -------------------------------------------
    const anchors: SymbolSprite[] = [];
    for (const f of fusions) {
      for (const [r, c] of [...f.cells, ...f.wildCells]) {
        const sp = this.at(r, c); sp.setSymbol(Sym.EMPTY); sp.scale.set(1);
      }
      const [ar, ac] = f.anchor; const sp = this.at(ar, ac);
      sp.setSymbol(f.to); sp.scale.set(0.2); anchors.push(sp);
    }
    // a shockwave sized by how much metal went in — a four-cell fusion and a
    // nine-cell one must not land identically
    if (!ctx.reduced) {
      const rings = chains.map((c) => ({ p: c.anchor, n: c.nodes.length }));
      void tween({
        duration: 460, shouldSkip: ctx.shouldSkip,
        onUpdate: (t) => {
          const g = this.links;
          g.clear();
          for (const r of rings) {
            const rad = this.cell * (0.35 + (0.5 + r.n * 0.09) * t);
            g.circle(r.p.x, r.p.y, rad)
              .stroke({ width: 6 * (1 - t), color: 0xffd98a, alpha: 0.9 * (1 - t) });
          }
        },
      }).then(() => this.links.clear());
    }
    await tween({
      duration: ctx.reduced ? 80 : 320, ease: easeOutBack,
      shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => { for (const sp of anchors) sp.scale.set(0.2 + 0.8 * t); },
    });
    // the product is struck hardest — this is the hammer blow of the round
    await Promise.all(anchors.map((sp) => this.land(sp, 0.85, ctx)));
  }

  /**
   * Celebrate the relics that paid, so a win is legible on the board itself.
   *
   * Pulsing the winners alone is not enough on a 30-cell grid: on a busy board
   * a symbol that grows 8% is lost among twenty-nine others of equal weight.
   * Every commercial slot answers this by taking the board AWAY — the cells
   * that did not pay dim right down, and what is left standing in full light is
   * the win. The dim is what makes the pulse readable, not decoration on top
   * of it.
   */
  async celebrate(cells: { r: number; c: number }[], ctx: AnimCtx): Promise<void> {
    if (!cells.length) return;
    const won = new Set(cells.map(({ r, c }) => r * this.cols + c));
    const sprites = cells.map(({ r, c }) => this.at(r, c));
    const rest = this.cells.filter((_, i) => !won.has(i));
    for (const sp of sprites) sp.setWinning(true);
    // a halo under each paying cell, so the lit ones read as lit rather than
    // merely as the ones that were not dimmed
    if (!ctx.reduced) {
      const g = this.links;
      g.clear();
      for (const { r, c } of cells) {
        const p = this.cellCenter(r, c);
        g.circle(p.x, p.y, this.cell * 0.62)
          .fill({ color: 0xffcf7a, alpha: 0.13 });
      }
      g.alpha = 0;
      await tween({
        duration: 150, shouldSkip: ctx.shouldSkip,
        onUpdate: (t) => {
          g.alpha = t;
          for (const sp of rest) sp.alpha = 1 - 0.62 * t;
        },
      });
    }
    // The pulse still runs: it is what a symbol WITHOUT authored frames gets,
    // and under one it reads as the loop being emphasised rather than replaced.
    await Promise.all(sprites.map((sp) => pulse(sp, 2, 420, ctx)));
    for (const sp of sprites) sp.setWinning(false);
    if (!ctx.reduced) {
      await tween({
        duration: 170, shouldSkip: ctx.shouldSkip,
        onUpdate: (t) => {
          this.links.alpha = 1 - t;
          for (const sp of rest) sp.alpha = 0.38 + 0.62 * t;
        },
      });
    }
    // unconditional: a skip resolves the tweens early and the board must never
    // be left with half its cells dimmed
    this.links.clear();
    this.links.alpha = 1;
    for (const sp of rest) sp.alpha = 1;
  }

  async gravity(board: Board, spawned: Spawned[], ctx: AnimCtx): Promise<void> {
    this.setBoard(board);
    // Fall from OUTSIDE the housing, not from one cell up with a fade. The
    // symbol layer is masked, so a tumbled symbol is genuinely off-grid until
    // it enters — which is what makes a cascade read as things falling rather
    // than as cells being repainted.
    const drop = this.height2 + this.cell;
    // Stagger by column: a whole board landing on one frame reads as a slideshow,
    // a left-to-right cascade reads as physical.
    const byCell = spawned.map((s) => ({
      sp: this.at(s.r, s.c),
      homeY: this.gap + s.r * (this.cell + this.gap),
      delay: s.c * 0.085 + s.r * 0.02,
    }));
    for (const e of byCell) { e.sp.y = e.homeY - drop; }

    const span = 1 + Math.max(0, ...byCell.map((e) => e.delay));
    await tween({
      duration: 420, ease: (t) => t, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => {
        const now = t * span;
        for (const e of byCell) {
          const local = Math.max(0, Math.min(1, now - e.delay));
          e.sp.y = e.homeY - drop * (1 - easeOutCubic(local));
        }
      },
    });
    for (const e of byCell) { e.sp.y = e.homeY; }
    await Promise.all(byCell.slice(0, 8).map((e) => this.land(e.sp, 0.42, ctx)));
  }
}
