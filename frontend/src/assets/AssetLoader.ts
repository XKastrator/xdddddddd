/**
 * AssetLoader — preloads the texture atlas and the audio set, reporting real
 * progress to the loading screen.
 *
 * The atlas is ONE texture cut into per-symbol sub-textures, so the whole board
 * draws from a single base texture (low draw calls on mobile). Audio is fetched
 * as ArrayBuffers here and decoded lazily by the audio backend, so a silent
 * player never pays the decode cost.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';
import { Sym } from '../types/events';

export interface AtlasMeta {
  image: string;
  cell: number;
  size: { w: number; h: number };
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

/** Frame name in the atlas for each symbol id. */
const FRAME_OF: Partial<Record<Sym, string>> = {
  [Sym.O1]: 'O1', [Sym.O2]: 'O2', [Sym.O3]: 'O3', [Sym.O4]: 'O4', [Sym.O5]: 'O5',
  [Sym.BRONZE]: 'BRONZE', [Sym.IRON]: 'IRON', [Sym.SILVER]: 'SILVER',
  [Sym.GOLD]: 'GOLD', [Sym.MYTHRIL]: 'MYTHRIL', [Sym.CROWN]: 'CROWN',
  [Sym.FLUX]: 'FLUX', [Sym.CINDER]: 'CINDER',
};

export const AUDIO_IDS = [
  'bed_base', 'bed_bonus', 'bed_super',
  'sfx_spin', 'sfx_forge', 'sfx_forge_big', 'sfx_heat', 'sfx_cinder', 'sfx_retrigger',
  'sting_bonus', 'sting_super', 'sting_pour', 'sting_bigwin', 'sting_maxwin',
] as const;

export type AudioId = typeof AUDIO_IDS[number];

export interface RigMeta {
  image: string;
  frames: Record<string, { x: number; y: number; w: number; h: number;
    pivot: { x: number; y: number } }>;
}

export type SceneName = 'base' | 'bonus' | 'super';
const SCENES: SceneName[] = ['base', 'bonus', 'super'];

export class AssetLoader {
  private textures = new Map<Sym, Texture>();
  private audio = new Map<string, ArrayBuffer>();
  private scenes: Partial<Record<SceneName, Texture>> = {};
  private parts: Record<string, { texture: Texture; pivot: { x: number; y: number } }> = {};
  loaded = false;

  /** `onProgress` receives 0..1 across the whole asset set. */
  async load(base = 'assets/', onProgress?: (p: number) => void): Promise<void> {
    // meta + atlas + character + 3 scenes + audio
    const steps = 2 + 1 + SCENES.length + AUDIO_IDS.length;
    let done = 0;
    const tick = () => onProgress?.(++done / steps);

    const meta: AtlasMeta = await fetch(`${base}atlas.json`).then((r) => r.json());
    tick();

    const sheet: Texture = await Assets.load(`${base}${meta.image}`);
    tick();
    for (const [symStr, frame] of Object.entries(FRAME_OF)) {
      const f = meta.frames[frame as string];
      if (!f) continue;
      this.textures.set(Number(symStr) as Sym, new Texture({
        source: sheet.source,
        frame: new Rectangle(f.x, f.y, f.w, f.h),
      }));
    }

    // character rig parts — optional, the game runs without the smith
    try {
      const rig: RigMeta = await fetch(`${base}character.json`).then((r) => r.json());
      const rigSheet: Texture = await Assets.load(`${base}${rig.image}`);
      for (const [name, f] of Object.entries(rig.frames)) {
        this.parts[name] = {
          texture: new Texture({ source: rigSheet.source,
            frame: new Rectangle(f.x, f.y, f.w, f.h) }),
          pivot: f.pivot,
        };
      }
    } catch { /* no character art: rig simply is not shown */ }
    tick();

    // scenes — optional, Background falls back to a painted gradient
    await Promise.all(SCENES.map(async (name) => {
      try { this.scenes[name] = await Assets.load(`${base}scene_${name}.jpg`); }
      catch { /* keep going */ }
      tick();
    }));

    // audio is optional: a failed fetch must never block the game from starting
    await Promise.all(AUDIO_IDS.map(async (id) => {
      try {
        const buf = await fetch(`${base}audio/${id}.ogg`).then((r) => r.arrayBuffer());
        this.audio.set(id, buf);
      } catch { /* keep going silently */ }
      tick();
    }));

    this.loaded = true;
  }

  texture(sym: Sym): Texture | undefined { return this.textures.get(sym); }
  audioBuffer(id: string): ArrayBuffer | undefined { return this.audio.get(id); }
  sceneTextures(): Partial<Record<SceneName, Texture>> { return this.scenes; }
  rigParts(): Record<string, { texture: Texture; pivot: { x: number; y: number } }> {
    return this.parts;
  }
}
