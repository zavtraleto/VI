import type { InputController } from '../input/controller';
import { DIRS, type Dir } from '../rules';
import { h } from './dom';

const ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' };

/** Four buttons in a cross: up is north, right is east. Shown in button mode only. */
export class Dpad {
  readonly el = h('div', { class: 'dpad' });
  private readonly buttons = {} as Record<Dir, HTMLButtonElement>;

  constructor(parent: HTMLElement, controller: InputController, now: () => number, enabled: () => boolean) {
    for (const dir of DIRS) {
      const button = h('button', {
        class: `dpad-btn dpad-${dir}`,
        text: ARROW[dir],
        attrs: { type: 'button', 'aria-label': ARROW[dir] },
      });
      button.addEventListener('pointerdown', (e) => {
        if (!enabled()) return;
        e.preventDefault();
        try {
          button.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety; the press still registers without it.
        }
        button.classList.add('pressed');
        controller.press(dir, now());
      });
      const lift = () => button.classList.remove('pressed');
      button.addEventListener('pointerup', () => {
        lift();
        controller.release();
      });
      button.addEventListener('pointercancel', () => {
        lift();
        controller.cancel();
      });
      button.addEventListener('contextmenu', (e) => e.preventDefault());
      this.buttons[dir] = button;
      this.el.append(button);
    }
    parent.append(this.el);
  }

  /** Pulses one direction during the tutorial. */
  setPulse(dir: Dir | null): void {
    for (const d of DIRS) this.buttons[d].classList.toggle('pulse', d === dir);
  }
}
