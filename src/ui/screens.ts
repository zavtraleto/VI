import { topRuns, type ControlMode, type RecordMetric, type RunRecord, type Settings } from '../platform/settings';
import type { ExperimentConfig } from '../rules';
import { formatTime, h } from './dom';
import { t, type TextKey } from './i18n';

export interface ResultData {
  title: string;
  score: number;
  best: number;
  maxChain: number;
  time: string;
  note: string | null;
}

/** One mode's runs, for the records register. */
export interface RecordsSection {
  label: TextKey;
  runs: readonly RunRecord[];
  /** Survival time only means something where the run can end early. */
  survival: boolean;
}

/** Levels of one kind, as they stand together in the list of puzzles. */
export interface PuzzleSection {
  title: string;
  levels: readonly { index: number; stars: number }[];
}

export interface PuzzleResultData {
  stars: number;
  moves: number;
  par: number;
  /** There is a level after this one. */
  hasNext: boolean;
}

function starsLine(stars: number, total = 3): HTMLElement {
  return h('span', { class: 'stars' }, [
    '★'.repeat(stars),
    h('span', { class: 'stars-off', text: '★'.repeat(Math.max(0, total - stars)) }),
  ]);
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
  'soloOne',
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

  /** Main menu: pick a mode or the tutorial. */
  showMenu(
    tutorialFirst: boolean,
    actions: {
      onEndless: () => void;
      onTimed: () => void;
      onPuzzle: () => void;
      onTutorial: () => void;
      onRecords: () => void;
      onPlaytest: () => void;
    },
  ): void {
    this.open([
      h('h1', { class: 'menu-title', text: 'VI' }),
      h('h3', { class: 'menu-group', text: t('menuTrial') }),
      button('endless', actions.onEndless, tutorialFirst ? 'plain' : 'primary'),
      button('timed', actions.onTimed),
      h('h3', { class: 'menu-group', text: t('menuPuzzle') }),
      button('puzzle', actions.onPuzzle),
      h('div', { class: 'menu-gap' }),
      button('tutorial', actions.onTutorial, tutorialFirst ? 'primary' : 'plain'),
      button('records', actions.onRecords),
      button('playtest', actions.onPlaytest, 'quiet'),
    ]);
  }

  showPause(
    toggles: PauseToggles,
    actions: {
      onResume: () => void;
      onRestart: () => void;
      onRecords: () => void;
      onMenu: () => void;
      onPlaytest: () => void;
      onToggle: (key: keyof PauseToggles) => PauseToggles;
      /** Set in a puzzle: back to the list of levels, in place of the records. */
      onLevels?: () => void;
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
      actions.onLevels ? button('toLevels', actions.onLevels) : button('records', actions.onRecords),
      button('toMenu', actions.onMenu),
      h('div', { class: 'switches' }, switches),
      actions.onLevels ? null : button('playtest', actions.onPlaytest, 'quiet'),
    ]);
  }

  /** The rules of the puzzle mode, shown before the first level and on request. */
  showPuzzleRules(lines: readonly string[], actions: { onPlay?: () => void; onBack: () => void }): void {
    this.open([
      h('h2', { text: t('puzzleRules') }),
      h('ol', { class: 'rules-list' }, lines.map((line) => h('li', { text: line }))),
      actions.onPlay ? button('play', actions.onPlay, 'primary') : null,
      button('back', actions.onBack),
    ]);
  }

  /** Every puzzle, by kind, with the stars earned. All of them can be picked. */
  showPuzzleLevels(
    sections: readonly PuzzleSection[],
    current: number,
    actions: { onPick: (index: number) => void; onRules: () => void; onStats: () => void; onBack: () => void },
  ): void {
    const blocks = sections.flatMap((section) => [
      h('h3', { text: section.title }),
      h(
        'div',
        { class: 'level-grid' },
        section.levels.map(({ index, stars }) => {
          const el = h('button', { class: 'level-btn', attrs: { type: 'button' }, onClick: () => actions.onPick(index) }, [
            h('span', { class: 'level-number', text: String(index + 1) }),
            starsLine(stars),
          ]);
          el.classList.toggle('selected', index === current);
          return el;
        }),
      ),
    ]);
    // The list is long: what is not a level stays at the top, in sight.
    const rules = button('puzzleRules', actions.onRules);
    const stats = button('puzzleStats', actions.onStats);
    rules.classList.add('small');
    stats.classList.add('small');
    this.open([
      h('h2', { text: t('puzzle') }),
      h('div', { class: 'row' }, [rules, stats]),
      ...blocks,
      h('div', { class: 'menu-gap' }),
      button('toMenu', actions.onBack),
    ]);
  }

  showPuzzleResult(data: PuzzleResultData, actions: { onNext: () => void; onAgain: () => void; onLevels: () => void }): void {
    const row = (label: string, value: string) =>
      h('div', { class: 'result-row' }, [h('span', { class: 'stat-label', text: label }), h('span', { class: 'result-value', text: value })]);
    const stars = starsLine(data.stars);
    stars.classList.add('large');
    this.open([
      h('h2', { text: t('cleared') }),
      stars,
      h('div', { class: 'result-grid' }, [row(t('puzzleMoves'), String(data.moves)), row(t('puzzleMin'), String(data.par))]),
      data.hasNext ? button('next', actions.onNext, 'primary') : null,
      button('again', actions.onAgain, data.hasNext ? 'plain' : 'primary'),
      button('toLevels', actions.onLevels),
    ]);
  }

  /** What was played, as text to pass on. An empty report shows a line saying so. */
  showPuzzleStats(report: string, onBack: () => void): void {
    const text = report || t('statsEmpty');
    const copy = button('copy', () => {
      void navigator.clipboard?.writeText(text).then(() => (copy.textContent = t('copied')));
    });
    // Phones offer their own sheet of messengers; elsewhere the text is copied.
    const canShare = report !== '' && typeof navigator.share === 'function';
    const share = canShare
      ? button('share', () => void navigator.share({ text }).catch(() => undefined), 'primary')
      : null;
    this.open(
      [
        h('h2', { text: t('puzzleStats') }),
        h('p', { class: 'note', text: t('statsNote') }),
        // The report is long: the buttons that send it come before it.
        share,
        report !== '' ? copy : null,
        button('back', onBack),
        h('pre', { class: 'stats', text }),
      ],
      true,
    );
  }

  showResult(
    data: ResultData,
    actions: { onAgain: () => void; onRecords: () => void; onMenu: () => void; onPlaytest: () => void },
  ): void {
    const row = (label: string, value: string) =>
      h('div', { class: 'result-row' }, [h('span', { class: 'stat-label', text: label }), h('span', { class: 'result-value', text: value })]);
    this.open([
      h('h2', { text: data.title }),
      h('div', { class: 'result-grid' }, [
        row(t('score'), String(data.score)),
        row(t('best'), String(data.best)),
        row(t('maxChain'), `×${data.maxChain}`),
        row(t('time'), data.time),
      ]),
      data.note ? h('p', { class: 'note', text: data.note }) : null,
      button('again', actions.onAgain, 'primary'),
      button('records', actions.onRecords),
      button('toMenu', actions.onMenu),
      button('playtest', actions.onPlaytest, 'quiet'),
    ]);
  }

  /** Local register of the best runs per mode; the same layout later holds the online tables. */
  showRecords(sections: readonly RecordsSection[], initial: number, tickMs: number, onBack: () => void): void {
    const metrics: { key: RecordMetric; label: TextKey; format: (r: RunRecord) => string }[] = [
      { key: 'score', label: 'recordsScore', format: (r) => String(r.score) },
      { key: 'chain', label: 'recordsChain', format: (r) => `×${r.chain}` },
      { key: 'ticks', label: 'recordsSurvival', format: (r) => formatTime(r.ticks, tickMs) },
    ];
    let section = Math.min(Math.max(initial, 0), sections.length - 1);
    let metric = 0;
    const table = h('div', { class: 'register' });
    const modeTabs = sections.map((sec, i) => {
      const tab = h('button', { class: 'btn small', text: t(sec.label), attrs: { type: 'button' } });
      tab.addEventListener('click', () => {
        section = i;
        render();
      });
      return tab;
    });
    const metricTabs = metrics.map((m, i) => {
      const tab = h('button', { class: 'tab', text: t(m.label), attrs: { type: 'button' } });
      tab.addEventListener('click', () => {
        metric = i;
        render();
      });
      return tab;
    });
    const render = () => {
      const current = sections[section];
      if (!current.survival && metrics[metric].key === 'ticks') metric = 0;
      modeTabs.forEach((tab, i) => tab.classList.toggle('selected', i === section));
      metricTabs.forEach((tab, i) => {
        tab.classList.toggle('selected', i === metric);
        tab.hidden = !current.survival && metrics[i].key === 'ticks';
      });
      const top = topRuns(current.runs, metrics[metric].key, 10);
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
                h('span', { text: metrics[metric].format(r) }),
              ]),
            )),
      );
    };
    render();
    this.open([
      h('h2', { text: t('records') }),
      h('div', { class: 'row' }, modeTabs),
      h('div', { class: 'tabs' }, metricTabs),
      table,
      button('back', onBack),
    ]);
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
