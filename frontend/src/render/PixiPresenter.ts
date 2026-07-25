/**
 * PixiPresenter — production renderer implementing the Presenter contract on top
 * of PixiJS v8. Consumes the event stream from BookPlayer and animates it. Holds
 * NO game maths. Symbol artwork comes from the texture atlas (see ART_BIBLE.md);
 * a procedural fallback keeps the game runnable without binary assets.
 */
import { Application, Container } from 'pixi.js';
import type { Presenter } from '../game/Presenter';
import type { Board, Fusion, Relic, Spawned, SpinKind } from '../types/events';
import { Sym } from '../types/events';
import { BoardView } from './BoardView';
import { HeatMeter } from './HeatMeter';
import { WinBanner, tierName } from './WinBanner';
import { computeLayout } from './Layout';
import { THEME } from './palette';
import { wait } from './tween';
import { Particles } from './Particles';
import { CoinShower, shake } from './juice';
import { Background } from './Background';
import { Rig, EMBERWRIGHT_BONES, type PartTextures } from './Rig';
import type { AudioManager } from '../audio/AudioManager';
import type { TextureProvider } from './SymbolSprite';
import { GlyphFont, GlyphText } from './GlyphText';
import { UiPanel, type UiCallbacks } from './UiPanel';
import type { Texture } from 'pixi.js';

export interface PresenterAssets {
  getTexture?: TextureProvider;
  scenes?: Partial<Record<'base' | 'bonus' | 'super', Texture>>;
  rigParts?: PartTextures;
  font?: GlyphFont | null;
  ui?: UiCallbacks;
}

const COLS = 6, ROWS = 5, BASE_CELL = 96, BASE_GAP = 8;
const HEAT_CAP: Record<SpinKind, number> = { base: 25, free: 100, super: 10 };

export class PixiPresenter implements Presenter {
  private bg: Background;
  private world = new Container();
  private rig: Rig | null = null;
  private rigHolder = new Container();
  private board: BoardView;
  private heatMeter: HeatMeter;
  private banner: WinBanner;
  private fx = new Particles();
  private coins = new CoinShower();
  private hud = new Container();
  private lblMode: GlyphText; private lblSpins: GlyphText; private lblVault: GlyphText;
  private lblSpinWin: GlyphText; private lblTotal: GlyphText;
  /** In-canvas control bar. Null when no display face was loaded. */
  panel: UiPanel | null = null;

  skip = false;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private app: Application, private audio?: AudioManager,
              assets: PresenterAssets = {}) {
    this.bg = new Background(assets.scenes ?? {});
    this.board = new BoardView(COLS, ROWS, BASE_CELL, BASE_GAP, assets.getTexture);
    if (assets.rigParts && Object.keys(assets.rigParts).length) {
      this.rig = new Rig(EMBERWRIGHT_BONES, assets.rigParts);
      this.rigHolder.addChild(this.rig);
    }
    this.banner = new WinBanner(assets.font ?? null);
    this.heatMeter = new HeatMeter(this.board.width2, 14, assets.font ?? null);
    this.heatMeter.position.set(0, -30);
    this.world.addChild(this.heatMeter, this.board, this.fx);

    // The HUD uses the authored display face; falling back to the OS font is
    // exactly the tell we are removing, so a missing atlas hides the HUD text
    // rather than rendering it in system-ui.
    const font = assets.font ?? null;
    const mk = (size: number, tint: number, align: 'left' | 'right' = 'left') =>
      new GlyphText(font!, { size, tint, align, letterSpacing: 1.5 });
    if (font) {
      this.lblMode = mk(14, THEME.amber2);
      this.lblSpins = mk(13, THEME.txt, 'right');
      this.lblVault = mk(13, THEME.teal, 'right');
      this.lblSpinWin = mk(13, THEME.gold, 'right');
      this.lblTotal = mk(19, THEME.txt);
      this.hud.addChild(this.lblMode, this.lblSpins, this.lblVault, this.lblSpinWin, this.lblTotal);
      if (assets.ui) this.panel = new UiPanel(font, assets.ui);
    } else {
      const stub = () => ({ text: '', position: { set: () => {} } } as unknown as GlyphText);
      this.lblMode = stub(); this.lblSpins = stub(); this.lblVault = stub();
      this.lblSpinWin = stub(); this.lblTotal = stub();
    }

    app.stage.addChild(this.bg, this.rigHolder, this.world, this.coins, this.hud);
    if (this.panel) app.stage.addChild(this.panel);
    app.stage.addChild(this.banner);
    this.resize(app.renderer.width, app.renderer.height);
    this.showIdleBoard();

    // one ticker drives the rig and the background drift
    let elapsed = 0;
    app.ticker.add((ticker) => {
      const dt = ticker.deltaMS / 1000;
      elapsed += dt;
      if (!this.reduced) this.bg.drift(elapsed);
      this.rig?.update(dt);
    });
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

  resize(w: number, h: number): void {
    this.bg.resize(w, h);
    // the control bar owns the bottom of the stage; the board gets what is left
    const panelH = this.panel ? this.panel.layout(w, h) : 0;
    const playH = h - panelH;

    const lay = computeLayout(w, playH, COLS, ROWS);
    const scale = lay.cell / BASE_CELL;
    this.world.scale.set(scale);
    this.world.position.set(lay.boardX, lay.boardY);

    const pad = Math.round(Math.min(w, playH) * 0.05);
    this.lblMode.position.set(pad, pad * 0.6);
    this.lblTotal.position.set(pad, pad * 0.6 + 26);
    this.lblSpinWin.position.set(w - pad, pad * 0.6);
    this.lblSpins.position.set(w - pad, pad * 0.6 + 22);
    this.lblVault.position.set(w - pad, pad * 0.6 + 42);
    this.banner.resize(w, playH);
    this.placeRig(w, playH, lay.boardX, lay.boardY, lay.boardH ?? 0);
  }

  /**
   * The smith stands at the forge beside the board. On narrow portrait screens
   * there is no side room, so he is tucked behind the board's lower edge instead
   * of being squeezed on top of the grid.
   */
  private placeRig(w: number, h: number, boardX: number, boardY: number,
                   boardH: number): void {
    if (!this.rig) return;
    // The figure is set dressing: it must never crowd the grid or be clipped.
    // It only appears when there is genuine room beside the board.
    const sideRoom = boardX;
    const wide = sideRoom > w * 0.14;
    this.rig.visible = wide;
    if (!wide) return;

    // authored figure is ~410 units tall above the hips (shoulders at -268,
    // hood reaching ~-410); size it so the whole figure fits the side gutter
    const RIG_HEIGHT = 430;
    const byHeight = h * 0.34 / RIG_HEIGHT;
    const byWidth = (sideRoom * 0.82) / 240;       // authored half-width ~120
    this.rig.scale.set(Math.min(byHeight, byWidth));
    // feet (hem) rest on the board's bottom line, tucked into the gutter
    this.rig.position.set(sideRoom * 0.5, boardY + boardH * 0.86);
    this.rig.alpha = 0.92;
  }

  // --- Presenter contract --------------------------------------------------
  async revealBoard(board: Board, heat: number, kind: SpinKind, _scatters: number): Promise<void> {
    this.heatMeter.setCap(HEAT_CAP[kind]); this.heatMeter.reset(heat);
    this.board.setBoard(board);
    this.lblSpinWin.text = 'WIN 0.00×';
    this.audio?.stinger('spin', 'sfx_spin');
    this.audio?.setHeatIntensity(heat, HEAT_CAP[kind]);
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
    this.rig?.play('strike');
    await this.board.forge(fusions, this.ctx);
    // the hammer landing: impact scales with the size of the group that fused
    void shake(this.world, big ? 9 : 4.5, big ? 300 : 190, this.ctx);
    // sparks at each forged relic; bigger jumps throw more embers
    for (const f of fusions) {
      const p = this.board.cellCenter(f.anchor[0], f.anchor[1]);
      this.fx.burst(p.x, p.y, 8 + Math.min(16, f.cells.length * 2));
    }
    this.audio?.stinger('heat', 'sfx_heat');
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
    this.heatMeter.setCap(HEAT_CAP[kind]);
    this.lblMode.text = mode === 'molten_core' ? 'MOLTEN CORE' : 'FORGE FURY';
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
      this.rig?.play('cheer');
      this.coins.erupt(this.app.renderer.width, this.app.renderer.height,
                       amount >= 300 ? 44 : 24);
      void shake(this.world, amount >= 300 ? 10 : 6, 380, this.ctx);
      await this.banner.show(tierName(amount), amount, this.ctx);
    }
  }

  async roundEnd(): Promise<void> {
    // the round is over: the forge cools back to its resting scene
    await this.bg.to('base', this.ctx);
  }

  setMode(name: string): void { this.lblMode.text = name.toUpperCase(); }
}
