import * as THREE from 'three';
import type { Layer } from './layer';

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
uniform float uTime;

varying vec2 vUv;

const int BLUR_TAPS = 12;
const int GLOW_TAPS = 16;
/** The golden angle: taps on a spiral cover a disc evenly. */
const float TURN = 2.39996323;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec4 soft(vec2 uv) {
  vec4 sum = texture2D(uMap, uv) * 2.0;
  float total = 2.0;
  vec2 radius = vec2(uBlur + uSmear, uBlur) / uSize;
  if (radius.x > 0.0) {
    for (int i = 0; i < BLUR_TAPS; i++) {
      float f = (float(i) + 0.5) / float(BLUR_TAPS);
      float angle = float(i) * TURN;
      float weight = 1.0 - 0.6 * f;
      sum += texture2D(uMap, uv + vec2(cos(angle), sin(angle)) * sqrt(f) * radius) * weight;
      total += weight;
    }
  }
  return sum / total;
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
    float total = 0.0;
    for (int i = 0; i < GLOW_TAPS; i++) {
      float f = (float(i) + 0.5) / float(GLOW_TAPS);
      float angle = float(i) * TURN;
      float weight = 1.0 - 0.7 * f;
      vec2 offset = vec2(cos(angle), sin(angle)) * (1.5 + 6.5 * sqrt(f)) / uSize;
      halo += max(texture2D(uMap, vUv + offset).rgb - 0.55, 0.0) * weight;
      total += weight;
    }
    colour += halo / total * 2.0 * uGlow;
  }

  if (uNoise > 0.0) {
    // New grain 24 times a second, like the frames of a tape.
    float tick = floor(uTime * 24.0);
    float grain = hash(floor(vUv * uSize) + vec2(tick * 0.37, tick * 1.91)) - 0.5;
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

varying vec2 vUv;

void main() {
  vec2 at = uNearest ? (floor(vUv * uSize) + 0.5) / uSize : vUv;
  vec4 texel = texture2D(uMap, at);
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

/** The two pictures a layer with video effects is worked through, in its own size. */
interface Stage {
  a: THREE.WebGLRenderTarget;
  b: THREE.WebGLRenderTarget;
}

function stageTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
}

/**
 * The pass that puts a layer on the screen: into sRGB, dither, colour depth, inversion,
 * opacity. One full-screen triangle per layer, blended over what is already there.
 *
 * A layer whose look asks for video effects takes a longer way: colour depth and dither into
 * a picture of the layer's size, the signal effects into a second one, and from there to the
 * screen. A layer without them is drawn exactly as before.
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
  };
  private readonly videoUniforms = {
    uMap: { value: null as THREE.Texture | null },
    uSize: { value: new THREE.Vector2(1, 1) },
    uBlur: { value: 0 },
    uSmear: { value: 0 },
    uChroma: { value: 0 },
    uGlow: { value: 0 },
    uNoise: { value: 0 },
    uTime: { value: 0 },
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
  };
  private readonly material: THREE.ShaderMaterial;
  private readonly videoMaterial: THREE.ShaderMaterial;
  private readonly screenMaterial: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly stages = new Map<Layer, Stage>();

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

  /** Draws a layer over the screen. `timeMs` moves the grain. */
  draw(renderer: THREE.WebGLRenderer, layer: Layer, timeMs = 0): void {
    const { look } = layer;
    const video = look.blur > 0 || look.smear > 0 || look.chroma > 0 || look.glow > 0 || look.noise > 0;
    if (!video && look.scanlines <= 0 && look.vignette <= 0) {
      this.plain(renderer, layer, look.filter === 'nearest', look.invert, Math.min(1, look.opacity));
      return;
    }

    // A layer that already holds what the screen pass reads - sRGB, every bit of it, colour
    // premultiplied - goes straight to it: one pass over the screen instead of two.
    let worked: { texture: THREE.Texture } = layer;
    if (video || !layer.encoded || look.depth < 7.5) {
      const stage = this.stage(layer);
      renderer.setClearColor(0x000000, 0);

      // Colour depth and dither, pixel for pixel.
      renderer.setRenderTarget(stage.a);
      renderer.clear(true, false, false);
      this.plain(renderer, layer, true, false, 1);
      worked = stage.a;
    }

    if (video) {
      const stage = this.stage(layer);
      const uniforms = this.videoUniforms;
      uniforms.uMap.value = stage.a.texture;
      uniforms.uSize.value.set(layer.width, layer.height);
      uniforms.uBlur.value = look.blur;
      uniforms.uSmear.value = look.smear;
      uniforms.uChroma.value = look.chroma;
      uniforms.uGlow.value = look.glow;
      uniforms.uNoise.value = look.noise;
      uniforms.uTime.value = timeMs / 1000;
      renderer.setRenderTarget(stage.b);
      this.pass(renderer, this.videoMaterial);
      worked = stage.b;
    }

    const uniforms = this.screenUniforms;
    uniforms.uMap.value = worked.texture;
    uniforms.uSize.value.set(layer.width, layer.height);
    uniforms.uArea.value.copy(layer.area);
    uniforms.uOpacity.value = Math.min(1, look.opacity);
    uniforms.uInvert.value = look.invert;
    uniforms.uNearest.value = look.filter === 'nearest';
    uniforms.uScanlines.value = look.scanlines;
    uniforms.uPitch.value = look.scanlinePitch > 0 ? look.scanlinePitch : layer.height;
    uniforms.uVignette.value = look.vignette;
    renderer.setRenderTarget(null);
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

  private plain(renderer: THREE.WebGLRenderer, layer: Layer, nearest: boolean, invert: boolean, opacity: number): void {
    const { uniforms } = this;
    const { look } = layer;
    uniforms.uMap.value = layer.texture;
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
      stage = { a: stageTarget(), b: stageTarget() };
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
