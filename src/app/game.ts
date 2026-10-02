import { AudioEngine } from '../audio/engine';
import { Display } from '../display/display';
import { InputController } from '../input/controller';
import { CARDINAL_DIRS, GestureTracker, bindGestures, leanDirs, type ScreenDirs } from '../input/gesture';
import { bindKeyboard } from '../input/keyboard';
import { addRun, bestOf, loadSettings, prefersReducedMotion, puzzleStat, saveSettings, type Settings } from '../platform/settings';
import { storageAvailable } from '../platform/storage';
import type { BoardGuide, GuideArrow, GuideFrame } from '../render/overlays';
import { OCCULT_THEME } from '../render/theme';
import { BoardView } from '../render/view';
import { PUZZLE_LEVELS } from '../puzzle/levels';
import {
  createRun,
  cubeAt,
  defaultConfig,
  previewMove,
  resolveMove,
  ruleKey,
  tutorialView,
  DELTA,
  DIRS,
  type Dir,
  type GameEvent,
  type MarkFace,
  type RunState,
} from '../rules';
import { DebugPanel } from '../ui/debug';
import { formatTime, h } from '../ui/dom';
import { Dpad } from '../ui/dpad';
import { ChainLabels, HintBubble, Hud } from '../ui/hud';
import { t, type TextKey } from '../ui/i18n';
import { PuzzleTools } from '../ui/puzzle';
import { Screens, type PauseToggles, type PuzzleSection } from '../ui/screens';
import { Seal } from '../ui/seal';
import { TutorialGuide, type InputGlyph } from '../ui/tutorial';
import { puzzleReport, starsFor } from './puzzleStats';
import { Ritual } from './ritual';
import { Runner } from './runner';
import { statsText } from './stats';

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

/** Space between the tutorial's text and the far corner of the board. */
const GUIDE_GAP_PX = 8;

/** What the player picked in the menu. */
type RunKind = 'endless' | 'timed' | 'tutorial' | 'puzzle';

const PUZZLE_RULES: readonly TextKey[] = ['puzzleRule1', 'puzzleRule2', 'puzzleRule3', 'puzzleRule4', 'puzzleRule5'];

/** How long the direction of a swipe stays shown after the finger has let go. */
const STEER_LINGER_MS = 280;

export class Game {
  private settings: Settings = loadSettings();
  private runner!: Runner;
  private paused = false;
  private inMenu = false;
  private kind: RunKind = 'endless';
  private lastClock = -1;
  private lastFrame = 0;
  /** Where a swipe has to point for each board direction; follows the camera. */
  private swipeDirs: ScreenDirs = CARDINAL_DIRS;
  /** The direction the last swipe was read as, shown on the board and the seal for a moment after it. */
  private steer: { dir: Dir; until: number; arrow: GuideArrow } | null = null;
  private lastStats = '';
  private resultShown = false;
  /** Cell where the tutorial ended and Endless is about to start. */
  private handoff: { x: number; z: number } | null = null;
  /** Face of the player's die the tutorial asks to bring on top, ringed in the seal. */
  private sealMark: MarkFace | null = null;
  /** Level being played, or last played, in the list of puzzles. */
  private puzzleIndex = 0;
  /** The puzzle as it stood before each roll, oldest first: what a move is taken back to. */
  private history: RunState[] = [];
  /** The puzzle as it stood when the last command was taken, kept if that command was a roll. */
  private beforeCommand: RunState | null = null;
  /** This start of the level has had a move, so it counts as a try. */
  private tryCounted = false;

  private readonly controller = new InputController();
  private readonly ritual = new Ritual();
  private readonly audio = new AudioEngine();
  private readonly tracker: GestureTracker;
  /** The one canvas of the page; the picture is put together from its layers. */
  private readonly display = new Display();
  /** The board, as crisp as the screen allows and looking as it would on a canvas of its own. */
  private readonly world = this.display.addLayer({ name: 'world', lines: null, samples: 4, encoded: true });
  /** A board is built for a size and kept: puzzles come in several. */
  private readonly views = new Map<number, BoardView>();
  private readonly stage: HTMLElement;
  private view: BoardView;
  private readonly puzzleTools: PuzzleTools;
  private readonly hud: Hud;
  private readonly labels: ChainLabels;
  private readonly hint: HintBubble;
  private readonly guide: TutorialGuide;
  private readonly seal: Seal;
  private readonly dpad: Dpad;
  private readonly screens: Screens;
  private readonly debug: DebugPanel;
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    const hudEl = h('header', { class: 'hud' });
    const stage = h('div', { class: 'stage' });
    const overlayLayer = h('div', { class: 'stage-layer' });
    stage.append(overlayLayer);
    this.stage = stage;
    const controls = h('div', { class: 'controls' });
    const play = h('div', { class: 'play' }, [stage, controls]);
    const overlay = h('div', { class: 'overlay' });
    root.append(hudEl, play, overlay);

    const now = () => this.now();
    const enabled = () => this.inputEnabled();

    if (new URLSearchParams(window.location.search).has('debug')) this.settings.debugPanel = true;
    this.view = this.useView(defaultConfig().size);
    this.hud = new Hud(hudEl, () => this.togglePause(), () => this.debug.toggle());
    this.labels = new ChainLabels(overlayLayer);
    this.hint = new HintBubble(overlayLayer);
    this.guide = new TutorialGuide(overlayLayer, () => this.skipTutorial());
    this.seal = new Seal(overlayLayer);
    this.puzzleTools = new PuzzleTools(overlayLayer, { onUndo: () => this.undoPuzzle(), onRestart: () => this.restartPuzzle() });
    this.dpad = new Dpad(controls, this.controller, now, () => enabled() && this.settings.controlMode === 'dpad');
    this.screens = new Screens(overlay);
    this.debug = new DebugPanel(root, this.settings, {
      onChange: () => saveSettings(this.settings),
      onCamera: () => this.applyCamera(),
      onRestart: () => this.startRun(),
    });
    this.applyCamera();

    // Swipes lean half-way from plain up, right, down and left towards the board's own directions.
    this.tracker = new GestureTracker(this.controller, now, () => this.swipeDirs);
    bindGestures(play, this.tracker, () => enabled() && this.settings.controlMode === 'gesture');
    bindKeyboard(this.controller, now, enabled, () => this.togglePause());
    window.addEventListener('keydown', (e) => {
      if (!this.state.puzzle || !enabled()) return;
      if (e.code === 'KeyZ' || e.code === 'Backspace') this.undoPuzzle();
      else if (e.code === 'KeyR') this.restartPuzzle();
    });

    // The text of the tutorial wraps differently once the screen turns or the font arrives.
    window.addEventListener('resize', () => this.layoutGuide());
    void document.fonts?.ready.then(() => this.layoutGuide());

    // Browsers keep audio locked until the first user gesture.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.audio.setMuted(this.settings.muted);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // What the playtest has gathered so far is kept even if the page never comes back.
        saveSettings(this.settings);
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

  /** The board of the given size, built on first use. All of them share a layer; only the one in use is drawn. */
  private useView(size: number): BoardView {
    let view = this.views.get(size);
    if (!view) {
      view = new BoardView(this.stage, this.world, OCCULT_THEME, size, this.settings.camera);
      this.views.set(size, view);
    }
    return view;
  }

  /** Points the camera and lays the seal out the way the board now lies on screen. */
  private applyCamera(): void {
    this.view.setCamera(this.settings.camera);
    this.seal.setFloor(this.view.floorAxes());
    const at = (dir: Dir) => this.view.screenDir(dir);
    this.swipeDirs = leanDirs({ N: at('N'), E: at('E'), S: at('S'), W: at('W') }, this.settings.camera.swipeTilt);
  }

  /** `start` builds the board around a cell and raises it from the floor: the tutorial's hand-off. */
  private startRun(kind: RunKind = this.kind, start?: { x: number; z: number }): void {
    if (kind === 'puzzle') {
      this.startPuzzle(this.puzzleIndex);
      return;
    }
    this.kind = kind;
    const { experiments } = this.settings;
    const tutorial = kind === 'tutorial';
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    const config = defaultConfig(experiments, this.settings.tuning);
    if (start) {
      config.startX = start.x;
      config.startZ = start.z;
    }
    this.begin(createRun({ seed, config, tutorial, timed: kind === 'timed' }), start !== undefined);
    if (tutorial) {
      // The one-time hints of a normal run pick up where the tutorial stops.
      this.settings.hintsSeen = [];
    }
    this.layoutGuide();
  }

  /** Puts a new run on the board and clears away what the previous one left on screen. */
  private begin(state: RunState, riseIn: boolean): void {
    this.runner = new Runner(state);
    this.view = this.useView(state.config.size);
    this.applyCamera();
    this.history = [];
    this.beforeCommand = null;
    this.handoff = null;
    this.inMenu = false;
    this.lastClock = -1;
    this.root.classList.toggle('gesture', this.settings.controlMode === 'gesture');
    this.hud.showDebugButton(this.settings.debugPanel);
    this.controller.cancel();
    this.ritual.reset();
    this.view.reset(riseIn);
    this.puzzleTools.hide();
    this.audio.setStage(0);
    this.audio.warn(null);
    this.audio.setPaused(false);
    this.paused = false;
    this.resultShown = false;
    this.screens.hide();
    this.labels.clear();
    this.hint.reset();
    this.dpad.setPulse(null);
    this.seal.setPulse(null);
    this.guide.hide();
  }

  private startPuzzle(index: number): void {
    const level = PUZZLE_LEVELS[index];
    this.kind = 'puzzle';
    this.puzzleIndex = index;
    this.tryCounted = false;
    // A puzzle keeps the default pace whatever the debug sliders say: nothing in it is timed.
    this.begin(createRun({ seed: 1, config: defaultConfig(this.settings.experiments), puzzle: level }), false);
    this.layoutGuide();
  }

  private restartPuzzle(): void {
    if (!this.state.puzzle || this.inMenu) return;
    saveSettings(this.settings);
    this.startPuzzle(this.puzzleIndex);
  }

  /** Takes the last roll back, with every step made since. */
  private undoPuzzle(): void {
    if (!this.state.puzzle || this.state.over || this.inMenu || this.paused) return;
    const previous = this.history.pop();
    if (!previous) return;
    puzzleStat(this.settings, PUZZLE_LEVELS[this.puzzleIndex].id).undos++;
    this.runner = new Runner(previous);
    this.beforeCommand = null;
    this.controller.cancel();
    this.view.reset();
  }

  /** The next command, with the puzzle as it stands remembered in case the command is a roll. */
  private takeCommand(): Dir | null {
    const cmd = this.controller.take(this.now());
    if (cmd && this.state.puzzle) this.beforeCommand = structuredClone(this.state);
    return cmd;
  }

  /** First level that has no stars yet; the first one when all have. */
  private nextPuzzle(): number {
    const open = PUZZLE_LEVELS.findIndex((level) => !this.settings.puzzle.stars[level.id]);
    return open === -1 ? 0 : open;
  }

  private openPuzzle(): void {
    if (this.settings.puzzle.rulesSeen) this.showPuzzleLevels();
    else this.showPuzzleRules(true);
  }

  /** With `first`, this is the showing before the first level: it leads straight into the game. */
  private showPuzzleRules(first: boolean): void {
    const lines = PUZZLE_RULES.map((key) => t(key));
    if (!first) {
      this.screens.showPuzzleRules(lines, { onBack: () => this.showPuzzleLevels() });
      return;
    }
    this.screens.showPuzzleRules(lines, {
      onPlay: () => {
        this.settings.puzzle.rulesSeen = true;
        saveSettings(this.settings);
        this.startPuzzle(this.nextPuzzle());
      },
      onBack: () => this.showMenu(),
    });
  }

  private showPuzzleLevels(): void {
    this.inMenu = true;
    this.paused = false;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.hint.reset();
    this.guide.hide();
    saveSettings(this.settings);
    const sections: { title: string; levels: { index: number; stars: number }[] }[] = [];
    PUZZLE_LEVELS.forEach((level, index) => {
      const title = t(`tier_${level.tier}` as TextKey);
      let section = sections.find((s) => s.title === title);
      if (!section) sections.push((section = { title, levels: [] }));
      section.levels.push({ index, stars: this.settings.puzzle.stars[level.id] ?? 0 });
    });
    const shown: readonly PuzzleSection[] = sections;
    this.screens.showPuzzleLevels(shown, this.kind === 'puzzle' ? this.puzzleIndex : this.nextPuzzle(), {
      onPick: (index) => this.startPuzzle(index),
      onRules: () => this.showPuzzleRules(false),
      onStats: () =>
        this.screens.showPuzzleStats(puzzleReport(PUZZLE_LEVELS, this.settings.puzzle.stats), () => this.showPuzzleLevels()),
      onBack: () => this.showMenu(),
    });
  }

  private showPuzzleResult(): void {
    const level = PUZZLE_LEVELS[this.puzzleIndex];
    const moves = this.state.puzzle!.moves;
    const stars = starsFor(moves, level.par);
    const progress = this.settings.puzzle;
    progress.stars[level.id] = Math.max(progress.stars[level.id] ?? 0, stars);
    const stat = puzzleStat(this.settings, level.id);
    if (stat.firstMoves === null) {
      stat.firstMoves = moves;
      stat.firstSec = Math.round(stat.playMs / 1000);
    }
    stat.best = stat.best === null ? moves : Math.min(stat.best, moves);
    saveSettings(this.settings);
    this.screens.showPuzzleResult(
      { stars, moves, par: level.par, hasNext: this.puzzleIndex + 1 < PUZZLE_LEVELS.length },
      {
        onNext: () => this.startPuzzle(this.puzzleIndex + 1),
        onAgain: () => this.startPuzzle(this.puzzleIndex),
        onLevels: () => this.showPuzzleLevels(),
      },
    );
  }

  /**
   * Lays the board out below the tutorial's text, so the text never covers it. Outside the
   * tutorial the board has the whole stage.
   */
  private layoutGuide(): void {
    const active = this.state.tutorial !== null && !this.inMenu;
    this.root.classList.toggle('in-tutorial', active);
    this.view.setClear(active ? this.guide.reserve() + GUIDE_GAP_PX : 0);
  }

  /**
   * Shows what the tutorial asks for at this moment: the lesson and its line, the input, the
   * count of the group. Returns the part that is drawn on the board itself.
   */
  private updateGuide(state: RunState): BoardGuide | null {
    const view = this.inMenu ? null : tutorialView(state);
    this.sealMark = null;
    this.seal.setPulse(view?.dir ?? null);
    if (!view) return null;
    const { dir, mark, counter } = view;
    let glyph: InputGlyph = 'none';
    if (dir !== null) {
      if (!coarsePointer) glyph = 'keys';
      // With buttons on screen the pulsing quadrant of the seal is the prompt.
      else if (this.settings.controlMode === 'gesture') glyph = 'swipe';
    }
    this.guide.show({ value: view.value, line: view.line, dir, glyph, screen: dir ? this.swipeDirs[dir] : null });
    this.dpad.setPulse(dir);
    this.guide.count(
      counter && { value: view.value, have: counter.have, need: counter.need },
      counter && this.view.project(counter.x, 1.5, counter.z),
    );
    // A face on the bottom cannot be lit: the sum of opposite faces says what it is.
    this.guide.seven(mark?.face === 'bottom' ? this.view.project(mark.x, 2.25, mark.z) : null);

    // Arrows lie on the floor of the cell to go to, where it can be seen. A step onto another
    // die, or north into the cell the player's own die hides, is drawn at the height of the dice.
    const { player } = state;
    const onDie = player.level === 'top';
    if (mark && mark.x === player.x && mark.z === player.z) this.sealMark = mark.face;
    const arrows: GuideArrow[] = [];
    let { x, z } = player;
    view.path.forEach((step, i) => {
      const tx = x + DELTA[step].dx;
      const tz = z + DELTA[step].dz;
      const raised = onDie && (cubeAt(state, tx, tz) !== undefined || (i === 0 && step === 'N'));
      // From a die the arrow starts past its edge; from the figure, right beside it.
      arrows.push({ x, z, dir: step, y: raised ? 1 : 0.04, lead: onDie && !raised ? 0.64 : 0.42, dim: i > 0 });
      x = tx;
      z = tz;
    });
    const frames: GuideFrame[] = view.group.map((die) => ({ ...die, face: 'top', strong: false }));
    if (mark && mark.face !== 'bottom') frames.push({ x: mark.x, z: mark.z, face: mark.face, height: 1, strong: true });
    return { arrows, frames };
  }

  /**
   * The direction a swipe is being read as, drawn on the board from where the player is: the
   * answer to which way it went is where the eye already is. After a flick the arrow stays
   * where it was for a moment.
   */
  private steerGuide(state: RunState, time: number): { dir: Dir | null; guide: BoardGuide | null } {
    const live = this.inputEnabled() ? this.tracker.direction : null;
    if (live) {
      const { player } = state;
      // A step already under way that way is the one the swipe made: the arrow runs from the
      // cell the player is leaving. Otherwise it shows the step that comes next.
      const action = player.action?.dir === live ? player.action : undefined;
      const x = action ? action.fromX : player.x;
      const z = action ? action.fromZ : player.z;
      const onDie = (action ? action.fromLevel : player.level) === 'top';
      const ahead = action ? action.kind === 'hop' : cubeAt(state, x + DELTA[live].dx, z + DELTA[live].dz) !== undefined;
      // As with the tutorial's arrows: on the floor of the cell ahead where that can be seen,
      // at the height of the dice where a die stands there or hides it.
      const raised = onDie && (ahead || live === 'N');
      const arrow: GuideArrow = { x, z, dir: live, y: raised ? 1 : 0.04, lead: onDie && !raised ? 0.64 : 0.42, dim: false };
      this.steer = { dir: live, until: time + STEER_LINGER_MS, arrow };
    } else if (this.steer && (time > this.steer.until || !this.inputEnabled())) {
      this.steer = null;
    }
    if (!this.steer) return { dir: null, guide: null };
    return { dir: this.steer.dir, guide: { arrows: [this.steer.arrow], frames: [] } };
  }

  /** Leaves the tutorial for a normal run, from where the player stands. */
  private skipTutorial(): void {
    if (!this.state.tutorial || this.inMenu) return;
    this.settings.tutorialDone = true;
    saveSettings(this.settings);
    this.handoff = { x: this.state.player.x, z: this.state.player.z };
  }

  private showMenu(): void {
    this.inMenu = true;
    this.paused = false;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.hint.reset();
    this.guide.hide();
    this.layoutGuide();
    this.dpad.setPulse(null);
    this.screens.showMenu(!this.settings.tutorialDone, {
      onEndless: () => this.startRun('endless'),
      onTimed: () => this.startRun('timed'),
      onPuzzle: () => this.openPuzzle(),
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
      onLevels: this.state.puzzle ? () => this.showPuzzleLevels() : undefined,
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
    // The tutorial speaks for itself, and a puzzle has its own rules; these belong to a normal run.
    if (this.state.tutorial || this.state.puzzle) return;
    if (!this.settings.experiments.guidedStart || this.settings.hintsSeen.includes(id)) return;
    this.settings.hintsSeen.push(id);
    saveSettings(this.settings);
    this.hint.show(t(id));
  }

  private onTick(state: RunState): void {
    this.view.notify(state.events);
    for (const event of state.events) {
      // Levels mean nothing in the tutorial: no fanfare for passing one.
      if (!(state.tutorial && event.type === 'levelUp')) this.audio.handle(event);
      this.onEvent(state, event);
    }
    const { player } = state;
    if (state.puzzle || player.action || state.tick % 10 !== 0) return;
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
      case 'move':
        if (state.puzzle && event.kind === 'roll' && this.beforeCommand) {
          this.history.push(this.beforeCommand);
          if (!this.tryCounted) {
            this.tryCounted = true;
            puzzleStat(this.settings, PUZZLE_LEVELS[this.puzzleIndex].id).tries++;
          }
        }
        this.beforeCommand = null;
        break;
      case 'deadEnd':
        puzzleStat(this.settings, PUZZLE_LEVELS[this.puzzleIndex].id).dead++;
        break;
      case 'match':
        if (state.stats.clears >= 2) this.hintOnce('hintChain');
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

  private frame(time: number): void {
    requestAnimationFrame((next) => this.frame(next));
    const dt = this.lastFrame === 0 ? 0 : Math.max(0, time - this.lastFrame);
    this.lastFrame = time;

    const running = !this.paused && !this.inMenu && !this.state.over;
    let alpha = 0;
    if (running) {
      alpha = this.runner.advance(dt, () => this.takeCommand(), (s) => this.onTick(s));
      if (this.state.puzzle) {
        // Time on a level counts until it is first cleared: that is how hard it was to read.
        const stat = puzzleStat(this.settings, PUZZLE_LEVELS[this.puzzleIndex].id);
        if (stat.firstMoves === null) stat.playMs += Math.min(dt, 250);
      }
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
      if (state.puzzle) this.showPuzzleResult();
      else this.showResult();
    }

    // The ritual follows the score of this run only and never feeds back into the rules.
    // A puzzle is not scored: the board stays as it is at the start.
    const reached = this.ritual.update(state.puzzle ? 0 : state.score, running ? Math.min(dt, 250) : 0);
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
    const steer = this.steerGuide(state, time);
    // The tutorial's own arrows say where to go; a swipe is echoed on the board outside it.
    const guide = this.updateGuide(state) ?? steer.guide;
    this.view.draw(state, alpha, time, {
      overlay: { boardPreview: experiments.boardPreview, matchHint: experiments.matchHint, guide },
      levels: this.ritual.levels,
      phaseShift: this.ritual.phaseShift,
      warn: state.cubes.length >= state.config.warnOccupied && !state.over,
      danger: secondsLeft !== null,
      reducedMotion,
      shake: this.settings.shake,
    });
    if (state.puzzle) {
      const level = PUZZLE_LEVELS[this.puzzleIndex];
      this.hud.updatePuzzle({
        level: this.puzzleIndex + 1,
        moves: state.puzzle.moves,
        par: level.par,
        best: this.settings.puzzle.stats[level.id]?.best ?? null,
      });
      if (this.inMenu) this.puzzleTools.hide();
      else this.puzzleTools.update({ dead: state.puzzle.dead, held: state.puzzle.held !== 0, canUndo: this.history.length > 0 });
    } else {
      this.hud.update(state, bestOf(this.settings, this.currentRecordKey(), 'score'), this.ritual.stage);
    }
    this.labels.update(state, this.view);
    this.seal.update(state, this.sealMark);
    this.seal.setActive(steer.dir);
    this.display.present();
  }
}
