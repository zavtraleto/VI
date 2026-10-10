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
   * How much light the tube spreads around what gives light off in the layer: the picture
   * `emit` has drawn, blurred and added. 0 leaves it out, and so does a layer nothing was
   * emitted into.
   */
  halo: number;
  /** How far that light spreads, in pixels of the layer. */
  haloReach: number;
  /**
   * How much of it lies over the very things that give the light: there it would wash out what
   * is dark on them. Over everything else the layer has drawn, and into the dark around, it
   * lies in full, as the light of a tube does: it knows nothing of what stands behind what.
   */
  haloOver: number;
  /**
   * 0 spreads the light of the picture `emit` has drawn. Above it, the light is taken from the
   * layer itself, as the consoles of the last years of the tube took it: whatever in the
   * picture is brighter than this gives light, by as much as it is brighter, and nothing has
   * to be drawn a second time.
   */
  haloThreshold: number;
  /** 0..1, grain of the tube over the layer as it stands on screen: counted in the lines of the scanlines, new 24 times a second. */
  grain: number;
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
  halo: 0,
  haloReach: 0,
  haloOver: 0,
  haloThreshold: 0,
  grain: 0,
  lens: 0,
  lensCentre: { x: 0.5, y: 0.5 },
  lensFrom: null,
};

/** How many times smaller along a side the picture of what gives light off is than the layer. */
const EMIT_SHRINK = 4;

/** How many times smaller along a side the picture a trail is kept in is than the layer. */
const TRAIL_SHRINK = 2;

/** The layer made small: four of its points run together into one. */
const TRAIL_SMALL_FRAGMENT = /* glsl */ `
uniform sampler2D uNow;

varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(uNow, vUv);
}
`;

/**
 * What a layer leaves behind what moves in it: at every place, what was there a frame ago and
 * is there no longer, with what was left before it, fainter. A place where nothing has changed
 * has nothing in it, so nothing that stands still gets an edge of its own from so small a
 * picture. The least step of the picture is taken off as well, or the last of a trail would
 * never go.
 */
const TRAIL_FRAGMENT = /* glsl */ `
uniform sampler2D uNow;
uniform sampler2D uWas;
uniform sampler2D uTrail;
uniform float uKeep;

varying vec2 vUv;

void main() {
  vec4 gone = max(texture2D(uWas, vUv) - texture2D(uNow, vUv), 0.0);
  gl_FragColor = max(texture2D(uTrail, vUv) * uKeep - 0.006, gone * uKeep);
}
`;

/** One triangle over the whole of a picture, and what the two pictures of a trail are drawn with. */
function trailPass(): { scene: THREE.Scene; camera: THREE.Camera; mesh: THREE.Mesh; small: THREE.ShaderMaterial; left: THREE.ShaderMaterial } {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const material = (uniforms: Record<string, THREE.IUniform>, fragmentShader: string): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
  const small = material({ uNow: { value: null } }, TRAIL_SMALL_FRAGMENT);
  const left = material({ uNow: { value: null }, uWas: { value: null }, uTrail: { value: null }, uKeep: { value: 0 } }, TRAIL_FRAGMENT);
  const mesh = new THREE.Mesh(geometry, small);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, camera: new THREE.Camera(), mesh, small, left };
}

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
  /** What gives light off in the layer, drawn alone and small; null until something is. */
  private emitTarget: THREE.WebGLRenderTarget | null = null;
  /** The frame of the layer that picture was drawn for. */
  private emitRevision = -1;
  /** The frame made small, this one and the one before, and what they have left behind, likewise; made when a trail is first asked for. */
  private trails: { small: THREE.WebGLRenderTarget[]; left: THREE.WebGLRenderTarget[] } | null = null;
  private trailRevision = -1;
  private trailPass: ReturnType<typeof trailPass> | null = null;

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

  /**
   * What is left behind what has moved in the picture, small, colour premultiplied by alpha;
   * null where no trail is kept of the picture as it is now. It is shown under the picture.
   */
  get trailTexture(): THREE.Texture | null {
    return this.trails && this.trailRevision === this.revision ? this.trails.left[0].texture : null;
  }

  /**
   * Keeps what the frame that has been drawn leaves behind of the one before: `keep` is the
   * share of what was left already that stays, 0 to 1. Called once everything of the frame is
   * drawn into the layer. Both pictures are a quarter of the layer: a trail costs a fraction
   * of what drawing the layer over itself would.
   */
  trail(keep: number): void {
    const { renderer } = this.host;
    const now = this.renderTarget();
    const fresh = this.fitTrails() || this.trailRevision < 0;
    const { small, left } = this.trails!;
    const pass = (this.trailPass ??= trailPass());
    // The frame as it is now, small.
    small.reverse();
    pass.mesh.material = pass.small;
    pass.small.uniforms.uNow.value = now.texture;
    renderer.setRenderTarget(small[0]);
    renderer.render(pass.scene, pass.camera);
    // What it has left of the frame before, over what was left already.
    left.reverse();
    pass.mesh.material = pass.left;
    pass.left.uniforms.uNow.value = small[0].texture;
    pass.left.uniforms.uWas.value = small[1].texture;
    pass.left.uniforms.uTrail.value = left[1].texture;
    // Nothing of a picture of another size, or of a frame from before the trail was dropped.
    pass.left.uniforms.uKeep.value = fresh ? 0 : Math.min(0.98, Math.max(0, keep));
    renderer.setRenderTarget(left[0]);
    renderer.render(pass.scene, pass.camera);
    renderer.setRenderTarget(null);
    this.trailRevision = this.revision;
  }

  /**
   * Lets the trail go: the next one starts from nothing. The pictures a trail was kept in stay
   * and are held to the size of the layer, so that the frame a trail is next asked for on, the
   * frame something first moves, makes nothing.
   */
  dropTrail(): void {
    this.trailRevision = -1;
    if (this.trails && this.fitTrails()) for (const target of [...this.trails.small, ...this.trails.left]) this.host.renderer.initRenderTarget(target);
  }

  /**
   * Makes ready, ahead of the first thing that moves, what a trail is kept with: its four
   * pictures and its two programs, built by drawing with them once. Nothing is left of that
   * drawing. Without it they are made on the frame of the first roll, and hold it up.
   */
  warmTrail(): void {
    // Twice: a trail is drawn into each of its two pairs of pictures in turn.
    this.trail(0);
    this.trail(0);
    this.trailRevision = -1;
  }

  /** The pictures of a trail, made if there are none and brought to the size of the layer; true when any of them is new or has changed its size. */
  private fitTrails(): boolean {
    const now = this.renderTarget();
    const width = Math.max(1, Math.ceil(this.size.width / TRAIL_SHRINK));
    const height = Math.max(1, Math.ceil(this.size.height / TRAIL_SHRINK));
    let changed = false;
    if (!this.trails) {
      const make = (): THREE.WebGLRenderTarget =>
        new THREE.WebGLRenderTarget(width, height, {
          type: now.texture.type,
          depthBuffer: false,
          generateMipmaps: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
        });
      this.trails = { small: [make(), make()], left: [make(), make()] };
      this.trailRevision = -1;
      changed = true;
    }
    for (const target of [...this.trails.small, ...this.trails.left]) {
      if (target.width === width && target.height === height) continue;
      target.setSize(width, height);
      changed = true;
    }
    return changed;
  }

  /** The rows of the picture run from the top down, as those of a canvas do, and not from the bottom up. */
  get topDown(): boolean {
    return false;
  }

  /** What gives light off in the picture as it is now, small and still sharp; null where nothing was drawn for it. */
  get emitted(): THREE.Texture | null {
    return this.emitTarget !== null && this.emitRevision === this.revision ? this.emitTarget.texture : null;
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

  /** Size of the window the layer covers, in CSS pixels. */
  get window(): Size {
    return { width: this.host.width, height: this.host.height };
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
   * Draws a scene over what the layer holds, without clearing it, into `rect` or the whole
   * window: for what is not kept inside the part of the window the rest of the scene goes to.
   * The depth the drawing before left is still there, so what stood in front still hides it.
   */
  renderOver(scene: THREE.Scene, camera: THREE.Camera, options: { rect?: Rect } = {}): void {
    const { renderer } = this.host;
    const target = this.renderTarget();
    const { width, height } = this.size;
    const view = options.rect ? targetViewport(options.rect, this.host, this.size) : { x: 0, y: 0, width, height };
    target.scissorTest = false;
    target.viewport.set(view.x, view.y, view.width, view.height);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    this.revision++;
  }

  /**
   * Draws beside the picture, small, the part of a scene that gives light off: what the tube
   * spreads light around. Called after `render`, with the same `rect`, and with the scene
   * showing only that - black wherever it gives none. The small picture keeps its own depth,
   * so that what stands in front still hides what is behind.
   */
  emit(scene: THREE.Scene, camera: THREE.Camera, options: { rect?: Rect } = {}): void {
    const { renderer } = this.host;
    const size = { width: Math.max(1, Math.ceil(this.size.width / EMIT_SHRINK)), height: Math.max(1, Math.ceil(this.size.height / EMIT_SHRINK)) };
    const target = this.emitPicture(size);
    target.scissorTest = false;
    target.viewport.set(0, 0, size.width, size.height);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    const view = options.rect ? targetViewport(options.rect, this.host, size) : { x: 0, y: 0, ...size };
    target.viewport.set(view.x, view.y, view.width, view.height);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    this.emitRevision = this.revision;
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
    this.emitTarget?.dispose();
    this.emitTarget = null;
    for (const target of [...(this.trails?.small ?? []), ...(this.trails?.left ?? [])]) target.dispose();
    this.trails = null;
    this.trailPass?.small.dispose();
    this.trailPass?.left.dispose();
    this.trailPass = null;
  }

  protected resized(): void {
    this.target?.setSize(this.size.width, this.size.height);
  }

  private emitPicture(size: Size): THREE.WebGLRenderTarget {
    let target = this.emitTarget;
    if (!target) {
      target = new THREE.WebGLRenderTarget(size.width, size.height, {
        depthBuffer: true,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      // Written as the layer itself is, sRGB in 8 bits: see `renderTarget`.
      target.texture.colorSpace = THREE.SRGBColorSpace;
      target.texture.internalFormat = 'RGBA8';
      (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
      this.emitTarget = target;
    }
    if (target.width !== size.width || target.height !== size.height) target.setSize(size.width, size.height);
    return target;
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
