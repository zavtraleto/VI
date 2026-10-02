import type { Dir } from '../rules';
import type { InputController } from './controller';

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'N',
  KeyW: 'N',
  ArrowRight: 'E',
  KeyD: 'E',
  ArrowDown: 'S',
  KeyS: 'S',
  ArrowLeft: 'W',
  KeyA: 'W',
};

/** Arrow keys and WASD. The most recently pressed key wins; repeat comes from the controller. */
export function bindKeyboard(
  controller: InputController,
  now: () => number,
  enabled: () => boolean,
  onPause: () => void,
): void {
  const down: string[] = [];

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      // A key that something else has already answered is not a pause.
      if (!e.defaultPrevented) onPause();
      return;
    }
    const dir = KEY_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat || !enabled()) return;
    if (!down.includes(e.code)) down.push(e.code);
    controller.press(dir, now());
  });

  window.addEventListener('keyup', (e) => {
    const i = down.indexOf(e.code);
    if (i < 0) return;
    const wasLatest = i === down.length - 1;
    down.splice(i, 1);
    if (down.length === 0) controller.release();
    else if (wasLatest) controller.hold(KEY_DIR[down[down.length - 1]]);
  });

  window.addEventListener('blur', () => {
    down.length = 0;
    controller.cancel();
  });
}
