import * as THREE from 'three';
import type { LensStrength, Point } from './lens';
import { quality } from './quality';
import { canvasSize, targetSize, targetViewport, type Rect, type Size } from './sizing';

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
  /**
   * Lines of the screen the scanlines are counted in; 0 is the layer's own. A crisp layer
   * takes the lines of the tube it is shown on, so its picture stays sharp under them.
   */
  scanlinePitch: number;
  /** 0..1, how dark the corners are. */
  vignette: number;
  /**
   * Strength of the lens the layer is put on screen through: the middle of the part the scene
   * was drawn to is enlarged `1 + k` times and its edges are pressed together, so all of it
   * stays in view. 0 is no lens. See `lens.ts`.
   */
  lens: LensStrength;
  /** Where the centre of the lens stands on screen, as fractions of that part from its left and its bottom. */
  lensCentre: Point;
  /** The point of the layer that is shown at the centre; null is the point that lies there anyway. */
  lensFrom: Point | null;
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

/** The pictures a material is drawn with: those it names itself, and those among its uniforms. */
function texturesOf(material: THREE.Material): THREE.Texture[] {
  const found: THREE.Texture[] = [];
  const take = (value: unknown): void => {
    const texture = value as THREE.Texture | null;
    if (texture?.isTexture && !texture.isRenderTargetTexture) found.push(texture);
  };
  for (const value of Object.values(material)) take(value);
  const { uniforms } = material as THREE.ShaderMaterial;
  if (uniforms) for (const uniform of Object.values(uniforms)) take(uniform.value);
  return found;
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
  scanlinePitch: 0,
  vignette: 0,
  lens: 0,
  lensCentre: { x: 0.5, y: 0.5 },
  lensFrom: null,
};

/** A picture the size of the window, at a resolution of its own, that scenes are drawn into. */
export class Layer {
  readonly name: string;
  readonly encoded: boolean;
  look: LayerLook;
  /**
   * Grows whenever the picture changes. What is worked out from the picture is kept until it
   * does, instead of being worked out again on every frame.
   */
  revision = 0;
  /** Part of the layer the last scene went to: left, bottom, right, top, as fractions of it. */
  readonly area = new THREE.Vector4(0, 0, 1, 1);
  protected lines: number | null;
  protected readonly size: Size = { width: 0, height: 0 };
  /** How many times denser than its lines say the layer is, side to side and top to bottom. */
  private readonly dense = { x: 1, y: 1 };
  private samples: number;
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
    // A point of its own: one layer moving its lens moves no other's.
    this.look.lensCentre = { ...this.look.lensCentre };
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

  /** The rows of the picture run from the top down, as those of a canvas do, and not from the bottom up. */
  get topDown(): boolean {
    return false;
  }

  /** Draws the layer with this many samples of anti-aliasing from the next scene on. */
  setSamples(samples: number): void {
    if (samples === this.samples) return;
    this.samples = samples;
    // A picture is made for a number of samples: this one is let go, and the next drawing makes another.
    this.target?.dispose();
    this.target = null;
  }

  setLines(lines: number | null): void {
    if (lines === this.lines) return;
    this.lines = lines;
    this.fit();
  }

  /**
   * Draws the layer denser than its lines say, `x` times from side to side and `y` times
   * from top to bottom: room for a picture whose middle is enlarged on the way to the screen,
   * as a lens does. A lens that draws the picture together one way only costs that way only.
   */
  setDensity(x: number, y = x): void {
    const dense = { x: x > 0 ? x : 1, y: y > 0 ? y : 1 };
    if (dense.x === this.dense.x && dense.y === this.dense.y) return;
    this.dense.x = dense.x;
    this.dense.y = dense.y;
    this.fit();
  }

  /** Size of the canvas of the page, which the layer is put on, in its pixels. */
  get screen(): Size {
    return canvasSize(this.host, this.host.pixelRatio);
  }

  /** Takes the size the window gives it. The display calls this when the window changes. */
  fit(): void {
    const plain = targetSize(this.host, this.lines, this.host.pixelRatio);
    const width = Math.max(1, Math.round(plain.width * this.dense.x));
    const height = Math.max(1, Math.round(plain.height * this.dense.y));
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
    this.revision++;
  }

  /**
   * Has what a scene is drawn with into this layer made ready ahead of time: its programs
   * are built and its pictures sent to the graphics card. Left to the first drawing, they
   * hold that frame up. Everything of the scene is taken, seen or not. The promise is kept
   * when the programs are ready.
   */
  warm(scene: THREE.Scene, camera: THREE.Camera): Promise<unknown> {
    const { renderer } = this.host;
    // A program is built for the picture it writes to: this layer's, not the screen.
    renderer.setRenderTarget(this.renderTarget());
    const ready = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(null);
    scene.traverse((object) => {
      const { material } = object as THREE.Mesh;
      if (!material) return;
      for (const one of Array.isArray(material) ? material : [material]) {
        for (const texture of texturesOf(one)) renderer.initTexture(texture);
      }
    });
    return ready;
  }

  /** Sends to the graphics card what has changed in the picture. The display calls this before it shows the layer. */
  flush(): void {}

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
  /**
   * The same canvas as a picture the graphics card never holds: a part of the canvas is sent
   * from it. three.js takes a source that is on the card for a copy from one of the card's
   * pictures to another, and this one has to be read from memory.
   */
  private readonly source: THREE.CanvasTexture;
  /** What is sent next: the whole canvas, or only the part of it in `patch`. */
  private whole = true;
  private readonly patch = new THREE.Box2();
  private readonly corner = new THREE.Vector2();

  constructor(host: LayerHost, options: LayerOptions) {
    super(host, { ...options, encoded: true });
    this.canvas = document.createElement('canvas');
    // Kept in memory, not on the graphics card: the picture is read back on every upload, and a
    // canvas of the card's own has to be fetched from it first, which stalls the frame.
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.canvasTexture = new THREE.CanvasTexture(this.canvas);
    this.canvasTexture.premultiplyAlpha = true;
    this.canvasTexture.generateMipmaps = false;
    this.canvasTexture.minFilter = THREE.LinearFilter;
    this.canvasTexture.magFilter = THREE.LinearFilter;
    // Rows go up as the canvas has them, top first: turning them over costs a copy of the
    // picture on every upload, and a part of it could not be sent to its place. The pass that
    // reads the layer turns it instead.
    this.canvasTexture.flipY = false;
    this.source = new THREE.CanvasTexture(this.canvas);
  }

  override get texture(): THREE.Texture {
    return this.canvasTexture;
  }

  override get topDown(): boolean {
    return true;
  }

  /** Pixels of the canvas per CSS pixel of the window. */
  get scale(): number {
    return this.size.height / this.host.height;
  }

  /**
   * The picture has changed, and is sent to the graphics card before the next frame: all of it,
   * or only `part` of it, in pixels of the canvas from its top left corner.
   */
  markDirty(part?: Rect): void {
    this.revision++;
    if (!part || !quality().patches) this.whole = true;
    if (this.whole || !part) return;
    const left = Math.max(0, Math.floor(part.x));
    const top = Math.max(0, Math.floor(part.y));
    const right = Math.min(this.size.width, Math.ceil(part.x + part.width));
    const bottom = Math.min(this.size.height, Math.ceil(part.y + part.height));
    if (right <= left || bottom <= top) return;
    this.patch.expandByPoint(this.corner.set(left, top));
    this.patch.expandByPoint(this.corner.set(right, bottom));
  }

  override flush(): void {
    if (this.whole) this.canvasTexture.needsUpdate = true;
    else if (!this.patch.isEmpty()) this.host.renderer.copyTextureToTexture(this.source, this.canvasTexture, this.patch, this.patch.min);
    this.whole = false;
    this.patch.makeEmpty();
  }

  override render(): void {
    throw new Error(`Layer "${this.name}" is drawn through its ctx, not with a scene.`);
  }

  override dispose(): void {
    this.canvasTexture.dispose();
    this.source.dispose();
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
