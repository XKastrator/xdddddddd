/**
 * BoardView — the 6×5 grid of SymbolSprites and its animations
 * (reveal, forge pulse + product placement, gravity drop). It renders the state
 * carried by events; it never decides outcomes.
 */
import { Container, Graphics } from 'pixi.js';
import type { Board, Fusion, Spawned } from '../types/events';
import { Sym } from '../types/events';
import { SymbolSprite, type TextureProvider } from './SymbolSprite';
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

  constructor(cols: number, rows: number, cell: number, gap: number,
              getTexture?: TextureProvider) {
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
        const sp = new SymbolSprite(cell, getTexture);
        sp.position.set(gap + c * (cell + gap), gap + r * (cell + gap));
        this.cells.push(sp);
        this.symbolLayer.addChild(sp);
      }
    }
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
  tickIdle(elapsed: number, reduced: boolean): void {
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
    if (ctx.reduced) return;

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
    const fall = 300;
    const total = Math.round(fall * span);

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
    await Promise.all(
      Array.from({ length: this.cols }, (_, c) => this.at(this.rows - 1, c))
        .map((sp) => squash(sp, 0.16, 170, ctx)));
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
    // 1) the winning group flares and is drawn INTO the anchor before fusing,
    //    so the player sees cause (these cells) and effect (this relic)
    const consumed: SymbolSprite[] = [];
    for (const f of fusions) {
      for (const [r, c] of f.cells) consumed.push(this.at(r, c));
      for (const [r, c] of f.wildCells) consumed.push(this.at(r, c));
    }
    const home = consumed.map((sp) => ({ x: sp.x, y: sp.y }));
    const targets = fusions.flatMap((f) => {
      const a = this.at(f.anchor[0], f.anchor[1]);
      const all = [...f.cells, ...f.wildCells];
      return all.map(() => ({ x: a.x, y: a.y }));
    });
    await tween({
      duration: 360, ease: easeOutCubic, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => {
        const flare = 1 + 0.26 * Math.sin(t * Math.PI);
        const pull = t * t;                       // accelerate inward
        for (let i = 0; i < consumed.length; i++) {
          const sp = consumed[i];
          sp.scale.set(flare * (1 - 0.35 * pull));
          const tgt = targets[i] ?? home[i];
          sp.x = home[i].x + (tgt.x - home[i].x) * pull * 0.55;
          sp.y = home[i].y + (tgt.y - home[i].y) * pull * 0.55;
          sp.alpha = 1 - 0.45 * pull;
        }
      },
    });
    for (let i = 0; i < consumed.length; i++) {
      consumed[i].x = home[i].x; consumed[i].y = home[i].y; consumed[i].alpha = 1;
    }
    // 2) clear consumed, place product at anchor with a pop
    const anchors: SymbolSprite[] = [];
    for (const f of fusions) {
      for (const [r, c] of f.cells) { const sp = this.at(r, c); sp.setSymbol(Sym.EMPTY); sp.scale.set(1); }
      for (const [r, c] of f.wildCells) { const sp = this.at(r, c); sp.setSymbol(Sym.EMPTY); sp.scale.set(1); }
      const [ar, ac] = f.anchor; const sp = this.at(ar, ac);
      sp.setSymbol(f.to); sp.scale.set(0.2); anchors.push(sp);
    }
    await tween({
      duration: 320, ease: easeOutBack, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { for (const sp of anchors) sp.scale.set(0.2 + 0.8 * t); },
    });
    await Promise.all(anchors.map((sp) => squash(sp, 0.18, 200, ctx)));
  }

  /** Celebrate the relics that paid, so a win is legible on the board itself. */
  async celebrate(cells: { r: number; c: number }[], ctx: AnimCtx): Promise<void> {
    if (!cells.length) return;
    await Promise.all(cells.map(({ r, c }) => pulse(this.at(r, c), 2, 420, ctx)));
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
