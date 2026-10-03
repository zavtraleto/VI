import { Display } from '../display/display';
import { loadSettings, type Settings } from '../platform/settings';
import type { ParamValues } from '../signal/scene';
import { clearedPanel, pausePanel, recordsPanel, resultPanel, rulesPanel, systemPanel, tasksPanel } from '../shell/panels';
import type { PanelSpec } from '../shell/screens/panel';
import { Shell, type MenuActions } from '../shell/shell';
import { SHELL_PARAMS, parseShellValue, shellChanged, shellDefaults } from '../shell/theme';
import { FpsCounter } from '../ui/fps';
import { t } from '../ui/i18n';
import { ShellPanel } from './shellPanel';

export const SHELL_SCREENS = ['boot', 'menu', 'pause', 'system', 'result', 'records', 'rules', 'tasks', 'cleared'] as const;
export type ShellScreenName = (typeof SHELL_SCREENS)[number];

/** What the menu shows of the player's progress, as a sample. */
const SAMPLE_DATA = { bestEndless: 12840, bestTimed: 4310, tutorialDone: true, tasksDone: 7, tasksTotal: 30, sessions: 12 };
/** Players for the sample of the table a platform keeps: the one who plays is far below the top. */
const SAMPLE_BOARD = [
  ...['Guest 4f1c09', 'Мария', 'kuro_neko', '', 'A name far too long for the table', 'Tomás', 'Guest 77ab31', 'ольга', 'N0body'].map((name, i) => ({
    rank: i + 1,
    name,
    score: 48200 - i * 4170,
    own: false,
  })),
  { rank: 41, name: 'Guest 0c52e7', score: 870, own: true },
];
/** Sessions for the sample of the log. */
const SAMPLE_RUNS = [
  { score: 12840, chain: 7, ticks: 31200, date: '2026-10-01' },
  { score: 8020, chain: 5, ticks: 24100, date: '2026-10-02' },
  { score: 4310, chain: 4, ticks: 15300, date: '2026-10-02' },
  { score: 870, chain: 2, ticks: 6100, date: '2026-10-02' },
];

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // No permission, or the page is not focused: the old way below still works.
  }
  // The clipboard API is missing on a page opened over plain http, as from a phone on the same network.
  const area = document.createElement('textarea');
  area.value = text;
  area.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

/**
 * The page where the shell of the program is looked at and tuned: `?lab=shell&screen=menu`,
 * with `&ui=0` to leave the panel out. Any parameter of the look can be set in the address by
 * its name. The screens are shown with sample data and their zones start nothing.
 */
export class ShellLab {
  readonly display = new Display();
  readonly shell: Shell;
  /** The look of the shell; the panel is bound to this object. */
  readonly values: ParamValues;
  screen: ShellScreenName;
  /** The boot is shown as the first start of the program, with the check. */
  first: boolean;
  /** The tutorial is not done yet: EXERCISE is the main item of the menu. */
  tutorialFirst: boolean;
  /** What the last copy put on the clipboard. */
  copied: string | null = null;
  /** The settings as they are stored, changed here in memory only and never saved. */
  private readonly settings: Settings = loadSettings();
  private readonly fps = new FpsCounter();

  constructor() {
    const query = new URLSearchParams(window.location.search);
    const screen = query.get('screen');
    this.screen = SHELL_SCREENS.includes(screen as ShellScreenName) ? (screen as ShellScreenName) : 'menu';
    this.first = query.get('first') !== '0';
    this.tutorialFirst = query.get('tutorial') === '1';

    // Under the page's own interface the pointer would scroll and zoom; here it only presses.
    document.documentElement.style.touchAction = 'none';
    this.shell = new Shell(this.display, this.settings);
    this.values = this.shell.values;
    for (const name of Object.keys(SHELL_PARAMS)) {
      const text = query.get(name);
      const value = text === null ? undefined : parseShellValue(name, text);
      if (value !== undefined) this.values[name] = value;
    }
    this.shell.touch();
    this.show(this.screen);

    if (query.get('ui') !== '0') new ShellPanel(this);
    const loop = (time: number): void => {
      requestAnimationFrame(loop);
      this.frame(time);
    };
    requestAnimationFrame(loop);
  }

  /** Draws one frame. Called from the console where frames have to be stepped by hand. */
  frame(timeMs: number): void {
    this.fps.tick(timeMs);
    this.shell.frame(timeMs);
    this.display.present(timeMs);
  }

  /** A parameter has changed. */
  touch(): void {
    this.shell.touch();
  }

  show(screen: ShellScreenName): void {
    this.screen = screen;
    if (screen === 'boot') {
      this.settings.bootSeen = !this.first;
      // As in the game: the menu follows the boot.
      this.shell.boot(() => this.showMenu());
    } else if (screen === 'menu') {
      this.showMenu();
    } else {
      // Here a panel stands alone: there is no board under it.
      this.shell.showPanel(this.samplePanel(screen), true);
    }
    this.writeAddress();
  }

  setFirst(first: boolean): void {
    this.first = first;
    this.show('boot');
  }

  setTutorialFirst(tutorialFirst: boolean): void {
    this.tutorialFirst = tutorialFirst;
    this.show('menu');
  }

  /** Back to the look as it is defined. */
  reset(): void {
    Object.assign(this.values, shellDefaults());
    this.touch();
  }

  /** The tuned look as JSON: only the values that differ from the defaults. */
  json(): string {
    return JSON.stringify(shellChanged(this.values), null, 2);
  }

  async copy(): Promise<boolean> {
    const text = this.json();
    const done = await copyText(text);
    this.copied = done ? text : null;
    return done;
  }

  /** A panel with sample data; what it is told to do does nothing. */
  private samplePanel(screen: Exclude<ShellScreenName, 'boot' | 'menu'>): PanelSpec {
    const nothing = (): void => undefined;
    const values = { muted: false, reducedMotion: false, shake: true, control: 'gesture' as const };
    switch (screen) {
      case 'pause':
        return pausePanel({ task: false, onResume: nothing, onRestart: nothing, onRecords: nothing, onTasks: nothing, onSystem: nothing, onMenu: nothing });
      case 'system':
        return systemPanel({ values: () => values, onToggle: nothing, onBack: nothing });
      case 'result':
        return resultPanel(
          { timeUp: false, score: 8020, best: 12840, maxChain: 5, ticks: 24100, tickMs: 20, note: t('newBest') },
          { onAgain: nothing, onRecords: nothing, onMenu: nothing },
        );
      case 'records':
        return recordsPanel([{ runs: SAMPLE_RUNS, survival: true }, { runs: SAMPLE_RUNS.slice(2), survival: false }], 0, 20, nothing, {
          lines: (section) => (section === 0 ? SAMPLE_BOARD : 'waiting'),
          onRegister: nothing,
        });
      case 'rules':
        return rulesPanel([t('puzzleRule1'), t('puzzleRule2'), t('puzzleRule3'), t('puzzleRule4'), t('puzzleRule5')], { onStart: nothing, onBack: nothing });
      case 'tasks':
        return tasksPanel(
          Array.from({ length: 30 }, (_, i) => ({ stars: i < 7 ? 3 - (i % 3) : 0, tier: t(i < 6 ? 'tier_intro' : 'tier_path') })),
          7,
          { onPick: nothing, onRules: nothing, onBack: nothing },
        );
      case 'cleared':
        return clearedPanel({ stars: 2, moves: 6, target: 4, hasNext: true }, { onNext: nothing, onAgain: nothing, onTasks: nothing });
    }
  }

  private showMenu(): void {
    const nothing = (): void => undefined;
    const actions: MenuActions = {
      onEndless: nothing,
      onTimed: nothing,
      onPuzzle: nothing,
      onTutorial: nothing,
      onRecords: nothing,
      onSystem: nothing,
    };
    this.shell.showMenu(this.tutorialFirst, actions, SAMPLE_DATA);
  }

  /** The address names the screen, so it can be reloaded or sent to a phone. */
  private writeAddress(): void {
    const query = new URLSearchParams(window.location.search);
    query.set('lab', 'shell');
    query.set('screen', this.screen);
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
  }
}

export function startShellLab(): ShellLab {
  const lab = new ShellLab();
  // For the console, and for stepping frames where the browser does not run them itself.
  (window as unknown as { lab: ShellLab }).lab = lab;
  return lab;
}
