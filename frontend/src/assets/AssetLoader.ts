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


import { GlyphFont, type FontMeta } from '../render/GlyphText';

import type { SceneArt, SceneTextures } from '../render/Background';

export type SceneName = 'base' | 'bonus' | 'super';
const SCENES: SceneName[] = ['base', 'bonus', 'super'];

export class AssetLoader {
  private textures = new Map<Sym, Texture>();
  private audio = new Map<string, ArrayBuffer>();
  private scenes: SceneTextures = {};
  private glyphFont: GlyphFont | null = null;
  private logoTex: Texture | null = null;
  private characterTex: Texture | null = null;
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
    // meta + atlas + font + character + logo + 3 scenes + audio
    const steps = 3 + 2 + SCENES.length + AUDIO_IDS.length;
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

    // the smith — optional, the game runs without him
    try { this.characterTex = await Assets.load(`${base}character.webp`); }
    catch (e) { this.warnings.push(`character unavailable (${String(e)})`); }
    tick();

    // wordmark — optional, the title card falls back to glyph text
    try { this.logoTex = await Assets.load(`${base}logo.png`); }
    catch (e) { this.warnings.push(`logo unavailable (${String(e)})`); }
    tick();

    // Scenes are LAYERED: `scene_x.jpg` is the far plane, and the mid/near
    // planes are optional painted overrides for what Background otherwise draws
    // procedurally. Every one of the three is independently optional.
    await Promise.all(SCENES.map(async (name) => {
      const art: SceneArt = {};
      const tryLoad = async (file: string): Promise<Texture | undefined> => {
        try { return await Assets.load(`${base}${file}`); } catch { return undefined; }
      };
      // far planes are opaque JPEG; the mid/near planes need alpha and ship as
      // WebP, which is 6-8x smaller than the equivalent PNG
      art.far = await tryLoad(`scene_${name}.jpg`);
      art.mid = await tryLoad(`scene_${name}_mid.webp`);
      art.near = await tryLoad(`scene_${name}_near.webp`);
      this.scenes[name] = art;
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
  sceneTextures(): SceneTextures { return this.scenes; }
  font(): GlyphFont | null { return this.glyphFont; }
  logo(): Texture | null { return this.logoTex; }
  character(): Texture | null { return this.characterTex; }
}
