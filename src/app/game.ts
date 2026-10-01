import { AudioEngine } from '../audio/engine';
import { InputController } from '../input/controller';
import { GestureTracker, bindGestures, type ScreenDirs } from '../input/gesture';
import { bindKeyboard } from '../input/keyboard';
import { addRun, bestOf, loadSettings, prefersReducedMotion, saveSettings, type Settings } from '../platform/settings';
import { storageAvailable } from '../platform/storage';
import type { TutorialMarker } from '../render/overlays';
import { OCCULT_THEME } from '../render/theme';
import { BoardView } from '../render/view';
import {
  createRun,
  cubeAt,
  defaultConfig,
  previewMove,
  resolveMove,
  ruleKey,
  tutorialDir,
  DIRS,
  TUTORIAL_SCRIPT,
  type Dir,
  type GameEvent,
  type RunState,
} from '../rules';
import { DebugPanel } from '../ui/debug';
import { formatTime, h } from '../ui/dom';
import { ChainLabels, HintBubble, Hud } from '../ui/hud';
import { t, type TextKey } from '../ui/i18n';
import { Pad } from '../ui/pad';
import { Screens, type PauseToggles } from '../ui/screens';
import { TutorialGuide, type InputGlyph } from '../ui/tutorial';
import { Ritual } from './ritual';
import { Runner } from './runner';
import { statsText } from './stats';

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

/** What the player picked in the menu. */
type RunKind = 'endless' | 'timed' | 'tutorial';

export class Game {
  private settings: Settings = loadSettings();
  private runner!: Runner;
  private paused = false;
  private inMenu = false;
  private kind: RunKind = 'endless';
  private lastClock = -1;
  private lastFrame = 0;
  private lastStats = '';
  private resultShown = false;
  /** Line of the tutorial text on show; it follows what has happened, not what was commanded. */
  private guideLine = 0;
  /** Cell where the tutorial ended and Endless is about to start. */
  private handoff: { x: number; z: number } | null = null;

  private readonly controller = new InputController();
  private readonly ritual = new Ritual();
  private readonly audio = new AudioEngine();
  private readonly tracker: GestureTracker;
  private readonly view: BoardView;
  private readonly hud: Hud;
  private readonly labels: ChainLabels;
  private readonly hint: HintBubble;
  private readonly guide: TutorialGuide;
  private readonly pad: Pad;
  private readonly screens: Screens;
  private readonly debug: DebugPanel;
  private readonly root: HTMLElement;
  private screenDirs!: ScreenDirs;

  constructor(root: HTMLElement) {
    this.root = root;
    const hudEl = h('header', { class: 'hud' });
    const stage = h('div', { class: 'stage' });
    const overlayLayer = h('div', { class: 'stage-layer' });
    stage.append(overlayLayer);
    const controls = h('div', { class: 'controls' });
    const play = h('div', { class: 'play' }, [stage, controls]);
    const overlay = h('div', { class: 'overlay' });
    root.append(hudEl, play, overlay);

    const now = () => this.now();
    const enabled = () => this.inputEnabled();

    if (new URLSearchParams(window.location.search).has('debug')) this.settings.debugPanel = true;
    this.view = new BoardView(stage, OCCULT_THEME, defaultConfig().size, this.settings.camera);
    this.hud = new Hud(hudEl, () => this.togglePause(), () => this.debug.toggle());
    this.labels = new ChainLabels(overlayLayer);
    this.hint = new HintBubble(overlayLayer);
    this.guide = new TutorialGuide(overlayLayer);
    this.pad = new Pad(controls, this.controller, now, () => enabled() && this.settings.controlMode === 'dpad');
    this.screens = new Screens(overlay);
    this.debug = new DebugPanel(root, this.settings, {
      onChange: () => saveSettings(this.settings),
      onCamera: () => this.applyCamera(),
      onRestart: () => this.startRun(),
    });
    this.applyCamera();

    this.tracker = new GestureTracker(this.controller, now, () => this.screenDirs);
    bindGestures(play, this.tracker, () => enabled() && this.settings.controlMode === 'gesture');
    bindKeyboard(this.controller, now, enabled, () => this.togglePause());

    // Browsers keep audio locked until the first user gesture.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.audio.setMuted(this.settings.muted);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        this.audio.setPaused(true);
      } else if (!this.paused && !this.inMenu) {
        this.audio.setPaused(false);
      }
    });

    // A board is set up behind the menu so there is something to look at.
    this.startRun('endless');
    this.showMenu();
    requestAnimationFrame((time) => this.frame(time));
  }

  private get state(): RunState {
    return this.runner.state;
  }

  private now(): number {
    return this.state.tick * this.state.config.tickMs;
  }

  private inputEnabled(): boolean {
    return !this.paused && !this.state.over && !this.screens.visible;
  }

  /** Records are kept per mode and rule key. */
  private recordKey(mode: 'endless' | 'timed'): string {
    return `${mode}:${ruleKey(this.state.config)}`;
  }

  /** The table the current run counts towards; the tutorial shows Endless. */
  private currentRecordKey(): string {
    return this.recordKey(this.state.mode === 'timed' ? 'timed' : 'endless');
  }

  /** Points the camera and lines the controls up with where the board directions now point. */
  private applyCamera(): void {
    this.view.setCamera(this.settings.camera);
    const dirs = {} as ScreenDirs;
    for (const dir of DIRS) dirs[dir] = this.view.screenDir(dir);
    this.screenDirs = dirs;
    // The seal is drawn with north at 45 degrees and east at -45; turn it by the average offset.
    const degrees = (dir: Dir) => (Math.atan2(-dirs[dir].y, dirs[dir].x) * 180) / Math.PI;
    this.pad.setRotation((degrees('N') - 45 + (degrees('E') + 45)) / 2);
    if (this.runner && this.state.tutorial && !this.inMenu) this.syncGuide();
  }

  /** `start` builds the board around a cell and raises it from the floor: the tutorial's hand-off. */
  private startRun(kind: RunKind = this.kind, start?: { x: number; z: number }): void {
    this.kind = kind;
    const { experiments } = this.settings;
    const tutorial = kind === 'tutorial';
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    const config = defaultConfig(experiments, this.settings.tuning);
    if (start) {
      config.startX = start.x;
      config.startZ = start.z;
    }
    this.runner = new Runner(createRun({ seed, config, tutorial, timed: kind === 'timed' }));
    this.handoff = null;
    this.inMenu = false;
    this.lastClock = -1;
    this.root.classList.toggle('gesture', this.settings.controlMode === 'gesture');
    this.hud.showDebugButton(this.settings.debugPanel);
    this.controller.cancel();
    this.ritual.reset();
    this.view.reset(start !== undefined);
    this.audio.setStage(0);
    this.audio.warn(null);
    this.audio.setPaused(false);
    this.paused = false;
    this.resultShown = false;
    this.screens.hide();
    this.labels.clear();
    this.hint.reset();
    this.pad.setMode(this.settings.controlMode);
    this.pad.setPulse(null);
    this.guide.hide();
    if (tutorial) {
      // The one-time hints of a normal run pick up where the tutorial stops.
      this.settings.hintsSeen = [];
      this.guideLine = 0;
      this.syncGuide();
    }
  }

  /** Points the guide at the step the tutorial is waiting for. */
  private syncGuide(): void {
    const dir = tutorialDir(this.state);
    let glyph: InputGlyph = 'none';
    if (dir !== null) {
      if (!coarsePointer) glyph = 'keys';
      // With buttons on screen the pulsing quadrant of the seal is the prompt.
      else if (this.settings.controlMode === 'gesture') glyph = 'swipe';
    }
    this.guide.show(this.guideLine, dir, glyph, dir ? this.screenDirs[dir] : null);
    this.pad.setPulse(dir);
  }

  /** The cell the tutorial wants the player to step into, and what a die rolled there will show. */
  private tutorialMarker(state: RunState): TutorialMarker | null {
    const dir = this.inMenu ? null : tutorialDir(state);
    if (dir === null) return null;
    const intent = resolveMove(state, dir);
    if (intent.kind === 'blocked') return null;
    return { x: intent.tx, z: intent.tz, raised: intent.kind === 'hop', top: intent.newOri?.top };
  }

  private showMenu(): void {
    this.inMenu = true;
    this.paused = false;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.hint.reset();
    this.guide.hide();
    this.pad.setPulse(null);
    this.screens.showMenu(!this.settings.tutorialDone, {
      onEndless: () => this.startRun('endless'),
      onTimed: () => this.startRun('timed'),
      onTutorial: () => this.startRun('tutorial'),
      onRecords: () => this.showRecords(() => this.showMenu()),
      onPlaytest: () => this.showPlaytest(() => this.showMenu()),
    });
  }

  private togglePause(): void {
    if (this.state.over || this.inMenu) return;
    if (this.paused) this.resume();
    else this.pause();
  }

  private pause(): void {
    if (this.paused || this.inMenu || this.state.over) return;
    this.paused = true;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.showPause();
  }

  private resume(): void {
    this.paused = false;
    this.screens.hide();
    this.audio.setPaused(false);
    this.lastFrame = 0;
  }

  private toggles(): PauseToggles {
    return {
      muted: this.settings.muted,
      reducedMotion: prefersReducedMotion(this.settings),
      shake: this.settings.shake,
    };
  }

  private showPause(): void {
    this.screens.showPause(this.toggles(), {
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onRecords: () => this.showRecords(() => this.showPause()),
      onMenu: () => this.showMenu(),
      onPlaytest: () => this.showPlaytest(() => this.showPause()),
      onToggle: (key) => {
        if (key === 'muted') {
          this.settings.muted = !this.settings.muted;
          this.audio.setMuted(this.settings.muted);
        } else if (key === 'reducedMotion') {
          this.settings.reducedMotion = !prefersReducedMotion(this.settings);
        } else {
          this.settings.shake = !this.settings.shake;
        }
        saveSettings(this.settings);
        return this.toggles();
      },
    });
  }

  private showRecords(back: () => void): void {
    const state = this.state;
    this.screens.showRecords(
      [
        { label: 'endless', runs: this.settings.runs[this.recordKey('endless')] ?? [], survival: true },
        { label: 'timed', runs: this.settings.runs[this.recordKey('timed')] ?? [], survival: false },
      ],
      state.mode === 'timed' ? 1 : 0,
      state.config.tickMs,
      back,
    );
  }

  private showPlaytest(back: () => void): void {
    const text = this.state.tick > 0 ? statsText(this.state) : this.lastStats || t('noStats');
    this.screens.showPlaytest(this.settings, text, {
      onApply: (experiments, mode, debugPanel) => {
        this.settings.experiments = experiments;
        this.settings.controlMode = mode;
        this.settings.debugPanel = debugPanel;
        if (!debugPanel) this.debug.toggle(false);
        saveSettings(this.settings);
        this.startRun();
      },
      onBack: back,
      onReplayTutorial: () => {
        this.settings.hintsSeen = [];
        this.settings.experiments.guidedStart = true;
        saveSettings(this.settings);
        this.startRun('tutorial');
      },
    });
  }

  private showResult(): void {
    const state = this.state;
    this.lastStats = statsText(state);
    const key = this.currentRecordKey();
    const previous = bestOf(this.settings, key, 'score');
    let note: string | null = null;
    if (state.mode === 'practice') {
      note = t('practiceNote');
    } else if (state.config.custom) {
      note = t('customNote');
    } else {
      addRun(this.settings, key, {
        score: state.score,
        chain: state.maxChain,
        ticks: state.tick,
        date: new Date().toISOString().slice(0, 10),
      });
      const saved = saveSettings(this.settings) && storageAvailable();
      if (!saved) note = t('notSaved');
      else if (state.score > previous) note = t('newBest');
    }
    const result = () =>
      this.screens.showResult(
        {
          title: t(state.endReason === 'time' ? 'timeUp' : 'result'),
          score: state.score,
          best: bestOf(this.settings, key, 'score'),
          maxChain: state.maxChain,
          time: formatTime(state.tick, state.config.tickMs),
          note,
        },
        {
          onAgain: () => this.startRun(),
          onRecords: () => this.showRecords(result),
          onMenu: () => this.showMenu(),
          onPlaytest: () => this.showPlaytest(result),
        },
      );
    result();
  }

  private hintOnce(id: TextKey): void {
    // The tutorial speaks for itself; these belong to a normal run.
    if (this.state.tutorial) return;
    if (!this.settings.experiments.guidedStart || this.settings.hintsSeen.includes(id)) return;
    this.settings.hintsSeen.push(id);
    saveSettings(this.settings);
    this.hint.show(t(id));
  }

  private onTick(state: RunState): void {
    this.view.notify(state.events);
    for (const event of state.events) {
      this.audio.handle(event);
      this.onEvent(state, event);
    }
    const { player } = state;
    if (player.action || state.tick % 10 !== 0) return;
    if (player.level === 'ground') {
      if (DIRS.some((dir) => previewMove(state, dir).kind === 'mount')) this.hintOnce('hintMount');
    } else {
      const rollsOver = DIRS.some((dir) => {
        const intent = resolveMove(state, dir);
        return intent.over !== undefined || intent.displaced !== undefined;
      });
      if (rollsOver) this.hintOnce('hintLow');
    }
  }

  private onEvent(state: RunState, event: GameEvent): void {
    switch (event.type) {
      case 'match':
        if (state.tutorial) {
          this.guide.light(event.value);
          this.showGuideLine(state.tutorial.step);
        } else if (state.stats.clears >= 2) {
          this.hintOnce('hintChain');
        }
        break;
      case 'chain':
        if (state.tutorial) {
          this.guide.finale();
          this.showGuideLine(state.tutorial.step);
        }
        break;
      case 'tutorialStep':
        // A hop is over at once; a roll gets its line when the dice it joins start to sink.
        if (state.player.action?.kind === 'hop') this.guideLine = event.step;
        this.syncGuide();
        break;
      case 'nudge':
        this.guide.nudge();
        break;
      case 'tutorialDone':
        this.settings.tutorialDone = true;
        saveSettings(this.settings);
        this.handoff = { x: state.player.x, z: state.player.z };
        break;
      case 'fell':
        this.hintOnce('hintFloor');
        break;
      case 'landed': {
        const own = state.player.level === 'top' ? cubeAt(state, state.player.x, state.player.z) : undefined;
        if (own && own.ori.top === 1) this.hintOnce('hintOne');
        break;
      }
      default:
        break;
    }
  }

  private showGuideLine(line: number): void {
    this.guideLine = Math.min(line, TUTORIAL_SCRIPT.length);
    this.syncGuide();
  }

  private frame(time: number): void {
    requestAnimationFrame((next) => this.frame(next));
    const dt = this.lastFrame === 0 ? 0 : Math.max(0, time - this.lastFrame);
    this.lastFrame = time;

    const running = !this.paused && !this.inMenu && !this.state.over;
    let alpha = 0;
    if (running) {
      alpha = this.runner.advance(dt, () => this.controller.take(this.now()), (s) => this.onTick(s));
    }
    if (this.handoff) {
      // The tutorial is over: Endless starts on the spot, around the player.
      const start = this.handoff;
      this.startRun('endless', start);
      this.audio.begin();
    }
    const state = this.state;
    if (state.over && !this.resultShown) {
      this.resultShown = true;
      this.showResult();
    }

    // The ritual follows the score of this run only and never feeds back into the rules.
    const reached = this.ritual.update(state.score, running ? Math.min(dt, 250) : 0);
    if (reached.length > 0) this.audio.setStage(this.ritual.stage);
    const secondsLeft = Hud.secondsLeft(state);
    this.audio.warn(secondsLeft);
    // The last ten seconds of a Time Limited run are counted out loud.
    const clock = Hud.clockLeft(state);
    if (clock !== null && clock !== this.lastClock) {
      if (running && clock <= 10 && clock > 0 && this.lastClock !== -1) this.audio.tick();
      this.lastClock = clock;
    }

    const { experiments } = this.settings;
    const reducedMotion = prefersReducedMotion(this.settings);
    this.root.classList.toggle('reduced-motion', reducedMotion);
    const marker = this.tutorialMarker(state);
    this.view.draw(state, alpha, time, {
      overlay: { boardPreview: experiments.boardPreview, matchHint: experiments.matchHint, marker },
      levels: this.ritual.levels,
      phaseShift: this.ritual.phaseShift,
      warn: state.cubes.length >= state.config.warnOccupied && !state.over,
      danger: secondsLeft !== null,
      reducedMotion,
      shake: this.settings.shake,
    });
    this.hud.update(state, bestOf(this.settings, this.currentRecordKey(), 'score'), this.ritual.stage);
    this.labels.update(state, this.view);
    this.pad.update(state, experiments.matchHint);
    this.pad.setActive(this.tracker.direction);
  }
}
