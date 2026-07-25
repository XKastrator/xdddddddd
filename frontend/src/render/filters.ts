/**
 * filters.ts — custom WebGL shaders for MOLTEN CROWN.
 *
 * Three effects that no amount of sprite tweening can fake:
 *
 *   HeatHazeFilter    rising thermal distortion over the forge scene; its
 *                     strength is driven by Heat, so the room visibly cooks as
 *                     the multiplier climbs
 *   ShimmerFilter     a specular band sweeping across the grid when metal is
 *                     forged — the "polished metal" read
 *   ChromaticFilter   radial RGB split + warp used as an impact accent on the
 *                     Pour and the max win
 *
 * All three are single-pass and cheap enough for mid-range mobile. Colour is
 * PREMULTIPLIED in Pixi's filter pipeline, so any additive term is multiplied by
 * alpha before it is added, otherwise transparent regions bloom into grey.
 *
 * Shaders are GLSL ES 3.00 without a version header — Pixi prepends it. The
 * renderer is created with `preference: 'webgl'` (see app.ts) so a WebGL program
 * alone is sufficient; WebGPU support would need a parallel WGSL source.
 */
import { Filter, GlProgram, UniformGroup } from 'pixi.js';

/**
 * Pixi's stock filter vertex shader, inlined rather than deep-imported from the
 * package internals (that path is not a public export and would break on a
 * minor upgrade). Position + texcoord passthrough; identical maths to
 * `filters/defaults/defaultFilter.vert`.
 */
const VERT = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition( void ) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}`;

// --------------------------------------------------------------------------- //
const HAZE_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uStrength;

void main(void) {
    vec2 uv = vTextureCoord;
    // Two detuned vertical waves read as convecting air rather than a ripple.
    float w1 = sin(uv.y * 26.0 + uTime * 1.7);
    float w2 = sin(uv.y * 61.0 - uTime * 2.6);
    // Heat rises: distortion grows toward the bottom of the scene where the lava is.
    float amt = uStrength * (0.0014 + 0.0026 * smoothstep(0.30, 1.0, uv.y));
    uv.x += (w1 * 0.6 + w2 * 0.4) * amt;
    uv.y += cos(uv.x * 34.0 + uTime * 1.2) * amt * 0.5;
    finalColor = texture(uTexture, uv);
}`;

export class HeatHazeFilter extends Filter {
  private u: { uTime: number; uStrength: number };

  constructor(strength = 1) {
    const uniforms = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uStrength: { value: strength, type: 'f32' },
    });
    super({
      glProgram: GlProgram.from({ vertex: VERT, fragment: HAZE_FRAG, name: 'heat-haze' }),
      resources: { hazeUniforms: uniforms },
      // the shader samples outside the sprite, so pad to avoid edge clipping
      padding: 6,
    });
    this.u = uniforms.uniforms as unknown as typeof this.u;
  }

  advance(dt: number): void { this.u.uTime += dt; }
  set strength(v: number) { this.u.uStrength = v; }
  get strength(): number { return this.u.uStrength; }
}

// --------------------------------------------------------------------------- //
const SHIMMER_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uStrength;

void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    // diagonal band travelling across the board
    float band = sin((vTextureCoord.x + vTextureCoord.y * 0.65) * 7.0 - uTime * 4.0);
    float m = smoothstep(0.88, 1.0, band) * uStrength;
    // Pixi works in premultiplied alpha: scale the additive term by alpha so
    // fully transparent pixels stay transparent instead of glowing grey.
    finalColor = color + vec4(vec3(m) * color.a, 0.0);
}`;

export class ShimmerFilter extends Filter {
  private u: { uTime: number; uStrength: number };

  constructor() {
    const uniforms = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uStrength: { value: 0, type: 'f32' },
    });
    super({
      glProgram: GlProgram.from({ vertex: VERT, fragment: SHIMMER_FRAG, name: 'shimmer' }),
      resources: { shimmerUniforms: uniforms },
    });
    this.u = uniforms.uniforms as unknown as typeof this.u;
  }

  advance(dt: number): void { this.u.uTime += dt; }
  set strength(v: number) { this.u.uStrength = v; }
  get strength(): number { return this.u.uStrength; }
}

// --------------------------------------------------------------------------- //
const CHROMA_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uAmount;

void main(void) {
    vec2 uv = vTextureCoord;
    vec2 c = uv - 0.5;
    float d = length(c);
    // split grows toward the edges, so the centre of the action stays readable
    vec2 off = c * uAmount * d;
    float r = texture(uTexture, uv + off).r;
    vec4  g = texture(uTexture, uv);
    float b = texture(uTexture, uv - off).b;
    finalColor = vec4(r, g.g, b, g.a);
}`;

export class ChromaticFilter extends Filter {
  private u: { uAmount: number };

  constructor() {
    const uniforms = new UniformGroup({ uAmount: { value: 0, type: 'f32' } });
    super({
      glProgram: GlProgram.from({ vertex: VERT, fragment: CHROMA_FRAG, name: 'chromatic' }),
      resources: { chromaUniforms: uniforms },
      padding: 4,
    });
    this.u = uniforms.uniforms as unknown as typeof this.u;
  }

  set amount(v: number) { this.u.uAmount = v; }
  get amount(): number { return this.u.uAmount; }
}
