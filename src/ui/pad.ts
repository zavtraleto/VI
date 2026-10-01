import type { InputController } from '../input/controller';
import type { ControlMode } from '../platform/settings';
import { DIRS, cubeAt, previewAll, type Dir, type MovePreview, type RunState } from '../rules';
import { dieFace, h } from './dom';

const ARROW: Record<Dir, string> = { N: '↗', E: '↘', S: '↙', W: '↖' };

const ICON: Partial<Record<MovePreview['kind'], string>> = {
  hop: '⤴',
  mount: '⤴',
  climb: '⤴',
  descend: '⤵',
  walk: '·',
};

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
 * The orientation seal: the current top face in the middle, what each direction will do
 * on the four edges of the rhombus. In button mode the quadrants are also the D-pad.
 */
export class Pad {
  readonly el = h('div', { class: 'pad' });
  private readonly centre = h('div', { class: 'pad-centre' });
  private readonly quads = {} as Record<Dir, HTMLButtonElement>;
  private readonly slots = {} as Record<Dir, HTMLElement>;
  private readonly edges = {} as Record<Dir, SVGLineElement>;
  private signature = '';

  constructor(parent: HTMLElement, controller: InputController, now: () => number, enabled: () => boolean) {
    // Static markup built from constants only.
    this.el.innerHTML = sealSvg();
    for (const dir of DIRS) {
      this.edges[dir] = this.el.querySelector<SVGLineElement>(`.seal-edge-${dir}`)!;
      const slot = h('span', { class: 'pad-slot' });
      const quad = h('button', { class: `pad-quad pad-${dir}`, attrs: { type: 'button', 'aria-label': ARROW[dir] } }, [slot]);
      quad.addEventListener('pointerdown', (e) => {
        if (!enabled()) return;
        e.preventDefault();
        try {
          quad.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety; the press still registers without it.
        }
        quad.classList.add('pressed');
        controller.press(dir, now());
      });
      const lift = () => quad.classList.remove('pressed');
      quad.addEventListener('pointerup', () => {
        lift();
        controller.release();
      });
      quad.addEventListener('pointercancel', () => {
        lift();
        controller.cancel();
      });
      quad.addEventListener('contextmenu', (e) => e.preventDefault());
      this.quads[dir] = quad;
      this.slots[dir] = slot;
      this.el.append(quad);
    }
    this.el.append(this.centre);
    parent.append(this.el);
  }

  setMode(mode: ControlMode): void {
    this.el.classList.toggle('dpad', mode === 'dpad');
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

  /** Pulses one direction during the tutorial. */
  setPulse(dir: Dir | null): void {
    for (const d of DIRS) {
      this.edges[d].classList.toggle('pulse', d === dir);
      this.quads[d].classList.toggle('pulse', d === dir);
    }
  }

  update(state: RunState, showClears: boolean): void {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    const busy = player.action !== undefined || state.over;
    const previews = busy ? null : previewAll(state);
    const signature = JSON.stringify([own?.ori.top ?? 0, own?.state ?? '', previews, showClears]);
    if (signature === this.signature) return;
    this.signature = signature;

    this.centre.replaceChildren(own ? dieFace(own.ori.top) : h('span', { class: 'pad-floor' }));
    this.centre.classList.toggle('sinking', own?.state === 'sinking');

    for (const dir of DIRS) {
      const quad = this.quads[dir];
      const slot = this.slots[dir];
      const preview = previews?.[dir];
      const blocked = !preview || preview.kind === 'blocked';
      quad.classList.toggle('blocked', blocked);
      quad.classList.toggle('clears', !!preview && preview.clears && showClears);
      quad.classList.toggle('push', preview?.kind === 'push');
      this.edges[dir].classList.toggle('blocked', blocked);
      if (!preview || preview.kind === 'blocked') {
        slot.replaceChildren();
      } else if (preview.top !== undefined) {
        slot.replaceChildren(dieFace(preview.top));
      } else {
        slot.replaceChildren(h('span', { class: 'pad-icon', text: ICON[preview.kind] ?? '' }));
      }
    }
  }
}
