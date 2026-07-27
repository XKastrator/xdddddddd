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
import { computeLayout } from './Layout';
import { THEME } from './palette';
import { tween, wait } from './tween';
import { Particles } from './Particles';
import { CoinShower, shake } from './juice';
import { HeatHazeFilter, ShimmerFilter, ChromaticFilter } from './filters';
import { Background, type SceneTextures } from './Background';
import { ReelFrame, BAND } from './ReelFrame';
import { Smith } from './Smith';
import { Toast } from './Toast';
import type { AudioManager } from '../audio/AudioManager';
import type { TextureProvider } from './SymbolSprite';
import { GlyphFont, GlyphText } from './GlyphText';
import { UiPanel, type UiCallbacks } from './UiPanel';
import type { Texture } from 'pixi.js';

export interface PresenterAssets {
  getTexture?: TextureProvider;
  scenes?: SceneTextures;
  character?: Texture | null;
  font?: GlyphFont | null;
  logo?: Texture | null;
  ui?: UiCallbacks;
}

const COLS = 6, ROWS = 5, BASE_CELL = 96, BASE_GAP = 8;
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

  constructor(private app: Application, private audio?: AudioManager,
              assets: PresenterAssets = {}) {
    this.bg = new Background(assets.scenes ?? {});
    this.board = new BoardView(COLS, ROWS, BASE_CELL, BASE_GAP, assets.getTexture);
    if (assets.character) {
      this.smith = new Smith(assets.character);
      this.smithHolder.addChild(this.smith);
    }
    this.banner = new WinBanner(assets.font ?? null);
    this.toastView = new Toast(assets.font ?? null);
    this.heatMeter = new HeatMeter(this.board.width2, 14, assets.font ?? null);
    // The gauge moved BELOW the grid: the band above the board now carries the
    // frame's cartouche, and stacking both there made the two fight for the same
    // 30 units. Board-local, so this constant holds at every layout.
    this.heatMeter.position.set(0, this.board.height2 + BASE_GAP * BAND + 14);
    // The housing lives in the same scaled container as the grid and is drawn
    // in board-local coordinates, so it tracks every layout for free.
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
    app.stage.addChild(this.bg, this.smithHolder, this.world, this.coins, this.hud);
    if (this.logo) app.stage.addChild(this.logo);
    if (this.panel) app.stage.addChild(this.panel);
    app.stage.addChild(this.banner, this.toastView);

    this.frame.layout(this.board.width2, this.board.height2, BASE_GAP);
    this.frame.setTitle('THE DEEPFORGE');

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
      this.board.tickIdle(elapsed, this.reduced);
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

  /** Fill the grid with ore before the first spin so the game never looks empty. */
  showIdleBoard(): void {
    const ores = [Sym.O1, Sym.O2, Sym.O3, Sym.O4, Sym.O5];
    const board: Board = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => ores[(r * COLS + c * 3 + r * 2) % ores.length]));
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

    // the housing and the gauge below it are drawn outside the board rect, so
    // the layout has to buy that space back out of the available area
    const lay = computeLayout(w, playH, COLS, ROWS, BAND + 1.5);
    const scale = lay.cell / BASE_CELL;
    this.world.scale.set(scale);
    this.world.position.set(lay.boardX, lay.boardY);

    // the glyph face draws upward from its baseline, so the top row needs a
    // full line of clearance or the caps are cut off by the stage edge
    const pad = Math.round(Math.min(w, playH) * 0.05);
    const top = Math.max(20, pad * 0.75);
    this.lblMode.position.set(pad, top);
    this.lblTotal.position.set(pad, top + 28);
    this.lblSpinWin.position.set(w - pad, top);
    this.lblSpins.position.set(w - pad, top + 22);
    this.lblVault.position.set(w - pad, top + 42);
    this.banner.resize(w, playH);
    this.toastView.resize(w, playH);
    this.placeSmith(w, playH, lay.boardX, lay.boardY, lay.boardH);
    this.placeLogo(w, playH, lay.boardY);
  }

  /**
   * The wordmark sits in the band above the housing. It is sized by the space
   * actually left over rather than by stage width, and it stands down entirely
   * when the board has crowded that band out — a clipped logo is worse than no
   * logo.
   */
  private placeLogo(w: number, h: number, boardY: number): void {
    if (!this.logo) return;
    const tex = this.logo.texture;
    const room = boardY - BAND * 1.6 * (this.world.scale.x * BASE_GAP) - 6;
    const maxH = Math.min(room * 0.82, h * 0.13, 104);
    if (maxH < 26) { this.logo.visible = false; return; }
    this.logo.visible = true;
    const s = Math.min(maxH / tex.height, (w * 0.5) / tex.width);
    this.logo.scale.set(s);
    this.logo.position.set(w / 2, Math.max(2, (room - tex.height * s) / 2));
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

    // He is a hero illustration, not a background prop — size him off the play
    // area and only fall back to the gutter width when that is the tighter
    // constraint, so he stays substantial on wide screens.
    const byHeight = (h * 0.66) / this.smith.artHeight;
    const byWidth = (sideRoom * 0.94) / this.smith.artWidth;
    this.smith.scale.set(Math.min(byHeight, byWidth));
    // anchored at the feet, so this is where he STANDS: on the foreground ledge,
    // a little below the board's bottom line
    this.smith.position.set(sideRoom * 0.5,
      Math.min(h * 0.93, boardY + boardH * 1.02));
  }

  // --- Presenter contract --------------------------------------------------
  async revealBoard(board: Board, heat: number, kind: SpinKind, _scatters: number): Promise<void> {
    this.kind = kind;
    this.heatMeter.setCap(HEAT_CAP[kind]); this.heatMeter.reset(heat);
    this.board.setBoard(board);
    this.lblSpinWin.text = 'WIN 0.00×';
    this.audio?.stinger('spin', 'sfx_spin');
    this.audio?.setHeatIntensity(heat, HEAT_CAP[kind]);
    this.setHazeFromHeat(heat, HEAT_CAP[kind]);
    await wait(this.reduced ? 40 : 220, () => this.skip, this.reduced);
  }

  async anticipation(scatters: number, needed: number): Promise<void> {
    this.lblSpinWin.text = `CINDERS ${scatters}/${needed}…`;
    this.audio?.stinger('win', 'sfx_cinder');
    void shake(this.world, 2.5, 420, this.ctx);
    await wait(this.reduced ? 40 : 300, () => this.skip, this.reduced);
  }

  async forge(fusions: Fusion[], heat: number): Promise<void> {
    this.fx.enabled = !this.reduced;
    const biggest = Math.max(...fusions.map((f) => f.cells.length));
    const big = biggest >= 7;
    this.audio?.stinger('forge', big ? 'sfx_forge_big' : 'sfx_forge');
    this.smith?.play('strike');
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
    await this.board.celebrate(relics.map((r) => ({ r: r.r, c: r.c })), this.ctx);
    await wait(this.reduced ? 40 : 200, () => this.skip, this.reduced);
  }

  async bonusStart(mode: string, spins: number, kind: SpinKind): Promise<void> {
    this.kind = kind;
    this.heatMeter.setCap(HEAT_CAP[kind]);
    this.lblMode.text = mode === 'molten_core' ? 'MOLTEN CORE' : 'FORGE FURY';
    this.frame.setTitle(this.lblMode.text);
    if (mode === 'molten_core') this.lblVault.text = 'VAULT 0.00×';
    this.lblSpins.text = `SPINS ${spins}`;
    this.audio?.enterState(mode === 'molten_core' ? 'super' : 'bonus');
    await this.bg.to(mode === 'molten_core' ? 'super' : 'bonus', this.ctx);
    await this.banner.show(mode === 'molten_core' ? 'SUPERBONUS' : 'BONUS', 0, this.ctx);
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
    await this.banner.show('★ MAX WIN ★', 15000, this.ctx);
  }

  async finalWin(amount: number): Promise<void> {
    this.lblTotal.text = `TOTAL ${amount.toFixed(2)}×`;
    if (amount >= 20) {
      this.audio?.stinger('bigwin', 'sting_bigwin');
      this.smith?.play('cheer');
      this.coins.erupt(this.app.renderer.width, this.app.renderer.height,
                       amount >= 300 ? 44 : 24);
      void shake(this.world, amount >= 300 ? 10 : 6, 380, this.ctx);
      await this.banner.show(tierName(amount), amount, this.ctx);
    }
  }

  async roundEnd(): Promise<void> {
    // the round is over: the forge cools back to its resting scene
    this.frame.setTitle('THE DEEPFORGE');
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
