import * as THREE from 'three';
import voiceUrl from './people/voice.webp';
import type { Band } from './bands';
import { NOVEL_LOOK, figureBox, figureMask, type FigureMask } from './record';

/** The corners of the figure's picture are put where `uBox` says, in shares of the frame. */
const VERTEX = /* glsl */ `
uniform vec4 uBox;

varying vec2 vUv;

void main() {
  vUv = position.xy;
  gl_Position = vec4((uBox.xy + position.xy * uBox.zw) * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * The figure as her picture, graded into the cold of the place (`NOVEL_LOOK.figure.grade`), with
 * the marks of the signal on her - her light parts glowing, every other line a little darker,
 * grain, her lines slipping sideways where a band of interference crosses her - and a light at her edge, a little over
 * the edge itself and more out past it, as a figure stands against a light behind it. The colours
 * are worked in the numbers of the picture as it is stored, and given to the layer linear.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D uMask;
uniform sampler2D uColor;
uniform vec3 uShadow;
uniform vec3 uHigh;
uniform vec3 uHalo;
uniform float uSaturation;
uniform float uContrast;
uniform float uTone;
uniform float uWarmth;
uniform float uLift;
uniform float uBright;
uniform float uHaloAmount;
uniform float uRimAmount;
uniform float uHalation;
uniform float uScan;
uniform float uGrain;
uniform float uFrame;
uniform vec3 uSlip;
uniform float uFace;
uniform float uFaceNoise;

varying vec2 vUv;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // A band of lines that slips: the further from its middle, the less.
  float slip = uSlip.z * (1.0 - smoothstep(0.0, uSlip.y, abs(vUv.y - uSlip.x)));
  vec2 uv = vec2(vUv.x - slip, 1.0 - vUv.y);
  vec4 mask = texture2D(uMask, uv);
  vec3 src = texture2D(uColor, uv).rgb;

  // The grade: less colour, a little more contrast, then towards a scale of its own lightness from
  // the dark of the place to the cold light, less of the way in the middle tones.
  vec3 c = mix(vec3(luma(src)), src, uSaturation);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float l = luma(c);
  float middle = 1.0 - abs(l * 2.0 - 1.0);
  c = mix(c, mix(mix(uShadow, uHigh, uLift), uHigh, l), uTone * (1.0 - uWarmth * middle));
  c *= uBright;

  // The signal on her.
  c += uHalo * mask.a * uHalation;
  // A silhouette is the dark of the place; her face comes through it in streaks along her lines.
  float streak = hash(vec2(floor(gl_FragCoord.x / 6.0), floor(gl_FragCoord.y)) + uFrame + 31.0);
  c = mix(uShadow, c, clamp(uFace + (streak - 0.5) * uFaceNoise, 0.0, 1.0));
  c *= 1.0 - uScan * step(0.5, fract(gl_FragCoord.y * 0.5));
  c += (hash(floor(gl_FragCoord.xy) + uFrame) - 0.5) * uGrain;

  float body = mask.r;
  float rim = body * (1.0 - mask.b) * uRimAmount;
  float outside = mask.g * (1.0 - body) * uHaloAmount;
  float alpha = body + outside;
  if (alpha <= 0.002) discard;
  vec3 color = (c * (body - rim) + uHalo * (rim + outside)) / alpha;
  gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(2.2)), alpha);
}
`;

/** A colour as the numbers it is written with, 0..1, not made linear: the grade works in these. */
function stored(hex: string, into = new THREE.Vector3()): THREE.Vector3 {
  const value = Number.parseInt(hex.replace('#', ''), 16) || 0;
  return into.set(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

/** The picture of the voice of the other side, as it is worked out once; null while it has not come, or could not. */
let loading: Promise<{ mask: FigureMask; sprite: number } | null> | null = null;

function loadMask(): Promise<{ mask: FigureMask; sprite: number } | null> {
  loading ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = voiceUrl;
  })
    .then((image) => {
      const sprite = image.naturalWidth / Math.max(1, image.naturalHeight);
      const height = NOVEL_LOOK.figure.maskLines;
      const width = Math.max(1, Math.round(height * sprite));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0, width, height);
      return { mask: figureMask(ctx.getImageData(0, 0, width, height).data, width, height), sprite };
    })
    .catch(() => {
      // Asked for again by the next record.
      loading = null;
      return null;
    });
  return loading;
}

function dataTexture(data: Uint8Array, width: number, height: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The voice of the other side in a record of the link: a figure to the waist in the middle of the
 * frame, drawn over the picture of the place and under the band of the words, and going through
 * the signal of the transmission with it. Its picture is fetched with the first record, not
 * before. While the operator speaks she is dimmer and her light is less; it goes from one to the
 * other slowly.
 */
export class VoiceFigure {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.Camera();
  private readonly material: THREE.ShaderMaterial;
  private readonly box = new THREE.Vector4();
  private readonly slip = new THREE.Vector3(0, 0.01, 0);
  /** How far she is the one who speaks, 0..1, as it is now; null before the first frame. */
  private speaking: number | null = null;
  private last = 0;

  private constructor(
    private readonly mask: FigureMask,
    /** The picture of the figure, width over height, without the air around it. */
    private readonly sprite: number,
  ) {
    const look = NOVEL_LOOK.figure;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: dataTexture(mask.data, mask.width, mask.height) },
        uColor: { value: dataTexture(mask.color, mask.width, mask.height) },
        uBox: { value: this.box },
        uShadow: { value: new THREE.Vector3() },
        uHigh: { value: stored(look.grade.highlight) },
        uHalo: { value: stored(look.halo) },
        uSaturation: { value: look.grade.saturation },
        uContrast: { value: look.grade.contrast },
        uTone: { value: look.grade.tone },
        uWarmth: { value: look.grade.warmth },
        uLift: { value: look.grade.lift },
        uBright: { value: 1 },
        uHaloAmount: { value: 0 },
        uRimAmount: { value: 0 },
        uHalation: { value: 0 },
        uScan: { value: look.scanlines },
        uGrain: { value: look.grain },
        uFace: { value: 1 },
        uFaceNoise: { value: 0 },
        uFrame: { value: 0 },
        uSlip: { value: this.slip },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /** The figure, once its picture has come and been worked out; null if it could not be fetched. */
  static load(): Promise<VoiceFigure | null> {
    return loadMask().then((found) => (found ? new VoiceFigure(found.mask, found.sprite) : null));
  }

  /**
   * Sets the figure for a frame of this shape (`aspect`, width over height). `speaking`: the voice
   * is the one who speaks now. `shadow` is the dark of the place her shadows go into. `band` is the
   * band of interference over the frame now, or null: her lines slip where it crosses her. With
   * `still` she does not breathe and the grain stands. `face` is how far her face is there, 0..1: 0
   * is a silhouette, filled with `shadow` and lit at its edge (`faceAt` in `record.ts`).
   */
  update(timeMs: number, aspect: number, speaking: boolean, shadow: string, still: boolean, band: Band | null = null, face = 1): void {
    const look = NOVEL_LOOK.figure;
    const target = speaking ? 1 : 0;
    const dt = Math.max(0, timeMs - this.last);
    this.last = timeMs;
    this.speaking = this.speaking === null ? target : this.speaking + (target - this.speaking) * (1 - Math.exp(-dt / Math.max(1, look.fadeMs)));
    const light = look.operator + (look.voice - look.operator) * this.speaking;
    const bright = look.grade.exposure * (look.operatorBright + (1 - look.operatorBright) * this.speaking);

    const breath = still ? 0 : look.breath * Math.sin((timeMs / look.breathMs) * Math.PI * 2);
    const at = figureBox(aspect, this.sprite, breath);
    // The picture with the air around it: the light outside the figure is drawn in that air.
    const { mask } = this;
    const inner = { width: mask.width - mask.pad * 2, height: mask.height - mask.pad * 2 };
    const padX = (mask.pad / inner.width) * at.width;
    const padY = (mask.pad / inner.height) * at.height;
    this.box.set(at.left - padX, at.bottom - padY, at.width + padX * 2, at.height + padY * 2);

    // The band in the shares of the quad of her picture.
    const box = this.box;
    this.slip.set(band ? (band.y - box.y) / box.w : 0, band ? Math.max(0.001, band.half / box.w) : 0.01, band && !still ? (band.strength * look.slipShift) / box.z : 0);
    const uniforms = this.material.uniforms;
    stored(shadow, uniforms.uShadow.value as THREE.Vector3);
    uniforms.uBright.value = bright;
    const halo = look.silhouetteHalo + (look.haloAmount - look.silhouetteHalo) * face;
    const rim = look.silhouetteRim + (look.rimAmount - look.silhouetteRim) * face;
    uniforms.uHaloAmount.value = Math.min(1, halo * light);
    uniforms.uRimAmount.value = Math.min(1, rim * light);
    uniforms.uHalation.value = look.halation * light;
    uniforms.uFace.value = face;
    // On the way from the silhouette to her face, and only then, it breaks up.
    uniforms.uFaceNoise.value = still ? 0 : look.reveal.noise * Math.sin(face * Math.PI);
    // New grain 24 times a second; with motion kept low it stands as it is.
    uniforms.uFrame.value = still ? 0 : (Math.floor((timeMs * 24) / 1000) % 64) * 7;
  }

  /** A record has closed: the next one starts where it is told to, not where this one left off. */
  reset(): void {
    this.speaking = null;
  }
}
