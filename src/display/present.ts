import * as THREE from 'three';
import type { Layer } from './layer';
import { quality } from './quality';

const VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
/** Size of the layer in its own pixels. */
uniform vec2 uSize;
/** Part of the layer the scene was drawn to: left, bottom, right, top. */
uniform vec4 uArea;
uniform float uOpacity;
uniform float uDepth;
uniform float uDither;
uniform bool uInvert;
uniform bool uNearest;
/** The layer holds linear values that still have to become sRGB. */
uniform bool uLinear;
/** The rows of the picture run from the top down. */
uniform bool uTopDown;

varying vec2 vUv;

const float BAYER[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);

vec3 toSrgb(vec3 c) {
  vec3 low = c * 12.92;
  vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(low, high, step(vec3(0.0031308), c));
}

void main() {
  // Everything below is counted in the pixels of the layer, not of the screen: a layer of
  // 240 lines has coarse dither dots however large the window is.
  vec2 cell = floor(vUv * uSize);
  vec2 at = uNearest ? (cell + 0.5) / uSize : vUv;
  if (uTopDown) at.y = 1.0 - at.y;
  vec4 texel = texture2D(uMap, at);
  float alpha = clamp(texel.a, 0.0, 1.0);
  // Light added over nothing has colour and no alpha: it is taken as it is.
  float cover = alpha > 0.0 ? alpha : 1.0;
  vec3 colour = texel.rgb / cover;
  if (uLinear) colour = toSrgb(max(colour, 0.0));
  colour = clamp(colour, 0.0, 1.0);

  if (uDepth < 7.5) {
    float steps = exp2(uDepth) - 1.0;
    int index = int(mod(cell.x, 4.0)) + int(mod(cell.y, 4.0)) * 4;
    float threshold = (BAYER[index] + 0.5) / 16.0 - 0.5;
    colour = clamp(floor(colour * steps + 0.5 + threshold * uDither) / steps, 0.0, 1.0);
  }

  bool inside = vUv.x >= uArea.x && vUv.y >= uArea.y && vUv.x < uArea.z && vUv.y < uArea.w;
  if (uInvert && inside && alpha > 0.0) colour = 1.0 - colour;

  gl_FragColor = vec4(colour * cover, alpha) * uOpacity;
}
`;

const BLUR_TAPS = 12;
const GLOW_TAPS = 16;
/** The golden angle: taps on a spiral cover a disc evenly. */
const TURN = 2.39996323;
/** New grain this many times a second, like the frames of a tape. */
const GRAIN_HZ = 24;

/**
 * Taps on a spiral, written out as the shader reads them: where each one lies and how much
 * it counts. They are the same for every pixel, so they are worked out here once instead of
 * with a sine and a cosine for every tap of every pixel.
 */
function spiral(count: number, reach: (f: number) => number, weight: (f: number) => number): { taps: string; total: number } {
  const taps: string[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const f = (i + 0.5) / count;
    const angle = i * TURN;
    taps.push(`vec3(${(Math.cos(angle) * reach(f)).toFixed(8)}, ${(Math.sin(angle) * reach(f)).toFixed(8)}, ${weight(f).toFixed(8)})`);
    total += weight(f);
  }
  return { taps: `vec3[${count}](${taps.join(', ')})`, total };
}

const BLUR = spiral(BLUR_TAPS, (f) => Math.sqrt(f), (f) => 1 - 0.6 * f);
const GLOW = spiral(GLOW_TAPS, (f) => 1.5 + 6.5 * Math.sqrt(f), (f) => 1 - 0.7 * f);

/**
 * The layer as a worn video signal, still in its own pixels: blur, smear along the lines,
 * colours that have parted, light spilling out of the bright parts, grain. It reads and writes
 * sRGB with the colour premultiplied by alpha.
 */
const VIDEO_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uSize;
uniform float uBlur;
uniform float uSmear;
uniform float uChroma;
uniform float uGlow;
uniform float uNoise;
/** Which grain this is: it counts up as the tape runs. */
uniform float uTick;

varying vec2 vUv;

/** Taps of the blur and of the glow: x and y are where a tap lies, z is how much it counts. */
const vec3 BLUR[${BLUR_TAPS}] = ${BLUR.taps};
const vec3 GLOW[${GLOW_TAPS}] = ${GLOW.taps};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec4 soft(vec2 uv) {
  vec4 sum = texture2D(uMap, uv) * 2.0;
  vec2 radius = vec2(uBlur + uSmear, uBlur) / uSize;
  if (radius.x <= 0.0) return sum / 2.0;
  for (int i = 0; i < ${BLUR_TAPS}; i++) sum += texture2D(uMap, uv + BLUR[i].xy * radius) * BLUR[i].z;
  return sum / ${(2 + BLUR.total).toFixed(8)};
}

void main() {
  vec4 texel = soft(vUv);
  if (uChroma > 0.0) {
    vec2 shift = vec2(uChroma / uSize.x, 0.0);
    texel.r = soft(vUv + shift).r;
    texel.b = soft(vUv - shift).b;
  }
  vec3 colour = texel.rgb;

  if (uGlow > 0.0) {
    vec3 halo = vec3(0.0);
    for (int i = 0; i < ${GLOW_TAPS}; i++) halo += max(texture2D(uMap, vUv + GLOW[i].xy / uSize).rgb - 0.55, 0.0) * GLOW[i].z;
    colour += halo / ${GLOW.total.toFixed(8)} * 2.0 * uGlow;
  }

  if (uNoise > 0.0) {
    float grain = hash(floor(vUv * uSize) + vec2(uTick * 0.37, uTick * 1.91)) - 0.5;
    colour += grain * 0.3 * uNoise * texel.a;
  }

  gl_FragColor = vec4(clamp(colour, 0.0, texel.a), texel.a);
}
`;

/** Puts the worked signal on the screen: stretch, scanlines, dark corners, inversion, opacity. */
const SCREEN_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uSize;
uniform vec4 uArea;
uniform float uOpacity;
uniform bool uInvert;
uniform bool uNearest;
uniform float uScanlines;
/** Lines the scanlines are counted in. */
uniform float uPitch;
uniform float uVignette;
/** The rows of the picture run from the top down. */
uniform bool uTopDown;
/** How far red and blue part from green along the lines, in pixels of the layer; 0 where the video pass has done it. */
uniform float uChroma;

varying vec2 vUv;

void main() {
  vec2 at = uNearest ? (floor(vUv * uSize) + 0.5) / uSize : vUv;
  if (uTopDown) at.y = 1.0 - at.y;
  vec4 texel = texture2D(uMap, at);
  if (uChroma > 0.0) {
    vec2 shift = vec2(uChroma / uSize.x, 0.0);
    texel.r = texture2D(uMap, at + shift).r;
    texel.b = texture2D(uMap, at - shift).b;
    // Colour stays under its alpha; light added over nothing has no alpha and is left as it is.
    if (texel.a > 0.0) texel.rgb = min(texel.rgb, texel.a);
  }
  vec3 colour = texel.rgb;
  float alpha = texel.a;

  if (uScanlines > 0.0) {
    // Brightest in the middle of a line, darkest between two of them.
    float line = 0.5 - 0.5 * cos(6.2831853 * vUv.y * uPitch);
    colour *= 1.0 - uScanlines * (1.0 - line);
  }
  if (uVignette > 0.0) {
    float corner = length(vUv - 0.5) * 1.41421356;
    colour *= 1.0 - uVignette * smoothstep(0.35, 1.0, corner);
  }

  bool inside = vUv.x >= uArea.x && vUv.y >= uArea.y && vUv.x < uArea.z && vUv.y < uArea.w;
  if (uInvert && inside) colour = alpha - colour;

  gl_FragColor = vec4(colour, alpha) * uOpacity;
}
`;

/**
 * The two pictures a layer with video effects is worked through, in its own size, and what
 * each of them was last worked out from: while that stays the same, the picture is kept.
 */
interface Stage {
  a: THREE.WebGLRenderTarget;
  b: THREE.WebGLRenderTarget;
  /** The first picture: the layer it was made from, its size, the colour depth and the dither. */
  first: [revision: number, width: number, height: number, depth: number, dither: number];
  /** The second: the signal it was given, and which grain. */
  second: [blur: number, smear: number, chroma: number, glow: number, noise: number, tick: number];
}

function stageTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
}

/** Whether `kept` is these numbers already; takes them where it is not. */
function taken(kept: number[], ...now: number[]): boolean {
  let same = true;
  for (let i = 0; i < now.length; i++) {
    if (kept[i] === now[i]) continue;
    kept[i] = now[i];
    same = false;
  }
  return same;
}

/** How a layer gets to the screen. */
interface Way {
  /** Through the pass that works it as a video signal. */
  video: boolean;
  /** Through a picture of its own size first: for the video pass, or for the colour depth alone. */
  staged: boolean;
  /** Not by the plain pass: with scanlines, dark corners or the video signal. */
  dressed: boolean;
  /** Colours parted in the screen pass itself, in pixels of the layer; 0 where the video pass parts them. */
  chroma: number;
}

/**
 * The passes that put a layer on the screen. A layer without effects takes one: into sRGB,
 * dither, colour depth, inversion, opacity, as one full-screen triangle blended over what is
 * already there.
 *
 * A layer whose look asks for video effects takes a longer way: colour depth and dither into
 * a picture of the layer's size, the signal effects into a second one, and from there to the
 * screen. The two pictures are made in `prepare`, before anything is drawn to the screen, and
 * only when the layer or its look has changed; `compose` draws to the screen alone. The
 * screen is then one unbroken run of drawing, which is what a phone's graphics card is fast at.
 */
export class Presenter {
  private readonly uniforms = {
    uMap: { value: null as THREE.Texture | null },
    uSize: { value: new THREE.Vector2(1, 1) },
    uArea: { value: new THREE.Vector4(0, 0, 1, 1) },
    uOpacity: { value: 1 },
    uDepth: { value: 8 },
    uDither: { value: 0 },
    uInvert: { value: false },
    uNearest: { value: true },
    uLinear: { value: true },
    uTopDown: { value: false },
  };
  private readonly videoUniforms = {
    uMap: { value: null as THREE.Texture | null },
    uSize: { value: new THREE.Vector2(1, 1) },
    uBlur: { value: 0 },
    uSmear: { value: 0 },
    uChroma: { value: 0 },
    uGlow: { value: 0 },
    uNoise: { value: 0 },
    uTick: { value: 0 },
  };
  private readonly screenUniforms = {
    uMap: { value: null as THREE.Texture | null },
    uSize: { value: new THREE.Vector2(1, 1) },
    uArea: { value: new THREE.Vector4(0, 0, 1, 1) },
    uOpacity: { value: 1 },
    uInvert: { value: false },
    uNearest: { value: true },
    uScanlines: { value: 0 },
    uPitch: { value: 1 },
    uVignette: { value: 0 },
    uTopDown: { value: false },
    uChroma: { value: 0 },
  };
  private readonly material: THREE.ShaderMaterial;
  private readonly videoMaterial: THREE.ShaderMaterial;
  private readonly screenMaterial: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly stages = new Map<Layer, Stage>();
  private readonly way: Way = { video: false, staged: false, dressed: false, chroma: 0 };

  constructor() {
    // The colour comes out premultiplied.
    const over = {
      vertexShader: VERTEX,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    } as const;
    this.material = new THREE.ShaderMaterial({ ...over, uniforms: this.uniforms, fragmentShader: FRAGMENT });
    this.screenMaterial = new THREE.ShaderMaterial({ ...over, uniforms: this.screenUniforms, fragmentShader: SCREEN_FRAGMENT });
    this.videoMaterial = new THREE.ShaderMaterial({
      uniforms: this.videoUniforms,
      vertexShader: VERTEX,
      fragmentShader: VIDEO_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    // One triangle that covers the screen: no seam down the diagonal.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /**
   * Works out, off the screen, the pictures a layer is shown through. Called for every layer
   * that will be shown, before the first of them is drawn. `timeMs` moves the grain.
   */
  prepare(renderer: THREE.WebGLRenderer, layer: Layer, timeMs = 0): void {
    const way = this.wayOf(layer);
    if (!way.staged) return;
    const { look } = layer;
    const stage = this.stage(layer);

    // Colour depth and dither, pixel for pixel.
    const first = taken(stage.first, layer.revision, layer.width, layer.height, look.depth, look.dither);
    if (!first) {
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(stage.a);
      renderer.clear(true, false, false);
      this.plain(renderer, layer, true, false, 1);
      // What was made from the picture before this one is no longer of it.
      stage.second[5] = -1;
    }
    if (!way.video) return;

    const tick = look.noise > 0 ? Math.floor((timeMs / 1000) * GRAIN_HZ) : 0;
    const second = taken(stage.second, look.blur, look.smear, look.chroma, look.glow, look.noise, tick);
    if (first && second) return;
    const uniforms = this.videoUniforms;
    uniforms.uMap.value = stage.a.texture;
    uniforms.uSize.value.set(layer.width, layer.height);
    uniforms.uBlur.value = look.blur;
    uniforms.uSmear.value = look.smear;
    uniforms.uChroma.value = look.chroma;
    uniforms.uGlow.value = look.glow;
    uniforms.uNoise.value = look.noise;
    uniforms.uTick.value = tick;
    renderer.setRenderTarget(stage.b);
    // The pass writes every pixel; cleared first, the card does not fetch the old picture to draw over.
    renderer.clear(true, false, false);
    this.pass(renderer, this.videoMaterial);
  }

  /** Draws a layer over the screen, from what `prepare` has made of it. The screen is already the target. */
  compose(renderer: THREE.WebGLRenderer, layer: Layer): void {
    const { look } = layer;
    const way = this.wayOf(layer);
    if (!way.dressed) {
      this.plain(renderer, layer, look.filter === 'nearest', look.invert, Math.min(1, look.opacity));
      return;
    }

    // A layer that already holds what the screen pass reads - sRGB, every bit of it, colour
    // premultiplied - goes straight to it: one pass over the screen instead of two.
    const stage = way.staged ? this.stage(layer) : null;
    const uniforms = this.screenUniforms;
    uniforms.uMap.value = stage ? (way.video ? stage.b.texture : stage.a.texture) : layer.texture;
    uniforms.uTopDown.value = stage === null && layer.topDown;
    uniforms.uSize.value.set(layer.width, layer.height);
    uniforms.uArea.value.copy(layer.area);
    uniforms.uOpacity.value = Math.min(1, look.opacity);
    uniforms.uInvert.value = look.invert;
    uniforms.uNearest.value = look.filter === 'nearest';
    uniforms.uScanlines.value = look.scanlines;
    uniforms.uPitch.value = look.scanlinePitch > 0 ? look.scanlinePitch : layer.height;
    uniforms.uVignette.value = look.vignette;
    uniforms.uChroma.value = way.chroma;
    this.pass(renderer, this.screenMaterial);
  }

  /** Frees what was kept for a layer that is gone. */
  release(layer: Layer): void {
    const stage = this.stages.get(layer);
    if (!stage) return;
    stage.a.dispose();
    stage.b.dispose();
    this.stages.delete(layer);
  }

  private wayOf(layer: Layer): Way {
    const { look } = layer;
    const { way } = this;
    const video = quality().video && (look.blur > 0 || look.smear > 0 || look.chroma > 0 || look.glow > 0 || look.noise > 0);
    // Parted colours alone, on a layer the screen pass reads as it is, are three readings of
    // the layer in that pass: the board, when a group goes. The two pictures of the video
    // pass, each as large as the screen, are not made for it.
    const alone = video && look.blur <= 0 && look.smear <= 0 && look.glow <= 0 && look.noise <= 0 && layer.encoded && look.depth >= 7.5;
    way.chroma = alone ? look.chroma : 0;
    way.video = video && !alone;
    way.dressed = video || look.scanlines > 0 || look.vignette > 0;
    way.staged = way.dressed && (way.video || !layer.encoded || look.depth < 7.5);
    return way;
  }

  private plain(renderer: THREE.WebGLRenderer, layer: Layer, nearest: boolean, invert: boolean, opacity: number): void {
    const { uniforms } = this;
    const { look } = layer;
    uniforms.uMap.value = layer.texture;
    uniforms.uTopDown.value = layer.topDown;
    uniforms.uSize.value.set(layer.width, layer.height);
    uniforms.uArea.value.copy(layer.area);
    uniforms.uOpacity.value = opacity;
    uniforms.uDepth.value = look.depth;
    uniforms.uDither.value = look.dither;
    uniforms.uInvert.value = invert;
    uniforms.uNearest.value = nearest;
    uniforms.uLinear.value = !layer.encoded;
    this.pass(renderer, this.material);
  }

  private pass(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial): void {
    this.mesh.material = material;
    material.uniformsNeedUpdate = true;
    renderer.render(this.scene, this.camera);
  }

  private stage(layer: Layer): Stage {
    let stage = this.stages.get(layer);
    if (!stage) {
      stage = { a: stageTarget(), b: stageTarget(), first: [-1, 0, 0, 0, 0], second: [0, 0, 0, 0, 0, -1] };
      this.stages.set(layer, stage);
    }
    const width = Math.max(1, layer.width);
    const height = Math.max(1, layer.height);
    if (stage.a.width !== width || stage.a.height !== height) {
      stage.a.setSize(width, height);
      stage.b.setSize(width, height);
    }
    return stage;
  }
}
