/**
 * AudioManager — layered, state-reactive mix with ducking and SFX priority.
 *
 * Layers (ART_BIBLE.md §10): base/bonus/super ambience beds, spin, forge, heat,
 * bonus, super, big win, max win. Music intensity tracks Heat so escalation is
 * audible without chaos; a higher-priority stinger ducks the bed briefly so it
 * reads clearly. Asset ids match the files produced by assets/generate_audio.py.
 */
export type Layer =
  | 'ambience' | 'spin' | 'win' | 'forge' | 'heat'
  | 'bonus' | 'super' | 'bigwin' | 'maxwin';

export interface AudioBackend {
  loop(id: string, volume: number): void;
  stopLoop(id: string): void;
  play(id: string, volume: number): void;
  duck(target: number, ms: number): void; // lower music bed to `target` for ms
  setMuted(muted: boolean): void;
}

const SFX_PRIORITY: Record<Layer, number> = {
  ambience: 0, spin: 1, win: 2, forge: 2, heat: 3,
  bonus: 4, super: 5, bigwin: 6, maxwin: 10,
};

const BED_OF = { base: 'bed_base', bonus: 'bed_bonus', super: 'bed_super' } as const;

export class AudioManager {
  private muted = false;
  private currentPriority = 0;
  private bed: string | null = null;

  constructor(private backend: AudioBackend) {}

  setMuted(m: boolean): void { this.muted = m; this.backend.setMuted(m); }

  /** Music intensity 0..1 mapped from Heat (0..cap). */
  setHeatIntensity(heat: number, cap: number): void {
    if (!this.bed) return;
    const t = Math.max(0, Math.min(1, heat / cap));
    this.backend.loop(this.bed, 0.55 + 0.45 * t);
  }

  stinger(layer: Layer, id: string, volume = 1): void {
    if (this.muted) return;
    const pr = SFX_PRIORITY[layer];
    // a lower-priority stinger never interrupts a still-playing higher one
    if (pr < this.currentPriority && pr < 4) return;
    // duck the bed for high-priority stingers so they read clearly
    if (pr >= 4) this.backend.duck(0.25, 900);
    this.currentPriority = pr;
    this.backend.play(id, volume);
  }

  /** Swap the ambience bed when the round changes state. */
  enterState(state: 'base' | 'bonus' | 'super'): void {
    this.currentPriority = 0;
    const next = BED_OF[state];
    if (this.bed === next) return;
    if (this.bed) this.backend.stopLoop(this.bed);
    this.bed = next;
    this.backend.loop(next, 0.7);
    if (state === 'bonus') this.stinger('bonus', 'sting_bonus');
    if (state === 'super') this.stinger('super', 'sting_super');
  }
}
