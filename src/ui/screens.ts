import { topRuns, type ControlMode, type RecordMetric, type RunRecord, type Settings } from '../platform/settings';
import type { ExperimentConfig } from '../rules';
import { formatTime, h } from './dom';
import { t, type TextKey } from './i18n';

export interface ResultData {
  score: number;
  best: number;
  maxChain: number;
  time: string;
  note: string | null;
}

export interface PauseToggles {
  muted: boolean;
  reducedMotion: boolean;
  shake: boolean;
}

const EXPERIMENTS: (keyof ExperimentConfig)[] = [
  'guidedStart',
  'gentleStart',
  'boardPreview',
  'matchHint',
  'floorClimb',
  'floorLift',
];

function button(key: TextKey, onClick: () => void, kind: 'primary' | 'plain' | 'quiet' = 'plain'): HTMLButtonElement {
  return h('button', { class: `btn ${kind}`, text: t(key), attrs: { type: 'button' }, onClick });
}

/** Pause, result, records and playtest panels shown over the board. */
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

  showPause(
    toggles: PauseToggles,
    actions: {
      onResume: () => void;
      onRestart: () => void;
      onRecords: () => void;
      onPlaytest: () => void;
      onToggle: (key: keyof PauseToggles) => PauseToggles;
    },
  ): void {
    let current = toggles;
    const rows: { key: keyof PauseToggles; label: TextKey; value: () => string }[] = [
      { key: 'muted', label: 'sound', value: () => t(current.muted ? 'off' : 'on') },
      { key: 'reducedMotion', label: 'motion', value: () => t(current.reducedMotion ? 'reduced' : 'full') },
      { key: 'shake', label: 'shake', value: () => t(current.shake ? 'on' : 'off') },
    ];
    const switches = rows.map((row) => {
      const value = h('span', { class: 'switch-value', text: row.value() });
      const el = h('button', { class: 'switch', attrs: { type: 'button' } }, [h('span', { text: t(row.label) }), value]);
      el.addEventListener('click', () => {
        current = actions.onToggle(row.key);
        switches.forEach((s, i) => (s.lastElementChild!.textContent = rows[i].value()));
      });
      return el;
    });

    this.open([
      h('h2', { text: t('paused') }),
      button('resume', actions.onResume, 'primary'),
      button('restart', actions.onRestart),
      button('records', actions.onRecords),
      h('div', { class: 'switches' }, switches),
      button('playtest', actions.onPlaytest, 'quiet'),
    ]);
  }

  showResult(data: ResultData, actions: { onAgain: () => void; onRecords: () => void; onPlaytest: () => void }): void {
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
      button('again', actions.onAgain, 'primary'),
      button('records', actions.onRecords),
      button('playtest', actions.onPlaytest, 'quiet'),
    ]);
  }

  /** Local register of the best runs; the same layout later holds the online tables. */
  showRecords(runs: readonly RunRecord[], tickMs: number, onBack: () => void): void {
    const metrics: { key: RecordMetric; label: TextKey; format: (r: RunRecord) => string }[] = [
      { key: 'score', label: 'recordsScore', format: (r) => String(r.score) },
      { key: 'chain', label: 'recordsChain', format: (r) => `×${r.chain}` },
      { key: 'ticks', label: 'recordsSurvival', format: (r) => formatTime(r.ticks, tickMs) },
    ];
    const table = h('div', { class: 'register' });
    const tabs = metrics.map((m, i) => {
      const tab = h('button', { class: 'tab', text: t(m.label), attrs: { type: 'button' } });
      tab.addEventListener('click', () => select(i));
      return tab;
    });
    const select = (index: number) => {
      tabs.forEach((tab, i) => tab.classList.toggle('selected', i === index));
      const metric = metrics[index];
      const top = topRuns(runs, metric.key, 10);
      table.replaceChildren(
        h('div', { class: 'register-row head' }, [
          h('span', { text: t('place') }),
          h('span', { text: t('date') }),
          h('span', { text: t('resultCol') }),
        ]),
        ...(top.length === 0
          ? [h('p', { class: 'note', text: t('noRecords') })]
          : top.map((r, i) =>
              h('div', { class: 'register-row' }, [
                h('span', { text: String(i + 1) }),
                h('span', { text: r.date }),
                h('span', { text: metric.format(r) }),
              ]),
            )),
      );
    };
    select(0);
    this.open([h('h2', { text: t('records') }), h('div', { class: 'tabs' }, tabs), table, button('back', onBack)]);
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
      return h('label', { class: 'toggle' }, [input, h('span', { text: t(key) })]);
    });

    let debugPanel = settings.debugPanel;
    const debugInput = h('input', { attrs: { type: 'checkbox' } });
    debugInput.checked = debugPanel;
    debugInput.addEventListener('change', () => (debugPanel = debugInput.checked));
    const debugToggle = h('label', { class: 'toggle' }, [debugInput, h('span', { text: t('debugPanel') })]);

    const modes = ['gesture', 'dpad'] as const;
    const modeButtons = modes.map((m) => {
      const b = h('button', { class: 'btn small', text: t(m), attrs: { type: 'button' } });
      b.classList.toggle('selected', m === mode);
      b.addEventListener('click', () => {
        mode = m;
        modeButtons.forEach((other, i) => other.classList.toggle('selected', modes[i] === m));
      });
      return b;
    });

    const copy = button('copy', () => {
      void navigator.clipboard?.writeText(statsText).then(() => (copy.textContent = t('copied')));
    });
    copy.classList.add('small');

    this.open(
      [
        h('h2', { text: t('playtest') }),
        h('h3', { text: t('experiments') }),
        ...toggles,
        h('p', { class: 'note', text: t('expNote') }),
        debugToggle,
        h('h3', { text: t('controls') }),
        h('div', { class: 'row' }, modeButtons),
        h('h3', { text: t('stats') }),
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
