/**
 * UiPanel — the game's control bar, drawn INSIDE the canvas.
 *
 * HTML `<select>`s and checkboxes under the stage read as a debug harness. A
 * slot's controls are part of its art: a forged bar with chiselled labels, a
 * primary action that dominates, and secondary controls that recede.
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
}

/** A forged, tappable control. Minimum 44px hit area is enforced by the caller. */
class Button extends Container {
  private bg = new Graphics();
  private cap: GlyphText;
  private _enabled = true;
  private _on = false;

  constructor(font: GlyphFont, text: string, private w: number, private h: number,
              private primary: boolean, onTap: () => void) {
    super();
    this.cap = new GlyphText(font, {
      size: primary ? Math.min(22, h * 0.34) : Math.min(15, h * 0.30),
      align: 'center', letterSpacing: primary ? 3 : 2,
    });
    this.cap.text = text;
    this.addChild(this.bg, this.cap);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => { if (this._enabled) onTap(); });
    this.on('pointerdown', () => { if (this._enabled) this.scale.set(0.96); });
    this.on('pointerup', () => this.scale.set(1));
    this.on('pointerupoutside', () => this.scale.set(1));
    this.redraw();
  }

  setSize(w: number, h: number): void { this.w = w; this.h = h; this.redraw(); }
  setEnabled(v: boolean): void { this._enabled = v; this.alpha = v ? 1 : 0.42; this.cursor = v ? 'pointer' : 'default'; }
  setOn(v: boolean): void { this._on = v; this.redraw(); }
  setText(t: string): void { this.cap.text = t; this.redraw(); }

  private redraw(): void {
    const { w, h } = this;
    const r = Math.min(14, h * 0.28);
    this.bg.clear();
    if (this.primary) {
      // molten primary: hot core with a lit top edge
      this.bg.roundRect(0, 0, w, h, r).fill({ color: 0xd95b00 });
      this.bg.roundRect(0, 0, w, h * 0.55, r).fill({ color: 0xff8a2a, alpha: 0.95 });
      this.bg.roundRect(2, 2, w - 4, h * 0.3, r * 0.7).fill({ color: 0xffb347, alpha: 0.45 });
      this.bg.roundRect(0, 0, w, h, r).stroke({ width: 2, color: 0xffd08a, alpha: 0.75 });
    } else {
      this.bg.roundRect(0, 0, w, h, r).fill({ color: 0x1b140d });
      this.bg.roundRect(0, 0, w, h * 0.5, r).fill({ color: 0x241a10, alpha: 0.9 });
      this.bg.roundRect(0, 0, w, h, r)
        .stroke({ width: 2, color: this._on ? THEME.teal : THEME.line });
    }
    this.cap.setTint(this.primary ? 0xfff6e2 : (this._on ? THEME.teal : THEME.txt));
    this.cap.position.set(w / 2, h / 2 + (this.primary ? 8 : 5));
    // hit area covers the whole control even where the art is rounded away
    this.hitArea = new Rectangle(0, 0, w, h);
  }
}

/** A label + value readout (balance, bet, win). */
class Readout extends Container {
  private caption: GlyphText;
  private value: GlyphText;
  constructor(font: GlyphFont, caption: string, tint: number, align: 'left' | 'right') {
    super();
    this.caption = new GlyphText(font, { size: 10, tint: THEME.dim, letterSpacing: 2, align });
    this.value = new GlyphText(font, { size: 16, tint, letterSpacing: 1.5, align });
    this.caption.text = caption;
    this.value.text = '—';
    this.caption.position.set(0, 0);
    this.value.position.set(0, 22);
    this.addChild(this.caption, this.value);
  }
  setCaption(t: string): void { this.caption.text = t; }
  set(v: string): void { this.value.text = v; }
}

export class UiPanel extends Container {
  private bar = new Graphics();
  private spin: Button;
  private skip: Button;
  private turbo: Button;
  private help: Button;
  private betDown: Button; private betUp: Button;
  private modeLeft: Button; private modeRight: Button;
  private modeLabel: GlyphText;
  private betReadout: Readout;
  private balReadout: Readout;
  private h = 0;

  constructor(font: GlyphFont, cb: UiCallbacks) {
    super();
    this.addChild(this.bar);
    this.spin = new Button(font, 'SPIN', 100, 56, true, cb.onSpin);
    this.skip = new Button(font, 'SKIP', 80, 44, false, cb.onSkip);
    this.turbo = new Button(font, 'TURBO', 80, 44, false,
      () => this.turbo.setOn(cb.onToggleTurbo()));
    this.help = new Button(font, 'HELP', 80, 44, false, cb.onHelp);
    this.betDown = new Button(font, '-', 44, 44, false, () => cb.onBetStep(-1));
    this.betUp = new Button(font, '+', 44, 44, false, () => cb.onBetStep(1));
    this.modeLeft = new Button(font, '<', 40, 36, false, () => cb.onModeStep(-1));
    this.modeRight = new Button(font, '>', 40, 36, false, () => cb.onModeStep(1));
    this.modeLabel = new GlyphText(font, { size: 13, tint: THEME.amber2, align: 'center', letterSpacing: 2 });
    this.betReadout = new Readout(font, 'BET', THEME.amber2, 'left');
    this.balReadout = new Readout(font, 'BALANCE', THEME.txt, 'right');
    this.addChild(this.spin, this.skip, this.turbo, this.help, this.betDown, this.betUp,
      this.modeLeft, this.modeRight, this.modeLabel, this.betReadout, this.balReadout);
  }

  get height2(): number { return this.h; }

  setBalance(v: string): void { this.balReadout.set(v); }
  setBet(v: string): void { this.betReadout.set(v); }
  setMode(v: string): void { this.modeLabel.text = v; }
  setSpinEnabled(v: boolean): void { this.spin.setEnabled(v); }
  setTurboVisible(v: boolean): void { this.turbo.visible = v; }
  setCaptions(bet: string, balance: string): void {
    this.betReadout.setCaption(bet); this.balReadout.setCaption(balance);
  }
  setLabels(spin: string, skip: string, turbo: string, help: string): void {
    this.spin.setText(spin); this.skip.setText(skip);
    this.turbo.setText(turbo); this.help.setText(help);
  }

  /** Lay the bar out for the given stage size. Returns the height it occupies. */
  layout(w: number, h: number): number {
    const compact = w < 720;
    const barH = compact ? 132 : 96;
    this.h = barH;
    const y = h - barH;
    this.position.set(0, y);

    this.bar.clear();
    this.bar.rect(0, 0, w, barH).fill({ color: 0x100c08 });
    this.bar.rect(0, 0, w, 2).fill({ color: THEME.line });
    this.bar.rect(0, 0, w, 1).fill({ color: 0x3a2a18, alpha: 0.9 });

    const pad = Math.max(12, w * 0.02);
    const btnH = 46;

    if (compact) {
      // portrait: readouts on top row, controls beneath, primary full width
      this.betReadout.position.set(pad, 10);
      this.balReadout.position.set(w - pad, 10);
      const row2 = 58;
      const smallW = (w - pad * 2 - 3 * 8) / 4;
      this.skip.setSize(smallW, btnH); this.skip.position.set(pad, row2);
      this.turbo.setSize(smallW, btnH); this.turbo.position.set(pad + smallW + 8, row2);
      this.help.setSize(smallW, btnH); this.help.position.set(pad + (smallW + 8) * 2, row2);
      this.spin.setSize(smallW, btnH); this.spin.position.set(pad + (smallW + 8) * 3, row2);
      // bet stepper + mode sit above, beside the readouts
      this.betDown.setSize(34, 30); this.betDown.position.set(pad + 66, 16);
      this.betUp.setSize(34, 30); this.betUp.position.set(pad + 104, 16);
      this.modeLeft.visible = this.modeRight.visible = false;
      this.modeLabel.position.set(w / 2, 30);
    } else {
      this.modeLeft.visible = this.modeRight.visible = true;
      const spinW = 168;
      this.spin.setSize(spinW, 56); this.spin.position.set(pad, (barH - 56) / 2);
      let x = pad + spinW + 16;
      for (const b of [this.skip, this.turbo, this.help]) {
        b.setSize(84, btnH); b.position.set(x, (barH - btnH) / 2); x += 92;
      }
      // bet stepper
      this.betDown.setSize(40, btnH); this.betDown.position.set(x, (barH - btnH) / 2);
      this.betReadout.position.set(x + 48, 24);
      this.betUp.setSize(40, btnH); this.betUp.position.set(x + 140, (barH - btnH) / 2);
      // mode selector, centred-right
      const mx = x + 220;
      this.modeLeft.setSize(36, 34); this.modeLeft.position.set(mx, (barH - 34) / 2);
      this.modeLabel.position.set(mx + 128, barH / 2 + 5);
      this.modeRight.setSize(36, 34); this.modeRight.position.set(mx + 220, (barH - 34) / 2);
      this.balReadout.position.set(w - pad, 24);
    }
    return barH;
  }
}
