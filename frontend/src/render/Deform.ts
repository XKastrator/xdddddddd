/**
 * Deform — a symbol that bends, instead of a picture that scales.
 *
 * This is the gap between our symbols and a studio's, and most of it does NOT
 * need an animator. Spine's advantage on a SINGLE-PIECE symbol is mesh
 * deformation: the artwork is pinned to a grid and the grid is pushed around,
 * so the object squashes, wobbles and settles like it has mass. A rigged
 * multi-part character still needs a human. A gold bar does not.
 *
 * So the symbol art goes on a MeshPlane and the vertices are driven here.
 * Three motions, all physical rather than decorative:
 *
 *   impact   the whole mesh compresses on the axis it was hit along, and
 *            bulges on the other — volume is roughly conserved, which is what
 *            makes squash read as mass rather than as a scale tween
 *   wobble   a travelling sine along the hit axis, decaying — the ring after
 *            the strike
 *   settle   a critically-ish damped spring back to rest, so nothing snaps
 *
 * Everything decays to exactly zero and the geometry is restored, so a symbol
 * that is deformed mid-animation and then reused cannot keep a stale bend.
 */
import { MeshPlane, Texture } from 'pixi.js';

/** Grid resolution. 6x6 bends smoothly and stays cheap; 2x2 reads as a shear. */
const SEG = 6;

export class Deform {
  readonly mesh: MeshPlane;
  private rest: Float32Array;
  private size: number;

  /** Live state, all decaying to zero. */
  private impact = 0;
  private wobble = 0;
  private phase = 0;
  private vel = 0;
  private disp = 0;
  private axis = 1;   // 1 = vertical hit, 0 = horizontal

  constructor(size: number, texture: Texture = Texture.EMPTY) {
    this.size = size;
    this.mesh = new MeshPlane({ texture, verticesX: SEG + 1, verticesY: SEG + 1 });
    this.mesh.width = size;
    this.mesh.height = size;
    const buf = this.mesh.geometry.getBuffer('aPosition');
    this.rest = new Float32Array(buf.data as Float32Array);
  }

  setTexture(t: Texture): void {
    this.mesh.texture = t;
    this.mesh.width = this.size;
    this.mesh.height = this.size;
    const buf = this.mesh.geometry.getBuffer('aPosition');
    this.rest = new Float32Array(buf.data as Float32Array);
  }

  /** Hit it. `power` 0..1; `vertical` picks the axis it compresses along. */
  strike(power: number, vertical = true): void {
    this.axis = vertical ? 1 : 0;
    this.impact = Math.min(1, this.impact + power);
    this.wobble = Math.min(1, this.wobble + power);
    this.phase = 0;
    // a spring displacement, so the settle overshoots instead of easing
    this.vel -= power * 9;
  }

  /** True while anything is still moving — lets the caller skip idle work. */
  get active(): boolean {
    return this.impact > 0.001 || this.wobble > 0.001
      || Math.abs(this.disp) > 0.0005 || Math.abs(this.vel) > 0.0005;
  }

  /**
   * Advance and rewrite the vertex buffer.
   *
   * Called from the board's ticker. Returns early when at rest so a grid of
   * thirty meshes costs nothing between spins.
   */
  update(dt: number): void {
    if (!this.active) return;

    // spring: F = -kx - cv, integrated semi-implicitly so it cannot blow up
    const k = 120, c = 13;
    this.vel += (-k * this.disp - c * this.vel) * dt;
    this.disp += this.vel * dt;

    this.impact = Math.max(0, this.impact - dt * 3.2);
    this.wobble = Math.max(0, this.wobble - dt * 2.4);
    this.phase += dt * 17;

    const buf = this.mesh.geometry.getBuffer('aPosition');
    const v = buf.data as Float32Array;
    const s = this.size;
    // squash amount: the spring displacement plus what is left of the impact
    const q = this.disp * 0.35 + this.impact * 0.16;

    for (let i = 0; i < v.length; i += 2) {
      const rx = this.rest[i], ry = this.rest[i + 1];
      // normalised -1..1 from the centre, so the deformation is symmetric
      const nx = (rx / s) * 2 - 1;
      const ny = (ry / s) * 2 - 1;

      let dx = 0, dy = 0;
      if (this.axis === 1) {
        // compress vertically, bulge horizontally, both strongest at the far
        // edge from the impact — a bar hit from above flattens at the bottom
        dy = q * s * 0.5 * (ny + 1) * 0.5;
        dx = -q * s * 0.32 * nx;
        // ring: a wave travelling up the object, fading with height
        dx += Math.sin(this.phase - ny * 2.4) * this.wobble * s * 0.035 * (1 - Math.abs(ny));
      } else {
        dx = q * s * 0.5 * (nx + 1) * 0.5;
        dy = -q * s * 0.32 * ny;
        dy += Math.sin(this.phase - nx * 2.4) * this.wobble * s * 0.035 * (1 - Math.abs(nx));
      }
      v[i] = rx + dx;
      v[i + 1] = ry + dy;
    }

    if (!this.active) {
      // land exactly on rest, or a symbol reused later inherits the last bend
      v.set(this.rest);
      this.impact = this.wobble = this.disp = this.vel = 0;
    }
    buf.update();
  }
}
