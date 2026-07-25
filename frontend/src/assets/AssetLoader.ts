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

import { GlyphFont, type FontMeta } from '../render/GlyphText';

export type SceneName = 'base' | 'bonus' | 'super';
const SCENES: SceneName[] = ['base', 'bonus', 'super'];

export class AssetLoader {
  private textures = new Map<Sym, Texture>();
  private audio = new Map<string, ArrayBuffer>();
  private scenes: Partial<Record<SceneName, Texture>> = {};
  private parts: Record<string, { texture: Texture; pivot: { x: number; y: number } }> = {};
  private glyphFont: GlyphFont | null = null;
  /** Non-fatal load problems, surfaced by the boot diagnostics. */
  readonly warnings: string[] = [];
  loaded = false;

  /**
   * Resolve the asset folder from THIS MODULE's own URL rather than from the
   * page URL. A game served from a CDN sub-path (Stake Engine serves
   * `.../{gameID}/{version}/index.html`) may be requested with or without a
   * trailing slash; a bare relative string like 'assets/' then resolves one
   * level off and every asset 404s. The bundle always sits in `<root>/assets/`,
   * so its own URL is the reliable anchor.
   */
  static defaultBase(): string {
    try {
      return new URL('./', import.meta.url).href;
    } catch {
      return 'assets/';
    }
  }

  /** `onProgress` receives 0..1 across the whole asset set. */
  async load(base = AssetLoader.defaultBase(), onProgress?: (p: number) => void): Promise<void> {
    // meta + atlas + character + 3 scenes + audio
    const steps = 3 + 1 + SCENES.length + AUDIO_IDS.length;
    let done = 0;
    const tick = () => onProgress?.(++done / steps);

    // Symbol atlas. NOT fatal: SymbolSprite falls back to procedural shapes, so
    // a missing atlas costs looks, never the ability to play. A hard failure
    // here used to abort boot and leave a black canvas.
    try {
      const meta: AtlasMeta = await fetch(`${base}atlas.json`).then((r) => {
        if (!r.ok) throw new Error(`atlas.json ${r.status}`);
        return r.json();
      });
      tick();
      const sheet: Texture = await Assets.load(`${base}${meta.image}`);
      for (const [symStr, frame] of Object.entries(FRAME_OF)) {
        const f = meta.frames[frame as string];
        if (!f) continue;
        this.textures.set(Number(symStr) as Sym, new Texture({
          source: sheet.source,
          frame: new Rectangle(f.x, f.y, f.w, f.h),
        }));
      }
    } catch (e) {
      this.warnings.push(`symbol atlas unavailable (${String(e)})`);
      tick();
    }
    tick();

    // display typeface — the HUD falls back to Pixi Text if this is missing
    try {
      const fm: FontMeta = await fetch(`${base}font.json`).then((r) => r.json());
      const fsheet: Texture = await Assets.load(`${base}${fm.image}`);
      this.glyphFont = new GlyphFont(fm, fsheet);
    } catch (e) { this.warnings.push(`display face unavailable (${String(e)})`); }
    tick();

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
    } catch (e) { this.warnings.push(`character rig unavailable (${String(e)})`); }
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
  font(): GlyphFont | null { return this.glyphFont; }
  rigParts(): Record<string, { texture: Texture; pivot: { x: number; y: number } }> {
    return this.parts;
  }
}
