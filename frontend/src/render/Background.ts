/**
 * Background — the Deepforge scene, built as a PARALLAX STACK rather than a
 * single sheet of wallpaper.
 *
 * A slot's environment reads as painted depth only when the room is actually
 * split into planes that move at different rates. Three planes here:
 *
 *   far    the cavern itself — gradient, lava seams, embers (the authored JPEG)
 *   mid    the architecture — basalt columns, capitals, the vault arch
 *   near   the foreground — floor lip, hanging chains, braziers
 *
 * Each plane accepts DROP-IN PAINTED ART (`scene_{name}_mid.png`,
 * `scene_{name}_near.png`); where none is supplied the plane is drawn
 * procedurally, so depth exists today and improves the moment real art lands.
 * Everything is cover-fitted with headroom so parallax offsets never expose an
 * edge, and the centre stays low-contrast so the grid and HUD read on top.
 *
 * A vignette and floor glow are composited on top from generated radial-gradient
 * textures — Graphics has no smooth radial fill, and stepped rings posterise
 * badly on a dark scene.
 */
import { CanvasSource, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { THEME } from './palette';
import { tween } from './tween';

export type SceneName = 'base' | 'bonus' | 'super';
const SCENES: SceneName[] = ['base', 'bonus', 'super'];

/** Textures for one scene. Only `far` is expected to exist. */
export interface SceneArt {
  far?: Texture;
  mid?: Texture;
  near?: Texture;
}
export type SceneTextures = Partial<Record<SceneName, SceneArt>>;

type PlaneName = 'far' | 'mid' | 'near';

/**
 * How much each plane moves relative to the camera. Far barely shifts; near
 * moves fully. These are the whole illusion — keep them well separated.
 */
const DEPTH: Record<PlaneName, number> = { far: 0.18, mid: 0.52, near: 1 };
/** Cover-fit headroom, so a plane can slide without revealing its edge. */
const OVERSCAN = 1.14;
const DRIFT_PX = 9;
const POINTER_PX = 22;

interface ScenePalette {
  rock: number;      // basalt body
  rockLit: number;   // rim light on the lit side
  lava: number;      // seam colour
  lavaHot: number;   // seam core
  glowAlpha: number; // floor glow strength
}

const PALETTES: Record<SceneName, ScenePalette> = {
  base: { rock: 0x0d0a07, rockLit: 0x3a2a18, lava: 0xff7a18, lavaHot: 0xffe9b8, glowAlpha: 0.20 },
  bonus: { rock: 0x120b07, rockLit: 0x50351c, lava: 0xff8c22, lavaHot: 0xfff0c8, glowAlpha: 0.36 },
  super: { rock: 0x170c06, rockLit: 0x6b3a12, lava: 0xffc46a, lavaHot: 0xfffaf0, glowAlpha: 0.55 },
};

/** A soft radial falloff, generated once and reused (smooth, no banding). */
function radialTexture(inner: string, outer: string, stop: number): Texture {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(stop, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new Texture({ source: new CanvasSource({ resource: cv }) });
}

/**
 * One plane of one scene: an optional painted sprite plus a procedural layer.
 * Both are kept — painted art overrides the procedural draw, it does not have to
 * replace the whole plane.
 */
class Plane extends Container {
  private sprite: Sprite | null = null;
  readonly gfx = new Graphics();

  constructor(tex: Texture | undefined) {
    super();
    if (tex) {
      this.sprite = new Sprite(tex);
      this.sprite.anchor.set(0.5);
      this.addChild(this.sprite);
    }
    this.addChild(this.gfx);
  }

  get painted(): boolean { return this.sprite !== null; }

  fit(w: number, h: number): void {
    if (!this.sprite) return;
    const { width: tw, height: th } = this.sprite.texture;
    this.sprite.scale.set(Math.max(w / tw, h / th) * OVERSCAN);
    this.sprite.position.set(w / 2, h / 2);
  }
}

export class Background extends Container {
  /** Plane containers, back to front. Parallax is applied to these. */
  private planes: Record<PlaneName, Container> = {
    far: new Container(), mid: new Container(), near: new Container(),
  };
  /** Per scene, per plane. */
  private scene: Record<string, Record<PlaneName, Plane>> = {};
  /** Per-scene group alpha lives on these wrappers so a cross-fade is one tween. */
  private groups = new Map<SceneName, Container[]>();
  private fallback = new Graphics();
  private grade = new Container();
  private vignette: Sprite;
  private floorGlow: Sprite;
  private current: SceneName = 'base';
  private px = 0;
  private py = 0;
  private any = false;

  constructor(textures: SceneTextures) {
    super();
    this.addChild(this.fallback);

    for (const name of SCENES) {
      const art = textures[name] ?? {};
      const per = {} as Record<PlaneName, Plane>;
      const wrappers: Container[] = [];
      for (const plane of ['far', 'mid', 'near'] as PlaneName[]) {
        const p = new Plane(art[plane]);
        p.alpha = name === 'base' ? 1 : 0;
        if (art[plane]) this.any = true;
        per[plane] = p;
        wrappers.push(p);
        this.planes[plane].addChild(p);
      }
      this.scene[name] = per;
      this.groups.set(name, wrappers);
      if (art.far) this.any = true;
    }
    this.addChild(this.planes.far, this.planes.mid, this.planes.near);

    this.vignette = new Sprite(radialTexture('rgba(0,0,0,0)', 'rgba(0,0,0,0.82)', 0.34));
    this.floorGlow = new Sprite(radialTexture('rgba(255,140,40,0.55)', 'rgba(255,140,40,0)', 0.02));
    this.vignette.anchor.set(0.5);
    this.floorGlow.anchor.set(0.5);
    this.grade.addChild(this.floorGlow, this.vignette);
    this.addChild(this.grade);
  }

  /** True once any authored scene texture is present. */
  get hasArt(): boolean { return this.any; }

  /**
   * `h` is the PLAY area height — the room has to compose above the control bar,
   * not behind it, or the floor and braziers end up hidden and the floor glow
   * shows as a bright band cut off by the bar. `fullH` is the whole stage, used
   * only for the backing fill so nothing shows through.
   */
  resize(w: number, h: number, fullH: number = h): void {
    this.fallback.clear();
    this.fallback.rect(0, 0, w, fullH).fill({ color: THEME.bg0 });
    if (!this.any) {
      // painted stand-in for the far plane when no scene images shipped
      this.fallback.rect(0, 0, w, h * 0.62).fill({ color: 0x140f0a, alpha: 0.85 });
      this.fallback.ellipse(w / 2, h * 1.02, w * 0.6, h * 0.35)
        .fill({ color: THEME.amber, alpha: 0.16 });
    }

    for (const name of SCENES) {
      const pal = PALETTES[name];
      const per = this.scene[name];
      for (const plane of ['far', 'mid', 'near'] as PlaneName[]) per[plane].fit(w, h);
      // procedural planes are skipped wherever painted art was supplied
      per.mid.gfx.clear();
      if (!per.mid.painted) drawArchitecture(per.mid.gfx, w, h, pal);
      per.near.gfx.clear();
      if (!per.near.painted) drawForeground(per.near.gfx, w, h, pal);
    }

    // vignette covers the stage with headroom; the glow sits on the floor line
    const v = Math.max(w, h) * 1.5;
    this.vignette.width = this.vignette.height = v;
    this.vignette.position.set(w / 2, h / 2);
    this.floorGlow.width = w * 1.7;
    this.floorGlow.height = h * 0.9;
    this.floorGlow.position.set(w / 2, h * 1.02);
    this.floorGlow.alpha = PALETTES[this.current].glowAlpha;
  }

  /** Cross-fade every plane of a scene at once. Instant under reduced motion. */
  async to(name: SceneName, ctx: { shouldSkip: () => boolean; reduced: boolean }): Promise<void> {
    if (name === this.current) return;
    const from = this.groups.get(this.current) ?? [];
    const to = this.groups.get(name) ?? [];
    const glowFrom = PALETTES[this.current].glowAlpha;
    const glowTo = PALETTES[name].glowAlpha;
    this.current = name;
    await tween({
      duration: 520, shouldSkip: ctx.shouldSkip, reducedMotion: ctx.reduced,
      onUpdate: (t) => {
        for (const c of to) c.alpha = t;
        for (const c of from) c.alpha = 1 - t;
        this.floorGlow.alpha = glowFrom + (glowTo - glowFrom) * t;
      },
    });
    for (const c of to) c.alpha = 1;
    for (const c of from) c.alpha = 0;
    this.floorGlow.alpha = glowTo;
  }

  /**
   * Pointer-driven camera. `nx`/`ny` are -1..1 across the stage; on touch there
   * is no pointer, which is why `drift` runs regardless.
   */
  setPointer(nx: number, ny: number): void {
    this.px = Math.max(-1, Math.min(1, nx));
    this.py = Math.max(-1, Math.min(1, ny));
  }

  /** Ambient drift plus the pointer offset, applied per plane depth. */
  drift(seconds: number): void {
    const ax = Math.sin(seconds * 0.25);
    const ay = Math.cos(seconds * 0.18);
    for (const plane of ['far', 'mid', 'near'] as PlaneName[]) {
      const d = DEPTH[plane];
      this.planes[plane].position.set(
        (ax * DRIFT_PX - this.px * POINTER_PX) * d,
        (ay * DRIFT_PX * 0.7 - this.py * POINTER_PX * 0.5) * d,
      );
    }
  }
}

/**
 * MID PLANE — the room's architecture.
 *
 * Columns hug the outer edges so they frame the board instead of competing with
 * it; a vault arch behind the centre gives the room a back wall to sit against.
 */
function drawArchitecture(g: Graphics, w: number, h: number, p: ScenePalette): void {
  // Vault arch behind the board. Deliberately UNSTROKED and low-alpha: an
  // outlined round-rect reads as a stadium graphic pasted on the scene, whereas
  // a soft dark mass reads as the far wall the board is standing against.
  const archW = w * 0.84;
  const archH = h * 0.78;
  const ax = (w - archW) / 2;
  g.roundRect(ax, -h * 0.04, archW, archH, archW * 0.46)
    .fill({ color: p.rock, alpha: 0.34 });
  g.roundRect(ax + archW * 0.06, -h * 0.02, archW * 0.88, archH * 0.9, archW * 0.42)
    .fill({ color: 0x000000, alpha: 0.16 });

  // A stone plinth the whole room stands on. Gives the mid plane a floor line
  // to meet, so the columns end somewhere instead of running off the canvas.
  const plinthY = h * 0.80;
  g.rect(-4, plinthY, w + 8, h - plinthY + 8).fill({ color: p.rock, alpha: 0.75 });
  g.rect(-4, plinthY, w + 8, h * 0.012).fill({ color: p.rockLit, alpha: 0.5 });

  const colW = Math.max(64, w * 0.115);
  for (const [x, lit] of [[0, 1], [w - colW, -1]] as [number, number][]) {
    // Shaft. Lifted off pure black on purpose: at `p.rock` alpha 0.94 the
    // columns were indistinguishable from the backdrop and all that showed was
    // the lava seam, reading as two stray orange lines floating in the dark.
    g.rect(x, -h * 0.05, colW, h * 1.1).fill({ color: p.rockLit, alpha: 0.30 });
    g.rect(x, -h * 0.05, colW, h * 1.1).fill({ color: p.rock, alpha: 0.72 });
    // rim light down the edge that faces the forge
    const rimX = lit > 0 ? x + colW - colW * 0.13 : x;
    g.rect(rimX, -h * 0.05, colW * 0.13, h * 1.1)
      .fill({ color: p.rockLit, alpha: 0.55 });
    // capital and base blocks — the detail that stops a column reading as a bar
    for (const cy of [h * 0.08, h * 0.78]) {
      g.rect(x - colW * 0.12, cy, colW * 1.24, h * 0.045)
        .fill({ color: p.rock, alpha: 1 });
      g.rect(x - colW * 0.12, cy, colW * 1.24, h * 0.010)
        .fill({ color: p.rockLit, alpha: 0.7 });
    }
    // a lava seam running down the stone
    g.moveTo(x + colW * 0.5, h * 0.14)
      .lineTo(x + colW * 0.34, h * 0.42)
      .lineTo(x + colW * 0.58, h * 0.76)
      .stroke({ width: Math.max(2, colW * 0.06), color: p.lava, alpha: 0.5 });
  }
}

/**
 * NEAR PLANE — foreground furniture.
 *
 * Everything here is in FRONT of the board, so it is confined to the bottom lip
 * and the top corners. It must never cross the grid.
 */
function drawForeground(g: Graphics, w: number, h: number, p: ScenePalette): void {
  // floor lip: a dark shelf with a molten seam along its top edge. The seam is
  // laid down as bloom -> body -> core, the same three passes the scene art
  // uses, so it reads as glowing rock rather than a stray hairline.
  const lipY = h * 0.91;
  const edge = (): void => {
    g.moveTo(-4, lipY + h * 0.03).lineTo(w * 0.24, lipY)
      .lineTo(w * 0.62, lipY + h * 0.018).lineTo(w + 4, lipY - h * 0.01);
  };
  g.moveTo(-4, h + 4).lineTo(-4, lipY + h * 0.03)
    .lineTo(w * 0.24, lipY).lineTo(w * 0.62, lipY + h * 0.018)
    .lineTo(w + 4, lipY - h * 0.01).lineTo(w + 4, h + 4)
    .fill({ color: p.rock, alpha: 0.97 });
  edge(); g.stroke({ width: Math.max(8, h * 0.022), color: p.lava, alpha: 0.16 });
  edge(); g.stroke({ width: Math.max(3, h * 0.007), color: p.lava, alpha: 0.85 });
  edge(); g.stroke({ width: Math.max(1, h * 0.002), color: p.lavaHot, alpha: 0.9 });

  // Hanging chains in the top corners. Portrait has no side gutter — the board
  // reaches almost edge to edge — so foreground furniture would hang straight
  // across the grid and is dropped instead.
  const link = Math.max(7, h * 0.016);
  if (w > 700) {
    for (const cx of [w * 0.035, w * 0.965]) {
      const len = h * (cx < w / 2 ? 0.26 : 0.19);
      for (let y = -link; y < len; y += link * 1.55) {
        g.ellipse(cx, y, link * 0.44, link * 0.8)
          .fill({ color: p.rock, alpha: 0.95 });
        g.ellipse(cx, y, link * 0.44, link * 0.8)
          .stroke({ width: 1.5, color: p.rockLit, alpha: 0.65 });
      }
    }
  }

  // braziers on the lip: a bowl silhouette with a hot core
  for (const cx of [w * 0.085, w * 0.915]) {
    const by = lipY + h * 0.012;
    const r = Math.max(16, w * 0.026);
    g.ellipse(cx, by - r * 0.2, r * 1.15, r * 0.42)
      .fill({ color: p.lava, alpha: 0.55 });
    g.ellipse(cx, by - r * 0.25, r * 0.6, r * 0.22)
      .fill({ color: p.lavaHot, alpha: 0.8 });
    g.moveTo(cx - r, by - r * 0.2).lineTo(cx - r * 0.45, by + r * 0.9)
      .lineTo(cx + r * 0.45, by + r * 0.9).lineTo(cx + r, by - r * 0.2)
      .fill({ color: p.rock, alpha: 1 });
    g.rect(cx - r * 0.12, by + r * 0.9, r * 0.24, r * 0.5)
      .fill({ color: p.rock, alpha: 1 });
  }
}
