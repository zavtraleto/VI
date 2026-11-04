import * as THREE from 'three';
import voiceUrl from './people/voice.webp';
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
 * The figure as a silhouette: filled with a colour near the dark around it, and lit at its edge,
 * a little over the edge itself and more out past it, as a figure stands against a light behind
 * it. Nothing of what is inside the picture is shown: no face, no detail.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D uMask;
uniform vec3 uFill;
uniform vec3 uHalo;
uniform float uHaloAmount;
uniform float uRimAmount;

varying vec2 vUv;

void main() {
  vec3 mask = texture2D(uMask, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  float body = mask.r;
  float rim = body * (1.0 - mask.b) * uRimAmount;
  float outside = mask.g * (1.0 - body) * uHaloAmount;
  float alpha = body + outside;
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4((uFill * (body - rim) + uHalo * (rim + outside)) / alpha, alpha);
}
`;

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
      const pixels = ctx.getImageData(0, 0, width, height).data;
      const alpha = new Uint8Array(width * height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
      return { mask: figureMask(alpha, width, height), sprite };
    })
    .catch(() => {
      // Asked for again by the next record.
      loading = null;
      return null;
    });
  return loading;
}

/**
 * The voice of the other side in a record of the link: a figure to the waist in the middle of the
 * frame, drawn over the picture of the place and under the band of the words. Its picture is
 * fetched with the first record, not before. The light at its edge is stronger while the voice
 * speaks than while the operator does, and goes from one to the other slowly.
 */
export class VoiceFigure {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.Camera();
  private readonly material: THREE.ShaderMaterial;
  private readonly box = new THREE.Vector4();
  /** How much of its light the edge has now, as a share of the strongest; null before the first frame. */
  private glow: number | null = null;
  private last = 0;

  private constructor(
    private readonly mask: FigureMask,
    /** The picture of the figure, width over height, without the air around it. */
    private readonly sprite: number,
  ) {
    const texture = new THREE.DataTexture(mask.data, mask.width, mask.height, THREE.RGBAFormat);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: texture },
        uBox: { value: this.box },
        uFill: { value: new THREE.Color() },
        uHalo: { value: new THREE.Color(NOVEL_LOOK.figure.halo) },
        uHaloAmount: { value: 0 },
        uRimAmount: { value: 0 },
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
   * is the one who speaks now. `fill` is the colour of its body. With `still` it does not breathe.
   */
  update(timeMs: number, aspect: number, speaking: boolean, fill: string, still: boolean): void {
    const look = NOVEL_LOOK.figure;
    const target = speaking ? look.voice : look.operator;
    const dt = Math.max(0, timeMs - this.last);
    this.last = timeMs;
    this.glow = this.glow === null ? target : this.glow + (target - this.glow) * (1 - Math.exp(-dt / Math.max(1, look.fadeMs)));
    const breath = still ? 0 : look.breath * Math.sin((timeMs / look.breathMs) * Math.PI * 2);
    const at = figureBox(aspect, this.sprite, breath);
    // The picture with the air around it: the light outside the figure is drawn in that air.
    const { mask } = this;
    const inner = { width: mask.width - mask.pad * 2, height: mask.height - mask.pad * 2 };
    const padX = (mask.pad / inner.width) * at.width;
    const padY = (mask.pad / inner.height) * at.height;
    this.box.set(at.left - padX, at.bottom - padY, at.width + padX * 2, at.height + padY * 2);
    const uniforms = this.material.uniforms;
    (uniforms.uFill.value as THREE.Color).set(fill);
    uniforms.uHaloAmount.value = Math.min(1, look.haloAmount * this.glow);
    uniforms.uRimAmount.value = Math.min(1, look.rimAmount * this.glow);
  }

  /** A record has closed: the next one starts its light where it is told to, not where this one left it. */
  reset(): void {
    this.glow = null;
  }
}
