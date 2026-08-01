/**
 * PixiPresenter — production renderer implementing the Presenter contract on top
 * of PixiJS v8. Consumes the event stream from BookPlayer and animates it. Holds
 * NO game maths. Symbol artwork comes from the texture atlas (see ART_BIBLE.md);
 * a procedural fallback keeps the game runnable without binary assets.
 */
import { Application, Container, Sprite } from 'pixi.js';
import type { Presenter } from '../game/Presenter';
import type { Board, Fusion, Relic, Spawned, SpinKind } from '../types/events';
import { Sym } from '../types/events';
import { BoardView } from './BoardView';
import { HeatMeter } from './HeatMeter';
import { WinBanner, tierName } from './WinBanner';
import { computeLayout, GAP_X_FRAC, GAP_Y_FRAC } from './Layout';
import { THEME } from './palette';
import { tween, wait } from './tween';
import { Particles } from './Particles';
import { CoinShower, shake } from './juice';
import { HeatHazeFilter, ShimmerFilter, ChromaticFilter } from './filters';
import { Background, type SceneTextures } from './Background';
import { ReelFrame, BAND_FRAC } from './ReelFrame';
import { Smith } from './Smith';
import { Toast } from './Toast';
import { Camera } from './Camera';
import type { AudioManager } from '../audio/AudioManager';
import type { TextureProvider, WinLoopProvider } from './SymbolSprite';
import { GlyphFont, GlyphText } from './GlyphText';
import { UiPanel, type UiCallbacks } from './UiPanel';
import type { Texture } from 'pixi.js';

export interface PresenterAssets {
  getTexture?: TextureProvider;
  getWinLoop?: WinLoopProvider;
  scenes?: SceneTextures;
  character?: Texture | null;
  font?: GlyphFont | null;
  logo?: Texture | null;
  ui?: UiCallbacks;
}

const COLS = 6, ROWS = 5, BASE_CELL = 96;
/**
 * Board-local gutters. The world container is scaled by `cell / BASE_CELL`, so
 * these have to be the SAME fractions of the cell that `computeLayout` reserves
 * — otherwise the space bought for the board and the space the board occupies
 * drift apart and the housing creeps off the stage on one axis.
 */
const BASE_GAP = Math.round(BASE_CELL * GAP_Y_FRAC);
const BASE_GAP_X = Math.round(BASE_CELL * GAP_X_FRAC);
/**
 * Housing thickness in BOARD-LOCAL units. The world container is scaled by
 * `cell / BASE_CELL`, so a constant here is a constant fraction of the cell on
 * screen — which is exactly what `computeLayout` reserves for it.
 */
const BASE_BAND = Math.round(BASE_CELL * BAND_FRAC);
const HEAT_CAP: Record<SpinKind, number> = { base: 25, free: 100, super: 10 };

export class PixiPresenter implements Presenter {
  private bg: Background;
  private world = new Container();
  private smith: Smith | null = null;
  private smithHolder = new Container();
  private frame: ReelFrame;
  private logo: Sprite | null = null;
  private board: BoardView;
  private heatMeter: HeatMeter;
  private banner: WinBanner;
  private fx = new Particles();
  private coins = new CoinShower();
  private haze = new HeatHazeFilter(0);
  private shimmer = new ShimmerFilter();
  private chroma = new ChromaticFilter();
  private hud = new Container();
  private toastView: Toast;
  private lblMode: GlyphText; private lblSpins: GlyphText; private lblVault: GlyphText;
  private lblSpinWin: GlyphText; private lblTotal: GlyphText;
  /** In-canvas control bar. Null only when no UI callbacks were supplied. */
  panel: UiPanel | null = null;

  skip = false;
  private motionOff = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /**
   * Set by the frame-rate guard when the device cannot keep up. Folded into
   * `reduced` so every effect already gated on the accessibility preference is
   * gated on the performance floor too, without a second flag threaded through
   * forty call sites. Kept separate from `motionOff` because the app re-asserts
   * the player's own preference after a round and must not clear this.
   */
  lowPower = false;
  get reduced(): boolean { return this.motionOff || this.lowPower; }
  set reduced(v: boolean) { this.motionOff = v; }
  private kind: SpinKind = 'base';
  /** Which filters are currently ATTACHED — see `syncFilters`. */
  private attached = { haze: false, shimmer: false, chroma: false };
  /**
   * The shot. Previously the scene never moved: a dead spin and a max win were
   * framed identically, which is the difference between watching a game and
   * watching a screen. Costs no artwork.
   */
  private cam: Camera;

  constructor(private app: Application, private audio?: AudioManager,
              assets: PresenterAssets = {}) {
    this.bg = new Background(assets.scenes ?? {});
    this.board = new BoardView(COLS, ROWS, BASE_CELL, BASE_GAP, BASE_GAP_X,
      assets.getTexture, assets.getWinLoop, assets.font ?? null);
    if (assets.character) {
      this.smith = new Smith(assets.character);
      this.smithHolder.addChild(this.smith);
    }
    this.banner = new WinBanner(assets.font ?? null);
    this.toastView = new Toast(assets.font ?? null);
    // The gauge is MACHINED INTO the cabinet's bottom rail — see
    // `ReelFrame.gaugeSlot`. Below the housing it read as a stray progress bar
    // that happened to be near the game, and it cost the grid a 6% strip of
    // stage height for the privilege.
    this.heatMeter = new HeatMeter(this.board.width2, 14, assets.font ?? null);
    // The housing lives in the same scaled container as the grid and is drawn
    // in board-local coordinates, so it tracks every layout for free.
    this.cam = new Camera(this.world);
    this.frame = new ReelFrame(assets.font ?? null);
    this.world.addChild(this.frame, this.heatMeter, this.board, this.fx);
    if (assets.logo) {
      this.logo = new Sprite(assets.logo);
      this.logo.anchor.set(0.5, 0);
    }

    // The authored face is preferred, but nothing here REQUIRES it: GlyphText
    // falls back to a system-font Text, so a missing font.png costs typography
    // and never the control bar. Losing every button to one 404 is exactly the
    // failure mode that makes a live game look dead.
    const font = assets.font ?? null;
    const mk = (size: number, tint: number, align: 'left' | 'right' = 'left') =>
      new GlyphText(font, { size, tint, align, letterSpacing: 1.5 });
    this.lblMode = mk(14, THEME.amber2);
    this.lblSpins = mk(13, THEME.txt, 'right');
    this.lblVault = mk(13, THEME.teal, 'right');
    this.lblSpinWin = mk(13, THEME.gold, 'right');
    this.lblTotal = mk(19, THEME.txt);
    this.hud.addChild(this.lblMode, this.lblSpins, this.lblVault, this.lblSpinWin,
      this.lblTotal);
    if (assets.ui) this.panel = new UiPanel(font, assets.ui);

    // Heat haze distorts the room; shimmer sweeps the grid; chromatic
    // aberration is an impact accent on the whole stage. They are attached
    // ON DEMAND — see `syncFilters`.
    // The corner HUD is GONE. It printed BASE / TOTAL / WIN in the two top
    // corners in a thin face — every one of those numbers is already in the
    // control bar, so all it did was read as a debug overlay and steal 14% of
    // the stage height from the board. The band it occupied now belongs to the
    // grid, which is the thing the player is actually looking at.
    app.stage.addChild(this.bg, this.smithHolder, this.world, this.coins);
    this.hud.visible = false;
    if (this.logo) app.stage.addChild(this.logo);
    if (this.panel) app.stage.addChild(this.panel);
    app.stage.addChild(this.banner, this.toastView);

    // the board knows WHERE things happen; the presenter owns what it can draw
    // with, so the emitter and the scatter beat are handed over here
    this.board.sparks = (x, y, n, speed, color) => {
      this.fx.enabled = !this.reduced;
      this.fx.burst(x, y, n, speed, color);
    };
    this.board.onScatter = (count) => this.scatterLanded(count);

    this.frame.layout(this.board.width2, this.board.height2, BASE_GAP, BASE_BAND);
    this.frame.setTitle('THE DEEPFORGE');
    const slot = this.frame.gaugeSlot();
    this.heatMeter.position.set(slot.x, slot.y);
    this.heatMeter.layout(slot.w, slot.h);

    // NOTE: no pointer parallax. Tying the room to the cursor made the whole
    // scene twitch under every mouse move — distracting during play, and it
    // read as the game reacting to the wrong thing while the controls sat
    // still. Ambient drift alone carries the depth.
    app.stage.eventMode = 'static';

    this.resize(app.renderer.width, app.renderer.height);
    this.showIdleBoard();

    // one ticker drives the rig and the background drift
    let elapsed = 0;
    app.ticker.add((ticker) => {
      const dt = ticker.deltaMS / 1000;
      elapsed += dt;
      if (!this.reduced) {
        this.bg.drift(elapsed);
        this.haze.advance(dt);
        this.shimmer.advance(dt);
      }
      this.smith?.update(dt);
      this.toastView.update();
      this.cam.update(dt, this.reduced);
      this.board.tickIdle(elapsed, this.reduced, dt);
      this.syncFilters();
    });
  }

  /**
   * Attach each filter only while it is actually doing something.
   *
   * A filter on a container is not free when its uniform is zero: Pixi still
   * renders that subtree into an offscreen texture, runs the shader over every
   * pixel and blits the result back. `stage.filters` did that for the ENTIRE
   * scene on every frame, so an idle game — which is where a slot spends most
   * of its life — was paying for three full-screen render-target round trips
   * to display nothing. Profiling an idle frame put 99.9% of it outside JS, in
   * rasterisation, and the cost tracked canvas area exactly.
   *
   * The booleans mean this assigns only on a transition; `Container.filters`
   * adds/removes the effect and marks the render group as changed, which is
   * not something to do sixty times a second for no reason.
   */
  private syncFilters(): void {
    const want = {
      haze: !this.reduced && this.haze.strength > 0.01,
      shimmer: !this.reduced && this.shimmer.strength > 0.001,
      chroma: !this.reduced && this.chroma.amount > 0.001,
    };
    if (want.haze !== this.attached.haze) {
      this.bg.filters = want.haze ? [this.haze] : null;
      this.attached.haze = want.haze;
    }
    if (want.shimmer !== this.attached.shimmer) {
      this.world.filters = want.shimmer ? [this.shimmer] : null;
      this.attached.shimmer = want.shimmer;
    }
    if (want.chroma !== this.attached.chroma) {
      this.app.stage.filters = want.chroma ? [this.chroma] : null;
      this.attached.chroma = want.chroma;
    }
  }

  /**
   * The attract board — what the player sees before the first spin, and what a
   * lobby thumbnail captures.
   *
   * This used to be thirty ore cells. Every low symbol in this game is the same
   * silhouette in a different hue, so a grid of nothing but ore read as a
   * match-three puzzle rather than as a forge slot: no relics, no wild, no
   * scatter, none of the artwork the game is actually about. It is now
   * AUTHORED — a fixed arrangement that shows the range of the set and puts the
   * crown near the middle — because the one frame guaranteed to be seen is the
   * one worth composing by hand. It is presentation only; the first real board
   * replaces it and no outcome is implied.
   */
  showIdleBoard(): void {
    const { O1: a, O2: b, O3: c, O4: d, O5: e } = Sym;
    const board: Board = [
      [a, Sym.IRON, c, Sym.GOLD, b, e],
      [Sym.BRONZE, d, Sym.CROWN, a, Sym.SILVER, c],
      [b, e, Sym.FLUX, Sym.MYTHRIL, d, Sym.BRONZE],
      [Sym.SILVER, c, a, e, Sym.CINDER, b],
      [d, Sym.GOLD, b, Sym.IRON, a, d],
    ];
    this.board.setBoard(board);
    this.lblTotal.text = 'TOTAL 0.00×';
    this.lblSpinWin.text = 'WIN 0.00×';
  }

  private get ctx() { return { shouldSkip: () => this.skip, reduced: this.reduced }; }

  /** Sweep the shimmer band across the grid once. */
  private flashShimmer(peak: number): void {
    if (this.reduced) { this.shimmer.strength = 0; return; }
    void tween({
      duration: 520, shouldSkip: () => this.skip,
      onUpdate: (t) => { this.shimmer.strength = Math.sin(t * Math.PI) * peak; },
    }).then(() => { this.shimmer.strength = 0; });
  }

  /** Radial RGB split as an impact accent. */
  private flashChroma(peak: number, duration: number): void {
    if (this.reduced) { this.chroma.amount = 0; return; }
    void tween({
      duration, shouldSkip: () => this.skip,
      onUpdate: (t) => { this.chroma.amount = (1 - t) ** 2 * peak; },
    }).then(() => { this.chroma.amount = 0; });
  }

  /** Heat drives how hard the room shimmers — the forge visibly cooks. */
  private setHazeFromHeat(heat: number, cap: number): void {
    const t = Math.min(1, heat / cap);
    this.haze.strength = this.reduced ? 0 : t * 1.6 + 0.25;
    // the housing runs hot too, so the frame is part of the round, not furniture
    this.frame.setHeat(t);
  }

  resize(w: number, h: number): void {
    // the control bar owns the bottom of the stage; the board gets what is left
    const panelH = this.panel ? this.panel.layout(w, h) : 0;
    const playH = h - panelH;
    // the room composes inside the PLAY area, so the floor and the braziers are
    // not buried behind the control bar
    this.bg.resize(w, playH, h);

    // the housing is drawn outside the board rect, so the layout has to buy
    // that space back out of the available area
    const lay = computeLayout(w, playH, COLS, ROWS, BAND_FRAC);
    const scale = lay.cell / BASE_CELL;
    // Layout decides the framing; the camera adds to it every frame.
    this.cam.setBase(scale, lay.boardX, lay.boardY,
      this.board.width2, this.board.height2);

    // the glyph face draws upward from its baseline, so the top row needs a
    // full line of clearance or the caps are cut off by the stage edge
    const pad = Math.round(Math.min(w, playH) * 0.05);
    const top = Math.max(20, pad * 0.75);
    this.lblMode.position.set(pad, top);
    this.lblTotal.position.set(pad, top + 28);
    this.lblSpinWin.position.set(w - pad, top);
    this.lblSpins.position.set(w - pad, top + 22);
    this.lblVault.position.set(w - pad, top + 42);
    // point the room's lighting at the cabinet, not at the middle of the screen
    this.bg.focus(lay.boardX + lay.boardW / 2, lay.boardY + lay.boardH / 2,
      lay.boardW + lay.band * 2, lay.boardH + lay.band * 2);
    this.banner.resize(w, playH);
    this.toastView.resize(w, playH);
    this.placeSmith(w, playH, lay.boardX, lay.boardY, lay.boardH);
    this.placeLogo(w, playH, lay.boardX, lay.boardY);
  }

  /**
   * The wordmark. On a wide stage it lives IN THE SCENE beside the board; in
   * portrait it falls back to the band above the housing.
   */
  private placeLogo(w: number, h: number, boardX: number, boardY: number): void {
    if (!this.logo) return;
    const tex = this.logo.texture;
    const scale = this.world.scale.x;
    // everything above the cartouche, which itself sits above the housing
    const bandTop = boardY - (BASE_BAND * 1.9) * scale;
    const pad = 6;

    // WIDE: out in the left gutter, over the room — which is where reference
    // layouts put it. Squeezing the wordmark into a reserved strip above the
    // board made it small AND cost the grid the strip; out here it can be three
    // times the size and costs the board nothing.
    const gutter = boardX;
    if (w >= 900 && gutter > w * 0.15) {
      const maxH = Math.min(h * 0.2, 168);
      const s = Math.min(maxH / tex.height, (gutter * 0.94) / tex.width);
      this.logo.visible = true;
      this.logo.scale.set(s);
      this.logo.position.set(gutter * 0.5, Math.max(pad, h * 0.03));
      return;
    }

    // PORTRAIT: no side room, so it goes back above the housing and has to fit
    // inside that band on BOTH axes — sizing off stage height instead let the
    // wordmark grow past its room and get guillotined by the stage edge.
    const maxH = bandTop - pad * 2;
    if (maxH < 22) { this.logo.visible = false; return; }
    this.logo.visible = true;
    const s = Math.min(maxH / tex.height, (w * 0.58) / tex.width);
    this.logo.scale.set(s);
    this.logo.position.set(w / 2, pad + (maxH - tex.height * s) / 2);
  }

  /**
   * The smith stands at the forge beside the board. On narrow portrait screens
   * there is no side room, so he stands down entirely rather than being squeezed
   * on top of the grid.
   */
  private placeSmith(w: number, h: number, boardX: number, boardY: number,
                     boardH: number): void {
    if (!this.smith) return;
    // He is set dressing: he must never crowd the grid or be clipped. He only
    // appears when the gutter beside the board is genuinely wide enough.
    const sideRoom = boardX;
    const wide = sideRoom > w * 0.13;
    this.smith.visible = wide;
    if (!wide) return;

    // He is a hero illustration, not a background prop.
    //
    // He was sized to fit ENTIRELY inside the gutter beside the board, which on
    // any normal aspect ratio meant a small dark figure pressed against the
    // stage edge. Reference compositions run their character at well over half
    // the frame height and let him OVERLAP the reel housing — he sits behind it
    // in the display list, so the overlap reads as depth rather than clutter,
    // and it is the overlap that makes him part of the scene instead of a
    // sticker beside it.
    const byHeight = (h * 0.6) / this.smith.artHeight;
    // 1.15, not 1.3: he is centred at 0.56 of the gutter, so this overlaps the
    // housing on his right while keeping his far shoulder inside the stage —
    // a character clipped by the window edge is a mistake, one clipped by the
    // cabinet is composition
    const byWidth = (sideRoom * 1.15) / this.smith.artWidth;
    this.smith.scale.set(Math.min(byHeight, byWidth));
    // anchored at the feet, so this is where he STANDS: on the foreground ledge,
    // a little below the board's bottom line
    this.smith.position.set(sideRoom * 0.56,
      Math.min(h * 0.95, boardY + boardH * 1.02));
  }

  // --- Presenter contract --------------------------------------------------
  async revealBoard(board: Board, heat: number, kind: SpinKind, scatters: number): Promise<void> {
    this.kind = kind;
    this.heatMeter.setCap(HEAT_CAP[kind]); this.heatMeter.reset(heat);
    this.lblSpinWin.text = 'WIN 0.00×';
    this.panel?.setWin('0.00×');
    this.audio?.stinger('spin', 'sfx_spin');
    this.audio?.setHeatIntensity(heat, HEAT_CAP[kind]);
    this.setHazeFromHeat(heat, HEAT_CAP[kind]);
    // Two scatters already on the board means the columns still to arrive can
    // finish a trigger, so they are held. Three or more and it is already done
    // — dragging it out then would be suspense about nothing.
    this.anticipating = scatters === 2;
    const holdFrom = this.anticipating ? COLS - 2 : -1;
    // the cartouche carries the live cinder count during the spin; put the
    // round's name back afterwards so it is never left showing a stale tally
    this.frame.setTitle(this.roundTitle);
    await this.board.reveal(board, this.ctx, holdFrom);
    if (scatters < PixiPresenter.NEEDED) this.frame.setTitle(this.roundTitle);
  }

  /** Set while a reveal is deliberately holding its last columns. */
  private anticipating = false;
  /** How many cinders are needed to open the forge. Presentation only. */
  private static readonly NEEDED = 3;
  /**
   * What the cartouche says when it is not counting cinders. Tracked because
   * the live tally borrows that plaque during a spin and has to give it back.
   */
  private roundTitle = 'THE DEEPFORGE';

  /**
   * A cinder just landed, while the reels to its right are still running.
   *
   * Measured over 30,000 base books, 30.1% of spins put at least one cinder on
   * the board and 4.2% put two — and NOTHING on screen marked either. A symbol
   * that appears on a third of all spins and is never acknowledged is a symbol
   * the player will tell you the game does not have. Each landing now gets its
   * own beat, rising in pitch and weight, and the count goes into the cabinet's
   * cartouche where the round name lives. Two cinders is acknowledged even
   * though it has won nothing, which is standard practice — and it is honest,
   * because it reports a fact about the board rather than implying an outcome.
   */
  private scatterLanded(count: number): void {
    this.audio?.stinger('win', 'sfx_cinder');
    this.cam.kick(2 + count * 2.2);
    this.frame.setTitle(`CINDERS ${count}/${PixiPresenter.NEEDED}`);
    if (count >= PixiPresenter.NEEDED) this.flashChroma(0.45, 520);
  }

  async anticipation(scatters: number, needed: number): Promise<void> {
    this.lblSpinWin.text = `CINDERS ${scatters}/${needed}…`;
    this.audio?.stinger('win', 'sfx_cinder');
    void shake(this.world, 2.5, 420, this.ctx);
    // The reveal already held the last columns; this is the beat on top of it.
    await this.board.anticipate(COLS - 2, this.ctx);
    this.anticipating = false;
  }

  async forge(fusions: Fusion[], heat: number): Promise<void> {
    this.fx.enabled = !this.reduced;
    const biggest = Math.max(...fusions.map((f) => f.cells.length));
    const big = biggest >= 7;
    this.audio?.stinger('forge', big ? 'sfx_forge_big' : 'sfx_forge');
    this.smith?.play('strike');
    this.cam.kick(Math.min(9, 2 + biggest * 0.7));
    await this.board.forge(fusions, this.ctx);
    // the hammer landing: impact scales with the size of the group that fused
    void shake(this.world, big ? 9 : 4.5, big ? 300 : 190, this.ctx);
    // sparks at each forged relic; bigger jumps throw more embers
    for (const f of fusions) {
      const p = this.board.cellCenter(f.anchor[0], f.anchor[1]);
      this.fx.burst(p.x, p.y, 8 + Math.min(16, f.cells.length * 2));
    }
    this.audio?.stinger('heat', 'sfx_heat');
    this.flashShimmer(big ? 0.85 : 0.5);
    this.setHazeFromHeat(heat, HEAT_CAP[this.kind]);
    await this.heatMeter.set(heat, this.ctx);
  }

  async gravity(spawned: Spawned[], board: Board): Promise<void> {
    await this.board.gravity(board, spawned, this.ctx);
  }

  async heat(heat: number): Promise<void> { await this.heatMeter.set(heat, this.ctx); }

  async settleWin(relics: Relic[], _heat: number, win: number): Promise<void> {
    if (win <= 0) return;
    this.lblSpinWin.text = `WIN ${win.toFixed(2)}×`;
    this.panel?.setWin(`${win.toFixed(2)}×`);
    await this.board.celebrate(relics.map((r) => ({ r: r.r, c: r.c })), this.ctx);
    await wait(this.reduced ? 40 : 200, () => this.skip, this.reduced);
  }

  async bonusStart(mode: string, spins: number, kind: SpinKind): Promise<void> {
    this.kind = kind;
    this.heatMeter.setCap(HEAT_CAP[kind]);
    this.lblMode.text = mode === 'molten_core' ? 'MOLTEN CORE' : 'FORGE FURY';
    this.roundTitle = this.lblMode.text;
    this.frame.setTitle(this.roundTitle);
    if (mode === 'molten_core') this.lblVault.text = 'VAULT 0.00×';
    this.lblSpins.text = `SPINS ${spins}`;
    this.audio?.enterState(mode === 'molten_core' ? 'super' : 'bonus');
    const scene = mode === 'molten_core' ? 'super' : 'bonus';

    // A real transition, in order: the old board leaves, the room changes
    // underneath it, the impact lands, then the banner arrives on an empty
    // grid. Previously this was a cross-fade plus a banner over a board that
    // never moved — the round changed and the game did not visibly change with
    // it, which is why entering a bonus felt like nothing had happened.
    // 1. CAUSE. The cinders that triggered this leave the grid as objects and
    //    collide in the middle. Without this the biggest moment in the game had
    //    nothing on screen explaining why it was happening.
    this.cam.to(1.05);
    const hit = await this.board.gatherScatters(this.ctx);
    this.fx.enabled = !this.reduced;
    this.fx.burst(hit.x, hit.y, 26, 3.2, THEME.amber);
    this.cam.kick(mode === 'molten_core' ? 15 : 11);
    this.flashChroma(0.7, 620);
    this.audio?.stinger('win', mode === 'molten_core' ? 'sting_super' : 'sting_bonus');

    // 2. CONSEQUENCE. The old board leaves, the room changes underneath it,
    //    and only then does the banner arrive on an empty grid.
    this.cam.to(0.94);            // pull back — the round is changing shape
    await this.board.sweepOut(this.ctx);
    const room = this.bg.to(scene, this.ctx);
    void shake(this.world, mode === 'molten_core' ? 9 : 6, 520, this.ctx);
    await room;
    this.cam.kick(mode === 'molten_core' ? 14 : 10);
    this.cam.to(1);
    // the count of free spins is the fact the player wants; it goes where the
    // win total goes on a big win, because that is where they are already looking
    await this.banner.show(mode === 'molten_core' ? 'SUPERBONUS' : 'BONUS', 0,
      this.ctx, false, undefined, `${spins} SPINS`);
  }

  async spinCounter(remaining: number, total: number): Promise<void> {
    this.lblSpins.text = `SPIN ${total - remaining}/${total}`;
  }

  async retrigger(added: number, _spins: number): Promise<void> {
    this.audio?.stinger('bonus', 'sfx_retrigger');
    await this.banner.show('RETRIGGER', added, this.ctx);
  }

  async superSeed(board: Board, _minRank: number): Promise<void> {
    this.board.setBoard(board);
    await wait(this.reduced ? 40 : 220, () => this.skip, this.reduced);
  }

  async lockUpdate(_locked: Relic[], vault: number): Promise<void> {
    this.lblVault.text = `VAULT ${vault.toFixed(2)}×`;
    await wait(this.reduced ? 20 : 120, () => this.skip, this.reduced);
  }

  async pour(vault: number, _heat: number, win: number): Promise<void> {
    this.lblVault.text = `VAULT ${vault.toFixed(2)}×`;
    this.audio?.stinger('super', 'sting_pour');
    void shake(this.world, 14, 700, this.ctx);
    this.flashChroma(0.5, 900);
    this.coins.erupt(this.app.renderer.width, this.app.renderer.height, 46);
    // lava spills across the whole grid at the culmination
    this.fx.enabled = !this.reduced;
    for (let c = 0; c < COLS; c++) {
      const p = this.board.cellCenter(0, c);
      this.fx.burst(p.x, p.y, 10, 3.0, THEME.amber);
    }
    await this.banner.show('THE POUR', win, this.ctx);
  }

  async totalWin(totalWin: number): Promise<void> { this.lblTotal.text = `TOTAL ${totalWin.toFixed(2)}×`; }

  async maxWin(): Promise<void> {
    this.audio?.stinger('maxwin', 'sting_maxwin');
    void shake(this.world, 18, 900, this.ctx);
    this.flashChroma(0.85, 1200);
    this.coins.erupt(this.app.renderer.width, this.app.renderer.height, 70);
    this.fx.enabled = !this.reduced;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c += 2) {
        const p = this.board.cellCenter(r, c);
        this.fx.burst(p.x, p.y, 4, 3.4, THEME.gold);
      }
    }
    this.cam.to(1.14);
    this.cam.kick(18);
    await this.banner.show(tierName(15000), 15000, this.ctx, true, {
      onTier: (_name, tier) => {
        this.cam.kick(6 + tier * 3);
        this.coins.erupt(this.app.renderer.width, this.app.renderer.height,
          10 + tier * 10);
      },
    });
    this.cam.reset();
  }

  async finalWin(amount: number): Promise<void> {
    this.lblTotal.text = `TOTAL ${amount.toFixed(2)}×`;
    if (amount >= 20) {
      this.audio?.stinger('bigwin', 'sting_bigwin');
      this.smith?.play('cheer');
      this.coins.erupt(this.app.renderer.width, this.app.renderer.height,
                       amount >= 300 ? 44 : 24);
      void shake(this.world, amount >= 300 ? 10 : 6, 380, this.ctx);
      // push in for the count-up and release after it: the shot itself says
      // this one is bigger, which no amount of banner styling can
      this.cam.to(amount >= 500 ? 1.10 : amount >= 100 ? 1.06 : 1.03);
      // The counter climbs THROUGH the tiers, and the shot climbs with it —
      // each crossing kicks the camera, throws coins and re-stings, so a big
      // win is a sequence of escalating beats rather than one number arriving.
      await this.banner.show(tierName(amount), amount, this.ctx, true, {
        onTier: (_name, tier) => {
          if (tier < 1) return;
          this.cam.kick(4 + tier * 3);
          this.cam.to(1.03 + tier * 0.025);
          this.flashChroma(0.2 + tier * 0.09, 420);
          this.audio?.stinger('bigwin', 'sting_bigwin');
          this.coins.erupt(this.app.renderer.width, this.app.renderer.height,
            8 + tier * 8);
        },
      });
      this.cam.reset();
    }
  }

  async roundEnd(): Promise<void> {
    // the round is over: the forge cools back to its resting scene
    this.roundTitle = 'THE DEEPFORGE';
    this.frame.setTitle(this.roundTitle);
    this.frame.setHeat(0);
    await this.bg.to('base', this.ctx);
  }

  setMode(name: string): void { this.lblMode.text = name.toUpperCase(); }

  /** Player-facing status, drawn on the canvas where the player is looking. */
  toast(message: string): void { this.toastView.show(message); }

  /** Control positions in stage coordinates (see UiPanel.hitPoints). */
  hitPoints(): Record<string, { x: number; y: number }> | null {
    return this.panel?.hitPoints() ?? null;
  }
}
