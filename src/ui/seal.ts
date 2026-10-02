import { DIRS, cubeAt, previewAll, roll, type Dir, type Orientation, type RunState } from '../rules';
import { topTurn } from '../render/orientationQuat';
import { dieFace, h } from './dom';

/** Side of the die that looks towards each board direction. */
const SIDE: Record<Dir, keyof Orientation> = { N: 'north', E: 'east', S: 'south', W: 'west' };

/** The roll that turns each side up: folded out, a side lies the way it would then lie on top. */
const TURNS_UP: Record<Dir, Dir> = { N: 'S', E: 'W', S: 'N', W: 'E' };

/** How the floor lies on screen: where a cell to the east and a cell to the south lead, y pointing down. */
export interface FloorAxes {
  east: { x: number; y: number };
  south: { x: number; y: number };
}

function face(value: number, ori: Orientation): HTMLElement {
  const el = dieFace(value);
  // The turn is counter-clockwise seen from above; CSS turns clockwise.
  el.style.rotate = `${Math.round((-topTurn(ori) * 180) / Math.PI)}deg`;
  return el;
}

/**
 * The orientation seal: the die under the player, unfolded. The top face is in the middle and
 * each side lies folded out towards the board direction it looks to; the bottom face is not
 * shown: it is for the player to work out. The net lies in the plane of the board, turned and
 * tilted as the board is, so a side points where a step that way leads.
 */
export class Seal {
  readonly el = h('div', { class: 'seal', attrs: { 'aria-hidden': 'true' } });
  private readonly net = h('div', { class: 'seal-net' });
  private readonly centre = h('div', { class: 'seal-centre' });
  private readonly sides = {} as Record<Dir, HTMLElement>;
  private signature = '';

  constructor(parent: HTMLElement) {
    for (const dir of DIRS) {
      this.sides[dir] = h('div', { class: `seal-side seal-${dir}` });
      this.net.append(this.sides[dir]);
    }
    this.net.append(this.centre);
    this.el.append(this.net);
    parent.append(this.el);
  }

  /** Lays the net out the way the floor of the board lies on screen. */
  setFloor({ east, south }: FloorAxes): void {
    const n = (v: number) => v.toFixed(4);
    this.net.style.transform = `matrix(${n(east.x)}, ${n(east.y)}, ${n(south.x)}, ${n(south.y)}, 0, 0)`;
  }

  /** Lights the side the finger is steering towards. */
  setActive(dir: Dir | null): void {
    for (const d of DIRS) this.sides[d].classList.toggle('active', d === dir);
  }

  /** Pulses the side of the direction the tutorial asks for. */
  setPulse(dir: Dir | null): void {
    for (const d of DIRS) this.sides[d].classList.toggle('pulse', d === dir);
  }

  /** `mark` rings the side the tutorial asks to bring on top. */
  update(state: RunState, mark: keyof Orientation | null): void {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    const busy = player.action !== undefined || state.over;
    const previews = busy ? null : previewAll(state);
    const blocked = DIRS.map((dir) => !previews || previews[dir].kind === 'blocked');
    const signature = JSON.stringify([own?.ori ?? null, own?.state ?? '', blocked, mark]);
    if (signature === this.signature) return;
    this.signature = signature;

    this.el.classList.toggle('floor', !own);
    this.centre.replaceChildren(...(own ? [face(own.ori.top, own.ori)] : []));
    this.centre.classList.toggle('sinking', own?.state === 'sinking');
    DIRS.forEach((dir, i) => {
      const side = this.sides[dir];
      side.replaceChildren(...(own ? [face(own.ori[SIDE[dir]], roll(own.ori, TURNS_UP[dir]))] : []));
      side.classList.toggle('marked', own !== undefined && SIDE[dir] === mark);
      side.classList.toggle('blocked', blocked[i]);
    });
  }
}
