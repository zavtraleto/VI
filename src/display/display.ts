import * as THREE from 'three';
import { CanvasLayer, Layer, type LayerHost, type LayerOptions } from './layer';
import { Presenter } from './present';
import { pixelRatio } from './sizing';

/**
 * The one renderer and the one canvas of the application, as large as the window. The picture
 * is put together from layers. The display keeps no loop of its own: whoever owns the frame
 * draws into the layers and then calls `present()`.
 */
export class Display implements LayerHost {
  readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly layers: Layer[] = [];
  private readonly presenter = new Presenter();
  private cssWidth = 0;
  private cssHeight = 0;
  private ratio = 0;

  constructor() {
    // Layers that need anti-aliasing or depth have their own; the canvas only receives them.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false });
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'display';
    // Under everything else on the page, which comes after it.
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
    document.body.prepend(this.canvas);
    this.sync();
  }

  /** Size of the window in CSS pixels. */
  get width(): number {
    return this.cssWidth;
  }

  get height(): number {
    return this.cssHeight;
  }

  /** Pixels of the canvas per CSS pixel. */
  get pixelRatio(): number {
    return this.ratio;
  }

  /** A new layer over all the others, or right under the layer `under`. */
  addLayer(options: LayerOptions, under?: Layer): Layer {
    return this.add(new Layer(this, options), under);
  }

  addCanvasLayer(options: LayerOptions, under?: Layer): CanvasLayer {
    return this.add(new CanvasLayer(this, options), under);
  }

  removeLayer(layer: Layer): void {
    const index = this.layers.indexOf(layer);
    if (index === -1) return;
    this.layers.splice(index, 1);
    this.presenter.release(layer);
    layer.dispose();
  }

  /**
   * Brings the canvas and the layers up to the window as it is now. Checked on every draw
   * rather than left to resize events: those do not arrive where frames are stepped by hand,
   * and a change of pixel ratio alone raises none.
   */
  sync(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const ratio = pixelRatio(window.devicePixelRatio);
    if (width === this.cssWidth && height === this.cssHeight && ratio === this.ratio) return;
    this.cssWidth = width;
    this.cssHeight = height;
    this.ratio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    for (const layer of this.layers) layer.fit();
  }

  /**
   * Puts the visible layers on the screen, in the order they were added. `timeMs` is only for
   * looks that change by themselves, like grain.
   */
  present(timeMs = 0): void {
    this.sync();
    const { renderer } = this;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    for (const layer of this.layers) {
      if (layer.look.opacity > 0) this.presenter.draw(renderer, layer, timeMs);
    }
  }

  private add<T extends Layer>(layer: T, under?: Layer): T {
    layer.fit();
    const at = under ? this.layers.indexOf(under) : -1;
    if (at === -1) this.layers.push(layer);
    else this.layers.splice(at, 0, layer);
    return layer;
  }
}
