import { DEFAULT_CAMERA, type Settings } from '../platform/settings';
import { DEFAULT_TUNING, TUNING_RANGES, type Tuning } from '../rules';
import { h } from './dom';
import { td, type DevKey } from './devText';

const TUNING_KEYS = Object.keys(DEFAULT_TUNING) as (keyof Tuning)[];

const CAMERA_RANGES = {
  yaw: [0, 45, 1],
  pitch: [20, 80, 1],
  swipeTilt: [0, 1, 0.1],
} as const;

interface Row {
  input: HTMLInputElement;
  value: HTMLElement;
  read: () => number;
  fallback: number;
}

/**
 * Optional drawer for tuning gameplay variables during a playtest. Gameplay values take
 * effect from the next run; camera angles apply at once.
 */
export class DebugPanel {
  private readonly el = h('aside', { class: 'debug-panel' });
  private readonly rows: Row[] = [];

  constructor(
    root: HTMLElement,
    private readonly settings: Settings,
    private readonly actions: { onChange: () => void; onCamera: () => void; onRestart: () => void },
  ) {
    const tuning = TUNING_KEYS.map((key) =>
      this.row(
        `tune_${key}` as DevKey,
        TUNING_RANGES[key],
        DEFAULT_TUNING[key],
        () => settings.tuning[key] ?? DEFAULT_TUNING[key],
        (v) => {
          if (v === DEFAULT_TUNING[key]) delete settings.tuning[key];
          else settings.tuning[key] = v;
          actions.onChange();
        },
      ),
    );
    const camera = (['yaw', 'pitch', 'swipeTilt'] as const).map((key) =>
      this.row(
        `cam_${key}` as DevKey,
        CAMERA_RANGES[key],
        DEFAULT_CAMERA[key],
        () => settings.camera[key],
        (v) => {
          settings.camera[key] = v;
          actions.onChange();
          actions.onCamera();
        },
      ),
    );

    this.el.append(
      h('div', { class: 'debug-head' }, [
        h('h2', { text: td('debugTitle') }),
        h('button', { class: 'btn small', text: td('close'), attrs: { type: 'button' }, onClick: () => this.toggle(false) }),
      ]),
      h('h3', { text: td('debugCamera') }),
      ...camera,
      h('h3', { text: td('debugRules') }),
      ...tuning,
      h('div', { class: 'row' }, [
        h('button', { class: 'btn small primary', text: td('restart'), attrs: { type: 'button' }, onClick: () => actions.onRestart() }),
        h('button', { class: 'btn small', text: td('reset'), attrs: { type: 'button' }, onClick: () => this.reset() }),
      ]),
    );
    this.el.hidden = true;
    root.append(this.el);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  toggle(open = this.el.hidden): void {
    this.el.hidden = !open;
    if (open) this.refresh();
  }

  private row(
    label: DevKey,
    range: readonly [number, number, number],
    fallback: number,
    read: () => number,
    write: (value: number) => void,
  ): HTMLElement {
    const [min, max, step] = range;
    const input = h('input', { attrs: { type: 'range', min: String(min), max: String(max), step: String(step) } });
    const value = h('span', { class: 'debug-value' });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      value.textContent = String(v);
      value.classList.toggle('changed', v !== fallback);
      write(v);
    });
    this.rows.push({ input, value, read, fallback });
    return h('label', { class: 'debug-row' }, [h('span', { class: 'debug-label', text: td(label) }), value, input]);
  }

  private refresh(): void {
    for (const row of this.rows) {
      const v = row.read();
      row.input.value = String(v);
      row.value.textContent = String(v);
      row.value.classList.toggle('changed', v !== row.fallback);
    }
  }

  private reset(): void {
    this.settings.tuning = {};
    this.settings.camera = { ...DEFAULT_CAMERA };
    this.refresh();
    this.actions.onChange();
    this.actions.onCamera();
  }
}
