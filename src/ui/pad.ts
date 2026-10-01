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
  walk: '•',
};

/**
 * The orientation seal: current top face in the middle, what each direction will do
 * around it. In button mode the four quadrants are also the D-pad.
 */
export class Pad {
  readonly el = h('div', { class: 'pad' });
  private readonly centre = h('div', { class: 'pad-centre' });
  private readonly quads = {} as Record<Dir, HTMLButtonElement>;
  private readonly slots = {} as Record<Dir, HTMLElement>;
  private signature = '';

  constructor(parent: HTMLElement, controller: InputController, now: () => number, enabled: () => boolean) {
    for (const dir of DIRS) {
      const slot = h('span', { class: 'pad-slot' });
      const quad = h('button', { class: `pad-quad pad-${dir}`, attrs: { type: 'button', 'aria-label': ARROW[dir] } }, [
        h('span', { class: 'pad-arrow', text: ARROW[dir] }),
        slot,
      ]);
      quad.addEventListener('pointerdown', (e) => {
        if (!enabled()) return;
        e.preventDefault();
        try {
          quad.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety; the press still registers without it.
        }
        controller.press(dir, now());
      });
      const stop = () => controller.release();
      quad.addEventListener('pointerup', stop);
      quad.addEventListener('pointercancel', () => controller.cancel());
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

  /** Lights the quadrant the finger is steering towards. */
  setActive(dir: Dir | null): void {
    for (const d of DIRS) this.quads[d].classList.toggle('active', d === dir);
  }

  /** Pulses one quadrant during the tutorial. */
  setPulse(dir: Dir | null): void {
    for (const d of DIRS) this.quads[d].classList.toggle('pulse', d === dir);
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
      quad.classList.toggle('blocked', !preview || preview.kind === 'blocked');
      quad.classList.toggle('clears', !!preview && preview.clears && showClears);
      quad.classList.toggle('push', preview?.kind === 'push');
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
