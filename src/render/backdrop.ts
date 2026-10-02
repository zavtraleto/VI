import * as THREE from 'three';
import type { Layer } from '../display/layer';

/**
 * What lies behind the board: a layer of its own under it, a picture of few pixels as the
 * program's menu is. For now it is the dark of the tube alone, in the colour the board gives
 * it. The things of the other side that leak through will be drawn here.
 */
export class Backdrop {
  readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private css = '';

  constructor(private readonly layer: Layer) {}

  /** Draws the layer; `lines` is the height of the program's picture in its own pixels. */
  draw(colour: THREE.Color, lines: number): void {
    this.layer.setLines(lines);
    this.layer.render(this.scene, this.camera, { clear: colour });
    const css = `#${colour.getHexString()}`;
    if (css !== this.css) {
      // The page follows the dark: panels and marks drawn over the board take their colour from it.
      this.css = css;
      document.documentElement.style.setProperty('--void', css);
    }
  }
}
