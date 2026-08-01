/**
 * BoardView — the 6×5 grid of SymbolSprites and its animations
 * (reveal, forge pulse + product placement, gravity drop). It renders the state
 * carried by events; it never decides outcomes.
 */
import { Container, FillGradient, Graphics } from 'pixi.js';
import type { Board, Fusion, Spawned, Vein } from '../types/events';
import { Sym } from '../types/events';
import { SymbolSprite, type TextureProvider, type WinLoopProvider } from './SymbolSprite';
import { tween, wait, easeOutBack, easeOutCubic } from './tween';
import { squash, pulse } from './juice';
import { GlyphText, type GlyphFont } from './GlyphText';
import { symStyle } from './palette';

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
  /**
   * One extra sprite per column.
   *
   * A reel is a CONTINUOUS strip: symbols run past the window and wrap around.
   * With exactly `rows` sprites per column the strip is one gutter shorter than
   * the window, so the wrap shows as a seam travelling through the reel. The
   * spare makes the strip taller than the window, which is the whole trick.
   * Hidden except while spinning.
   */
  private spare: SymbolSprite[] = [];
  /** Symbols the spinning strip cycles through. Presentation only. */
  private static readonly STRIP: Sym[] = [
    Sym.O1, Sym.O2, Sym.O3, Sym.O4, Sym.O5,
    Sym.BRONZE, Sym.IRON, Sym.SILVER, Sym.GOLD, Sym.MYTHRIL,
    Sym.O1, Sym.O3, Sym.O5, Sym.O2, Sym.O4,
  ];

  /**
   * Floating "x5" callouts over a fusion anchor.
   *
   * The loudest complaint about this game was that you cannot tell what is
   * happening — symbols vanish and a gold bar appears, with nothing on screen
   * saying that FIVE of them combined INTO it. A count popping over the anchor
   * as the group is drawn in states the rule in one glance, every time it
   * fires, without a tutorial.
   */
  private callouts: GlyphText[] = [];
  /**
   * Particle emitter, in BOARD-LOCAL coordinates. Supplied by the presenter,
   * which owns the particle layer; the board knows WHERE things happen and the
   * presenter knows WHAT it can draw with.
   */
  sparks: ((x: number, y: number, n: number, speed?: number, color?: number) => void)
    | null = null;
  /**
   * Fired the instant a scatter lands, with how many are on the board so far.
   * Every commercial slot acknowledges each scatter as it arrives — sound,
   * flash, a running count — including at two, where nothing has been won yet.
   * Without it a 30%-of-spins symbol is invisible.
   */
  onScatter: ((count: number) => void) | null = null;
  /**
   * A cinder landing is not the only landing worth hearing. Fired for every
   * symbol as its column stops, with the column index, so the caller can play a
   * reel-stop click that rises across the board.
   */
  onReelStop: ((col: number) => void) | null = null;

  /**
   * Free-running spin, started the instant the player presses the button and
   * kept turning until the outcome arrives.
   *
   * The reference implementation (Stake Engine's own web SDK,
   * `createReelForSpinning`) loops the reels in `preSpinSlideDownLoop` while
   * `isPreSpinning`, i.e. WHILE THE SERVER REQUEST IS IN FLIGHT. Ours waited
   * for the response and only then began to move, so every click was followed
   * by 100-400ms of a completely still board on a real connection. That dead
   * air is most of why the game does not feel like a game.
   */
  private free = { on: false, off: 0, v: 0, t: 0 };
  /** One symbol-pitch per this many ms at full speed. */
  private static readonly SPIN_MS_PER_SYMBOL = 42;
  /** Wind-up: the strip lifts before it drops, like a lever being pulled. */
  private static readonly WIND_MS = 120;

  constructor(cols: number, rows: number, cell: number, gap: number, gapX: number,
              getTexture?: TextureProvider, getWinLoop?: WinLoopProvider,
              private font: GlyphFont | null = null) {
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
    for (let c = 0; c < cols; c++) {
      const sp = new SymbolSprite(cell, getTexture, getWinLoop);
      sp.position.set(gapX + c * (cell + gapX), 0);
      sp.visible = false;
      this.spare.push(sp);
      this.symbolLayer.addChild(sp);
    }
    this.wrapAt = Array.from({ length: cols }, () => new Array<number>(rows + 1).fill(0));
    this.buildPosts(w, h);
    this.addChild(this.posts, this.links);
  }

  /** A pooled callout, parented above everything on the board. */
  private callout(i: number): GlyphText {
    while (this.callouts.length <= i) {
      const t = new GlyphText(this.font, {
        size: Math.round(this.cell * 0.32), tint: 0xfff0c4,
        align: 'center', letterSpacing: 2,
      });
      t.visible = false;
      this.callouts.push(t);
      this.addChild(t);
    }
    return this.callouts[i];
  }

  /**
   * The strip for one column, top to bottom: the spare sits at index 0, one
   * slot ABOVE the window, and the visible rows follow. Slot i sits at
   * `gap + (i - 1) * (cell + gap)` when the strip is at rest.
   */
  private strip(c: number): SymbolSprite[] {
    const out: SymbolSprite[] = [this.spare[c]];
    for (let r = 0; r < this.rows; r++) out.push(this.at(r, c));
    return out;
  }

  /**
   * Start the reels NOW, with no outcome in hand.
   *
   * Returns immediately. `reveal` picks up from wherever the strip has got to,
   * so the request latency is spent spinning instead of standing still.
   */
  beginSpin(reduced: boolean): void {
    if (reduced || this.free.on) return;
    this.free = { on: true, off: 0, v: 0, t: 0 };
    for (let c = 0; c < this.cols; c++) {
      for (const sp of this.strip(c)) { sp.visible = true; sp.alpha = 1; }
    }
  }

  /** True while the reels are turning with no result yet. */
  get spinning(): boolean { return this.free.on; }

  /**
   * Stop a free spin that will never receive an outcome — a refused bet, a
   * network failure. The reels must not be left turning over a round that is
   * not happening, and the board goes back to whatever it was showing.
   */
  abortSpin(): void {
    if (!this.free.on) return;
    this.free.on = false;
    for (const sp of this.spare) { sp.visible = false; sp.setBlur(0); }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const sp = this.at(r, c);
        sp.setBlur(0); sp.scale.set(1); sp.alpha = 1;
        const home = this.homeOf(r, c);
        sp.x = home.x; sp.y = home.y;
      }
    }
  }

  private get pitch(): number { return this.cell + this.gap; }
  private get turn(): number { return (this.rows + 1) * this.pitch; }
  private get vMax(): number { return this.pitch / BoardView.SPIN_MS_PER_SYMBOL; }

  /**
   * One frame of the free spin: a short wind-UP, then acceleration to full
   * speed, then a wrapping strip under motion blur.
   */
  private advanceFree(dt: number): void {
    const f = this.free;
    f.t += dt * 1000;
    const W = BoardView.WIND_MS;
    if (f.t < W) {
      // the lever pulls back before it releases — the strip rises a little
      const k = Math.sin((f.t / W) * Math.PI);
      f.off = -this.pitch * 0.14 * k;
      this.placeStrips(f.off, 0.15 * k, true);
      return;
    }
    const ramp = Math.min(1, (f.t - W) / 170);
    f.v = this.vMax * ramp;
    f.off += f.v * dt * 1000;
    this.placeStrips(f.off, ramp, true);
  }

  /**
   * Lay every column's strip out at a shared offset. `randomise` re-faces a
   * symbol as it wraps around the top, which is what makes a five-sprite strip
   * read as an endless reel.
   */
  private placeStrips(off: number, blur: number, randomise: boolean): void {
    const { rows, gap } = this;
    const P = this.turn;
    for (let c = 0; c < this.cols; c++) {
      const st = this.strip(c);
      for (let i = 0; i <= rows; i++) {
        const pos = ((i * this.pitch + off) % P + P) % P;
        if (randomise && pos < this.wrapAt[c][i]) {
          st[i].setSymbol(BoardView.STRIP[(Math.random() * BoardView.STRIP.length) | 0]);
        }
        this.wrapAt[c][i] = pos;
        st[i].y = gap + pos - this.pitch;
        st[i].setBlur(blur);
      }
    }
  }

  /** Last wrap position per strip slot, so a wrap can be detected. */
  private wrapAt: number[][] = [];

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
    for (const sp of this.cells) { sp.tickWin(dt); sp.tickSpecial(dt, reduced); }
    for (const sp of this.spare) sp.tickSpecial(dt, reduced);
    if (this.free.on) { this.advanceFree(dt); return; }
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
   * THE SPIN.
   *
   * What was here before moved the final symbols in from above with a column
   * stagger. It was not a spin: the board the player was about to see was
   * already decided AND already on screen, sliding down. A slot spins because
   * the reel is a continuous strip running past a window fast enough to blur,
   * and because it STOPS one column at a time — that stop, repeated six times,
   * is the entire rhythm of the game. Without it there is no anticipation to
   * build on and nothing for a scatter to interrupt.
   *
   * So: accelerate, run a wrapping strip under motion blur, then land each
   * column in turn with an overshoot. `holdFrom` keeps the last columns
   * spinning far longer, which is the deliberate slowing every slot uses when
   * the reels still running could complete a trigger. It is driven by the
   * scatter count already in the event stream, so it never promises something
   * the round cannot deliver.
   *
   * Reduced motion — and the frame-rate guard, which routes through the same
   * flag — collapses this to one short move. It must not delete it: a board
   * that appears in a single frame is the exact failure this method exists to
   * fix, and the weakest devices would be the only ones still getting it.
   */
  async reveal(board: Board, ctx: AnimCtx, holdFrom = -1): Promise<void> {
    if (ctx.reduced) { this.free.on = false; await this.briskReveal(board, ctx); return; }

    const { cols, rows, gap } = this;
    const pitch = this.pitch;
    const held = (c: number) => holdFrom >= 0 && c >= holdFrom;

    // Timings taken from the reference implementation and converted to our
    // pitch: 145ms between reel stops, a 1.2-pitch run-in, a 0.3-pitch
    // overshoot eased back, and an anticipated reel running roughly ten reel
    // lengths further than a normal one rather than the half-second we had.
    const STAGGER = 145;
    const HOLD = 1500;
    const STOP = 340;
    const LEAD = pitch * 1.2;
    const BOUNCE = pitch * 0.3;
    // If the reels are already turning we owe the player no run-up; if this is
    // a replay with no pre-spin (a resumed round) we still need a short one.
    const warm = this.free.on;
    const RUN = warm ? 120 : 320;

    const stopAt: number[] = [];
    let extra = 0;
    for (let c = 0; c < cols; c++) {
      if (held(c)) extra += HOLD;
      stopAt.push(RUN + c * STAGGER + extra);
    }
    const total = stopAt[cols - 1] + STOP;

    // carry on from wherever the free spin got to, at full speed
    const startOff = this.free.off;
    const v = this.vMax;
    this.free.on = false;

    const landed = new Array<boolean>(cols).fill(false);
    let scatters = 0;
    for (let c = 0; c < cols; c++) {
      for (const sp of this.strip(c)) { sp.visible = true; sp.alpha = 1; }
    }

    await tween({
      duration: total, ease: (x) => x, shouldSkip: ctx.shouldSkip,
      onUpdate: (x) => {
        const now = x * total;
        for (let c = 0; c < cols; c++) {
          if (now < stopAt[c]) {
            const off = startOff + (warm ? v * now : v * now * Math.min(1, now / 200));
            const P = this.turn;
            const st = this.strip(c);
            for (let i = 0; i <= rows; i++) {
              const pos = ((i * pitch + off) % P + P) % P;
              if (pos < this.wrapAt[c][i]) {
                st[i].setSymbol(BoardView.STRIP[
                  (Math.random() * BoardView.STRIP.length) | 0]);
              }
              this.wrapAt[c][i] = pos;
              st[i].y = gap + pos - pitch;
              st[i].setBlur(warm ? 1 : Math.min(1, now / 200));
            }
            continue;
          }
          // First frame past this column's stop time: the outcome goes on the
          // strip, and from here the column is landing, not spinning.
          if (!landed[c]) {
            landed[c] = true;
            this.spare[c].visible = false;
            this.onReelStop?.(c);
            for (let r = 0; r < rows; r++) {
              const sp = this.at(r, c);
              sp.setSymbol(board[r]?.[c] ?? Sym.EMPTY);
              // Each cinder is announced AS IT LANDS, while the reels to its
              // right are still running. Announcing them all at the end would
              // be a summary; one at a time is the build.
              if (sp.sym === Sym.CINDER) {
                scatters++;
                sp.flash();
                const p = this.cellCenter(r, c);
                this.sparks?.(p.x, p.y, 14, 2.6, 0xffb347);
                this.onScatter?.(scatters);
              }
            }
          }
          // Two-stage stop, as the reference does it: run in to an overshoot,
          // then ease back up to home. A single ease-out lands flat; the
          // overshoot plus the slow return is what gives a reel its weight.
          const p = Math.min(1, (now - stopAt[c]) / STOP);
          let k: number;
          if (p < 0.55) {
            k = BOUNCE + LEAD * (1 - easeOutCubic(p / 0.55));
          } else {
            const q = (p - 0.55) / 0.45;
            k = BOUNCE * (1 - Math.sin((q * Math.PI) / 2));
          }
          for (let r = 0; r < rows; r++) {
            const sp = this.at(r, c);
            sp.y = gap + r * pitch + k;
            sp.setBlur(p < 0.55 ? (1 - p / 0.55) * 0.5 : 0);
          }
        }
      },
    });

    // Unconditional: a skip resolves the tween early, and a column left
    // mid-flight would keep a stretched scale and a stale symbol all round.
    this.settleStrips(board);
    // the bottom row carries the impact; bending all thirty would be noise
    await Promise.all(
      Array.from({ length: cols }, (_, c) => this.at(rows - 1, c))
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

  /** Put every cell home, unblurred, holding the outcome. */
  private settleStrips(board: Board): void {
    for (const sp of this.spare) { sp.visible = false; sp.setBlur(0); }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const sp = this.at(r, c);
        sp.setSymbol(board[r]?.[c] ?? Sym.EMPTY);
        sp.setBlur(0);
        sp.scale.set(1);
        sp.alpha = 1;
        const home = this.homeOf(r, c);
        sp.x = home.x; sp.y = home.y;
      }
    }
  }

  /**
   * The reduced-motion path: ONE short move, not a shortened spin.
   *
   * Keeping the stagger and merely cutting the durations still cost ~240ms per
   * spin, and a resumed bonus round replays a hundred of them — the catch-up
   * went from instant to over a minute, which is a hang as far as the player is
   * concerned.
   */
  private async briskReveal(board: Board, ctx: AnimCtx): Promise<void> {
    this.settleStrips(board);
    const travel = this.height2 + this.cell;
    const homes = this.cells.map((sp) => sp.y);
    for (let i = 0; i < this.cells.length; i++) this.cells[i].y = homes[i] - travel;
    await tween({
      duration: 60, ease: easeOutCubic, shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        for (let i = 0; i < this.cells.length; i++) {
          this.cells[i].y = homes[i] - travel * (1 - t);
        }
      },
    });
    for (let i = 0; i < this.cells.length; i++) this.cells[i].y = homes[i];
  }

  /**
   * The scatters that triggered the round fly to the middle and collide.
   *
   * Bonus entry used to be: the board slides away, the room cross-fades, a
   * banner appears. Nothing in that sequence referred to the symbols that
   * actually caused it, so the most important moment in the game had no cause
   * on screen. The cinders now leave the grid as objects, gather, and go off
   * together — which is what every commercial trigger does, because the player
   * has to see WHY.
   *
   * Returns the collision point in board-local coordinates so the caller can
   * put particles and a shockwave there.
   */
  async gatherScatters(ctx: AnimCtx): Promise<{ x: number; y: number }> {
    const cx = this.width2 / 2, cy = this.height2 / 2;
    if (ctx.reduced) return { x: cx, y: cy };
    const found: { sp: SymbolSprite; x: number; y: number }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const sp = this.at(r, c);
        if (sp.sym !== Sym.CINDER) continue;
        found.push({ sp, x: sp.x, y: sp.y });
      }
    }
    if (!found.length) return { x: cx, y: cy };

    // everything that is NOT a scatter recedes, so the cinders are the subject
    const rest = this.cells.filter((sp) => sp.sym !== Sym.CINDER);
    for (const e of found) this.symbolLayer.setChildIndex(e.sp, this.symbolLayer.children.length - 1);

    await tween({
      duration: 380, ease: easeOutCubic, shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        for (const sp of rest) sp.alpha = 1 - 0.75 * t;
        for (const e of found) {
          e.sp.scale.set(1 + 0.45 * t);
          e.sp.rotation = t * 0.6;
        }
        const g = this.links;
        g.clear();
        for (const e of found) {
          g.moveTo(e.x + this.cell / 2, e.y + this.cell / 2).lineTo(cx, cy)
            .stroke({ width: 2 + 5 * t, color: 0xffb457, alpha: 0.7 * t, cap: 'round' });
        }
      },
    });
    await tween({
      duration: 260, ease: (x) => x * x, shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        for (const e of found) {
          e.sp.x = e.x + (cx - this.cell / 2 - e.x) * t;
          e.sp.y = e.y + (cy - this.cell / 2 - e.y) * t;
          e.sp.rotation = 0.6 + t * 2.4;
          e.sp.scale.set(1.45 - 0.5 * t);
        }
        this.links.alpha = 1 - t;
      },
    });
    for (const e of found) {
      e.sp.rotation = 0; e.sp.scale.set(1); e.sp.x = e.x; e.sp.y = e.y;
      e.sp.setSymbol(Sym.EMPTY);
    }
    for (const sp of rest) sp.alpha = 1;
    this.links.clear();
    this.links.alpha = 1;
    return { x: cx, y: cy };
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

  async forge(fusions: Fusion[], ctx: AnimCtx, heat = 1): Promise<void> {
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
      // NO DRAWN CORD.
      //
      // This used to stroke a line from cell to cell along the chain. A line
      // between two symbols is what a payline slot draws, and drawn with
      // Graphics it reads as exactly what it is: a stroke on top of the
      // artwork. The group is a group because the METAL IS HEATED — so the
      // heat is what plays. Each cell in turn goes white-hot, swells, and
      // throws sparks; the eye follows the heat down the chain without a
      // single line being drawn.
      const fired = chains.map((ch) => new Array<boolean>(ch.nodes.length).fill(false));
      await tween({
        duration: 460, shouldSkip: ctx.shouldSkip,
        onUpdate: (t) => {
          const g = this.links;
          g.clear();
          for (let ci = 0; ci < chains.length; ci++) {
            const ch = chains[ci];
            // how far the heat has travelled along this chain, in cells
            const head = t * (ch.nodes.length + 0.6);
            for (let i = 0; i < ch.nodes.length; i++) {
              const lit = Math.max(0, Math.min(1, head - i));
              if (lit <= 0) continue;
              const n = ch.nodes[i];
              n.sp.setHot(lit);
              n.sp.scale.set(1 + 0.18 * Math.sin(lit * Math.PI * 0.9));
              // a pool of heat under the cell, filled rather than outlined
              g.circle(n.p.x, n.p.y, this.cell * (0.34 + 0.26 * lit))
                .fill({ color: 0xff8a1e, alpha: 0.1 + 0.16 * lit });
              g.circle(n.p.x, n.p.y, this.cell * (0.16 + 0.14 * lit))
                .fill({ color: 0xffe6b8, alpha: 0.12 + 0.2 * lit });
              if (!fired[ci][i] && lit > 0.45) {
                fired[ci][i] = true;
                this.sparks?.(n.p.x, n.p.y, 9, 2.2, 0xffb347);
              }
            }
          }
        },
      });
    }

    // ---- 2. DRAW THE CHAIN INTO THE ANCHOR --------------------------------
    // The count rides the pull-in, so the number the player reads is on screen
    // at the exact moment the cells disappear into one.
    const tags = fusions.map((f, i) => {
      const t = this.callout(i);
      t.text = `×${f.cells.length + f.wildCells.length}`;
      const p = this.cellCenter(f.anchor[0], f.anchor[1]);
      // A callout is centre-aligned, so an anchor in the first or last column
      // would hang half of it outside the reel window. Clamped to the BOARD,
      // not to the cell — the label belongs to the group, not to one square.
      const halfTag = Math.max(this.cell * 0.6, t.contentWidth / 2 + this.cell * 0.1);
      t.position.set(
        Math.max(halfTag, Math.min(this.width2 - halfTag, p.x)),
        Math.max(this.cell * 0.5, p.y - this.cell * 0.5));
      t.visible = !ctx.reduced;
      t.alpha = 0;
      return t;
    });
    await tween({
      duration: ctx.reduced ? 90 : 300, ease: easeOutCubic,
      shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        for (const tag of tags) {
          tag.alpha = Math.min(1, t * 2.2);
          tag.scale.set(0.7 + 0.5 * easeOutBack(Math.min(1, t * 1.6)));
        }
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
      all[i].sp.setHot(0);
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
            // a expanding shell of light, not an outline: two filled discs with
            // the inner one punched back out by the background is not available
            // in Graphics, so this is a wide soft band that thins as it grows
            g.circle(r.p.x, r.p.y, rad)
              .stroke({ width: this.cell * 0.3 * (1 - t) ** 1.6,
                color: 0xffd98a, alpha: 0.55 * (1 - t) });
            g.circle(r.p.x, r.p.y, rad * 0.86)
              .fill({ color: 0xff8a1e, alpha: 0.1 * (1 - t) });
          }
        },
      }).then(() => this.links.clear());
    }
    // The count becomes the NAME of what was made and WHAT IT PAID, in the same
    // place, so the whole sentence reads itself: five cells went in, an iron
    // came out, it credited 1.35x. Without the money the player can see that
    // something combined and still have no idea whether it mattered — which is
    // exactly the complaint. `value` is the base paytable amount; Heat is the
    // multiplier applied at the instant it is forged, so the product of the two
    // is the number that actually reached the balance.
    for (let i = 0; i < fusions.length; i++) {
      const paid = fusions[i].value * heat;
      tags[i].text = `${symStyle(fusions[i].to).name} ${paid.toFixed(2)}×`;
    }
    await tween({
      duration: ctx.reduced ? 80 : 320, ease: easeOutBack,
      shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        for (const sp of anchors) sp.scale.set(0.2 + 0.8 * t);
        for (const tag of tags) { tag.alpha = 1; tag.scale.set(0.8 + 0.32 * t); }
      },
    });
    // the product is struck hardest — this is the hammer blow of the round
    await Promise.all(anchors.map((sp) => this.land(sp, 0.85, ctx)));
    await tween({
      duration: ctx.reduced ? 40 : 300, shouldSkip: ctx.shouldSkip,
      onUpdate: (t) => {
        for (const tag of tags) { tag.alpha = 1 - t; tag.y -= this.cell * 0.012; }
      },
    });
    for (const tag of tags) tag.visible = false;
  }

  /**
   * THE VEIN pays: light the run from the seam down to the crucible, then
   * drain it.
   *
   * The whole animation is one idea, because the mechanic is one idea. Ore does
   * not "combine" here — a run of it that reaches all the way down is a channel,
   * and what a channel does is CARRY. So the light starts at the top cell and
   * travels down the path in order, each cell going white-hot as the flow
   * reaches it; when it arrives at the crucible the vein is fully lit and drains
   * out of the bottom. No lines are drawn between cells: the cells themselves
   * ARE the line, which is the entire point of the mechanic.
   */
  async strike(veins: Vein[], ctx: AnimCtx, heat = 1): Promise<void> {
    if (!veins.length) return;
    // Order each vein by ROW so the flow runs seam-to-crucible rather than in
    // whatever order the solver happened to walk the flood.
    const paths = veins.map((v) => {
      const cells = [...v.cells, ...v.wildCells]
        .slice()
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return { v, cells, sprites: cells.map(([r, c]) => this.at(r, c)) };
    });
    const lit = paths.map((p) => new Array<boolean>(p.cells.length).fill(false));

    if (!ctx.reduced) {
      // everything not in a vein recedes, so the channel is the only thing lit
      const inVein = new Set<number>();
      for (const p of paths) for (const [r, c] of p.cells) inVein.add(r * this.cols + c);
      const rest = this.cells.filter((_, i) => !inVein.has(i));

      const tags = paths.map((p, i) => {
        const t = this.callout(i);
        t.text = `${p.v.columns} KOLUMN`;
        const mid = p.cells[Math.floor(p.cells.length / 2)];
        const q = this.cellCenter(mid[0], mid[1]);
        const half = Math.max(this.cell * 0.6, t.contentWidth / 2 + this.cell * 0.1);
        t.position.set(Math.max(half, Math.min(this.width2 - half, q.x)), q.y);
        t.visible = true; t.alpha = 0;
        return t;
      });

      await tween({
        duration: 520, shouldSkip: ctx.shouldSkip,
        onUpdate: (t) => {
          const g = this.links;
          g.clear();
          for (const sp of rest) sp.alpha = 1 - 0.62 * Math.min(1, t * 2);
          for (let i = 0; i < paths.length; i++) {
            const p = paths[i];
            const head = t * (p.cells.length + 0.5);
            for (let k = 0; k < p.cells.length; k++) {
              const flow = Math.max(0, Math.min(1, head - k));
              if (flow <= 0) continue;
              p.sprites[k].setHot(flow);
              p.sprites[k].scale.set(1 + 0.14 * Math.sin(flow * Math.PI * 0.9));
              const q = this.cellCenter(p.cells[k][0], p.cells[k][1]);
              g.circle(q.x, q.y, this.cell * (0.3 + 0.24 * flow))
                .fill({ color: 0xff8a1e, alpha: 0.1 + 0.18 * flow });
              if (!lit[i][k] && flow > 0.5) {
                lit[i][k] = true;
                this.sparks?.(q.x, q.y, 7, 2.0, 0xffb347);
              }
            }
            tags[i].alpha = Math.min(1, t * 2.4);
            tags[i].scale.set(0.75 + 0.4 * easeOutBack(Math.min(1, t * 1.5)));
          }
        },
      });
      for (let i = 0; i < paths.length; i++) {
        tags[i].text = `${(paths[i].v.value * heat).toFixed(2)}×`;
      }
      // the channel drains: the run empties downward out of the crucible
      await tween({
        duration: 360, ease: easeOutCubic, shouldSkip: ctx.shouldSkip,
        onUpdate: (t) => {
          this.links.alpha = 1 - t;
          for (const p of paths) {
            for (let k = 0; k < p.sprites.length; k++) {
              const sp = p.sprites[k];
              // lower cells leave first, so the vein empties from the bottom
              const lag = 1 - k / Math.max(1, p.sprites.length - 1);
              const local = Math.max(0, Math.min(1, t * 1.6 - lag * 0.5));
              sp.y += this.cell * 0.055 * local;
              sp.alpha = 1 - local;
            }
          }
          for (const tag of tags) { tag.alpha = 1 - t * 0.6; tag.y -= this.cell * 0.008; }
        },
      });
      for (const tag of tags) tag.visible = false;
      for (const sp of rest) sp.alpha = 1;
    }

    // Unconditional: a skip resolves the tweens early and a cell left mid-drain
    // would keep a stale offset and a hot tint for the rest of the round.
    this.links.clear();
    this.links.alpha = 1;
    for (const p of paths) {
      for (let k = 0; k < p.sprites.length; k++) {
        const sp = p.sprites[k];
        sp.setHot(0); sp.scale.set(1); sp.alpha = 1;
        const home = this.homeOf(p.cells[k][0], p.cells[k][1]);
        sp.x = home.x; sp.y = home.y;
        sp.setSymbol(Sym.EMPTY);
      }
    }
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
