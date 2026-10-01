import { DIRS, cubeAt, previewAll, type Dir, type Orientation, type RunState } from '../rules';
import { dieFace, h } from './dom';

/** Side of the die that looks towards each board direction. */
const SIDE: Record<Dir, keyof Orientation> = { N: 'north', E: 'east', S: 'south', W: 'west' };

/** Rhombus edges, one per board direction, in a 200x200 box. */
const EDGE: Record<Dir, [number, number, number, number]> = {
  N: [100, 10, 190, 100],
  E: [190, 100, 100, 190],
  S: [100, 190, 10, 100],
  W: [10, 100, 100, 10],
};

function sealSvg(): string {
  const ticks: string[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI * 2) / 48;
    const r0 = i % 4 === 0 ? 86 : 90;
    ticks.push(
      `<line x1="${(100 + Math.cos(a) * r0).toFixed(1)}" y1="${(100 + Math.sin(a) * r0).toFixed(1)}" x2="${(100 + Math.cos(a) * 94).toFixed(1)}" y2="${(100 + Math.sin(a) * 94).toFixed(1)}"/>`,
    );
  }
  const edges = DIRS.map((d) => {
    const [x1, y1, x2, y2] = EDGE[d];
    return `<line class="seal-edge seal-edge-${d}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  return `<svg class="seal-art" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="98"/><circle cx="100" cy="100" r="94"/>
    <g class="seal-ticks">${ticks.join('')}</g>
    <g class="seal-cross"><line x1="100" y1="14" x2="100" y2="186"/><line x1="14" y1="100" x2="186" y2="100"/></g>
    ${edges}
    <circle class="seal-hub" cx="100" cy="100" r="30"/>
  </svg>`;
}

/**
 * The orientation seal: the die under the player, opened out. The top face is in the middle
 * and each side lies on the edge of the rhombus it looks towards. The bottom face is not
 * shown: it is for the player to work out.
 */
export class Seal {
  readonly el = h('div', { class: 'seal', attrs: { 'aria-hidden': 'true' } });
  private readonly centre = h('div', { class: 'seal-centre' });
  private readonly quads = {} as Record<Dir, HTMLElement>;
  private readonly slots = {} as Record<Dir, HTMLElement>;
  private readonly edges = {} as Record<Dir, SVGLineElement>;
  private signature = '';

  constructor(parent: HTMLElement) {
    // Static markup built from constants only.
    this.el.innerHTML = sealSvg();
    for (const dir of DIRS) {
      this.edges[dir] = this.el.querySelector<SVGLineElement>(`.seal-edge-${dir}`)!;
      this.slots[dir] = h('span', { class: 'seal-slot' });
      this.quads[dir] = h('div', { class: `seal-quad seal-${dir}` }, [this.slots[dir]]);
      this.el.append(this.quads[dir]);
    }
    this.el.append(this.centre);
    parent.append(this.el);
  }

  /**
   * Turns the seal so its directions match where the board directions point on screen.
   * `degrees` is counter-clockwise; faces inside stay upright.
   */
  setRotation(degrees: number): void {
    this.el.style.setProperty('--seal-turn', `${-degrees}deg`);
  }

  /** Lights the edge the finger is steering towards. */
  setActive(dir: Dir | null): void {
    for (const d of DIRS) this.edges[d].classList.toggle('active', d === dir);
  }

  /** Pulses the edge of the direction the tutorial asks for. */
  setPulse(dir: Dir | null): void {
    for (const d of DIRS) this.edges[d].classList.toggle('pulse', d === dir);
  }

  /** `mark` rings the side the tutorial asks to bring on top. */
  update(state: RunState, mark: keyof Orientation | null): void {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    const busy = player.action !== undefined || state.over;
    const previews = busy ? null : previewAll(state);
    const blocked = DIRS.map((dir) => !previews || previews[dir].kind === 'blocked');
    const faces = own ? [own.ori.top, ...DIRS.map((dir) => own.ori[SIDE[dir]])] : [];
    const signature = JSON.stringify([faces, own?.state ?? '', blocked, mark]);
    if (signature === this.signature) return;
    this.signature = signature;

    this.centre.replaceChildren(own ? dieFace(own.ori.top) : h('span', { class: 'seal-floor' }));
    this.centre.classList.toggle('sinking', own?.state === 'sinking');
    DIRS.forEach((dir, i) => {
      this.slots[dir].replaceChildren(...(own ? [dieFace(own.ori[SIDE[dir]])] : []));
      this.quads[dir].classList.toggle('marked', own !== undefined && SIDE[dir] === mark);
      this.edges[dir].classList.toggle('blocked', blocked[i]);
    });
  }
}
