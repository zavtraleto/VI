import { dailyArchive, endlessArchive } from '../app/archive';
import { standings } from '../app/standings';
import { AudioEngine } from '../audio/engine';
import { Display } from '../display/display';
import { loadSettings, type Settings } from '../platform/settings';
import { DEFAULT_TUNING } from '../rules';
import type { ParamValues } from '../signal/scene';
import { Climb } from '../shell/climb';
import { clearedPanel, pausePanel, recordsPanel, resultPanel, rulesPanel, systemPanel, tasksPanel } from '../shell/panels';
import type { PanelSpec } from '../shell/screens/panel';
import { Shell, type MenuActions } from '../shell/shell';
import { COMMANDS, RECORDS } from '../shell/text';
import { dayAt } from '../app/daily';
import { SHELL_PARAMS, parseShellValue, shellChanged, shellDefaults } from '../shell/theme';
import { FpsCounter } from '../ui/fps';
import { t } from '../ui/i18n';
import { ShellPanel } from './shellPanel';

export const SHELL_SCREENS = ['boot', 'menu', 'pause', 'system', 'result', 'climb', 'records', 'rules', 'tasks', 'cleared'] as const;
export type ShellScreenName = (typeof SHELL_SCREENS)[number];

/** What the menu shows of the player's progress, as a sample. */
const SAMPLE_DATA = { bestEndless: 12840, levelsDone: 7, levelsTotal: 20, limitSec: DEFAULT_TUNING.timedSec, tutorialDone: true, tasksDone: 7, tasksTotal: 30, sessions: 12 };
/** Players for the sample of the table a platform keeps: one with no name, one with a name too long for the table. */
const SAMPLE_PLAYERS = ['Green Chicken', '', 'A name far too long for the table', 'Yellow Mackerel'].map((name, i) => ({
  name,
  score: 27770 - i * 6900,
  own: false,
}));
/** The best the one who plays has in the sample of the log: far below its top. */
const SAMPLE_BEST = 870;
/** The logs of the sample: the made-up players as they stand now, the sample players and the one who plays. */
const sampleLog = () => standings(endlessArchive(Date.now()), SAMPLE_PLAYERS, { name: RECORDS.you, score: SAMPLE_BEST });
const sampleDay = () => standings(dailyArchive(dayAt(Date.now()), Date.now()), [], { name: RECORDS.you, score: 0 });

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
  /** What the session of the sample of the way up the log came to. */
  climbScore = 27770;
  /** The settings as they are stored, changed here in memory only and never saved. */
  private readonly settings: Settings = loadSettings();
  /** The interface is heard here as in the game. */
  private readonly audio = new AudioEngine();
  private readonly fps = new FpsCounter();

  constructor() {
    const query = new URLSearchParams(window.location.search);
    const screen = query.get('screen');
    this.screen = SHELL_SCREENS.includes(screen as ShellScreenName) ? (screen as ShellScreenName) : 'menu';
    this.first = query.get('first') !== '0';
    this.tutorialFirst = query.get('tutorial') === '1';

    // Under the page's own interface the pointer would scroll and zoom; here it only presses.
    document.documentElement.style.touchAction = 'none';
    this.shell = new Shell(this.display, this.settings, { sound: (event) => this.audio.ui(event) });
    // Browsers keep audio locked until the first press.
    const unlock = (): void => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const score = Number(query.get('score'));
    if (query.has('score') && Number.isFinite(score)) this.climbScore = Math.max(0, Math.round(score));
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
    const values = { muted: false, reducedMotion: false, shake: true, control: 'gesture' as const, view: 'auto' as const, language: 'en' as const };
    switch (screen) {
      case 'pause':
        return pausePanel({ task: false, onResume: nothing, onRestart: nothing, onRecords: nothing, onTasks: nothing, onSystem: nothing, onMenu: nothing });
      case 'system':
        return systemPanel({ values: () => values, onToggle: nothing, onLanguage: nothing, onBack: nothing });
      case 'result':
        return resultPanel(
          { timeUp: false, score: 8020, best: 12840, maxChain: 5, ticks: 24100, tickMs: 20, note: t('newBest') },
          { onAgain: nothing, onRecords: nothing, onMenu: nothing },
        );
      case 'climb': {
        // A session goes up the sample of the log: its score is `climbScore`, or `&score=` in the address.
        const record = this.climbScore > SAMPLE_BEST;
        const climb = new Climb(
          { lines: sampleLog(), score: this.climbScore, name: RECORDS.you, record, reduced: this.settings.reducedMotion === true, leadMs: 400 },
          (event) => this.audio.ui(event),
        );
        return resultPanel(
          {
            timeUp: false,
            score: this.climbScore,
            best: Math.max(SAMPLE_BEST, this.climbScore),
            before: SAMPLE_BEST,
            maxChain: 9,
            ticks: 31200,
            tickMs: 20,
            note: record ? t('newBest') : null,
          },
          { onAgain: () => this.show('climb'), onRecords: () => this.show('records'), onMenu: nothing },
          climb,
        );
      }
      case 'records': {
        let shared = false;
        return recordsPanel((section) => (section === 0 ? { lines: sampleLog() } : { lines: sampleDay(), link: 'waiting', day: 'H38.10.04' }), 0, {
          onBack: nothing,
          onRegister: nothing,
          share: {
            label: () => (shared ? COMMANDS.copied : COMMANDS.share),
            action: () => {
              shared = !shared;
              this.shell.touch();
            },
          },
        });
      }
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
      onLevels: nothing,
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
