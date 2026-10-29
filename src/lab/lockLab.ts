import GUI from 'lil-gui';
import type { Game } from '../app/game';
import type { Settings } from '../platform/settings';
import type { ParamValues } from '../signal/scene';
import { SHELL_GROUPS } from '../shell/theme';

/** Narrower than this, the panel starts folded: on a phone it would cover the board. */
const NARROW_PX = 600;

/** What the lab reaches inside the game. These are private to it: the lab is a tool and looks inside. */
interface Inside {
  readonly settings: Settings;
  readonly look: { shell: ParamValues };
  readonly hud: { drawn: string };
  startPlace(index: number, intro?: boolean, said?: boolean): void;
  startRun(kind: 'endless'): void;
}

/** What the sliders of the frame are called on the panel. */
const LABELS: Record<string, string> = {
  lockGap: 'зазор до цели',
  lockArm: 'длина уголка (0.5 — вся рамка)',
  lockStuds: 'точки в углах',
  lockFrom: 'насколько шире в начале',
  lockSnapMs: 'захват, мс',
  lockTone: 'яркость',
};

/**
 * The lab of the frame of a tap, `?lab=lock`: the game itself, played by taps and clicks, on the
 * first place of the row or in Endless, with a panel of the numbers of the frame
 * (docs/superpowers/specs/2026-10-29-vi-tap-control-design.md). What is turned shows at once.
 */
export function startLockLab(game: Game): void {
  const inside = game as unknown as Inside;
  inside.settings.control = 'tap';
  inside.startPlace(0);

  const gui = new GUI({ title: 'VI · рамка цели' });
  if (window.innerWidth < NARROW_PX) gui.close();
  const values = inside.look.shell;
  for (const [name, spec] of Object.entries(SHELL_GROUPS.lock)) {
    const redraw = (): void => {
      inside.hud.drawn = '';
    };
    if (spec.kind === 'number') gui.add(values, name, spec.min, spec.max, spec.step).name(LABELS[name] ?? name).onChange(redraw);
    else if (spec.kind === 'boolean') gui.add(values, name).name(LABELS[name] ?? name).onChange(redraw);
  }
  const actions = {
    level: () => inside.startPlace(0),
    endless: () => inside.startRun('endless'),
    copy: () => {
      const changed = Object.fromEntries(Object.keys(SHELL_GROUPS.lock).map((name) => [name, values[name]]));
      void navigator.clipboard?.writeText(JSON.stringify(changed, null, 2));
    },
  };
  gui.add(actions, 'level').name('первый уровень');
  gui.add(actions, 'endless').name('Endless');
  gui.add(actions, 'copy').name('Скопировать числа');
}
