import { cubeAt, type Orientation, type RunState } from '../rules';
import { dieFace, h } from './dom';

type Face = keyof Orientation;

/** Order the cells are built in; where each one sits is set by its class. */
const FACES: readonly Face[] = ['top', 'west', 'south', 'east', 'north', 'bottom'];

/**
 * The die under the player, unfolded: its four sides in a row, the top face above the side
 * that looks at the camera and the bottom face below it. One glance tells which value is
 * where. On the floor the net is empty.
 */
export class Seal {
  readonly el = h('div', { class: 'net', attrs: { 'aria-hidden': 'true' } });
  private readonly cells = {} as Record<Face, HTMLElement>;
  private signature = '';

  constructor(parent: HTMLElement) {
    for (const face of FACES) {
      this.cells[face] = h('span', { class: `net-cell net-${face}` });
      this.el.append(this.cells[face]);
    }
    parent.append(this.el);
  }

  /** `mark` rings the face the tutorial asks to bring on top. */
  update(state: RunState, mark: Face | null): void {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    const signature = own ? `${FACES.map((face) => own.ori[face]).join('')}${own.state}${mark ?? ''}` : '';
    if (signature === this.signature) return;
    this.signature = signature;

    this.el.classList.toggle('floor', !own);
    this.el.classList.toggle('sinking', own?.state === 'sinking');
    for (const face of FACES) {
      const cell = this.cells[face];
      cell.replaceChildren(...(own ? [dieFace(own.ori[face])] : []));
      cell.classList.toggle('marked', own !== undefined && face === mark);
    }
  }
}
