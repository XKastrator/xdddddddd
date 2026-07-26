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
}

/** Minimum comfortable touch target (WCAG 2.5.5 / mobile casino guidance). */
const TAP = 44;

type IconName = 'turbo' | 'skip' | 'help' | 'auto';

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

  constructor(font: GlyphFont, text: string, private w: number, private h: number,
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

  constructor(private kind: IconName, private r: number, onTap: () => void) {
    super(onTap);
    this.addChild(this.bg, this.icon);
    this.redraw();
  }

  setOn(v: boolean): void { this.active = v; this.redraw(); }
  setRadius(r: number): void { this.r = r; this.redraw(); }
  protected restyle(): void { this.redraw(); }

  private redraw(): void {
    const r = this.r;
    const accent = this.active ? THEME.teal : this.hovered && this.enabled ? THEME.amber2 : 0x8a7963;
    this.bg.clear();
    this.bg.circle(0, 2, r).fill({ color: 0x0d0906 });
    this.bg.circle(0, this.pressed ? 1 : 0, r)
      .fill({ color: this.hovered && this.enabled ? 0x2a1e14 : 0x1b140d });
    this.bg.circle(0, this.pressed ? 1 : 0, r)
      .stroke({ width: 1.6, color: this.active ? THEME.teal : THEME.line });
    if (this.active) this.bg.circle(0, 0, r * 1.28).fill({ color: THEME.teal, alpha: 0.10 });

    this.icon.clear();
    this.icon.y = this.pressed ? 1 : 0;
    drawIcon(this.icon, this.kind, r * 0.52, accent);
    this.alpha = this.enabled ? 1 : 0.45;
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
  }
}

/**
 * The primary action. Circular, molten, and physically the largest thing in the
 * bar — a player should never have to look for it. Doubles as the autoplay STOP
 * control while a session runs, so stopping is always one tap on the control the
 * thumb is already resting on.
 */
class SpinButton extends Control {
  private bg = new Graphics();
  private glyph = new Graphics();
  private countdown: GlyphText | null = null;
  private r = 38;
  private mode: 'spin' | 'stop' = 'spin';

  constructor(font: GlyphFont | null, onTap: () => void) {
    super(onTap);
    this.addChild(this.bg, this.glyph);
    if (font) {
      this.countdown = new GlyphText(font, { size: 13, align: 'center', letterSpacing: 1.5 });
      this.addChild(this.countdown);
    }
    this.redraw();
  }

  setRadius(r: number): void { this.r = r; this.redraw(); }
  /** `remaining` non-null switches the button into autoplay STOP mode. */
  setAuto(remaining: number | null): void {
    this.mode = remaining === null ? 'spin' : 'stop';
    if (this.countdown) this.countdown.text = remaining === null ? '' : String(remaining);
    this.redraw();
  }
  protected restyle(): void { this.redraw(); }

  private redraw(): void {
    const r = this.r;
    const sink = this.pressed ? 2 : 0;
    const lit = this.hovered && this.enabled;
    const g = this.bg;
    g.clear();

    // seated ring the button sits in
    g.circle(0, 3, r + 6).fill({ color: 0x0a0705 });
    g.circle(0, 0, r + 5).stroke({ width: 2, color: THEME.line });
    // heat bloom
    g.circle(0, 0, r + (lit ? 13 : 9))
      .fill({ color: THEME.amber, alpha: this.enabled ? (lit ? 0.22 : 0.13) : 0.04 });

    if (this.mode === 'stop') {
      g.circle(0, sink, r).fill({ color: 0x2b1a10 });
      g.circle(0, sink, r).stroke({ width: 2.5, color: THEME.teal, alpha: 0.9 });
      g.circle(0, sink - r * 0.35, r * 0.92).fill({ color: 0xffffff, alpha: 0.05 });
    } else {
      // molten body: hot core, lit upper half, bright top sliver
      g.circle(0, sink, r).fill({ color: 0xc24f00 });
      g.circle(0, sink - r * 0.16, r * 0.94).fill({ color: 0xff8a2a });
      g.circle(0, sink - r * 0.34, r * 0.72).fill({ color: 0xffb347, alpha: 0.75 });
      g.circle(0, sink - r * 0.52, r * 0.42).fill({ color: 0xffe0a8, alpha: 0.55 });
      g.circle(0, sink, r).stroke({ width: 2.5, color: 0xffd08a, alpha: 0.85 });
    }

    // glyph: a triangle "go" mark, or a stop square while autoplay runs
    const ig = this.glyph;
    ig.clear();
    ig.y = sink;
    const c = this.mode === 'stop' ? THEME.teal : 0x3d1200;
    if (this.mode === 'stop') {
      const s = r * 0.34;
      ig.roundRect(-s, -s - r * 0.18, s * 2, s * 2, s * 0.3).fill({ color: c });
    } else {
      const s = r * 0.44;
      ig.poly([-s * 0.72, -s, s * 0.88, 0, -s * 0.72, s]).fill({ color: c, alpha: 0.75 });
    }
    if (this.countdown) {
      this.countdown.setTint(THEME.teal);
      this.countdown.position.set(0, sink + r * 0.62);
    }

    this.alpha = this.enabled ? 1 : 0.5;
    const hit = Math.max(r + 6, TAP / 2);
    this.hitArea = new Rectangle(-hit, -hit, hit * 2, hit * 2);
  }
}

/** A caption + value readout (balance, bet). Captions recede, values lead. */
class Readout extends Container {
  private caption: GlyphText;
  private value: GlyphText;
  constructor(font: GlyphFont, caption: string, tint: number,
              private align: 'left' | 'center' | 'right') {
    super();
    this.caption = new GlyphText(font, { size: 9, tint: THEME.dim, letterSpacing: 2.6, align });
    this.value = new GlyphText(font, { size: 18, tint, letterSpacing: 1.2, align });
    this.caption.text = caption;
    this.value.text = '—';
    this.caption.position.set(0, 0);
    this.value.position.set(0, 26);
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
  private h = 0;
  private autoRemaining: number | null = null;
  private autoAllowed = true;

  constructor(font: GlyphFont, cb: UiCallbacks) {
    super();
    this.addChild(this.bar);
    this.spin = new SpinButton(font, () => {
      if (this.autoRemaining !== null) cb.onStopAuto(); else cb.onSpin();
    });
    this.skip = new RoundButton('skip', 21, cb.onSkip);
    this.turbo = new RoundButton('turbo', 21, () => this.turbo.setOn(cb.onToggleTurbo()));
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
    this.betReadout = new Readout(font, 'BET', THEME.amber2, 'center');
    this.balReadout = new Readout(font, 'BALANCE', THEME.txt, 'left');
    this.addChild(this.betDown, this.betUp, this.modeLeft, this.modeRight,
      this.modeLabel, this.modeCaption, this.betReadout, this.balReadout,
      this.skip, this.turbo, this.help, this.auto, this.spin);
  }

  get height2(): number { return this.h; }

  setBalance(v: string): void { this.balReadout.set(v); }
  setBet(v: string): void { this.betReadout.set(v); }
  setMode(v: string): void { this.modeLabel.text = v; }
  setSpinEnabled(v: boolean): void {
    this.spin.setEnabled(v || this.autoRemaining !== null);
    // changing the bet mid-round would misreport the cost of the round in flight
    for (const b of [this.betDown, this.betUp, this.modeLeft, this.modeRight]) {
      b.setEnabled(v && this.autoRemaining === null);
    }
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
      help: pt(this.help),
      turbo: pt(this.turbo),
      skip: pt(this.skip),
      auto: pt(this.auto),
      // rectangular controls are anchored at their top-left corner
      betUp: pt(this.betUp, 20, 22),
      betDown: pt(this.betDown, 20, 22),
      modeLeft: pt(this.modeLeft, 18, 17),
      modeRight: pt(this.modeRight, 18, 17),
    };
  }

  /** Lay the bar out for the given stage size. Returns the height it occupies. */
  layout(w: number, h: number): number {
    const compact = w < 900;
    // Portrait stacks three rows — readouts, mode selector, actions — and the
    // action row is a 34px-radius circle, so it needs 68px of its own before any
    // padding. 158 was not enough and the mode label landed inside the button.
    const barH = compact ? 196 : 116;
    this.h = barH;
    this.position.set(0, h - barH);

    const pad = Math.max(14, w * 0.02);
    this.bar.clear();
    this.bar.rect(0, 0, w, barH).fill({ color: 0x0c0906 });
    this.bar.rect(0, 0, w, barH * 0.42).fill({ color: 0xffffff, alpha: 0.014 });
    this.bar.rect(0, 0, w, 2).fill({ color: 0x000000 });
    this.bar.rect(0, 2, w, 1.5).fill({ color: EDGE_HOT, alpha: 0.55 });

    if (compact) this.layoutCompact(w, barH, pad);
    else this.layoutWide(w, barH, pad);
    return barH;
  }

  /** Desktop / landscape: one row, spin dead centre, clusters on both flanks. */
  private layoutWide(w: number, barH: number, pad: number): void {
    const mid = barH / 2;
    const r = 40;
    this.spin.setRadius(r);
    this.spin.position.set(w / 2, mid);

    // left flank: balance, then the mode selector
    this.balReadout.position.set(pad, mid - 30);
    const modeW = 168;
    const mx = pad + Math.max(150, this.balReadout.width2 + 40);
    this.modeCaption.visible = true;
    this.modeCaption.position.set(mx + modeW / 2 + 36, mid - 30);
    this.modeLeft.setSize(36, 36); this.modeLeft.position.set(mx, mid - 18);
    this.modeLabel.position.set(mx + modeW / 2 + 36, mid + 6);
    this.modeRight.setSize(36, 36); this.modeRight.position.set(mx + modeW + 36, mid - 18);

    // right flank, laid out from the edge inwards so it never collides
    let x = w - pad - 21;
    for (const b of [this.help, this.skip, this.turbo, this.auto]) {
      b.setRadius(21);
      b.position.set(x, mid);
      if (b.visible) x -= 52;
    }
    // bet stepper sits between the spin button and the round controls
    const betCx = (w / 2 + r + 40 + (x + 21)) / 2;
    this.betDown.setSize(40, TAP); this.betDown.position.set(betCx - 88, mid - TAP / 2);
    this.betReadout.position.set(betCx, mid - 30);
    this.betUp.setSize(40, TAP); this.betUp.position.set(betCx + 48, mid - TAP / 2);
  }

  /** Portrait: readouts, then the mode selector, then the action row. */
  private layoutCompact(w: number, barH: number, pad: number): void {
    // row 1 — readouts and the bet stepper (occupies y 10..54)
    this.balReadout.position.set(pad, 10);
    this.betReadout.position.set(w - pad - 60, 10);
    this.betDown.setSize(38, 38); this.betDown.position.set(w - pad - 156, 16);
    this.betUp.setSize(38, 38); this.betUp.position.set(w - pad - 38, 16);

    // row 2 — mode selector, centred (y 62..98)
    const modeY = 62;
    const arrowW = 36;
    const half = Math.min(150, w / 2 - pad - arrowW - 10);
    this.modeCaption.visible = false;
    this.modeLeft.setSize(arrowW, 34);
    this.modeLeft.position.set(w / 2 - half - arrowW, modeY);
    this.modeLabel.position.set(w / 2, modeY + 24);
    this.modeRight.setSize(arrowW, 34);
    this.modeRight.position.set(w / 2 + half, modeY);

    // row 3 — the action row, sized from the bar's own bottom
    const r = 34;
    const rowY = barH - r - 20;
    this.spin.setRadius(r);
    this.spin.position.set(w / 2, rowY);
    // secondary controls flank the primary; the spacing is whatever is actually
    // left between the spin button and the padding, never a fixed guess
    const room = w / 2 - r - pad - 20;
    const gap = Math.max(46, Math.min(62, room / 2));
    this.auto.setRadius(20); this.auto.position.set(w / 2 - r - gap, rowY);
    this.turbo.setRadius(20); this.turbo.position.set(w / 2 - r - gap * 2, rowY);
    this.skip.setRadius(20); this.skip.position.set(w / 2 + r + gap, rowY);
    this.help.setRadius(20); this.help.position.set(w / 2 + r + gap * 2, rowY);
  }
}
