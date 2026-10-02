import * as THREE from 'three';
import { targetSize, targetViewport, type Rect, type Size } from './sizing';

export type { Rect } from './sizing';

/** How a layer is put on screen. Changes take effect on the next frame. */
export interface LayerLook {
  /** 0 keeps the layer off the screen. */
  opacity: number;
  /** Bits per channel after quantizing; 8 turns it off. */
  depth: number;
  /** 0..1, ordered 4x4 dither before quantizing, in the layer's own pixels. */
  dither: number;
  /** Inverts the part of the layer the scene was drawn to. */
  invert: boolean;
  /** How the layer is stretched to the screen. */
  filter: 'nearest' | 'linear';
  // The rest treats the layer as a worn video signal. It is worked out in the layer's own
  // pixels, after the colour depth and the dither, and 0 turns each of them off.
  /** Radius of the blur, in pixels of the layer. */
  blur: number;
  /** Extra blur along the lines only, in pixels of the layer. */
  smear: number;
  /** How far red and blue part from green along the lines, in pixels of the layer. */
  chroma: number;
  /** 0..1, light spilling out of the bright parts. */
  glow: number;
  /** 0..1, grain that changes from frame to frame. */
  noise: number;
  /** 0..1, how dark the gaps between the lines are. */
  scanlines: number;
  /** 0..1, how dark the corners are. */
  vignette: number;
}

export interface LayerOptions {
  name: string;
  /** Height of the target in pixels, the width follows the window; null is the canvas, pixel for pixel. */
  lines: number | null;
  /** MSAA for layers that have to be crisp. */
  samples?: number;
  /**
   * The scene is written the way a plain canvas gets it: sRGB, 8 bits, with blending and
   * anti-aliasing done on those numbers. For a picture that must look as it did on a canvas
   * of its own. Without it the target is linear and deep, and the screen pass converts.
   */
  encoded?: boolean;
  look?: Partial<LayerLook>;
}

/** What a layer needs from the display that owns it. */
export interface LayerHost extends Size {
  readonly renderer: THREE.WebGLRenderer;
  readonly pixelRatio: number;
  /** Brings the canvas and the layers up to the window as it is now. */
  sync(): void;
}

const DEFAULT_LOOK: LayerLook = {
  opacity: 1,
  depth: 8,
  dither: 0,
  invert: false,
  filter: 'nearest',
  blur: 0,
  smear: 0,
  chroma: 0,
  glow: 0,
  noise: 0,
  scanlines: 0,
  vignette: 0,
};

/** A picture the size of the window, at a resolution of its own, that scenes are drawn into. */
export class Layer {
  readonly name: string;
  readonly encoded: boolean;
  look: LayerLook;
  /** Part of the layer the last scene went to: left, bottom, right, top, as fractions of it. */
  readonly area = new THREE.Vector4(0, 0, 1, 1);
  protected lines: number | null;
  protected readonly size: Size = { width: 0, height: 0 };
  private readonly samples: number;
  private target: THREE.WebGLRenderTarget | null = null;

  constructor(
    protected readonly host: LayerHost,
    options: LayerOptions,
  ) {
    this.name = options.name;
    this.lines = options.lines;
    this.samples = options.samples ?? 0;
    this.encoded = options.encoded ?? false;
    this.look = { ...DEFAULT_LOOK, ...options.look };
  }

  /** Size of the layer in its own pixels. */
  get width(): number {
    return this.size.width;
  }

  get height(): number {
    return this.size.height;
  }

  /** The picture, with colour premultiplied by alpha. */
  get texture(): THREE.Texture {
    return this.renderTarget().texture;
  }

  setLines(lines: number | null): void {
    if (lines === this.lines) return;
    this.lines = lines;
    this.fit();
  }

  /** Takes the size the window gives it. The display calls this when the window changes. */
  fit(): void {
    const { width, height } = targetSize(this.host, this.lines, this.host.pixelRatio);
    if (width === this.size.width && height === this.size.height) return;
    this.size.width = width;
    this.size.height = height;
    this.resized();
  }

  /**
   * Draws a scene into the layer in place of what was there. `rect` is the part of the window
   * the scene goes to, in CSS pixels; without it, the whole window. `clear` fills the whole
   * layer first; without it the layer is transparent around the scene.
   *
   * A `scene.background` colour would fill the whole layer, not the rect: leave it unset.
   */
  render(scene: THREE.Scene, camera: THREE.Camera, options: { rect?: Rect; clear?: THREE.Color } = {}): void {
    this.host.sync();
    const { renderer } = this.host;
    const target = this.renderTarget();
    const { width, height } = this.size;

    // No scissor: the multisample resolve at the end of a render is cut by it, and only the
    // rect would reach the texture. The viewport alone keeps the scene inside its rect.
    target.scissorTest = false;
    target.viewport.set(0, 0, width, height);
    renderer.setRenderTarget(target);
    if (options.clear) renderer.setClearColor(options.clear, 1);
    else renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);

    const view = options.rect ? targetViewport(options.rect, this.host, this.size) : { x: 0, y: 0, width, height };
    target.viewport.set(view.x, view.y, view.width, view.height);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    this.area.set(view.x / width, view.y / height, (view.x + view.width) / width, (view.y + view.height) / height);
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
  }

  protected resized(): void {
    this.target?.setSize(this.size.width, this.size.height);
  }

  private renderTarget(): THREE.WebGLRenderTarget {
    if (this.target) return this.target;
    const { extensions } = this.host.renderer;
    const deep = extensions.has('EXT_color_buffer_float') || extensions.has('EXT_color_buffer_half_float');
    const target = new THREE.WebGLRenderTarget(Math.max(1, this.size.width), Math.max(1, this.size.height), {
      // Linear values need the depth: the near-black of the board's void is less than half a
      // step of an 8-bit channel. Encoded values are what a canvas holds, and fit in 8 bits.
      type: this.encoded || !deep ? THREE.UnsignedByteType : THREE.HalfFloatType,
      samples: this.samples,
      depthBuffer: true,
      resolveDepthBuffer: false,
      generateMipmaps: false,
      // `nearest` is done in the screen pass, by sampling at the centres of the pixels.
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    if (this.encoded) {
      // three.js (r186) converts to sRGB only on the way to the screen or to a headset's
      // target, which is what this flag marks. With it the scene is written exactly as it
      // would be to a canvas, clear colour included. The format is named so that the texture
      // stays plain RGBA8: an sRGB one would be decoded again when the screen pass reads it.
      target.texture.colorSpace = THREE.SRGBColorSpace;
      target.texture.internalFormat = 'RGBA8';
      (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
    }
    this.target = target;
    return target;
  }
}

/** A layer drawn through Canvas2D: text and flat marks over the scenes. */
export class CanvasLayer extends Layer {
  readonly ctx: CanvasRenderingContext2D;
  /** Called when the canvas has taken a new size and lost its picture. */
  onResize: (() => void) | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly canvasTexture: THREE.CanvasTexture;

  constructor(host: LayerHost, options: LayerOptions) {
    super(host, { ...options, encoded: true });
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.canvasTexture = new THREE.CanvasTexture(this.canvas);
    this.canvasTexture.premultiplyAlpha = true;
    this.canvasTexture.generateMipmaps = false;
    this.canvasTexture.minFilter = THREE.LinearFilter;
    this.canvasTexture.magFilter = THREE.LinearFilter;
  }

  override get texture(): THREE.Texture {
    return this.canvasTexture;
  }

  /** Pixels of the canvas per CSS pixel of the window. */
  get scale(): number {
    return this.size.height / this.host.height;
  }

  /** The texture is uploaded again only after this call. */
  markDirty(): void {
    this.canvasTexture.needsUpdate = true;
  }

  override render(): void {
    throw new Error(`Layer "${this.name}" is drawn through its ctx, not with a scene.`);
  }

  override dispose(): void {
    this.canvasTexture.dispose();
  }

  protected override resized(): void {
    this.canvas.width = this.size.width;
    this.canvas.height = this.size.height;
    // The texture on the GPU keeps its first size: drop it, the next upload makes a new one.
    this.canvasTexture.dispose();
    this.markDirty();
    this.onResize?.();
  }
}
