import * as THREE from 'three';
import { NOVEL_LOOK } from './record';

/** A band of interference as it stands in a frame now, in shares of the frame from its bottom. */
export interface Band {
  /** Its middle, and half its height. */
  y: number;
  half: number;
  /** How strong it is now, 0..1: it grows and fades, never by a jump. */
  strength: number;
}

/** How a band comes: running down the frame from the top, or standing where it lights up. */
type BandKind = 'roll' | 'flare';

interface Coming {
  kind: BandKind;
  from: number;
  ms: number;
  /** Where a band that stands stands; a band that runs starts above the frame. */
  y: number;
  half: number;
}

/**
 * When the bands of interference of a record come and where they are: one at a time, now and
 * then, by a chance of its own (the look's, not the rules'). Kept apart from the drawing, so it
 * can be tested.
 */
export class BandTimer {
  private next: number | null = null;
  private band: Coming | null = null;

  constructor(
    private readonly random: () => number = Math.random,
    private readonly look = NOVEL_LOOK.bands,
  ) {}

  /**
   * The band at `timeMs`, or null. With `still` (motion kept low) none comes. With `rush` (her face
   * coming through) a band comes as soon as the last has gone, without the wait.
   */
  at(timeMs: number, still: boolean, rush = false): Band | null {
    const { look, random } = this;
    const between = (range: readonly [number, number]): number => range[0] + random() * (range[1] - range[0]);
    this.next ??= timeMs + between(look.every);
    if (still) {
      this.band = null;
      return null;
    }
    if (!this.band && (rush || timeMs >= this.next)) {
      const kind: BandKind = random() < look.rollShare ? 'roll' : 'flare';
      const half = between(look.height) / 2;
      this.band = { kind, from: timeMs, ms: kind === 'roll' ? look.rollMs : look.flareMs, y: half + random() * (1 - half * 2), half };
    }
    const band = this.band;
    if (!band) return null;
    const into = (timeMs - band.from) / Math.max(1, band.ms);
    if (into >= 1) {
      this.band = null;
      this.next = timeMs + between(look.every);
      return null;
    }
    if (band.kind === 'roll') {
      // From above the frame to below it; it is strongest in the middle of its way.
      const y = 1 + band.half - into * (1 + band.half * 2);
      return { y, half: band.half, strength: Math.sin(into * Math.PI) };
    }
    return { y: band.y, half: band.half, strength: Math.sin(into * Math.PI) };
  }

  /** A record has closed: the next starts its wait anew. */
  reset(): void {
    this.next = null;
    this.band = null;
  }
}

const VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = position.xy;
  gl_Position = vec4(position.xy * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * A band of interference over the whole frame: lighter, soft at its edges, broken into short
 * streaks along its lines that change 24 times a second. It is added to the light of the picture.
 */
const FRAGMENT = /* glsl */ `
uniform vec3 uBand;
uniform vec3 uColor;
uniform float uLight;
uniform float uNoise;
uniform float uFrame;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float d = abs(vUv.y - uBand.x) / max(0.0001, uBand.y);
  float w = 1.0 - smoothstep(0.0, 1.0, d);
  if (w <= 0.0 || uBand.z <= 0.0) discard;
  float streak = hash(vec2(floor(gl_FragCoord.x / 6.0), floor(gl_FragCoord.y)) + uFrame);
  float light = w * uBand.z * (uLight + uNoise * (streak - 0.5));
  gl_FragColor = vec4(uColor * max(0.0, light), 1.0);
}
`;

/** A colour as the numbers it is written with, made linear, as the layer takes it. */
function linear(hex: string): THREE.Vector3 {
  const value = Number.parseInt(hex.replace('#', ''), 16) || 0;
  const channel = (shift: number): number => (((value >> shift) & 255) / 255) ** 2.2;
  return new THREE.Vector3(channel(16), channel(8), channel(0));
}

/**
 * The bands of interference of a record (the owner, 4 November 2026: «полосы помех - нужны»):
 * now and then one runs down the frame, or lights up where it is and fades. Drawn over the
 * picture of the place and the figure, so it goes through the signal of the transmission with
 * them; the band of the words stays clear of it.
 */
export class RecordBands {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.Camera();
  private readonly timer = new BandTimer();
  private readonly band = new THREE.Vector3();
  private readonly material: THREE.ShaderMaterial;
  /** The band as it is now; null when there is none. */
  now: Band | null = null;

  constructor() {
    const look = NOVEL_LOOK.bands;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uBand: { value: this.band },
        uColor: { value: linear(look.color) },
        uLight: { value: look.light },
        uNoise: { value: look.noise },
        uFrame: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
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

  /**
   * Where the band is at `timeMs`; with `still` there is none. `boost`, 0..1, is how far her face
   * is on its way through: the bands come one after another, lighter and more torn
   * (`NOVEL_LOOK.figure.reveal`). True when there is one to draw.
   */
  update(timeMs: number, still: boolean, boost = 0): boolean {
    const look = NOVEL_LOOK.bands;
    const reveal = NOVEL_LOOK.figure.reveal;
    this.now = this.timer.at(timeMs, still, boost > 0);
    const { uniforms } = this.material;
    uniforms.uLight.value = look.light * (1 + (reveal.bandLight - 1) * boost);
    uniforms.uNoise.value = look.noise * (1 + (reveal.bandNoise - 1) * boost);
    const { now } = this;
    this.band.set(now?.y ?? 0, now?.half ?? 0.01, now?.strength ?? 0);
    this.material.uniforms.uFrame.value = (Math.floor((timeMs * 24) / 1000) % 64) * 7;
    return now !== null && now.strength > 0;
  }

  reset(): void {
    this.timer.reset();
    this.now = null;
  }
}
