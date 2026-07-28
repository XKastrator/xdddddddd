/**
 * UiPanel — the game's control bar, drawn INSIDE the canvas.
 *
 * HTML `<select>`s and checkboxes under the stage read as a debug harness. A
 * slot's controls are part of its art: a forged bar, one circular primary action
 * that dominates by size and heat, round secondary controls that recede, and a
 * clear typographic split between captions (small, dim, tracked) and values
 * (large, warm, tabular).
 *
 * The panel emits intents; it owns no game state and performs no maths.
 */
import { Container, Graphics, Rectangle } from 'pixi.js';
import { GlyphFont, GlyphText } from './GlyphText';
import { THEME } from './palette';

export interface UiCallbacks {
  onSpin: () => void;
  onSkip: () => void;
  onToggleTurbo: () => boolean;    // returns new state
  onHelp: () => void;
  onBetStep: (dir: -1 | 1) => void;
  onModeStep: (dir: -1 | 1) => void;
  /** Open the autoplay setup panel. */
  onAutoplay: () => void;
  /** Stop a running autoplay session immediately. */
  onStopAuto: () => void;
  /** Jump straight into the feature-buy flow (still confirmed before any bet). */
  onBonus: () => void;
}

/** Minimum comfortable touch target (WCAG 2.5.5 / mobile casino guidance). */
const TAP = 44;

type IconName = 'turbo' | 'skip' | 'help' | 'auto' | 'menu';

/**
 * Shared interaction skin: hover lifts, press sinks, disabled dims. Doing this
 * once means every control in the bar responds identically, which is most of
 * what "finished" feels like.
 */
abstract class Control extends Container {
  protected enabled = true;
  protected hovered = false;
  protected pressed = false;

  constructor(onTap: () => void) {
    super();
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => { if (this.enabled) onTap(); });
    this.on('pointerdown', () => { if (this.enabled) { this.pressed = true; this.restyle(); } });
    this.on('pointerup', () => { this.pressed = false; this.restyle(); });
    this.on('pointerupoutside', () => { this.pressed = false; this.hovered = false; this.restyle(); });
    this.on('pointerover', () => { this.hovered = true; this.restyle(); });
    this.on('pointerout', () => { this.hovered = false; this.pressed = false; this.restyle(); });
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    this.cursor = v ? 'pointer' : 'default';
    this.restyle();
  }

  protected abstract restyle(): void;
}

/** A rectangular control — used for the bet/mode steppers. */
class Button extends Control {
  private bg = new Graphics();
  private cap: GlyphText;

  constructor(font: GlyphFont | null, text: string, private w: number, private h: number,
              onTap: () => void) {
    super(onTap);
    this.cap = new GlyphText(font, { size: Math.min(15, h * 0.34), align: 'center',
      letterSpacing: 2 });
    this.cap.text = text;
    this.addChild(this.bg, this.cap);
    this.redraw();
  }

  setSize(w: number, h: number): void { this.w = w; this.h = h; this.redraw(); }
  setText(t: string): void { this.cap.text = t; this.redraw(); }
  protected restyle(): void { this.redraw(); }

  private redraw(): void {
    const { w, h } = this;
    const r = Math.min(12, h * 0.28);
    const lift = this.pressed ? 0 : this.hovered && this.enabled ? 2 : 1;
    this.bg.clear();
    this.bg.roundRect(0, 0, w, h, r).fill({ color: 0x0d0906 });
    this.bg.roundRect(0, lift === 0 ? 1 : 0, w, h - 1, r)
      .fill({ color: this.hovered && this.enabled ? 0x2a1e14 : 0x1b140d });
    this.bg.roundRect(0, lift === 0 ? 1 : 0, w, h * 0.46, r)
      .fill({ color: 0xffffff, alpha: this.hovered && this.enabled ? 0.06 : 0.03 });
    this.bg.roundRect(0.5, 0.5, w - 1, h - 1, r)
      .stroke({ width: 1.5, color: this.hovered && this.enabled ? EDGE_HOT : THEME.line });
    this.cap.setTint(this.enabled ? THEME.txt : 0x6d6152);
    this.cap.position.set(w / 2, h / 2 + h * 0.12 + (this.pressed ? 1 : 0));
    this.alpha = this.enabled ? 1 : 0.45;
    this.hitArea = new Rectangle(0, 0, w, h);
  }
}

const EDGE_HOT = 0x6b5433;

/** A circular secondary control carrying a drawn icon (never a text label). */
class RoundButton extends Control {
  private bg = new Graphics();
  private icon = new Graphics();
  /** `on` would shadow Pixi's EventEmitter.on — hence `active`. */
  private active = false;

  constructor(private kind: IconName, private r: number, onTap: () => void,
              private style: 'ring' | 'bare' = 'bare') {
    super(onTap);
    this.addChild(this.bg, this.icon);
    this.redraw();
  }

  setOn(v: boolean): void { this.active = v; this.redraw(); }
  setRadius(r: number): void { this.r = r; this.redraw(); }
  protected restyle(): void { this.redraw(); }

  /**
   * Two skins, both quiet.
   *
   * The previous button was a filled brown plate with a border — five of those
   * across a bar reads as a toolbar, not as a game. Reference bars draw their
   * secondary controls as a bare white glyph, with a thin ring only where one
   * control needs to stand slightly apart. The colour work belongs to the
   * board; the bar's job is to be legible and get out of the way.
   */
  private redraw(): void {
    const r = this.r;
    const lit = this.hovered && this.enabled;
    const tint = this.active ? THEME.teal : 0xffffff;
    this.bg.clear();
    if (this.style === 'ring') {
      this.bg.circle(0, 0, r).fill({ color: 0x000000, alpha: lit ? 0.45 : 0.25 });
      this.bg.circle(0, 0, r).stroke({ width: 2, color: tint, alpha: lit ? 1 : 0.85 });
    } else if (lit) {
      this.bg.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.10 });
    }
    if (this.active && this.style !== 'ring') {
      this.bg.circle(0, 0, r).stroke({ width: 2, color: THEME.teal, alpha: 0.9 });
    }

    this.icon.clear();
    this.icon.y = this.pressed ? 1 : 0;
    drawIcon(this.icon, this.kind, r * 0.55, tint);
    this.icon.alpha = lit ? 1 : 0.9;
    this.alpha = this.enabled ? 1 : 0.4;
    // the drawn art can be smaller than a finger; the hit area never is
    const hit = Math.max(r, TAP / 2);
    this.hitArea = new Rectangle(-hit, -hit, hit * 2, hit * 2);
  }
}

function drawIcon(g: Graphics, kind: IconName, s: number, color: number): void {
  switch (kind) {
    case 'turbo':
      g.poly([-s * 0.28, -s, s * 0.5, -s * 0.12, s * 0.06, -s * 0.12,
              s * 0.3, s, -s * 0.52, s * 0.04, -s * 0.06, s * 0.04])
        .fill({ color });
      return;
    case 'skip':
      for (const dx of [-s * 0.55, s * 0.1]) {
        g.poly([dx, -s * 0.72, dx + s * 0.62, 0, dx, s * 0.72]).fill({ color });
      }
      g.rect(s * 0.72, -s * 0.72, s * 0.26, s * 1.44).fill({ color });
      return;
    case 'help':
      // a drawn question mark: shoulder arc, descending stem, separate dot
      g.arc(0, -s * 0.3, s * 0.52, Math.PI, Math.PI * 2.05)
        .stroke({ width: s * 0.34, color, cap: 'round' });
      g.moveTo(s * 0.5, -s * 0.28).lineTo(s * 0.5, -s * 0.05)
        .lineTo(0, s * 0.28)
        .stroke({ width: s * 0.34, color, cap: 'round', join: 'round' });
      g.circle(0, s * 0.82, s * 0.2).fill({ color });
      return;
    case 'auto':
      // circular arrow — "repeat", not "play"
      g.arc(0, 0, s * 0.78, Math.PI * 0.62, Math.PI * 2.12)
        .stroke({ width: s * 0.3, color, cap: 'round' });
      g.poly([s * 0.34, -s * 0.92, s * 0.98, -s * 0.62, s * 0.4, -s * 0.2])
        .fill({ color });
      return;
    case 'menu':
      for (const dy of [-s * 0.62, 0, s * 0.62]) {
        g.moveTo(-s * 0.85, dy).lineTo(s * 0.85, dy)
          .stroke({ width: s * 0.30, color, cap: 'round' });
      }
      return;
  }
}

/**
 * The bet stepper as a stacked chevron pair.
 *
 * A slot bar has no room for two 44px square buttons beside a readout, and the
 * reference layouts all solve it the same way: one column, up over down, both
 * still a full touch target because the hit rectangles meet in the middle
 * rather than shrinking.
 */
class ChevronStack extends Container {
  private up = new Graphics();
  private down = new Graphics();
  private hitUp: Container;
  private hitDown: Container;
  private enabled = true;

  constructor(private size: number, onStep: (dir: -1 | 1) => void) {
    super();
    this.hitUp = this.arm(this.up, () => onStep(1));
    this.hitDown = this.arm(this.down, () => onStep(-1));
    this.addChild(this.hitUp, this.hitDown);
    this.redraw();
  }

  private arm(g: Graphics, tap: () => void): Container {
    const holder = new Container();
    holder.addChild(g);
    holder.eventMode = 'static';
    holder.cursor = 'pointer';
    holder.on('pointertap', () => { if (this.enabled) tap(); });
    return holder;
  }

  setEnabled(v: boolean): void { this.enabled = v; this.alpha = v ? 1 : 0.4; }
  setSize(s: number): void { this.size = s; this.redraw(); }

  private redraw(): void {
    const s = this.size;
    const half = Math.max(TAP / 2, s * 0.9);
    for (const [g, dir, holder] of
      [[this.up, -1, this.hitUp], [this.down, 1, this.hitDown]] as
      [Graphics, number, Container][]) {
      g.clear();
      // The apex points AWAY from centre: up-chevron peaks upward, down-chevron
      // dips downward. Signing these the other way round drew the pair as an X.
      const cy = dir * s * 0.85;
      g.moveTo(-s * 0.5, cy - dir * s * 0.28)
        .lineTo(0, cy + dir * s * 0.28)
        .lineTo(s * 0.5, cy - dir * s * 0.28)
        .stroke({ width: s * 0.2, color: 0xffffff, cap: 'round', join: 'round' });
      holder.hitArea = new Rectangle(-half, cy - half / 2, half * 2, half);
    }
  }
}

/**
 * The feature-buy entry point: a green pill on the far right.
 *
 * Green because it is the one control in the bar that spends a different, much
 * larger amount than SPIN, and it must never be mistaken for it. It opens the
 * confirmation panel — it does not place a bet — so the rule that a buy is
 * always confirmed before money moves is unchanged.
 */
class BonusButton extends Control {
  private bg = new Graphics();
  private cap: GlyphText;
  private r = 30;

  constructor(font: GlyphFont | null, text: string, onTap: () => void) {
    super(onTap);
    this.cap = new GlyphText(font, { size: 9, tint: 0xffffff, align: 'center',
      letterSpacing: 1.4 });
    this.cap.text = text;
    this.addChild(this.bg, this.cap);
    this.redraw();
  }

  setRadius(r: number): void { this.r = r; this.redraw(); }
  setText(t: string): void { this.cap.text = t; this.redraw(); }
  protected restyle(): void { this.redraw(); }

  /**
   * The feature buy: a green disc at the far right.
   *
   * Green because it is the one control in the bar that spends a different and
   * much larger amount than SPIN, and it must never be mistaken for it. It
   * opens the confirmation panel — it does not place a bet — so the rule that a
   * buy is always confirmed before money moves is unchanged.
   */
  private redraw(): void {
    const r = this.r;
    const sink = this.pressed ? 1 : 0;
    const lit = this.hovered && this.enabled;
    this.bg.clear();
    this.bg.circle(0, 3, r).fill({ color: 0x07260f });
    this.bg.circle(0, sink, r).fill({ color: lit ? 0x2fbf4f : 0x1f9c3f });
    this.bg.circle(0, sink - r * 0.28, r * 0.86)
      .fill({ color: 0xffffff, alpha: 0.10 });
    this.bg.circle(0, sink, r).stroke({ width: 2, color: 0x8ef0a6, alpha: lit ? 0.9 : 0.5 });
    this.cap.position.set(0, r * 0.2 + sink);
    this.alpha = this.enabled ? 1 : 0.45;
    const hit = Math.max(r, TAP / 2);
    this.hitArea = new Rectangle(-hit, -hit, hit * 2, hit * 2);
  }
}

class SpinButton extends Control {
  private bg = new Graphics();
  private glyph = new Graphics();
  private countdown: GlyphText;
  private r = 38;
  private mode: 'spin' | 'stop' = 'spin';

  constructor(font: GlyphFont | null, onTap: () => void) {
    super(onTap);
    this.addChild(this.bg, this.glyph);
    this.countdown = new GlyphText(font, { size: 13, align: 'center', letterSpacing: 1.5 });
    this.addChild(this.countdown);
    this.redraw();
  }

  setRadius(r: number): void { this.r = r; this.redraw(); }
  /** Switch the glyph between SPIN and STOP without touching the countdown. */
  setMode(m: 'spin' | 'stop'): void {
    if (this.mode === m) return;
    this.mode = m;
    this.redraw();
  }
  /** `remaining` non-null switches the button into autoplay STOP mode. */
  setAuto(remaining: number | null): void {
    this.mode = remaining === null ? 'spin' : 'stop';
    this.countdown.text = remaining === null ? '' : String(remaining);
    this.redraw();
  }
  protected restyle(): void { this.redraw(); }

  /**
   * A heavy white ring around a dark centre.
   *
   * The molten orange disc it replaced was the loudest thing on screen and
   * competed with the board for attention every frame. A ring reads as the
   * primary action through SIZE and contrast instead of colour, which leaves
   * colour free to mean something — and lets the one genuinely different
   * action in the bar, the feature buy, own green by itself.
   */
  private redraw(): void {
    const r = this.r;
    const lit = this.hovered && this.enabled;
    const sink = this.pressed ? 1 : 0;
    const g = this.bg;
    g.clear();
    g.circle(0, sink, r).fill({ color: lit ? 0x22252b : 0x141619 });
    g.circle(0, sink, r).stroke({ width: Math.max(4, r * 0.13), color: 0xffffff,
      alpha: this.enabled ? 1 : 0.35 });

    const q = this.glyph;
    q.clear();
    q.y = sink;
    const s = r * 0.5;
    if (this.mode === 'stop') {
      q.roundRect(-s * 0.62, -s * 0.62, s * 1.24, s * 1.24, s * 0.2)
        .fill({ color: 0xffffff });
    } else {
      // a circular arrow: the universal "spin" glyph, not a media play triangle
      q.arc(0, 0, s * 0.86, Math.PI * 0.72, Math.PI * 2.18)
        .stroke({ width: s * 0.34, color: 0xffffff, cap: 'round' });
      q.poly([s * 0.30, -s * 1.06, s * 1.06, -s * 0.66, s * 0.34, -s * 0.24])
        .fill({ color: 0xffffff });
    }
    this.countdown.position.set(0, r + 16);
    this.countdown.setTint(0xffffff);
    this.alpha = this.enabled ? 1 : 0.5;
    const hit = Math.max(r, TAP / 2);
    this.hitArea = new Rectangle(-hit, -hit, hit * 2, hit * 2);
  }
}

class Readout extends Container {
  private caption: GlyphText;
  private value: GlyphText;
  constructor(font: GlyphFont | null, caption: string, tint: number,
              private align: 'left' | 'center' | 'right') {
    super();
    this.caption = new GlyphText(font, { size: 8, tint: THEME.dim, letterSpacing: 2.2, align });
    this.value = new GlyphText(font, { size: 13, tint, letterSpacing: 1, align });
    this.caption.text = caption;
    this.value.text = '—';
    this.caption.position.set(0, 0);
    this.value.position.set(0, 20);
    this.addChild(this.caption, this.value);
  }
  setCaption(t: string): void { this.caption.text = t; }
  set(v: string): void { this.value.text = v; }
  get width2(): number { return Math.max(this.caption.contentWidth, this.value.contentWidth); }
  get alignment(): 'left' | 'center' | 'right' { return this.align; }
}

export class UiPanel extends Container {
  private bar = new Graphics();
  private spin: SpinButton;
  private skip: RoundButton;
  private turbo: RoundButton;
  private help: RoundButton;
  private auto: RoundButton;
  private betDown: Button; private betUp: Button;
  private modeLeft: Button; private modeRight: Button;
  private modeLabel: GlyphText;
  private modeCaption: GlyphText;
  private betReadout: Readout;
  private balReadout: Readout;
  private winReadout: Readout;
  private menu: RoundButton;
  private stepper: ChevronStack;
  private bonus: BonusButton;
  private h = 0;
  private autoRemaining: number | null = null;
  private autoAllowed = true;
  /** A round is playing — the primary button acts as SKIP. */
  private busy = false;

  constructor(font: GlyphFont | null, cb: UiCallbacks) {
    super();
    this.addChild(this.bar);
    this.spin = new SpinButton(font, () => {
      if (this.autoRemaining !== null) cb.onStopAuto();
      // While a round plays, the primary button IS the skip control. The
      // reference bars carry no separate skip circle, and a player reaching to
      // cut a long bonus short reaches for the big button, not a small one.
      else if (this.busy) cb.onSkip();
      else cb.onSpin();
    });
    this.skip = new RoundButton('skip', 21, cb.onSkip);
    this.turbo = new RoundButton('turbo', 21,
      () => this.turbo.setOn(cb.onToggleTurbo()), 'ring');
    this.help = new RoundButton('help', 21, cb.onHelp);
    this.auto = new RoundButton('auto', 21, cb.onAutoplay);
    this.betDown = new Button(font, '-', 40, TAP, () => cb.onBetStep(-1));
    this.betUp = new Button(font, '+', 40, TAP, () => cb.onBetStep(1));
    this.modeLeft = new Button(font, '<', 36, 36, () => cb.onModeStep(-1));
    this.modeRight = new Button(font, '>', 36, 36, () => cb.onModeStep(1));
    this.modeLabel = new GlyphText(font, { size: 14, tint: THEME.amber2, align: 'center',
      letterSpacing: 2 });
    this.modeCaption = new GlyphText(font, { size: 9, tint: THEME.dim, align: 'center',
      letterSpacing: 2.6 });
    this.modeCaption.text = 'MODE';
    // one weight, one colour: the bar states facts, the board carries the colour
    this.betReadout = new Readout(font, 'BET', 0xffffff, 'left');
    this.balReadout = new Readout(font, 'BALANCE', 0xffffff, 'left');
    this.winReadout = new Readout(font, 'WIN', 0xffffff, 'left');
    this.winReadout.set('0.00');
    this.menu = new RoundButton('menu', 21, cb.onHelp);
    this.stepper = new ChevronStack(13, (d) => cb.onBetStep(d));
    this.bonus = new BonusButton(font, 'BONUS', cb.onBonus);
    this.addChild(this.betDown, this.betUp, this.modeLeft, this.modeRight,
      this.modeLabel, this.modeCaption, this.betReadout, this.balReadout,
      this.winReadout, this.menu, this.stepper, this.bonus,
      this.skip, this.turbo, this.help, this.auto, this.spin);
  }

  get height2(): number { return this.h; }

  setBalance(v: string): void { this.balReadout.set(v); }
  /** Round win, shown beside the balance the way the reference bars do. */
  setWin(v: string): void { this.winReadout.set(v); }
  setBet(v: string): void { this.betReadout.set(v); }
  setMode(v: string): void { this.modeLabel.text = v; }
  setSpinEnabled(v: boolean): void {
    this.busy = !v;
    // never actually disabled: it becomes SKIP instead, so the control under
    // the player's thumb always does the thing they want next
    this.spin.setEnabled(true);
    this.spin.setMode(this.busy ? 'stop' : 'spin');
    // changing the bet mid-round would misreport the cost of the round in flight
    for (const b of [this.betDown, this.betUp, this.modeLeft, this.modeRight]) {
      b.setEnabled(v && this.autoRemaining === null);
    }
    this.stepper.setEnabled(v && this.autoRemaining === null);
    // a buy is its own bet: never offered while a round or a session is running
    this.bonus.setEnabled(v && this.autoRemaining === null);
    this.auto.setEnabled(v && this.autoAllowed && this.autoRemaining === null);
  }
  setTurboVisible(v: boolean): void { this.turbo.visible = v; }
  setAutoplayVisible(v: boolean): void { this.auto.visible = v; }
  /** Feature buys are single deliberate purchases — never autoplayed. */
  setAutoplayAllowed(v: boolean): void {
    this.autoAllowed = v;
    this.auto.setEnabled(v && this.autoRemaining === null);
  }

  /** `null` = no session running; a number shows the remaining rounds. */
  setAutoplay(remaining: number | null): void {
    this.autoRemaining = remaining;
    this.spin.setAuto(remaining);
    this.auto.setOn(remaining !== null);
  }

  setCaptions(bet: string, balance: string, mode: string): void {
    this.betReadout.setCaption(bet);
    this.balReadout.setCaption(balance);
    this.modeCaption.text = mode;
  }

  /**
   * Where each control was actually drawn, in stage coordinates. Exposed so a
   * test can click the real button rather than a guessed position — the
   * controls live inside the canvas, so there is no DOM node to target.
   */
  hitPoints(): Record<string, { x: number; y: number }> {
    const pt = (c: Container, cx = 0, cy = 0) => ({
      x: this.x + c.x + cx, y: this.y + c.y + cy,
    });
    return {
      spin: pt(this.spin),
      help: pt(this.menu),
      turbo: pt(this.turbo),
      // the primary button is the skip control while a round plays
      skip: pt(this.spin),
      auto: pt(this.auto),
      // `help` names the control that OPENS help, which is the hamburger now
      menu: pt(this.menu),
      bonus: pt(this.bonus),
      // the chevrons share one column: up sits above the centre, down below
      betUp: pt(this.stepper, 0, -13),
      betDown: pt(this.stepper, 0, 13),
    };
  }

  /** Lay the bar out for the given stage size. Returns the height it occupies. */
  layout(w: number, h: number): number {
    const compact = w < 900;
    // Portrait stacks three rows — readouts, mode selector, actions — and the
    // action row is a 34px-radius circle, so it needs 68px of its own before any
    // padding. 158 was not enough and the mode label landed inside the button.
    // Wide is one strip now that the mode selector is gone, so it needs far
    // less height — and every pixel it gives back goes to the board.
    const barH = compact ? 158 : 76;
    this.h = barH;
    this.position.set(0, h - barH);

    const pad = Math.max(14, w * 0.02);
    // Translucent, so the room the game is set in runs behind the controls
    // instead of being cut off by a solid plate. Stacked bands fake a vertical
    // gradient — the bar has to stay readable over a bright background, and a
    // single flat alpha is either too light at the top or too heavy at the
    // bottom. Pixi has no gradient fill for Graphics without a texture.
    this.bar.clear();
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands;
      this.bar.rect(0, barH * t0, w, barH / bands + 1)
        .fill({ color: 0x05070b, alpha: 0.30 + 0.48 * t0 });
    }
    this.bar.rect(0, 0, w, 1).fill({ color: 0xffffff, alpha: 0.10 });

    if (compact) this.layoutCompact(w, barH, pad);
    else this.layoutWide(w, barH, pad);
    return barH;
  }

  /**
   * Desktop / landscape: one low strip, read left to right.
   *
   * turbo · menu | BALANCE · WIN · BET ⌃⌄ | autoplay · SPIN · BONUS
   *
   * The previous bar centred SPIN and pushed everything to the flanks, which
   * left a 116px band of mostly empty dark plate across the bottom of the
   * screen and cost the board vertical room. Grouping the money readouts
   * together and putting the two actions that spend money at the right end
   * matches how the reference bars are read, and takes 40px less height.
   */
  private layoutWide(w: number, barH: number, pad: number): void {
    const mid = barH / 2;

    // --- left cluster: the two controls that change nothing about the bet ---
    let x = pad + 24;
    this.turbo.setRadius(24); this.turbo.position.set(x, mid);
    x += 58;
    this.menu.setRadius(22); this.menu.visible = true; this.menu.position.set(x, mid);

    // --- money readouts, as one group ---------------------------------------
    x += 44;
    const readTop = mid - 15;
    for (const ro of [this.balReadout, this.winReadout, this.betReadout]) {
      ro.position.set(x, readTop);
      x += Math.max(82, ro.width2 + 38);
    }
    // the stepper belongs to BET, so it sits immediately after it
    this.stepper.setSize(13);
    this.stepper.position.set(x - 22, mid);

    // --- right cluster, laid out from the edge inwards -----------------------
    const bonusR = Math.min(34, barH / 2 - 4);
    this.bonus.setRadius(bonusR);
    this.bonus.position.set(w - pad - bonusR, mid);
    const spinR = Math.min(34, barH / 2 - 4);
    this.spin.setRadius(spinR);
    const spinX = w - pad - bonusR * 2 - 20 - spinR;
    this.spin.position.set(spinX, mid);

    // Help lives behind the hamburger and skip is the primary button while a
    // round runs, so neither needs a circle of its own.
    this.skip.visible = false; this.help.visible = false;
    this.auto.setRadius(24);
    this.auto.position.set(spinX - spinR - 22 - 24, mid);

    // The mode selector is not in this layout: BONUS is the way into a feature
    // buy now. The arrows stay in the tree — autoplay and the tests still drive
    // them — but they are parked off-bar rather than drawn.
    this.modeCaption.visible = false;
    for (const b of [this.modeLeft, this.modeRight, this.betDown, this.betUp]) {
      b.visible = false;
    }
    // The round's name is already carved into the frame's cartouche above the
    // grid; repeating it across the middle of the bar was filler.
    this.modeLabel.visible = false;
  }

  /** Portrait: money on top, actions underneath. Same reading order as wide. */
  private layoutCompact(w: number, barH: number, pad: number): void {
    // row 1 — the money group, spread across the width
    const readTop = 12;
    const slot = (w - pad * 2 - 34) / 3;
    const readouts = [this.balReadout, this.winReadout, this.betReadout];
    for (let i = 0; i < readouts.length; i++) {
      readouts[i].position.set(pad + i * slot, readTop);
    }
    this.stepper.setSize(12);
    this.stepper.position.set(w - pad - 12, readTop + 24);

    // row 2 — actions, with the two money-spending controls on the right
    const rowY = barH - 46;
    const bonusR = 27;
    this.bonus.setRadius(bonusR);
    this.bonus.position.set(w - pad - bonusR, rowY);
    const r = 30;
    this.spin.setRadius(r);
    const spinX = w - pad - bonusR * 2 - 16 - r;
    this.spin.position.set(spinX, rowY);

    this.skip.visible = false; this.help.visible = false;
    let x = pad + 21;
    this.turbo.setRadius(21); this.turbo.position.set(x, rowY);
    x += 50;
    this.menu.setRadius(21); this.menu.visible = true; this.menu.position.set(x, rowY);
    this.auto.setRadius(21);
    this.auto.position.set(Math.min(x + 50, spinX - r - 30), rowY);

    this.modeCaption.visible = false;
    for (const b of [this.modeLeft, this.modeRight, this.betDown, this.betUp]) {
      b.visible = false;
    }
    this.modeLabel.visible = false;
  }
}
