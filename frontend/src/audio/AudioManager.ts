/**
 * AudioManager — layered, state-reactive mix with ducking and SFX priority.
 *
 * Layers (see ART_BIBLE.md): base ambience, spin, win, mechanic (forge), heat,
 * bonus, super, big-win, max-win. Music intensity tracks Heat / round state so
 * escalation is audible without chaos. SFX priority prevents stacking; a
 * higher-priority stinger ducks the music bed briefly.
 *
 * This is a framework-agnostic contract; wire it to WebAudio/Howler in prod.
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

export class AudioManager {
  private muted = false;
  private currentPriority = 0;

  constructor(private backend: AudioBackend) {}

  setMuted(m: boolean): void { this.muted = m; this.backend.setMuted(m); }

  /** Music intensity 0..1 mapped from Heat (0..cap). */
  setHeatIntensity(heat: number, cap: number): void {
    const t = Math.max(0, Math.min(1, heat / cap));
    this.backend.loop('bed', 0.5 + 0.5 * t);
  }

  stinger(layer: Layer, id: string, volume = 1): void {
    if (this.muted) return;
    const pr = SFX_PRIORITY[layer];
    // a lower-priority stinger never interrupts a still-playing higher one
    if (pr < this.currentPriority && pr < 4) return;
    // duck the bed for high-priority stingers so they read clearly
    if (pr >= 4) this.backend.duck(0.25, 600);
    this.currentPriority = pr;
    this.backend.play(id, volume);
  }

  enterState(state: 'base' | 'bonus' | 'super'): void {
    this.currentPriority = 0;
    this.backend.stopLoop('bed');
    this.backend.loop('bed', 0.7);
    if (state === 'bonus') this.stinger('bonus', 'sfx_bonus_start');
    if (state === 'super') this.stinger('super', 'sfx_super_start');
  }
}
