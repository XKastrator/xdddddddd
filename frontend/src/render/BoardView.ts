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

  constructor(cols: number, rows: number, cell: number, gap: number,
              getTexture?: TextureProvider) {
    super();
    this.cols = cols; this.rows = rows; this.cell = cell; this.gap = gap;
    const w = cols * cell + (cols + 1) * gap;
    const h = rows * cell + (rows + 1) * gap;
    this.bg.roundRect(0, 0, w, h, gap * 1.6).fill({ color: 0x0e0a07 });
    // Per-cell wells. Without them the recess is one flat rectangle and the
    // symbols read as stickers floating on a panel; a shallow inset behind each
    // one gives the grid structure and makes a gap in a fused group visible.
    const r = gap * 1.1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = gap + col * (cell + gap);
        const y = gap + row * (cell + gap);
        this.bg.roundRect(x, y, cell, cell, r).fill({ color: 0x171009 });
        // light catches the top lip, shadow gathers along the bottom
        this.bg.roundRect(x, y, cell, cell * 0.5, r)
          .fill({ color: 0xffffff, alpha: 0.022 });
        this.bg.roundRect(x + 0.5, y + 0.5, cell - 1, cell - 1, r)
          .stroke({ width: 1, color: 0x000000, alpha: 0.55 });
        this.bg.moveTo(x + r, y + 0.5).lineTo(x + cell - r, y + 0.5)
          .stroke({ width: 1, color: 0x5a462c, alpha: 0.35 });
      }
    }
    this.bg.roundRect(0, 0, w, h, gap * 1.6).stroke({ width: 2, color: THEME.line });
    this.addChild(this.bg);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sp = new SymbolSprite(cell, getTexture);
        sp.position.set(gap + c * (cell + gap), gap + r * (cell + gap));
        this.cells.push(sp);
        this.addChild(sp);
      }
    }
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
    const drop = this.cell * 1.15;
    // Stagger by column: a whole board landing on one frame reads as a slideshow,
    // a left-to-right cascade reads as physical.
    const byCell = spawned.map((s) => ({
      sp: this.at(s.r, s.c),
      homeY: this.gap + s.r * (this.cell + this.gap),
      delay: s.c * 0.085 + s.r * 0.02,
    }));
    for (const e of byCell) { e.sp.alpha = 0; e.sp.y = e.homeY - drop; }

    const span = 1 + Math.max(0, ...byCell.map((e) => e.delay));
    await tween({
      duration: 420, ease: (t) => t, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => {
        const now = t * span;
        for (const e of byCell) {
          const local = Math.max(0, Math.min(1, now - e.delay));
          e.sp.alpha = local;
          e.sp.y = e.homeY - drop * (1 - easeOutCubic(local));
        }
      },
    });
    for (const e of byCell) { e.sp.y = e.homeY; e.sp.alpha = 1; }
    await Promise.all(byCell.slice(0, 8).map((e) => squash(e.sp, 0.14, 160, ctx)));
  }
}
