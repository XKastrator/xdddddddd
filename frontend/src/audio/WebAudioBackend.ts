/**
 * WebAudioBackend — concrete AudioBackend for AudioManager.
 *
 * Sounds are SYNTHESISED placeholders (no audio assets shipped yet): a filtered
 * noise "clank" for forging, a rising ping for Heat, a low rumble bed, and a
 * bell-like chord for max win. Swapping in real files later means replacing the
 * `play`/`loop` bodies with buffer playback — AudioManager is unaffected.
 *
 * Autoplay policy: the context starts suspended until the first user gesture,
 * so `unlock()` must be called from a click/keydown handler.
 */
import type { AudioBackend } from './AudioManager';

interface Voice { gain: GainNode; stop: () => void; }

export class WebAudioBackend implements AudioBackend {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private loops = new Map<string, Voice>();
  private muted = false;
  private duckTimer: number | null = null;

  /** Must be called from a user gesture (autoplay policy). */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;                      // no WebAudio: game stays silent, never breaks
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  loop(id: string, volume: number): void {
    if (!this.ctx || !this.master) return;
    const existing = this.loops.get(id);
    if (existing) {
      existing.gain.gain.setTargetAtTime(volume * 0.18, this.ctx.currentTime, 0.15);
      return;
    }
    // low, slowly detuned drone = the forge bed
    const gain = this.ctx.createGain();
    gain.gain.value = volume * 0.18;
    gain.connect(this.master);
    const oscA = this.ctx.createOscillator();
    oscA.type = 'sawtooth'; oscA.frequency.value = 55;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'sine'; oscB.frequency.value = 82.5;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    oscA.connect(filter); oscB.connect(filter); filter.connect(gain);
    oscA.start(); oscB.start();
    this.bedGain = gain;
    this.loops.set(id, { gain, stop: () => { oscA.stop(); oscB.stop(); } });
  }

  stopLoop(id: string): void {
    const v = this.loops.get(id);
    if (!v) return;
    try { v.stop(); } catch { /* already stopped */ }
    v.gain.disconnect();
    this.loops.delete(id);
    if (this.bedGain === v.gain) this.bedGain = null;
  }

  play(id: string, volume: number): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    if (id.includes('forge')) this.clank(now, volume);
    else if (id.includes('heat')) this.ping(now, volume, 880);
    else if (id.includes('max')) this.chord(now, volume, [523.25, 659.25, 783.99, 1046.5]);
    else if (id.includes('super') || id.includes('pour')) this.chord(now, volume, [130.8, 196, 261.6]);
    else if (id.includes('bonus')) this.chord(now, volume, [261.6, 329.6, 392]);
    else this.ping(now, volume * 0.6, 660);
  }

  duck(target: number, ms: number): void {
    if (!this.ctx || !this.bedGain) return;
    const g = this.bedGain.gain;
    const now = this.ctx.currentTime;
    const restore = g.value;
    g.setTargetAtTime(restore * target, now, 0.03);
    if (this.duckTimer !== null) clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      if (this.ctx) g.setTargetAtTime(restore, this.ctx.currentTime, 0.12);
    }, ms);
  }

  // --- synthesis helpers ---------------------------------------------------
  private env(gain: GainNode, t0: number, peak: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  }

  private clank(t0: number, vol: number): void {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * 0.25);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 6;
    const g = this.ctx.createGain();
    this.env(g, t0, 0.35 * vol, 0.22);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + 0.3);
  }

  private ping(t0: number, vol: number, freq: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + 0.16);
    const g = this.ctx.createGain();
    this.env(g, t0, 0.22 * vol, 0.2);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.25);
  }

  private chord(t0: number, vol: number, freqs: number[]): void {
    if (!this.ctx || !this.master) return;
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      const g = this.ctx!.createGain();
      this.env(g, t0 + i * 0.05, 0.2 * vol, 0.9);
      osc.connect(g); g.connect(this.master!);
      osc.start(t0 + i * 0.05); osc.stop(t0 + i * 0.05 + 1.0);
    });
  }
}
