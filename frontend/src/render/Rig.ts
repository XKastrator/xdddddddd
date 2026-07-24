/**
 * Rig — a small bone-based skeletal animator for the Emberwright.
 *
 * WHY NOT SPINE: Spine (Esoteric Software) is a licensed editor + runtime. This
 * project has no Spine licence and no editor, so rather than ship fake `.skel`
 * files it implements the same idea directly: a bone hierarchy whose parts are
 * separate textures rotated about their pivots, driven by keyframed clips.
 * If the studio owns Spine, the bone names and pivots here map 1:1 onto a Spine
 * skeleton and only this file is replaced.
 *
 * Bones (parent -> child): root -> body -> head, armBack, armFront
 * Clips: idle (breathing sway), strike (hammer raise + slam), cheer (both arms up)
 */
import { Container, Sprite, Texture } from 'pixi.js';

export interface BoneDef {
  name: string;
  parent?: string;
  x: number;          // offset from the parent's pivot, in rig units
  y: number;
  rotation?: number;  // radians, rest pose
  z: number;          // draw order (low draws first)
}

/** Rest pose. Units are the authored art's own pixels (512-cell space). */
export const EMBERWRIGHT_BONES: BoneDef[] = [
  { name: 'armBack', parent: 'body', x: -66, y: -232, rotation: 0.18, z: 0 },
  { name: 'body', x: 0, y: 0, z: 1 },
  { name: 'head', parent: 'body', x: 0, y: -258, z: 2 },
  { name: 'armFront', parent: 'body', x: 60, y: -228, rotation: -0.32, z: 3 },
];

interface Track { rot?: number[]; x?: number[]; y?: number[]; }
export interface Clip {
  duration: number;                 // seconds
  loop: boolean;
  /** bone -> keyframe values sampled evenly across the clip. */
  tracks: Record<string, Track>;
}

/** Sample an evenly-spaced keyframe array with linear interpolation. */
function sample(keys: number[], t: number): number {
  if (keys.length === 1) return keys[0];
  const p = Math.max(0, Math.min(1, t)) * (keys.length - 1);
  const i = Math.floor(p);
  if (i >= keys.length - 1) return keys[keys.length - 1];
  return keys[i] + (keys[i + 1] - keys[i]) * (p - i);
}

export const CLIPS: Record<string, Clip> = {
  // slow breathing: the whole body lifts, the hammer arm drifts
  idle: {
    duration: 3.6, loop: true,
    tracks: {
      body: { y: [0, -5, 0, 4, 0], rot: [0, 0.012, 0, -0.012, 0] },
      head: { rot: [0, -0.03, 0, 0.03, 0] },
      armFront: { rot: [-0.32, -0.28, -0.32, -0.36, -0.32] },
      armBack: { rot: [0.18, 0.22, 0.18, 0.14, 0.18] },
    },
  },
  // anticipation up, then a fast heavy slam, then settle
  strike: {
    duration: 0.62, loop: false,
    tracks: {
      armFront: { rot: [-0.32, -1.5, -1.75, 0.55, 0.30, -0.32] },
      body: { rot: [0, -0.06, -0.08, 0.07, 0.03, 0], y: [0, -4, -6, 6, 2, 0] },
      head: { rot: [0, -0.05, -0.06, 0.09, 0.04, 0] },
    },
  },
  // both arms raised for a big win
  cheer: {
    duration: 1.5, loop: false,
    tracks: {
      armFront: { rot: [-0.32, -2.1, -2.3, -2.1, -0.32] },
      armBack: { rot: [0.18, 1.9, 2.1, 1.9, 0.18] },
      body: { y: [0, -14, -18, -14, 0] },
      head: { rot: [0, -0.12, -0.16, -0.12, 0] },
    },
  },
};

interface Bone {
  def: BoneDef;
  node: Container;
  sprite?: Sprite;
}

export type PartTextures = Record<string, { texture: Texture; pivot: { x: number; y: number } }>;

export class Rig extends Container {
  private bones = new Map<string, Bone>();
  private clip: Clip | null = null;
  private clipTime = 0;
  private queued: string | null = null;

  constructor(defs: BoneDef[], parts: PartTextures) {
    super();
    // create nodes first so parents exist before children attach
    for (const def of defs) {
      const node = new Container();
      node.position.set(def.x, def.y);
      node.rotation = def.rotation ?? 0;
      this.bones.set(def.name, { def, node });
    }
    for (const def of [...defs].sort((a, b) => a.z - b.z)) {
      const bone = this.bones.get(def.name)!;
      const parent = def.parent ? this.bones.get(def.parent)?.node : undefined;
      (parent ?? this).addChild(bone.node);

      const part = parts[def.name];
      if (part) {
        const sp = new Sprite(part.texture);
        // draw the art so its authored pivot sits on the bone origin
        sp.position.set(-part.pivot.x, -part.pivot.y);
        bone.node.addChild(sp);
        bone.sprite = sp;
      }
    }
    this.play('idle');
  }

  /** Start a clip. A non-looping clip returns to idle when it finishes. */
  play(name: string): void {
    const clip = CLIPS[name];
    if (!clip) return;
    this.clip = clip;
    this.clipTime = 0;
    this.queued = clip.loop ? null : 'idle';
  }

  /** Advance the animation. `dt` in seconds. */
  update(dt: number): void {
    if (!this.clip) return;
    this.clipTime += dt;
    const clip = this.clip;
    let t = this.clipTime / clip.duration;
    if (t >= 1) {
      if (clip.loop) { t = t % 1; this.clipTime = t * clip.duration; }
      else {
        t = 1;
        const next = this.queued;
        this.queued = null;
        if (next) { this.applyPose(clip, 1); this.play(next); return; }
      }
    }
    this.applyPose(clip, t);
  }

  private applyPose(clip: Clip, t: number): void {
    for (const [name, track] of Object.entries(clip.tracks)) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      const rest = bone.def;
      if (track.rot) bone.node.rotation = sample(track.rot, t);
      if (track.x) bone.node.x = rest.x + sample(track.x, t);
      if (track.y) bone.node.y = rest.y + sample(track.y, t);
    }
  }
}
