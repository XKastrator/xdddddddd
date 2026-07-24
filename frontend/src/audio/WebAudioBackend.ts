/**
 * WebAudioBackend — plays the preloaded OGG assets through WebAudio.
 *
 * Buffers arrive as ArrayBuffers from AssetLoader and are decoded on first use,
 * so a muted player never pays the decode cost. Beds are looped sources with
 * their own gain; stingers are one-shots routed through the master bus. Ducking
 * dips the bed gain so a high-priority stinger reads clearly.
 *
 * Autoplay policy: the context cannot start until a user gesture, so `unlock()`
 * must be called from a click/keydown handler.
 */
import type { AudioBackend } from './AudioManager';

type BufferProvider = (id: string) => ArrayBuffer | undefined;

interface LoopVoice { src: AudioBufferSourceNode; gain: GainNode; }

export class WebAudioBackend implements AudioBackend {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private decoded = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private loops = new Map<string, LoopVoice>();
  private muted = false;
  private duckTimer: number | null = null;

  constructor(private getBuffer: BufferProvider) {}

  /** Must be called from a user gesture (autoplay policy). */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;                   // no WebAudio: game stays silent, never breaks
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.02);
    }
  }

  /** Decode once and cache; concurrent requests share one decode. */
  private async decode(id: string): Promise<AudioBuffer | null> {
    const hit = this.decoded.get(id);
    if (hit) return hit;
    const inflight = this.pending.get(id);
    if (inflight) return inflight;

    const raw = this.getBuffer(id);
    if (!raw || !this.ctx) return null;
    const job = this.ctx.decodeAudioData(raw.slice(0))
      .then((buf) => { this.decoded.set(id, buf); this.pending.delete(id); return buf; })
      .catch(() => { this.pending.delete(id); return null; });
    this.pending.set(id, job);
    return job;
  }

  loop(id: string, volume: number): void {
    if (!this.ctx || !this.master) return;
    const existing = this.loops.get(id);
    if (existing) {                       // already running: just retarget volume
      existing.gain.gain.setTargetAtTime(volume * 0.5, this.ctx.currentTime, 0.2);
      return;
    }
    // reserve the slot synchronously so a rapid second call cannot double-start
    const gain = this.ctx.createGain();
    gain.gain.value = volume * 0.5;
    gain.connect(this.master);
    const src = this.ctx.createBufferSource();
    src.loop = true;
    this.loops.set(id, { src, gain });

    void this.decode(id).then((buf) => {
      const voice = this.loops.get(id);
      if (!buf || !this.ctx || voice?.src !== src) return;   // stopped meanwhile
      src.buffer = buf;
      src.connect(gain);
      src.start();
    });
  }

  stopLoop(id: string): void {
    const v = this.loops.get(id);
    if (!v) return;
    this.loops.delete(id);
    try { v.src.stop(); } catch { /* never started */ }
    v.src.disconnect();
    v.gain.disconnect();
  }

  play(id: string, volume: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    void this.decode(id).then((buf) => {
      if (!buf || !this.ctx || !this.master) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = volume;
      src.connect(g); g.connect(this.master);
      src.start();
      src.onended = () => { src.disconnect(); g.disconnect(); };
    });
  }

  /** Dip every running bed to `target` of its level for `ms`, then restore. */
  duck(target: number, ms: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const levels: { gain: GainNode; level: number }[] = [];
    for (const v of this.loops.values()) {
      levels.push({ gain: v.gain, level: v.gain.gain.value });
      v.gain.gain.setTargetAtTime(v.gain.gain.value * target, now, 0.04);
    }
    if (this.duckTimer !== null) clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      if (!this.ctx) return;
      for (const { gain, level } of levels) {
        gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.15);
      }
    }, ms);
  }
}
