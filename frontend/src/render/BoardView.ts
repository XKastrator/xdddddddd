/**
 * BoardView — the 6×5 grid of SymbolSprites and its animations
 * (reveal, forge pulse + product placement, gravity drop). It renders the state
 * carried by events; it never decides outcomes.
 */
import { Container, Graphics } from 'pixi.js';
import type { Board, Fusion, Spawned } from '../types/events';
import { Sym } from '../types/events';
import { SymbolSprite, type TextureProvider, type WinLoopProvider } from './SymbolSprite';
import { tween, easeOutBack, easeOutCubic } from './tween';
import { squash, pulse } from './juice';
import { THEME } from './palette';

export interface AnimCtx { shouldSkip: () => boolean; reduced: boolean; }

export class BoardView extends Container {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly gap: number;
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

  constructor(cols: number, rows: number, cell: number, gap: number,
              getTexture?: TextureProvider, getWinLoop?: WinLoopProvider) {
    super();
    this.cols = cols; this.rows = rows; this.cell = cell; this.gap = gap;
    const w = cols * cell + (cols + 1) * gap;
    const h = rows * cell + (rows + 1) * gap;
    // translucent: the painted room behind the grid is part of the composition
    this.bg.roundRect(0, 0, w, h, gap * 1.6).fill({ color: 0x05070c, alpha: 0.35 });
    // Per-cell wells. Without them the recess is one flat rectangle and the
    // symbols read as stickers floating on a panel; a shallow inset behind each
    // one gives the grid structure and makes a gap in a fused group visible.
    const r = gap * 1.1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = gap + col * (cell + gap);
        const y = gap + row * (cell + gap);
        this.bg.roundRect(x, y, cell, cell, r).fill({ color: 0x0b1018, alpha: 0.55 });
        // light catches the top lip, shadow gathers along the bottom
        this.bg.roundRect(x, y, cell, cell * 0.5, r)
          .fill({ color: 0xffffff, alpha: 0.022 });
        this.bg.roundRect(x + 0.5, y + 0.5, cell - 1, cell - 1, r)
          .stroke({ width: 1, color: 0x000000, alpha: 0.4 });
        this.bg.moveTo(x + r, y + 0.5).lineTo(x + cell - r, y + 0.5)
          .stroke({ width: 1, color: 0x7b8ea6, alpha: 0.22 });
      }
    }
    this.bg.roundRect(0, 0, w, h, gap * 1.6).stroke({ width: 2, color: THEME.line });
    this.addChild(this.bg);
    this.clip.roundRect(gap * 0.4, gap * 0.4, w - gap * 0.8, h - gap * 0.8, gap * 1.4)
      .fill({ color: 0xffffff });
    this.symbolLayer.mask = this.clip;
    this.addChild(this.clip, this.symbolLayer);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sp = new SymbolSprite(cell, getTexture, getWinLoop);
        sp.position.set(gap + c * (cell + gap), gap + r * (cell + gap));
        this.cells.push(sp);
        this.symbolLayer.addChild(sp);
      }
    }
    this.addChild(this.links);
  }

  /** Home position of a cell in board-local coordinates. */
  private homeOf(r: number, c: number): { x: number; y: number } {
    return { x: this.gap + c * (this.cell + this.gap), y: this.gap + r * (this.cell + this.gap) };
  }

  get width2(): number { return this.cols * this.cell + (this.cols + 1) * this.gap; }
  get height2(): number { return this.rows * this.cell + (this.rows + 1) * this.gap; }

  private at(r: number, c: number): SymbolSprite { return this.cells[r * this.cols + c]; }

  /** Centre of a cell in BoardView-local coordinates (for particle emission). */
  cellCenter(r: number, c: number): { x: number; y: number } {
    return {
      x: this.gap + c * (this.cell + this.gap) + this.cell / 2,
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
        .map((sp) => squash(sp, 0.16, 170, ctx)));
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
    await Promise.all(anchors.map((sp) => squash(sp, 0.18, 200, ctx)));
  }

  /** Celebrate the relics that paid, so a win is legible on the board itself. */
  async celebrate(cells: { r: number; c: number }[], ctx: AnimCtx): Promise<void> {
    if (!cells.length) return;
    const sprites = cells.map(({ r, c }) => this.at(r, c));
    for (const sp of sprites) sp.setWinning(true);
    // The pulse still runs: it is what a symbol WITHOUT authored frames gets,
    // and under one it reads as the loop being emphasised rather than replaced.
    await Promise.all(sprites.map((sp) => pulse(sp, 2, 420, ctx)));
    for (const sp of sprites) sp.setWinning(false);
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
    await Promise.all(byCell.slice(0, 8).map((e) => squash(e.sp, 0.14, 160, ctx)));
  }
}
