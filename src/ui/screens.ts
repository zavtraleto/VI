import type { ControlMode, Settings } from '../platform/settings';
import type { ExperimentConfig } from '../rules';
import { h } from './dom';
import { t, type TextKey } from './i18n';

export interface ResultData {
  score: number;
  best: number;
  maxChain: number;
  time: string;
  note: string | null;
}

const EXPERIMENTS: (keyof ExperimentConfig)[] = [
  'guidedStart',
  'gentleStart',
  'boardPreview',
  'matchHint',
  'floorClimb',
  'floorLift',
  'relaxedPace',
];

function button(key: TextKey, onClick: () => void, primary = false): HTMLButtonElement {
  return h('button', { class: primary ? 'btn primary' : 'btn', text: t(key), attrs: { type: 'button' }, onClick });
}

/** Pause, result and playtest panels shown over the board. */
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

  private open(children: (Node | null)[]): void {
    this.panel.replaceChildren(...children.filter((c): c is Node => c !== null));
    this.root.hidden = false;
    this.panel.scrollTop = 0;
  }

  showPause(actions: { onResume: () => void; onRestart: () => void; onPlaytest: () => void }): void {
    this.open([
      h('h2', { text: t('paused') }),
      button('resume', actions.onResume, true),
      button('restart', actions.onRestart),
      button('playtest', actions.onPlaytest),
    ]);
  }

  showResult(data: ResultData, actions: { onAgain: () => void; onPlaytest: () => void }): void {
    const row = (label: string, value: string) =>
      h('div', { class: 'result-row' }, [h('span', { class: 'stat-label', text: label }), h('span', { class: 'result-value', text: value })]);
    this.open([
      h('h2', { text: t('result') }),
      h('div', { class: 'result-grid' }, [
        row(t('score'), String(data.score)),
        row(t('best'), String(data.best)),
        row(t('maxChain'), `×${data.maxChain}`),
        row(t('time'), data.time),
      ]),
      data.note ? h('p', { class: 'note', text: data.note }) : null,
      button('again', actions.onAgain, true),
      button('playtest', actions.onPlaytest),
    ]);
  }

  showPlaytest(
    settings: Settings,
    statsText: string,
    actions: { onApply: (experiments: ExperimentConfig, mode: ControlMode) => void; onBack: () => void; onReplayTutorial: () => void },
  ): void {
    const draft: ExperimentConfig = { ...settings.experiments };
    let mode: ControlMode = settings.controlMode;

    const toggles = EXPERIMENTS.map((key) => {
      const input = h('input', { attrs: { type: 'checkbox' } });
      input.checked = draft[key];
      input.addEventListener('change', () => (draft[key] = input.checked));
      return h('label', { class: 'toggle' }, [input, h('span', { text: t(key) })]);
    });

    const modeButtons = (['gesture', 'dpad'] as const).map((m) => {
      const b = h('button', { class: 'btn small', text: t(m), attrs: { type: 'button' } });
      b.classList.toggle('selected', m === mode);
      b.addEventListener('click', () => {
        mode = m;
        modeButtons.forEach((other, i) => other.classList.toggle('selected', (['gesture', 'dpad'] as const)[i] === m));
      });
      return b;
    });

    const stats = h('pre', { class: 'stats', text: statsText });
    const copy = button('copy', () => {
      void navigator.clipboard?.writeText(statsText).then(() => (copy.textContent = t('copied')));
    });
    copy.classList.add('small');

    this.open([
      h('h2', { text: t('playtest') }),
      h('h3', { text: t('experiments') }),
      ...toggles,
      h('p', { class: 'note', text: t('expNote') }),
      h('h3', { text: t('controls') }),
      h('div', { class: 'row' }, modeButtons),
      h('h3', { text: t('stats') }),
      stats,
      copy,
      button('applyRestart', () => actions.onApply(draft, mode), true),
      button('replayTutorial', actions.onReplayTutorial),
      button('back', actions.onBack),
    ]);
  }
}
