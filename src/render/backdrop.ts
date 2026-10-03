import type * as THREE from 'three';
import type { Display } from '../display/display';

/**
 * What lies behind the board. For now it is the dark of the tube alone, in the colour the
 * board gives it, so it is the colour the screen starts from before any layer is put on it,
 * and costs no picture of its own. The things of the other side that leak through have
 * layers of their own, over it and under the board.
 */
export class Backdrop {
  private css = '';

  constructor(private readonly display: Display) {}

  /** Sets the dark for this frame. `inverted` turns it inside out, as the board's own picture is turned. */
  draw(colour: THREE.Color, inverted: boolean): void {
    const { background } = this.display;
    background.copy(colour);
    if (inverted) {
      // The picture is turned as the screen shows it, not as light adds up.
      background.convertLinearToSRGB();
      background.setRGB(1 - background.r, 1 - background.g, 1 - background.b);
      background.convertSRGBToLinear();
    }
    const css = `#${colour.getHexString()}`;
    if (css !== this.css) {
      // The page follows the dark: panels and marks drawn over the board take their colour from it.
      this.css = css;
      document.documentElement.style.setProperty('--void', css);
    }
  }

  /** Nothing of the board is on screen: the screen starts from black. */
  clear(): void {
    this.display.background.setRGB(0, 0, 0);
  }
}
