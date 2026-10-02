import type { ControlMode, Settings } from '../platform/settings';
import type { ExperimentConfig } from '../rules';
import { h } from './dom';
import { td, type DevKey } from './devText';

const EXPERIMENTS: (keyof ExperimentConfig)[] = [
  'guidedStart',
  'gentleStart',
  'boardPreview',
  'matchHint',
  'floorClimb',
  'floorLift',
  'soloOne',
  'chainCalm',
];

function button(key: DevKey, onClick: () => void, kind: 'primary' | 'plain' | 'quiet' = 'plain'): HTMLButtonElement {
  return h('button', { class: `btn ${kind}`, text: td(key), attrs: { type: 'button' }, onClick });
}

/**
 * The tools of the playtest, as panels of the page over the canvas: the report of the tasks and
 * the settings of the experiments. They are not a part of the program the player sees.
 */
export class Screens {
  private readonly panel = h('div', { class: 'panel' });

  constructor(private readonly root: HTMLElement) {
    root.append(this.panel);
    root.hidden = true;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  hide(): void {
    this.root.hidden = true;
    this.panel.replaceChildren();
  }

  private open(children: (Node | null)[], utility = false): void {
    this.panel.classList.toggle('utility', utility);
    this.panel.replaceChildren(...children.filter((c): c is Node => c !== null));
    this.root.hidden = false;
    this.panel.scrollTop = 0;
  }

  /** What was played, as text to pass on. An empty report shows a line saying so. */
  showPuzzleStats(report: string, onBack: () => void): void {
    const text = report || td('statsEmpty');
    const copy = button('copy', () => {
      void navigator.clipboard?.writeText(text).then(() => (copy.textContent = td('copied')));
    });
    // Phones offer their own sheet of messengers; elsewhere the text is copied.
    const canShare = report !== '' && typeof navigator.share === 'function';
    const share = canShare
      ? button('share', () => void navigator.share({ text }).catch(() => undefined), 'primary')
      : null;
    this.open(
      [
        h('h2', { text: td('puzzleStats') }),
        h('p', { class: 'note', text: td('statsNote') }),
        // The report is long: the buttons that send it come before it.
        share,
        report !== '' ? copy : null,
        button('back', onBack),
        h('pre', { class: 'stats', text }),
      ],
      true,
    );
  }

  showPlaytest(
    settings: Settings,
    statsText: string,
    actions: {
      onApply: (experiments: ExperimentConfig, mode: ControlMode, debugPanel: boolean) => void;
      onBack: () => void;
      onReplayTutorial: () => void;
    },
  ): void {
    const draft: ExperimentConfig = { ...settings.experiments };
    let mode: ControlMode = settings.controlMode;

    const toggles = EXPERIMENTS.map((key) => {
      const input = h('input', { attrs: { type: 'checkbox' } });
      input.checked = draft[key];
      input.addEventListener('change', () => (draft[key] = input.checked));
      return h('label', { class: 'toggle' }, [input, h('span', { text: td(key) })]);
    });

    let debugPanel = settings.debugPanel;
    const debugInput = h('input', { attrs: { type: 'checkbox' } });
    debugInput.checked = debugPanel;
    debugInput.addEventListener('change', () => (debugPanel = debugInput.checked));
    const debugToggle = h('label', { class: 'toggle' }, [debugInput, h('span', { text: td('debugPanel') })]);

    const modes = ['gesture', 'dpad'] as const;
    const modeButtons = modes.map((m) => {
      const b = h('button', { class: 'btn small', text: td(m), attrs: { type: 'button' } });
      b.classList.toggle('selected', m === mode);
      b.addEventListener('click', () => {
        mode = m;
        modeButtons.forEach((other, i) => other.classList.toggle('selected', modes[i] === m));
      });
      return b;
    });

    const copy = button('copy', () => {
      void navigator.clipboard?.writeText(statsText).then(() => (copy.textContent = td('copied')));
    });
    copy.classList.add('small');

    this.open(
      [
        h('h2', { text: td('playtest') }),
        h('h3', { text: td('experiments') }),
        ...toggles,
        h('p', { class: 'note', text: td('expNote') }),
        debugToggle,
        h('h3', { text: td('controls') }),
        h('div', { class: 'row' }, modeButtons),
        h('h3', { text: td('stats') }),
        h('pre', { class: 'stats', text: statsText }),
        copy,
        button('applyRestart', () => actions.onApply(draft, mode, debugPanel), 'primary'),
        button('replayTutorial', actions.onReplayTutorial),
        button('back', actions.onBack),
      ],
      true,
    );
  }
}
