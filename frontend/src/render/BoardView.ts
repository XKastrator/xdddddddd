/**
 * BoardView — the 6×5 grid of SymbolSprites and its animations
 * (reveal, forge pulse + product placement, gravity drop). It renders the state
 * carried by events; it never decides outcomes.
 */
import { Container, Graphics } from 'pixi.js';
import type { Board, Fusion, Spawned } from '../types/events';
import { Sym } from '../types/events';
import { SymbolSprite } from './SymbolSprite';
import { tween, easeOutBack, easeOutCubic } from './tween';
import { THEME } from './palette';

export interface AnimCtx { shouldSkip: () => boolean; reduced: boolean; }

export class BoardView extends Container {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly gap: number;
  private cells: SymbolSprite[] = [];
  private bg = new Graphics();

  constructor(cols: number, rows: number, cell: number, gap: number) {
    super();
    this.cols = cols; this.rows = rows; this.cell = cell; this.gap = gap;
    const w = cols * cell + (cols + 1) * gap;
    const h = rows * cell + (rows + 1) * gap;
    this.bg.roundRect(0, 0, w, h, gap * 1.6).fill({ color: THEME.panel })
      .roundRect(0, 0, w, h, gap * 1.6).stroke({ width: 2, color: THEME.line });
    this.addChild(this.bg);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sp = new SymbolSprite(cell);
        sp.position.set(gap + c * (cell + gap), gap + r * (cell + gap));
        this.cells.push(sp);
        this.addChild(sp);
      }
    }
  }

  get width2(): number { return this.cols * this.cell + (this.cols + 1) * this.gap; }
  get height2(): number { return this.rows * this.cell + (this.rows + 1) * this.gap; }

  private at(r: number, c: number): SymbolSprite { return this.cells[r * this.cols + c]; }

  setBoard(board: Board): void {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const sp = this.at(r, c);
        sp.setSymbol(board[r]?.[c] ?? Sym.EMPTY);
        sp.scale.set(1); sp.alpha = 1;
      }
  }

  async forge(fusions: Fusion[], ctx: AnimCtx): Promise<void> {
    // 1) pulse every consumed cell
    const consumed: SymbolSprite[] = [];
    for (const f of fusions) {
      for (const [r, c] of f.cells) consumed.push(this.at(r, c));
      for (const [r, c] of f.wildCells) consumed.push(this.at(r, c));
    }
    await tween({
      duration: 320, ease: easeOutCubic, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { const s = 1 + 0.22 * Math.sin(t * Math.PI); for (const sp of consumed) sp.scale.set(s); },
    });
    // 2) clear consumed, place product at anchor with a pop
    const anchors: SymbolSprite[] = [];
    for (const f of fusions) {
      for (const [r, c] of f.cells) { const sp = this.at(r, c); sp.setSymbol(Sym.EMPTY); sp.scale.set(1); }
      for (const [r, c] of f.wildCells) { const sp = this.at(r, c); sp.setSymbol(Sym.EMPTY); sp.scale.set(1); }
      const [ar, ac] = f.anchor; const sp = this.at(ar, ac);
      sp.setSymbol(f.to); sp.scale.set(0.2); anchors.push(sp);
    }
    await tween({
      duration: 300, ease: easeOutBack, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => { for (const sp of anchors) sp.scale.set(0.2 + 0.8 * t); },
    });
  }

  async gravity(board: Board, spawned: Spawned[], ctx: AnimCtx): Promise<void> {
    this.setBoard(board);
    const spawnedSet = new Set(spawned.map((s) => s.r * this.cols + s.c));
    const drop = this.cell * 0.9;
    const sprites = [...spawnedSet].map((i) => this.cells[i]);
    for (const sp of sprites) sp.alpha = 0.2;
    await tween({
      duration: 220, ease: easeOutCubic, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => {
        for (const sp of sprites) {
          sp.alpha = 0.2 + 0.8 * t;
          const base = this.gap + Math.floor(this.cells.indexOf(sp) / this.cols) * (this.cell + this.gap);
          sp.y = base - drop * (1 - t);
        }
      },
    });
    for (const sp of sprites) {
      const idx = this.cells.indexOf(sp);
      sp.y = this.gap + Math.floor(idx / this.cols) * (this.cell + this.gap);
      sp.alpha = 1;
    }
  }
}
