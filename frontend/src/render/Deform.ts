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
 *
 * IMPORTANT: `MeshPlane` builds its geometry from the TEXTURE's dimensions and
 * rebuilds it whenever the texture changes size — the vertex buffer is in
 * texture pixels, never in the size you want the thing drawn at. The working
 * dimensions are therefore read back off the rest buffer rather than assumed,
 * and display size is applied with `scale`.
 */
import { MeshPlane, Texture } from 'pixi.js';

/** Grid resolution. 6x6 bends smoothly and stays cheap; 2x2 reads as a shear. */
const SEG = 6;

export class Deform {
  readonly mesh: MeshPlane;
  private rest: Float32Array = new Float32Array(0);
  /** Geometry extent, in texture pixels. */
  private gw = 1;
  private gh = 1;

  /** Live state, all decaying to zero. */
  private impact = 0;
  private wobble = 0;
  private phase = 0;
  private vel = 0;
  private disp = 0;
  private axis = 1;   // 1 = vertical hit, 0 = horizontal

  constructor(texture: Texture = Texture.EMPTY) {
    this.mesh = new MeshPlane({ texture, verticesX: SEG + 1, verticesY: SEG + 1 });
    this.capture();
  }

  get texture(): Texture { return this.mesh.texture; }

  setTexture(t: Texture): void {
    if (this.mesh.texture === t) return;
    this.mesh.texture = t;
    this.capture();
  }

  /** Display size in stage units, applied as scale so the geometry stays clean. */
  setSize(px: number): void {
    this.mesh.scale.set(px / this.gw, px / this.gh);
  }

  /**
   * Snapshot the undeformed geometry and centre the pivot on it.
   *
   * Read back rather than computed: `MeshPlane` sizes its plane from the
   * texture, and a texture swap rebuilds the buffer underneath us.
   */
  private capture(): void {
    const buf = this.mesh.geometry.getBuffer('aPosition');
    this.rest = new Float32Array(buf.data as Float32Array);
    let maxX = 0, maxY = 0;
    for (let i = 0; i < this.rest.length; i += 2) {
      if (this.rest[i] > maxX) maxX = this.rest[i];
      if (this.rest[i + 1] > maxY) maxY = this.rest[i + 1];
    }
    this.gw = maxX || 1;
    this.gh = maxY || 1;
    // so the mesh hangs off its own centre, like the Sprite it stands in for
    this.mesh.pivot.set(this.gw / 2, this.gh / 2);
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

  /** Drop every deformation immediately and restore the rest pose. */
  reset(): void {
    if (this.impact === 0 && this.wobble === 0 && this.disp === 0 && this.vel === 0) return;
    this.impact = this.wobble = this.disp = this.vel = 0;
    const buf = this.mesh.geometry.getBuffer('aPosition');
    (buf.data as Float32Array).set(this.rest);
    buf.update();
  }

  /**
   * Advance and rewrite the vertex buffer.
   *
   * Called from the board's ticker. Returns early when at rest so a grid of
   * thirty meshes costs nothing between spins.
   */
  update(dt: number): void {
    if (!this.active) return;

    // FIXED-STEP integration, sub-stepped.
    //
    // A spring at k = 120 is only stable while the step is under about 80 ms,
    // and Pixi clamps a stalled frame's `deltaMS` to 100 — past that, the
    // semi-implicit update flips the velocity's sign every frame and the settle
    // becomes a rattle rather than a bounce. Measured on a throttled page:
    // vel went 1.35, -2.03, 1.42, -1.32 on successive frames. Sub-stepping also
    // makes the motion identical at 30, 60 and 144 Hz instead of frame-rate
    // dependent, which matters because the frame-rate guard exists precisely
    // because weak devices exist.
    const MAX = 1 / 120;
    const k = 120, c = 13;
    let left = Math.min(dt, 0.25);
    while (left > 0) {
      const step = Math.min(MAX, left);
      left -= step;
      this.vel += (-k * this.disp - c * this.vel) * step;
      this.disp += this.vel * step;
      this.impact = Math.max(0, this.impact - step * 2.3);
      this.wobble = Math.max(0, this.wobble - step * 1.8);
      this.phase += step * 17;
    }

    const buf = this.mesh.geometry.getBuffer('aPosition');
    const v = buf.data as Float32Array;
    const { gw, gh } = this;
    // Squash amount. BOTH terms are compressions, so both must push the same
    // way: the strike drives `vel` negative, so `disp` goes negative, and
    // `impact` — which is stored as a positive magnitude — has to be
    // SUBTRACTED. Adding it meant the immediate impact cancelled most of the
    // spring on the first frames and the peak bend came out at under 4% of the
    // symbol, which is invisible.
    const q = this.disp * 0.55 - this.impact * 0.30;

    for (let i = 0; i < v.length; i += 2) {
      const rx = this.rest[i], ry = this.rest[i + 1];
      // normalised -1..1 from the centre, so the deformation is symmetric
      const nx = (rx / gw) * 2 - 1;
      const ny = (ry / gh) * 2 - 1;

      let dx = 0, dy = 0;
      if (this.axis === 1) {
        // compress vertically, bulge horizontally, both strongest at the far
        // edge from the impact — a bar hit from above flattens at the bottom
        dy = q * gh * 0.5 * (ny + 1) * 0.5;
        dx = -q * gw * 0.32 * nx;
        // ring: a wave travelling up the object, fading with height
        dx += Math.sin(this.phase - ny * 2.4) * this.wobble * gw * 0.05 * (1 - Math.abs(ny));
      } else {
        dx = q * gw * 0.5 * (nx + 1) * 0.5;
        dy = -q * gh * 0.32 * ny;
        dy += Math.sin(this.phase - nx * 2.4) * this.wobble * gh * 0.05 * (1 - Math.abs(nx));
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
