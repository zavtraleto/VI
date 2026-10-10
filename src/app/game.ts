import { AudioEngine } from '../audio/engine';
import { Display } from '../display/display';
import { Governor, QUALITY_STEPS } from '../display/governor';
import { quality } from '../display/quality';
import type { Rect } from '../display/sizing';
import { InputController } from '../input/controller';
import { CARDINAL_DIRS, GestureTracker, bindGestures, leanDirs, type ScreenDirs } from '../input/gesture';
import { bindKeyboard } from '../input/keyboard';
import {
  boardEntries,
  canRegister,
  hasBoard,
  onPlatformAudio,
  onPlatformPause,
  platformNow,
  playerName,
  register,
  shareOut,
  showInterstitial,
  submitScore,
  takeFocus,
  tell,
  track,
  trackPerformance,
  type BoardEntry,
  type Shared,
} from '../platform/bridge';
import { SETTINGS_KEY, addRun, bestOf, bestOn, levelStat, loadSettings, noteShort, prefersReducedMotion, puzzleStat, saveSettings, type LevelStat, type Settings } from '../platform/settings';
import { loadJson, saveAll, saveJson, storageAvailable } from '../platform/storage';
import { Backdrop } from '../render/backdrop';
import { topTurn } from '../render/orientationQuat';
import type { BoardGuide, GuideArrow, GuideFrame } from '../render/overlays';
import { shiftFor } from '../render/framing';
import { boardDefaults, readView, type BoardLook } from '../render/params';
import { goneShare, type DicePassing } from '../render/passing';
import { BoardView, type Frame } from '../render/view';
import { ROAD, ROAD_HINTS, blockOf, placeAfter, type HintUntil, type RoadHintKey } from '../levels/road';
import { roadCells, roadDone, roadFocus } from '../levels/roadList';
import { LEVELS } from '../levels/levels';
import { ladderProgress, levelStars, limitedLevel, type LadderProgress } from '../levels/progress';
import { lessonsAt, ruleOf } from '../levels/rules';
import { messagesOf } from '../levels/voices';
import { PUZZLE_LEVELS } from '../puzzle/levels';
import {
  createRun,
  cubeAt,
  getCube,
  defaultConfig,
  goalLines,
  goalOf,
  levelDeadEnd,
  shortGroups,
  smallestGroup,
  previewAll,
  previewMove,
  resolveMove,
  roll,
  ruleKey,
  tutorialAck,
  tutorialHint,
  tutorialRestart,
  tutorialView,
  tutorialWaits,
  DELTA,
  DIRS,
  LEVEL_UNDOS,
  TUTORIAL_LESSONS,
  TUTORIAL_LINES,
  type Dir,
  type GameEvent,
  type GoalLine,
  type LevelDeadEnd,
  type LevelSpec,
  type MarkFace,
  type MoveKind,
  type Orientation,
  type RunState,
  type ShortGroup,
} from '../rules';
import { GameHud, type HudCounter, type HudLabel, type HudLesson, type HudSeal, type HudSign, type HudView } from '../shell/hud';
import { Climb } from '../shell/climb';
import { clearedPanel, languagePanel, levelIntroPanel, levelResultPanel, levelRulesPanel, levelsPanel, pausePanel, readmePanel, recordsPanel, resultPanel, roadPanel, rulesPanel, systemPanel, tasksPanel, type SystemValues } from '../shell/panels';
import { Shell } from '../shell/shell';
import { COMMANDS, LOGO_TEXT, PANELS, RECORDS, eraDate, type PanelName } from '../shell/text';
import { shellDefaults } from '../shell/theme';
import { SignalPlayer } from '../signal/player';
import type { DevTools } from '../ui/devtools';
import { h } from '../ui/dom';
import { readmePages } from '../ui/readme';
import { LANGUAGES, language, setLanguage, t, word, type TextKey } from '../ui/i18n';
import { dailyArchive, endlessArchive } from './archive';
import { clockLeft, secondsLeft } from './clock';
import { dailyValue, dayAt, readDailyValue, type Day } from './daily';
import { Hints } from './hints';
import { levelReport, shortOf } from './levelStats';
import { puzzleReport, starsFor } from './puzzleStats';
import { Hitstop, beatsOf, peakBeat, stepBeat, type Beat } from './juice';
import { CONTACT_STEPS, Ritual, nextThreshold } from './ritual';
import { Later } from './later';
import { Runner, frameBound } from './runner';
import { mark, span } from './spans';
import { standings, type PlayerLine, type Standing } from './standings';
import { statsText } from './stats';
import { FILE_LEADS, boardAfter, orderOf, passageAt, passageMarks, startBoard, type Board, type FileLead, type PassageCounts, type PassageTimes, type PassageView } from './passage';
import { RUN_KEY, packRun, unpackRun, type KeptRun } from './savedRun';
import { DeadEnds, fixedLineOver, hintOver, probeHint, roomLines, saysFixed } from './hint';
import { roadCounters } from './roadCounters';
import { roadWait, signBody, signMode, type RoadWait, type Waiting } from './signWay';
import { FrameSampler, RunTally, checkpoint, levelSummary, runSummary, type EventData } from './telemetry';

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

/** Space between the words of the exercise and the far corner of the board. */
const GUIDE_GAP_PX = 8;

/** What the player picked in the menu, or in the list of levels. */
type RunKind = 'endless' | 'timed' | 'tutorial' | 'puzzle' | 'level';

/**
 * The levels are a file of the menu. Asked for in the address, `?levels`, the program opens on
 * their list and not on its menu.
 */
const LEVELS_PROBE = new URLSearchParams(window.location.search).has('levels');
/**
 * The exercise and the tasks have no file in the menu since 6 October 2026: the levels teach
 * and the levels are the puzzles. Both are still in the program, and `?tutorial` and `?tasks`
 * open on them, until it is decided whether they come back or go: see docs/ROADMAP.md.
 */
const SHELVED = ((query) => (query.has('tutorial') ? 'tutorial' : query.has('tasks') ? 'tasks' : null))(new URLSearchParams(window.location.search));
/**
 * The road is not in the list of the levels and is played once. `?first` opens on its first
 * piece and `?road=R05` on the piece of that code, with no command to start it, to play a piece
 * again and to look at it. Null where the address asks for neither, or names no piece.
 */
const ROAD_PROBE = ((query) => {
  const index = query.has('road') ? ROAD.findIndex((spec) => spec.id === query.get('road')) : query.has('first') ? 0 : -1;
  return index < 0 ? null : index;
})(new URLSearchParams(window.location.search));
/**
 * A line of the hints asked for in the address of a development build, `?hint=hintChain`: it is
 * shown above the board of whatever piece runs, to look at it before the pieces that carry it are
 * laid. A production build has none.
 */
const HINT_PROBE = import.meta.env.DEV ? probeHint(new URLSearchParams(window.location.search).get('hint')) : null;
/** The code the first level of the build before the road was kept under: who passed it has passed what the first block of the road is. */
const FIRST_ID = 'F1';
/**
 * A lab that is the game itself under a panel of development, `?lab=juice`, opens on the menu, as
 * the program did before it opened on a board. The labs are tools of development: a production
 * build has none of them.
 */
const LAB = import.meta.env.DEV && new URLSearchParams(window.location.search).has('lab');
/**
 * How the game is played, as the file of the menu says it: the rules that hold wherever dice
 * are rolled, then what a level asks for and what a session does. Where a window of the levels
 * already says a rule in words that hold everywhere, the words are the same ones.
 */
const HOW_TO_PLAY: readonly TextKey[] = ['howRoll', 'howCombo', 'howChain', 'lessonGlass', 'lessonFloor', 'howOnes', 'howLevels', 'howProtocol'];
/** A window lower than this, in CSS pixels, and lying on its side shows the note that came with the program so many signs at a time. */
const README_LOW = 520;
const README_SIGNS = 330;
/**
 * A chapter of the levels opens for the stars of the levels before it. The gates are a probe:
 * `?gates=off` in the address leaves every chapter open, to play the ladder both ways.
 */
const LEVEL_GATES = new URLSearchParams(window.location.search).get('gates') !== 'off';
/** What the report of the levels says before any level has been played. */
const LEVELS_UNPLAYED = 'VI levels playtest: no level played yet';

/** The kinds of session that are scored, in the order the log shows them. Each has a table of players on the platform, under its own name. */
const SCORED = ['endless', 'timed'] as const;
type Scored = (typeof SCORED)[number];

/** An advertisement may come after this many tasks cleared: a number picked anew each time, from the first to the second. */
const TASKS_TO_AD = [5, 7] as const;
const tasksToAd = (): number => TASKS_TO_AD[0] + Math.floor(Math.random() * (TASKS_TO_AD[1] - TASKS_TO_AD[0] + 1));

const PUZZLE_RULES: readonly TextKey[] = ['puzzleRule1', 'puzzleRule2', 'puzzleRule3', 'puzzleRule4', 'puzzleRule5'];

/**
 * A finished session waits this long before it sets off up the log: the end of a session is a
 * cut, a silence and one low note, and they are heard out first.
 */
const CLIMB_LEAD_MS = 1100;
/** How long the command of sharing reads what came of it. */
const SHARED_MS = 2200;

/** A level has ended where nothing more can be done: too few dice stand for a combo, the player has no move left, or is down on the floor among faces that make no combo. */
const deadEnd = (state: RunState): boolean => levelDeadEnd(state) !== null;
/** What the window of a level says of a dead end that is not one by the count of the dice. */
const DEAD_END_LINE: Record<Exclude<LevelDeadEnd, 'count'>, TextKey> = { stranded: 'levelStranded', floor: 'levelFloorStuck', faces: 'levelFloorFaces' };

/**
 * Chapters on whose levels every group that is short is counted from the start: those that teach.
 * The probe has none: it is played by one who knows the rules, and only the group the last move
 * made is counted, as on the levels that came after the lessons.
 */
const CHAPTERS_COUNTED = 0;
/** How long the side of the seal that a swipe pointed at stays lit after the finger has let go. */
const SEAL_LINGER_MS = 280;
/**
 * The level from which the step with no way back is marked: the one that says a combo on its way
 * out can be walked over and stepped off, or the first while no level says so.
 */
const LEVEL_OF_COMMIT = LEVELS.findIndex((level) => level.lesson === 'lineWalk' || level.lesson === 'lessonWalk') + 1 || 1;
/** Of the signs the laboratory's assistant prints, one in so many is heard: a click to every sign is a rattle. */
const TYPED_EVERY = 2;
/**
 * The most a frame moves the passage between two boards on, in milliseconds: a page that was
 * out of sight comes back to the passage where it left it, and no part of it is leapt over.
 */
const PASSAGE_STEP_MS = 100;
/**
 * How long a level that is lost stands as it is before its result is shown: the board says it
 * first, the window after.
 */
const FAIL_HOLD_MS = 900;
/** How strong the answer of the board to a level that is passed is, as a beat: a tier under the strongest, and the sound of a chain's fourth link. */
const FINALE_TIER = 3;
const FINALE_CHAIN = 4;
/** Moves a cell keeps the frame of a die rolled over on it, at the most: its group is long gone by then. */
const GHOST_MOVES = 8;

/** Side of the die that looks towards each board direction. */
const SIDE: Record<Dir, keyof Orientation> = { N: 'north', E: 'east', S: 'south', W: 'west' };
/** The roll that turns each side up: folded out, a side lies the way it would then lie on top. */
const TURNS_UP: Record<Dir, Dir> = { N: 'S', E: 'W', S: 'N', W: 'E' };
/** The exercise goes through the faces from the two to the six, and ends with the one. */
const LESSONS = TUTORIAL_LESSONS;
/** Keys that read the words of the exercise: those that run a command, and those that step. */
const READ_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'KeyW', 'KeyD', 'KeyS', 'KeyA']);

/**
 * Where the step of quality this device has come down to is kept between visits, and for
 * how long. The step only goes down while the game runs, so it is forgotten after a few days:
 * a device that was slow once, hot or busy with something else, gets its samples back.
 */
const SAMPLE_STEP_KEY = 'vi.samples.v1';
const SAMPLE_STEP_DAYS = 3;

function keptSampleStep(): number {
  try {
    const kept = JSON.parse(window.localStorage.getItem(SAMPLE_STEP_KEY) ?? 'null') as { step?: unknown; at?: unknown } | null;
    const step = Number(kept?.step);
    const age = Date.now() - Number(kept?.at);
    const fresh = age >= 0 && age < SAMPLE_STEP_DAYS * 24 * 60 * 60 * 1000;
    return fresh && Number.isInteger(step) && step >= 0 && step < QUALITY_STEPS.length ? step : 0;
  } catch {
    return 0;
  }
}

function keepSampleStep(step: number): void {
  try {
    window.localStorage.setItem(SAMPLE_STEP_KEY, JSON.stringify({ step, at: Date.now() }));
  } catch {
    // Without storage the device starts from the most samples again: it comes down in a few seconds.
  }
}

/** How many quarter turns the picture of a top face lies at. */
function quarterTurns(ori: Orientation): number {
  return ((Math.round(topTurn(ori) / (Math.PI / 2)) % 4) + 4) % 4;
}

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
  /** The direction the last swipe was read as, lit on the seal for a moment after it. */
  private sealLight: { dir: Dir; until: number } | null = null;
  /** The breath the game holds on a beat. */
  private readonly hold = new Hitstop();
  /** The peak of the contact on the last frame, to notice it begin. */
  private lastPeak = 0;
  /** The way back to the end of a lesson for a player who has left its short way, and the position it is from. */
  private wayBack: { key: string; path: Dir[] } | null = null;
  private lastStats = '';
  private resultShown = false;
  /** A run is kept in storage for later: it is taken out when the run ends or is given up. */
  private runKept = false;
  /** The tick the kept run stood at: a run that has not moved since is not written again. */
  private keptTick = -1;
  /** The scored runs of this visit: how many were started, and how many in a row the board took. */
  private runIndex = 0;
  private lossesInRow = 0;
  /** When the last scored run ended, on the player's clock; 0 before the first. */
  private lastRunEnd = 0;
  /** Seconds between the end of the run before and the start of this one; -1 for the first. */
  private sinceLastRun = -1;
  /** The run in hand was put back after the page had gone away. */
  private resumed = false;
  /** Cell where the tutorial ended and Endless is about to start. */
  private handoff: { x: number; z: number } | null = null;
  /** Level being played, or last played, in the list of puzzles. */
  private puzzleIndex = 0;
  /** The puzzle as it stood before each roll, oldest first: what a move is taken back to. */
  private history: RunState[] = [];
  /** The puzzle as it stood when the last command was taken, kept if that command was a roll. */
  private beforeCommand: RunState | null = null;
  /** This start of the level has had a move, so it counts as a try. */
  private tryCounted = false;
  /** Level of the game being played, or last played, in the list of levels. */
  private levelIndex = 0;
  /** The piece of the road on the board, by its place in the road; null on a level of the list. */
  private piece: number | null = null;
  /** The board waits under the one command the program opens on: nothing of the session is shown over it. */
  private starting = false;
  /** The level on the board was laid under that command and has not been reported as started: it is, once, with the player's first move or step on it. */
  private unsaid = false;
  /**
   * The passage from a board that is passed to the next one: how long it has run, which board
   * comes (none where a window does), what is counted of the two boards, whether the next is
   * on yet and whether the board has answered its dice, how many dice have been heard to light
   * up, to go under and to stand, the dice of the board that is on in the order of their turns,
   * how much of the lines of that board the cell of the player alone is, and what the board
   * that is passed came to. While it is on, the board takes no input and its world stands.
   */
  private passage: {
    elapsed: number;
    next: Board | null;
    counts: PassageCounts;
    swapped: boolean;
    beaten: boolean;
    lit: number;
    gone: number;
    risen: number;
    order: number[];
    cell: number;
    outcome: { stars: number; moves: number } | null;
  } | null = null;
  /** How the dice stand in the passage, die by die: the view reads it on every frame. One object, changed in place. */
  private readonly passing: DicePassing = { mode: 'leave', ranks: new Map(), count: 0, stair: -1, litMs: 0, moveMs: 0, stepMs: 0, moveForMs: 0, flashMs: 0 };
  /** The numbers of the passage as the look has them, where the passage stands, and when its parts begin: read anew on every frame of it, into the same objects. */
  private readonly times: PassageTimes = { comboStepMs: 0, comboHoldMs: 0, sinkMs: 0, eraseMs: 0, cameraMs: 0, drawMs: 0, riseMs: 0, riseStepMs: 0 };
  private readonly passageNow: PassageView = { phase: 'combo', at: 0, lit: 0, swapped: false, camera: 0, lines: 1, risen: 0 };
  private readonly marksNow = { sink: 0, swap: 0, rise: 0 };
  /** The next board is to be laid with its starting cell on the cell the player stands on: that cell, and where the board it is a cell of lies. */
  private landing: { player: { x: number; z: number }; origin: { x: number; z: number } } | null = null;
  /** The board that is on is seen in a frame counted here, for the window as the view had it at this count; -1: in its own, which the view keeps. */
  private framedAt = -1;
  /** What the level of the list just passed came to, shown in the readings until the first move on the board after it. */
  private outcome: { stars: number; moves: number } | null = null;
  /** Ticks of the level in hand that have been played: its own tick stands still between moves and is no clock. */
  private levelTicks = 0;
  /** Moves of the level in hand that can still be taken back. */
  private undosLeft = 0;
  /** The cell the die of the last move of a level went to, and which move it was. */
  private lastMove: { x: number; z: number; moves: number } | null = null;
  /** The wait of the piece of the road on the board: its swipe sign and its blinking plaque. Null on a level of the list and outside the levels. */
  private wait: RoadWait | null = null;
  /** The dead ends of the piece in hand, which a try started over and a move taken back do not forget. */
  private readonly deadEnds = new DeadEnds();
  /** The line above the board of the piece in hand, while it teaches a move: from the start of the piece to the move being made. Null where the piece has none. */
  private hint: { key: RoadHintKey; until: HintUntil; done: boolean } | null = null;
  /**
   * The line about a dim die, said once to a player: the time of play it was put up at, null
   * while it is not shown. And whether it has been put up on the board in hand: no room is kept
   * for it before that, and from then the board keeps the room, as for the line of a lesson.
   */
  private fixedLine: number | null = null;
  private fixedShown = false;
  /** What that wait shows on this frame: the way the swipe sign points, and whether the plaque over the target blinks. */
  private waiting: Waiting = { dir: null, blink: false };
  /** What the player last played with: the swipe sign is a key for those who press keys. */
  private lastInput: 'keys' | 'pointer' | null = null;
  /** When the level on the board was lost: it stands as it is for a moment before its window. Null on a level that is not. */
  private failedAt: number | null = null;
  /** What the level on the board came to has been written down: it is, once, the moment the level ends. */
  private levelCounted = false;
  /** Cells of a level on which a die that was going has been rolled over: where, of what face and group, on which move. */
  private ghosts: { x: number; z: number; value: number; reactionId: number; moves: number }[] = [];
  /** The program is up: what starts from here on is started by the player. */
  private opened = false;
  /** The platform has been told that the game can be played. */
  private announced = false;
  /** The platform lets the game sound. */
  private platformSound = true;
  /** What keeps the game waiting from outside: the page is hidden, the platform has asked for a pause. */
  private readonly away = new Set<'page' | 'platform'>();
  /** The tables of players the platform keeps, by kind of session: their lines, or how the asking for them stands. */
  private readonly boards = new Map<string, readonly BoardEntry[] | 'waiting' | 'failed'>();
  /** What came of the last sharing, for as long as its command reads it. */
  private shared: Shared | null = null;
  private sharedTimer = 0;
  /** The day the run on the board was started on: the session with a limit is the session of that day. */
  private day: Day = dayAt(platformNow());
  /** What the events of the run add up to, for the analytics. */
  private readonly tally = new RunTally();
  /** The frames of active play, measured for the platform. */
  private readonly frames = new FrameSampler(trackPerformance);
  /** What is owed the platform and storage, and is paid when the move is over and not on its frame. */
  private readonly later = new Later();
  /** A move has been taken since the page opened: the first one is marked for whoever measures it. */
  private moved = false;
  /** Tasks cleared since an advertisement had its chance, and how many it takes for the next one. */
  private clearedSinceAd = 0;
  private clearsToAd = tasksToAd();

  private readonly controller = new InputController();
  private readonly ritual = new Ritual();
  private readonly audio = new AudioEngine();
  private readonly hints = new Hints();
  private readonly tracker: GestureTracker;
  /** The one canvas of the page; the picture is put together from its layers. */
  private readonly display = new Display();
  /** What lies behind the board: the dark the screen starts from. */
  private readonly backdrop = new Backdrop(this.display);
  /** The address has not turned the light of the tube off: the governor may keep it or give it up. */
  private readonly haloAsked = quality().halo;
  /** Gives samples of anti-aliasing and the light of the tube up where the device does not keep up; null where the address has set the samples. */
  private readonly governor = quality().auto ? new Governor(keptSampleStep()) : null;
  /** The board, as crisp as the screen allows and looking as it would on a canvas of its own. Clear around the dice. */
  private readonly world = this.display.addLayer({ name: 'world', lines: null, samples: this.governor?.samples ?? quality().samples, encoded: true });
  /** The least time between two frames drawn, in milliseconds, where the frames of the screen are held to a limit; 0 where they are not. */
  private readonly frameGap = quality().fpsCap > 0 ? 1000 / quality().fpsCap - 1 : 0;
  /** What the board and the interface are drawn from: the board's own values, and the look of the program. The address may name the view. */
  private readonly look: BoardLook = { board: { ...boardDefaults(), ...readView(window.location.search) }, shell: shellDefaults() };
  /** What the program shows of a session over the board. Its layers lie under those of the menu and the panels. */
  private readonly hud = new GameHud(this.display, this.look, {
    live: () => !this.inMenu && !this.shell.visible && !this.toolsOpen && !this.signal.busy,
    onPause: () => this.togglePause(),
    onUndo: () => this.undoTask(),
    onRestart: () => this.restartTask(),
    onSkip: () => this.skipTutorial(),
    onContinue: () => this.outside((state) => tutorialAck(state)),
    onPoints: (points, tier) => this.audio.points(points, tier),
    onCount: () => this.audio.count(),
    onSign: (sign) => this.audio.sign(sign),
    // The words over the board come with the click the program types the windows of the levels with.
    onHintWord: (sign) => this.audio.typed(sign),
    press: (dir) => {
      if (!this.inputEnabled()) return;
      // While the words of the exercise wait to be read, a button of the pad reads them.
      if (tutorialWaits(this.state)) this.hud.proceed();
      else this.controller.press(dir, this.now());
    },
    release: () => this.controller.release(),
    cancel: () => this.controller.cancel(),
  });
  /** The program around the game: boot, menu, panels. Its layers come after the board's, so they lie over it. */
  private readonly shell = new Shell(this.display, this.settings, { values: this.look.shell, blocked: () => this.toolsOpen, sound: (event) => this.audio.ui(event) });
  /** What comes from the other side: a transmission in a window of the program, over the board. */
  private readonly signal = new SignalPlayer(this.display, this.shell.values, this.world);
  /** Boxes of the page that the canvas draws into: the readings, the board, the buttons. */
  private readonly header: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly pad: HTMLElement;
  /** The one view of the game: every board is put on it, and its frame is set from here. */
  private readonly view: BoardView;
  /**
   * The tools of development: the playtest, the debug panel, the frame counter. They are not
   * a part of the program, are loaded in development only, and a production build has none.
   */
  private tools: DevTools | null = null;
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    // A device that gave the light of the tube up on an earlier visit starts without it.
    if (this.governor && !this.governor.halo) quality().halo = false;
    this.header = h('header', { class: 'hud' });
    const stage = h('div', { class: 'stage' });
    this.stage = stage;
    this.pad = h('div', { class: 'dpad' });
    const controls = h('div', { class: 'controls' }, [this.pad]);
    const play = h('div', { class: 'play' }, [stage, controls]);
    root.append(this.header, play);

    const now = () => this.now();
    const enabled = () => this.inputEnabled();

    this.view = new BoardView(this.stage, this.world, this.look, defaultConfig().size, this.settings.camera);
    this.hud.setLessonLines(TUTORIAL_LINES.map((line) => t(`tut_${line}` as TextKey)));
    if (import.meta.env.DEV) {
      if (new URLSearchParams(window.location.search).has('debug')) this.settings.debugPanel = true;
      void import('../ui/devtools').then(({ DevTools }) => {
        this.tools = new DevTools(root, this.settings, {
          onChange: () => saveSettings(this.settings),
          onCamera: () => this.applyCamera(),
          onRestart: () => this.startRun(),
        });
      });
    }
    this.applyCamera();

    // Swipes lean half-way from plain up, right, down and left towards the board's own directions.
    // On a level a swipe steps when the finger is lifted: every step there may be a move that counts.
    this.tracker = new GestureTracker(this.controller, now, () => this.swipeDirs, () => Boolean(this.state.levelRun));
    // While the words of the exercise wait to be read, a key or a swipe reads them and moves nothing.
    const moving = () => enabled() && !tutorialWaits(this.state);
    bindGestures(play, this.tracker, () => moving() && this.settings.controlMode === 'gesture');
    // Esc opens the pause over a session. Over a panel it is the panel's "back", and the shell
    // marks the key as taken; a transmission passes on any key, and whether one was on screen
    // is noted on the way down, before it answers.
    let free = true;
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'Escape') free = !this.signal.busy && !this.toolsOpen;
      },
      true,
    );
    bindKeyboard(this.controller, now, moving, () => {
      if (free && !this.shell.visible) this.pause();
    });
    window.addEventListener('keydown', (e) => {
      // The words of the exercise are read with any key that steps or runs a command.
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || this.inMenu || !enabled() || !tutorialWaits(this.state)) return;
      if (!READ_KEYS.has(e.code)) return;
      e.preventDefault();
      this.hud.proceed();
    });
    window.addEventListener('keydown', (e) => {
      const { puzzle, levelRun } = this.state;
      if (!(puzzle || levelRun) || !enabled()) return;
      if (e.code === 'KeyZ' || e.code === 'Backspace') this.undoTask();
      else if (e.code === 'KeyR') this.restartTask();
    });

    // The words of the exercise wrap differently once the screen turns or the font arrives.
    window.addEventListener('resize', () => this.layoutGuide());
    void document.fonts?.ready.then(() => this.layoutGuide());

    // Browsers keep audio locked until the first user gesture. Opening the sound holds the page
    // for a moment, and the press that opens it may be a move: the time it took is not played.
    // What took most of that moment, the numbers of the noise and of the echo, is worked out
    // before the press, while the page is idle.
    this.audio.prepare();
    const unlock = () => {
      if (this.audio.unlock()) this.stalled();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', () => (this.lastInput = 'pointer'));
    window.addEventListener('keydown', () => (this.lastInput = 'keys'));
    this.signal.onSound = (event) => this.audio.signal(event);
    this.applySound();
    onPlatformAudio((enabled) => {
      this.platformSound = enabled;
      this.applySound();
    });

    document.addEventListener('visibilitychange', () => this.setAway('page', document.hidden));
    // A page that is closed or thrown out of memory says so here, if it says anything at all.
    window.addEventListener('pagehide', () => {
      this.later.flush();
      this.keepRun();
    });
    // What goes wrong while the game is played is counted with the frames, and nothing more is said of it.
    window.addEventListener('error', () => this.frames.noteError('error'));
    window.addEventListener('unhandledrejection', () => this.frames.noteError('rejection'));
    window.addEventListener('webglcontextlost', () => this.frames.noteError('contextLoss'), true);
    // The platform asks for the same while its advertisement is open. What stood over the game
    // took the keys, and they come back with the game.
    onPlatformPause((paused) => {
      this.setAway('platform', paused);
      if (!paused) takeFocus();
    });
    // In a frame of the platform's page the keys are that page's until the game takes them.
    takeFocus();

    // A board is set up behind the shell and not drawn: the rest of the code leans on `this.runner`.
    this.startRun('endless');
    this.opened = true;
    this.inMenu = true;
    this.audio.setPaused(true);
    this.layoutGuide();
    this.shell.boot(() => {
      if (LEVELS_PROBE) {
        // The probe opens on its list. A run kept from before is left in storage, for a start without the probe.
        this.saveWithoutRun();
        this.showLevels();
        return;
      }
      if (SHELVED) {
        this.saveWithoutRun();
        if (SHELVED === 'tutorial') this.startRun('tutorial');
        else this.openPuzzle();
        return;
      }
      if (ROAD_PROBE !== null) {
        this.saveWithoutRun();
        this.startPiece(ROAD_PROBE);
        return;
      }
      // A run the player was taken away from waits for them on its pause; otherwise, the board
      // they will play, under the one command that starts it. A lab opens on the menu.
      const kept = this.keptRun();
      // The long boot is shown once per device. What was kept of the run has been read and goes
      // out of storage with the same save.
      this.saveWithoutRun();
      if (kept) this.continueRun(kept);
      else if (LAB) this.showMenu();
      else this.showStart();
    });
    requestAnimationFrame((time) => this.frame(time));
  }

  /** Draws the board with what the governor has come down to, and keeps the step for the next visit. */
  private applySamples(): void {
    const { governor } = this;
    if (!governor) return;
    quality().samples = governor.samples;
    quality().halo = this.haloAsked && governor.halo;
    this.world.setSamples(governor.samples);
    keepSampleStep(governor.step);
  }

  /** The sound is on when the player has it on and the platform allows it. */
  private applySound(): void {
    this.audio.setMuted(this.settings.muted || !this.platformSound);
  }

  /**
   * The page is hidden, or the platform asks the game to wait: the session stops and falls
   * silent. The sound comes back when nothing outside keeps the game waiting any more.
   */
  private setAway(by: 'page' | 'platform', away: boolean): void {
    if (away) {
      this.away.add(by);
      this.later.flush();
      // What has been gathered so far is kept even if the page never comes back: the settings
      // and the run in hand, in one call to storage.
      this.keepAll();
      this.pause();
      this.audio.setAway(true);
      return;
    }
    this.away.delete(by);
    if (this.away.size === 0) this.audio.setAway(false);
  }

  /**
   * Keeps the scored run in hand for later. A phone drops a page that is out of sight, and
   * the run would be gone with it: kept, it is put back the next time the game is opened.
   */
  private keepRun(): void {
    const kept = this.packedRun();
    if (!kept || (this.runKept && this.keptTick === kept.state.tick)) return;
    if (saveJson(RUN_KEY, kept)) this.noteKept(kept);
  }

  /** The settings and, with them, the scored run in hand: one call to storage for both. */
  private keepAll(): void {
    const kept = this.packedRun();
    if (!kept) saveSettings(this.settings);
    else if (saveAll([[SETTINGS_KEY, this.settings], [RUN_KEY, kept]])) this.noteKept(kept);
  }

  /** The scored run in hand as it would be kept; null when there is nothing to come back to. */
  private packedRun(): KeptRun | null {
    if (!this.opened || this.inMenu || this.handoff || (this.kind !== 'endless' && this.kind !== 'timed')) return null;
    return packRun(this.kind, this.day.date, this.state, this.tally);
  }

  private noteKept(kept: KeptRun): void {
    this.runKept = true;
    this.keptTick = kept.state.tick;
  }

  /** Takes the kept run out of storage: it has ended, or the player has given it up. */
  private dropRun(): void {
    if (!this.runKept) return;
    this.runKept = false;
    saveJson(RUN_KEY, null);
  }

  /** Saves the settings; a kept run that is no longer wanted goes out of storage in the same call. */
  private saveWithoutRun(): boolean {
    if (!this.runKept) return saveSettings(this.settings);
    this.runKept = false;
    return saveAll([[SETTINGS_KEY, this.settings], [RUN_KEY, null]]);
  }

  /**
   * The run the player was taken away from, if one was kept and this build can go on with it.
   * Whatever was kept has been read by now: it is marked to be taken out of storage.
   */
  private keptRun(): KeptRun | null {
    const found = loadJson<{ version?: number }>(RUN_KEY, {});
    this.runKept = found.version !== undefined;
    return unpackRun(found, dayAt(platformNow()).date);
  }

  /** Puts a kept run back. It waits on its pause: nothing moves until the player says so. */
  private continueRun(kept: KeptRun): void {
    this.kind = kept.kind;
    this.day = dayAt(platformNow());
    this.begin(kept.state, false);
    this.tally.take(kept.tally);
    // The contact stands where the run left it, without its steps being played again.
    this.ritual.update(kept.state.removed, 0);
    this.resumed = true;
    this.runIndex++;
    track('progression_resumed', { ...this.step(), duration_sec: this.seconds() });
    tell('level_started', this.kind);
    this.layoutGuide();
    this.pause();
  }

  /** What is known of the run beyond its own board: where it stands in the visit, and how it is played. */
  private visit(): EventData {
    const data: EventData = {
      run_index: this.runIndex,
      losses_in_row: this.lossesInRow,
      resumed: this.resumed,
      control: this.settings.controlMode,
      touch: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    };
    if (this.sinceLastRun >= 0) data.since_last_run_sec = this.sinceLastRun;
    return data;
  }

  /**
   * Ticks the run has been played. A level counts its own: its tick moves only with the world,
   * which stands between moves.
   */
  private played(): number {
    return this.state.levelRun ? this.levelTicks : this.state.tick;
  }

  /** How long the run has been played, in seconds. */
  private seconds(): number {
    return Math.round((this.played() * this.state.config.tickMs) / 1000);
  }

  /** The code of the level being played, or last played: a piece of the road has its own. */
  private levelId(): string {
    return this.piece !== null ? ROAD[this.piece].id : LEVELS[this.levelIndex].id;
  }

  /** What the platform calls the thing being played: a kind of session, a task, or a level. */
  private levelName(): string {
    if (this.kind === 'level') return `level_${this.levelId()}`;
    return this.kind === 'puzzle' ? `task_${PUZZLE_LEVELS[this.puzzleIndex].id}` : this.kind;
  }

  /** How a try at a level stands, for the analytics: the moves made against the fewest known, the moves taken back, which try it is. */
  private levelTry(): EventData {
    const run = this.state.levelRun!;
    const { spec } = run;
    return {
      moves: run.moves,
      left: Math.max(0, spec.moves - run.moves),
      limit: spec.moves,
      par: spec.par ?? 0,
      undos: (spec.undos ?? LEVEL_UNDOS) - this.undosLeft,
      try: this.levelRecord()?.tries ?? 1,
    };
  }

  /** What is kept of the level on the board, try after try: a piece of the road keeps its own, under its code, as a level of the list does. */
  private levelRecord(): LevelStat | null {
    const run = this.state.levelRun;
    return run ? levelStat(this.settings, run.spec.id) : null;
  }

  /** What is being played, as the analytics name it: a kind of session, the exercise, a task with its number, or a level. */
  private step(): EventData {
    if (this.kind === 'level' && this.piece !== null) return { step_id: `level_${this.levelId()}` };
    if (this.kind === 'level') return { step_id: `level_${this.levelId()}`, step_index: this.levelIndex + 1 };
    if (this.kind !== 'puzzle') return { step_id: this.kind };
    return { step_id: 'task', step_index: this.puzzleIndex + 1, level_id: PUZZLE_LEVELS[this.puzzleIndex].id };
  }

  /** A run that is left before its end is noted, with how far it got. */
  private leaveRun(how: 'menu' | 'restart'): void {
    // What was owed of the board is said before anything is said of leaving it.
    this.later.flush();
    if (!this.opened || this.inMenu || this.handoff || this.state.over || this.state.tick === 0) return;
    const { state } = this;
    const reached: EventData = state.puzzle
      ? { moves: state.puzzle.moves }
      : state.levelRun
        ? this.levelTry()
        : state.tutorial
          ? { lesson: state.tutorial.step }
          : { ...runSummary(state, this.tally), ...this.visit() };
    track('progression_failed', { ...this.step(), reason: how === 'menu' ? 'left' : 'restart', duration_sec: this.seconds(), ...reached });
    // A run given up is not one to come back to.
    this.dropRun();
    this.frames.flush(this.lastFrame);
  }

  /**
   * The best score a session is measured against: of all time for the session without a
   * limit, of one day for the session of the day.
   */
  private bestScore(mode: Scored, date = dayAt(platformNow()).date): number {
    return mode === 'timed' ? bestOn(this.settings, this.recordKey('timed'), date) : bestOf(this.settings, this.recordKey('endless'), 'score');
  }

  /** A tool of development lies over the canvas and takes the input. */
  private get toolsOpen(): boolean {
    return this.tools?.visible ?? false;
  }

  private get state(): RunState {
    return this.runner.state;
  }

  private now(): number {
    return this.played() * this.state.config.tickMs;
  }

  /**
   * The page has just stood still for work of its own, between two frames: the next frame does
   * not count that time. A roll lasts a fifth of a second, and a frame given that much time at
   * once plays all of it between two pictures: the die is seen where it stood and where it lands.
   */
  private stalled(): void {
    this.lastFrame = 0;
  }

  private inputEnabled(): boolean {
    return !this.paused && !this.state.over && !this.toolsOpen && !this.shell.visible && !this.signal.busy && !this.passage;
  }

  /**
   * Records are kept per kind of session. The rules everyone has keep one log through all
   * their versions: a new version does not start it from nothing. Rules with something switched
   * keep a log of their own. The exercise keeps rules of its own and is not scored: while it is
   * on the board, the key is the one of the session it leads to.
   */
  private recordKey(mode: 'endless' | 'timed'): string {
    const config = this.state.tutorial ? defaultConfig(this.settings.experiments) : this.state.config;
    const rules = ruleKey(config);
    return rules === ruleKey(defaultConfig()) ? mode : `${mode}/${rules}`;
  }

  /** The table the current run counts towards; the tutorial shows Endless. */
  private currentRecordKey(): string {
    return this.recordKey(this.state.mode === 'timed' ? 'timed' : 'endless');
  }

  /** Points the camera; the swipes follow the way the board now lies on screen. */
  private applyCamera(): void {
    this.view.setCamera(this.settings.camera);
    const at = (dir: Dir) => this.view.screenDir(dir);
    this.swipeDirs = leanDirs({ N: at('N'), E: at('E'), S: at('S'), W: at('W') }, this.settings.camera.swipeTilt);
  }

  /** `start` builds the board around a cell and raises it from the floor: the tutorial's hand-off. */
  private startRun(kind: RunKind = this.kind, start?: { x: number; z: number }): void {
    if (kind === 'puzzle') {
      this.startPuzzle(this.puzzleIndex);
      return;
    }
    if (kind === 'level') {
      if (this.piece !== null) this.startPiece(this.piece);
      else this.startLevel(this.levelIndex);
      return;
    }
    this.kind = kind;
    const { experiments } = this.settings;
    const tutorial = kind === 'tutorial';
    this.day = dayAt(platformNow());
    // The session with a limit is the session of the day: everyone is dealt it from one seed.
    const seed = kind === 'timed' ? this.day.seed : (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    const config = defaultConfig(experiments, this.settings.tuning);
    if (start) {
      config.startX = start.x;
      config.startZ = start.z;
    }
    this.begin(createRun({ seed, config, tutorial, timed: kind === 'timed' }), start !== undefined);
    this.resumed = false;
    if (this.opened && (kind === 'endless' || kind === 'timed')) {
      // The table of the platform is asked for now, so that it is here when the session ends and goes up it.
      if (hasBoard()) this.loadBoards();
      this.runIndex++;
      this.sinceLastRun = this.lastRunEnd > 0 ? Math.round((Date.now() - this.lastRunEnd) / 1000) : -1;
    }
    if (this.opened) {
      track('progression_started', this.step());
      tell('level_started', kind);
    }
    // Now and then something is seen before the session, for less than a second. Not before
    // the first frame: that run is only set up behind the boot.
    if (!tutorial && !start && this.lastFrame > 0) this.signal.glimpse();
    if (tutorial) {
      // The one-time hints of a normal run pick up where the tutorial stops.
      this.settings.hintsSeen = [];
    }
    this.layoutGuide();
  }

  /** Puts a new run on the board and clears away what the previous one left on screen. */
  private begin(state: RunState, riseIn: boolean): void {
    this.leaveRun('restart');
    // A board put on in the middle of a passage ends it: its dice stand as the rules have them.
    this.view.setPassing(null);
    this.passage = null;
    this.outcome = null;
    this.tally.reset();
    this.runner = new Runner(state);
    this.applyCamera();
    // A board lies at the start of the world and is put in its frame at once; one that a passage
    // leads to is laid with its starting cell on the cell the player stands on, and the camera
    // is given its time to come to it.
    const { landing } = this;
    this.landing = null;
    const origin = landing ? shiftFor(landing.player, landing.origin, state.player) : { x: 0, z: 0 };
    this.view.setBoard({ size: state.config.size, holes: state.levelRun?.spec.holes ?? [], origin });
    const frame = this.boardFrame();
    this.view.setFrame(frame, landing ? Number(this.look.board.cameraMs) : 0);
    this.framedAt = frame ? this.view.fitted : -1;
    // A board that is put on has all its lines, whatever was drawn of the lines of the one before.
    this.view.drawGrid(1, true);
    this.history = [];
    this.beforeCommand = null;
    this.levelTicks = 0;
    this.lastMove = null;
    this.failedAt = null;
    this.levelCounted = false;
    this.ghosts = [];
    // Only a piece of the road carries a line over its board; one that begins after it carries none.
    if (!state.levelRun) this.hint = null;
    // Every start of a board is without the line about a dim die; a board that is no level keeps no room for it.
    this.fixedLine = null;
    if (!state.levelRun) this.fixedShown = false;
    // A piece of the road waits with the player; every start of it waits anew.
    this.wait = state.levelRun ? roadWait(state.levelRun.spec.id, this.deadEnds.hurries) : null;
    this.waiting = { dir: null, blink: false };
    // Where every step may be a move that counts, a held direction is one step.
    this.controller.setRepeat(!state.levelRun);
    this.handoff = null;
    this.inMenu = false;
    this.starting = false;
    // A level that waited to be reported and was never played is not reported at all.
    this.unsaid = false;
    this.lastClock = -1;
    this.root.classList.toggle('gesture', this.settings.controlMode === 'gesture');
    this.tools?.showDebugButton(this.settings.debugPanel);
    this.controller.cancel();
    this.ritual.reset();
    this.hold.reset();
    this.lastPeak = 0;
    this.view.reset(riseIn);
    this.audio.reset();
    this.audio.warn(null);
    this.audio.setPaused(false);
    this.paused = false;
    this.resultShown = false;
    this.tools?.hide();
    this.shell.hide();
    this.hud.reset();
    this.hints.reset();
  }

  private startPuzzle(index: number): void {
    const level = PUZZLE_LEVELS[index];
    this.kind = 'puzzle';
    this.puzzleIndex = index;
    this.tryCounted = false;
    // A puzzle keeps the default pace whatever the debug sliders say: nothing in it is timed.
    this.begin(createRun({ seed: 1, config: defaultConfig(this.settings.experiments), puzzle: level }), false);
    track('progression_started', this.step());
    tell('level_started', this.levelName());
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

  /** A level that no dice come to: a move made on it can be taken back, for nothing is learnt by taking it back. */
  private get undoable(): boolean {
    return this.state.levelRun?.spec.arrival === 'none';
  }

  /** The next command, with the board as it stands remembered in case the command is a move that can be taken back. */
  private takeCommand(): Dir | null {
    const cmd = this.controller.take(this.now());
    if (cmd && !this.moved) {
      this.moved = true;
      mark('first-move');
    }
    if (cmd && (this.state.puzzle || this.undoable)) this.beforeCommand = structuredClone(this.state);
    return cmd;
  }

  /**
   * Takes the last move of a level back, with every step made since, while the try has moves to
   * take back. A level that has ended at a dead end is taken back from its result, or from the
   * board while it still stands before its result: it goes on from before the move that ended it.
   */
  private undoLevel(fromResult = false): void {
    const { levelRun, over } = this.state;
    if (!levelRun || !this.undoable || this.inMenu || this.paused || this.passage || this.undosLeft <= 0) return;
    const standing = over && !this.resultShown && deadEnd(this.state);
    if (over !== fromResult && !standing) return;
    const previous = this.history.pop();
    if (!previous) return;
    this.undosLeft--;
    const stat = this.levelRecord();
    if (stat) stat.undos++;
    if (over) {
      // The try is not over after all: it is counted as failed only if it ends failed.
      if (stat) stat.fails = Math.max(0, stat.fails - 1);
      this.levelCounted = false;
    }
    if (fromResult) {
      this.resultShown = false;
      this.shell.hide();
      this.lastFrame = 0;
    }
    this.runner = new Runner(previous);
    this.beforeCommand = null;
    this.lastMove = null;
    // The level goes on: its end is played anew when it comes.
    this.failedAt = null;
    // What was rolled over after the board that is back is not rolled over on it.
    const made = previous.levelRun?.moves ?? 0;
    this.ghosts = this.ghosts.filter((ghost) => ghost.moves <= made);
    this.controller.cancel();
    this.view.reset();
  }

  /** Takes back the last move of what is on the board: a task or a level, each its own way. */
  private undoTask(): void {
    if (this.state.levelRun) this.undoLevel();
    else this.undoPuzzle();
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
      this.shell.showPanel(rulesPanel(lines, { onBack: () => this.showPuzzleLevels() }), true);
      return;
    }
    this.shell.showPanel(
      rulesPanel(lines, {
        onStart: () => {
          this.settings.puzzle.rulesSeen = true;
          saveSettings(this.settings);
          this.startPuzzle(this.nextPuzzle());
        },
        onBack: () => this.showMenu(),
      }),
      true,
    );
  }

  private showPuzzleLevels(): void {
    this.leaveRun('menu');
    this.inMenu = true;
    this.paused = false;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.hints.reset();
    const { tools } = this;
    tools?.hide();
    saveSettings(this.settings);
    const levels = PUZZLE_LEVELS.map((level) => ({
      stars: this.settings.puzzle.stars[level.id] ?? 0,
      tier: t(`tier_${level.tier}` as TextKey),
    }));
    this.shell.showPanel(
      tasksPanel(levels, this.kind === 'puzzle' ? this.puzzleIndex : this.nextPuzzle(), {
        onPick: (index) => this.startPuzzle(index),
        onRules: () => this.showPuzzleRules(false),
        // What was played, as text to pass on: a tool of the playtest, over the list.
        tools:
          import.meta.env.DEV && tools
            ? [{ id: 'stats', label: { native: 'DEV', name: 'STATS' }, action: () => tools.showPuzzleStats(puzzleReport(PUZZLE_LEVELS, this.settings.puzzle.stats), () => tools.hide()) }]
            : [],
        onBack: () => this.showMenu(),
      }),
      true,
    );
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
    track('progression_completed', { ...this.step(), moves, stars, target: level.par, tries: stat.tries, undos: stat.undos, duration_sec: this.seconds() });
    tell('level_completed', this.levelName());
    this.frames.flush(this.lastFrame);
    this.clearedSinceAd++;
    // Once in several cleared tasks the platform may show its advertisement: between two tasks, never over one.
    const then = (next: () => void) => (): void => {
      if (this.clearedSinceAd < this.clearsToAd) {
        next();
        return;
      }
      this.clearedSinceAd = 0;
      this.clearsToAd = tasksToAd();
      this.shell.hide();
      showInterstitial(next);
    };
    this.shell.showPanel(
      clearedPanel(
        { stars, moves, target: level.par, hasNext: this.puzzleIndex + 1 < PUZZLE_LEVELS.length },
        {
          onNext: then(() => this.startPuzzle(this.puzzleIndex + 1)),
          onAgain: then(() => this.startPuzzle(this.puzzleIndex)),
          onTasks: then(() => this.showPuzzleLevels()),
        },
      ),
      false,
    );
  }

  /**
   * A level begins on its board. One that brings a rule opens with a window that says it, when
   * the level is come to from the list or from the level before; started over, it is not said again.
   */
  private startLevel(index: number, intro = false, said = true): void {
    // A level of a chapter that is not open is not started: the list says what its chapter asks for.
    if (this.ladder().locked[index]) {
      this.showLevels();
      return;
    }
    // The level is played with the limit of moves of its chapter; as it is kept, it has none.
    const spec = limitedLevel(LEVELS, index);
    this.levelIndex = index;
    this.piece = null;
    this.runLevel(spec, said);
    if (intro && spec.lesson) this.showLevelIntro(spec.lesson);
  }

  /**
   * A piece of the road begins on its board: a level as any is, with no window before it, no
   * limit of moves and no number.
   */
  private startPiece(index: number, said = true): void {
    this.piece = index;
    this.runLevel(ROAD[index], said);
  }

  /**
   * Puts a level on the board: one of the list or a piece of the road, whichever has just been
   * named as the one in hand. Without `said` its start is not reported: the board only waits, and
   * whoever laid it sees that it is reported when the player plays it.
   */
  private runLevel(spec: LevelSpec, said = true): void {
    this.kind = 'level';
    this.tryCounted = false;
    // A piece that teaches a move carries its line from its start; its room is the board's from the first frame it is framed in.
    const carried = this.piece !== null ? (ROAD_HINTS[spec.id] ?? HINT_PROBE) : null;
    this.hint = carried ? { ...carried, done: false } : null;
    this.fixedShown = false;
    this.deadEnds.begin(spec.id);
    this.view.setClear(this.hintRoom());
    // A level is the same for everyone: it is played by the rules as they are, whatever the player has set.
    this.begin(createRun({ seed: spec.seed, config: defaultConfig(), level: spec }), false);
    // A die laid as leaving sends nothing when it goes: the sound is told of it now.
    this.audio.laid(this.state);
    this.undosLeft = spec.undos ?? LEVEL_UNDOS;
    if (said) this.sayLevelStarted();
    this.layoutGuide();
  }

  /** The level on the board has started: the analytics and the platform are told. */
  private sayLevelStarted(late = false): void {
    const stat = this.levelRecord();
    // What is said is what stands now, whenever it is said.
    const data = { ...this.step(), try: (stat?.tries ?? 0) + 1 };
    const name = this.levelName();
    const say = (): void => {
      const from = performance.now();
      track('progression_started', data);
      tell('level_started', name);
      span('start-said', from, 0);
    };
    // Said from a move, it waits for the move to be over: the frame the die sets off on does nothing for the platform.
    if (late) this.later.after(say);
    else say();
  }

  /**
   * What the program opens on: the board the player will play, stepped back, with no figure on
   * it and nothing moving, under the one command that starts it: the piece of the road the
   * player stopped on, its first for one who is new, and for one who is past the road the first
   * level of the list not yet passed.
   */
  private showStart(): void {
    const { levels } = this.settings;
    const board = startBoard(levels.road, levels.passed[FIRST_ID] === true, this.nextLevel());
    if (board.road !== undefined) this.startPiece(board.road, false);
    else this.startLevel(board.level!, false, false);
    // Neither a launch nor the command starts the level: one who presses the command only to go
    // on to the menu has started none. It is reported as started with the first move or step on it.
    this.unsaid = this.state.levelRun !== null;
    this.paused = true;
    this.starting = true;
    this.audio.setPaused(true);
    this.view.showFigure(false);
    this.shell.showStart(() => {
      // The figure is there on the frame: the dice already stand, and nothing comes up with it.
      this.view.showFigure(true);
      this.starting = false;
      this.paused = false;
      this.shell.hide();
      this.audio.setPaused(false);
      this.lastFrame = 0;
      mark('play');
    });
  }

  /**
   * The frame the board that is on is seen in: null for its own, whole, which the view keeps
   * through every change of the window, and a level of the list has it; for a piece of the road,
   * a frame fitted by the cells of the piece, wherever in their square they lie, and not by the
   * square. In a block of the road that is seen at one scale the cell of the frame is that of
   * the piece of the block whose cells fit the window smallest. Such a frame is counted for the
   * window as it is, and counted again when the window changes.
   */
  private boardFrame(): Frame | null {
    if (!this.state.levelRun || this.piece === null) return null;
    const block = blockOf(this.piece);
    return this.view.frameOfPiece(this.view.shape, block?.oneScale ? ROAD.slice(block.from, block.to + 1) : []);
  }

  /** The numbers of the passage as the look has them now: the owner turns them while the game runs. */
  private readTimes(): PassageTimes {
    const { board } = this.look;
    const { times } = this;
    times.comboStepMs = Number(board.comboStepMs);
    times.comboHoldMs = Number(board.comboHoldMs);
    times.sinkMs = Number(board.sinkMs);
    times.eraseMs = Number(board.eraseMs);
    times.cameraMs = Number(board.cameraMs);
    times.drawMs = Number(board.drawMs);
    times.riseMs = Number(board.riseMs);
    times.riseStepMs = Number(board.riseStepMs);
    return times;
  }

  /**
   * A level is passed: the passage begins. The dice the last combo took light up one after
   * another, the nearest to the player first, and then go under; the dice that were going before
   * it are lit already and go with the last of them. From there the passage leads to the board
   * after this one with no window: the next piece of the road, after its last the level of the
   * list the player goes on with (the first not passed, or the first when all are), the level
   * after a level of the list. Where it leads nowhere - after the last level, or before a chapter
   * that is not open - the window of the level comes when the dice are gone.
   */
  private startPassage(): void {
    const { state, passing } = this;
    const run = state.levelRun!;
    const after = boardAfter(this.piece !== null ? { road: this.piece } : { level: this.levelIndex }, ROAD.length, LEVELS.length, this.nextLevel());
    const next = after && !(after.level !== undefined && this.ladder().locked[after.level]) ? after : null;
    this.frames.flush(this.lastFrame);
    const { cubes } = state;
    // A die the combo has just taken has not begun to go down: it stands as it stood until its turn to light up.
    const fresh = cubes.map((cube) => cube.state === 'sinking' && cube.t <= 1);
    const order = orderOf(cubes.map(({ x, z }, i) => ({ x, z, late: !fresh[i] })), state.player);
    passing.mode = 'leave';
    passing.ranks.clear();
    order.forEach((die, rank) => passing.ranks.set(cubes[die].id, rank));
    passing.count = fresh.filter(Boolean).length;
    passing.stair = -1;
    passing.litMs = 0;
    passing.moveMs = -1;
    this.passage = {
      elapsed: 0,
      next,
      counts: { combo: passing.count, dice: 0, stair: false },
      swapped: false,
      beaten: false,
      lit: 0,
      gone: 0,
      risen: 0,
      order: order.map((die) => cubes[die].id),
      cell: 0,
      // A board says what it came to in a line of its readings, a piece of the road as a level of the list.
      outcome: run.spec.par !== undefined ? { stars: levelStars(run.moves, run.spec.par), moves: run.moves } : null,
    };
    this.view.setPassing(passing);
  }

  /**
   * The passage, frame by frame, `dt` milliseconds on from the last. It is neither hurried by a
   * press nor paused, and it reads its numbers from the look on every frame. The dice of the
   * combo light up, each with a note a step higher than the last, and stand lit; the board
   * answers them, and they go under one after another; the lines of the board are erased
   * towards the cell the player stands on, and what the board came to is said in the readings
   * from then on; the next board is put on with its starting cell on that cell, the camera sets
   * off for it, and its lines are drawn from the cell; its dice come up, the nearest first; and
   * the board is the player's. The figure is on screen all the while, and neither board is on
   * screen with the other.
   */
  private runPassage(dt: number): void {
    const passage = this.passage!;
    const { passing } = this;
    const reduced = prefersReducedMotion(this.settings);
    const times = this.readTimes();
    passage.elapsed += Math.min(dt, PASSAGE_STEP_MS);
    const now = passageAt(passage.elapsed, times, passage.counts, reduced, this.passageNow);
    const marks = passageMarks(times, passage.counts, reduced, this.marksNow);
    if (!passage.swapped) {
      passing.stepMs = times.comboStepMs;
      passing.moveForMs = times.sinkMs;
      passing.flashMs = times.comboHoldMs;
      passing.litMs = passage.elapsed;
      passing.moveMs = passage.elapsed - marks.sink;
      // A die lights up on a note of its face: the first as a combo begins, each one after it a link higher, as a chain climbs.
      for (; passage.lit < now.lit; passage.lit++) {
        const face = getCube(this.state, passage.order[passage.lit])?.ori.top ?? 1;
        this.audio.play(
          passage.lit === 0 ? { kind: 'group', face, count: 1, tier: 0, pan: 0 } : { kind: 'chain', face, chain: passage.lit + 1, count: 1, tier: 0, pan: 0 },
        );
      }
      if (now.phase === 'combo') return;
      if (!passage.beaten) {
        passage.beaten = true;
        this.answerPassed();
      }
      // A die that has gone under is heard as one that goes under in a session.
      for (; passage.gone < passage.order.length && goneShare(passing, passage.gone) >= 1; passage.gone++) {
        const face = getCube(this.state, passage.order[passage.gone])?.ori.top ?? 1;
        this.audio.play({ kind: 'sunk', face, pan: 0 });
      }
      if (now.phase === 'sink') return;
      if (!passage.next) {
        // The passage leads nowhere: the window of the level, over a board whose dice are gone.
        this.passage = null;
        this.showLevelResult();
        return;
      }
      this.outcome = passage.outcome;
      if (!now.swapped) {
        const { player } = this.state;
        if (passage.cell === 0) {
          // The cell of the player stays when every other line is erased: it is one part of the wave from it.
          this.view.drawGrid(1, false, player);
          passage.cell = 1 / this.view.gridParts;
        }
        this.view.drawGrid(passage.cell + (1 - passage.cell) * now.lines, false, player);
        return;
      }
      this.putNext(passage);
    }
    const { player } = this.state;
    passing.stepMs = times.riseStepMs;
    passing.moveForMs = times.riseMs;
    // With motion kept low the dice of the board do not come up: they stand.
    passing.moveMs = reduced ? Infinity : passage.elapsed - marks.rise;
    this.view.drawGrid(passage.cell + (1 - passage.cell) * now.lines, true, player);
    // A die that stands is heard as one that has come up in a session, and settles as one. With motion kept low
    // the dice of the board all stand in one frame, and one note is played for the board, not one for each die.
    let heard = false;
    for (; passage.risen < now.risen; passage.risen++) {
      const cube = getCube(this.state, passage.order[passage.risen]);
      if (!cube) continue;
      if (cube.state === 'idle') this.view.stood(cube.id);
      if (!reduced || !heard) this.audio.play({ kind: 'risen', face: cube.ori.top, pan: 0 });
      heard = true;
    }
    if (now.phase !== 'done') return;
    this.view.drawGrid(1, true);
    this.view.setPassing(null);
    this.passage = null;
    // What was pressed while the board was coming is not a move on it.
    this.controller.cancel();
  }

  /**
   * The board answers the dice of a level that is passed as they begin to go: light runs over
   * its lines, with the beat of a chain, from where the dice stand.
   */
  private answerPassed(): void {
    const { state } = this;
    // The face sent last: that of the die that joined its group latest.
    const last = state.cubes.reduce<(typeof state.cubes)[number] | null>((latest, cube) => (!latest || cube.t < latest.t ? cube : latest), null);
    const value = last?.ori.top ?? 0;
    this.view.answer(value);
    this.beat({ kind: 'chain', value, tier: FINALE_TIER, cells: state.cubes.map(({ x, z }) => ({ x, z })), points: 0, chain: FINALE_CHAIN });
  }

  /**
   * The next board of the passage is put on, once: laid with its starting cell on the cell the
   * player stands on, so that the figure does not move, with the camera given its time to come
   * to it. Its dice are under the floor and its lines are the cell of the player alone; they
   * come in the order of their turns, the nearest to the player first and a stair, a die laid
   * as leaving, last.
   */
  private putNext(passage: NonNullable<Game['passage']>): void {
    const { passing } = this;
    const next = passage.next!;
    const before = this.state.player;
    const { origin } = this.view.shape;
    this.landing = { player: { x: before.x, z: before.z }, origin: { x: origin.x, z: origin.z } };
    if (next.road !== undefined) this.startPiece(next.road);
    else this.startLevel(next.level!);
    this.landing = null;
    // Putting a board on ends a passage; this one goes on over it, and what the board before came to is still said.
    this.passage = passage;
    this.outcome = passage.outcome;
    passage.swapped = true;
    const { state } = this;
    const { cubes, player } = state;
    const layout = state.levelRun?.spec.layout;
    const laid = layout?.leaving?.[0];
    const stair = laid ? cubeAt(state, layout!.dice[laid.die].x, layout!.dice[laid.die].z) : undefined;
    const order = orderOf(cubes.map((cube) => ({ x: cube.x, z: cube.z, late: cube === stair })), player);
    passing.mode = 'come';
    passing.ranks.clear();
    order.forEach((die, rank) => passing.ranks.set(cubes[die].id, rank));
    passing.count = cubes.length;
    passing.stair = stair?.id ?? -1;
    passing.litMs = 0;
    passing.flashMs = 0;
    passing.moveMs = -1;
    passage.counts.dice = cubes.length;
    passage.counts.stair = stair !== undefined;
    passage.order = order.map((die) => cubes[die].id);
    this.view.setPassing(passing);
    // The wave of its lines starts from the cell of the player, which is there from the first.
    this.view.drawGrid(1, true, player);
    passage.cell = 1 / this.view.gridParts;
    // The frame the passage is on is the next board's from here.
    passageAt(passage.elapsed, this.times, passage.counts, prefersReducedMotion(this.settings), this.passageNow);
    passageMarks(this.times, passage.counts, prefersReducedMotion(this.settings), this.marksNow);
  }

  /**
   * The window a level with a rule opens with: what the assistant of the laboratory says of it,
   * in the language of the player, a message at a time, printed out. The printing is heard: the
   * program clicks what it prints, and the words that are not the laboratory's are sung as the
   * other side sings. The level waits under the window and begins when the last message is left.
   */
  private showLevelIntro(lesson: string, page = 0): void {
    this.paused = true;
    this.audio.setPaused(true);
    const messages = messagesOf(t(lesson as TextKey));
    const said = messages[Math.min(Math.max(0, page), messages.length - 1)];
    this.shell.showPanel(
      levelIntroPanel(
        { number: this.levelIndex + 1, pages: messages.map((message) => message.text), page, still: prefersReducedMotion(this.settings) },
        {
          onPage: (next) => this.showLevelIntro(lesson, next),
          onStart: () => {
            this.paused = false;
            this.shell.hide();
            this.audio.setPaused(false);
            this.lastFrame = 0;
          },
          onBack: () => this.showLevels(),
          onSign: (index) => {
            const sign = said?.text[index];
            if (sign === undefined) return;
            if (said.other[index]) this.audio.sign(sign);
            else if (index % TYPED_EVERY === 0) this.audio.typed(sign);
          },
        },
      ),
      false,
    );
  }

  /**
   * The rules of the level that waits, to read again from its pause: the rule every window of
   * the levels up to it has left behind, each in a line of its own, a few to a window. Back
   * leads to the pause.
   */
  private showLevelRules(page = 0): void {
    const lines = this.levelRules();
    this.shell.showPanel(levelRulesPanel(lines, page, { onPage: (next) => this.showLevelRules(next), onBack: () => this.showPause() }), false);
  }

  /** The rules the levels up to the one that waits have said, each in a line: none where no level says a rule. */
  private levelRules(): string[] {
    return lessonsAt(LEVELS, this.levelIndex).flatMap((lesson) => {
      const rule = ruleOf(lesson);
      return rule ? [t(rule)] : [];
    });
  }

  private restartLevel(): void {
    if (!this.state.levelRun || this.inMenu || this.passage) return;
    saveSettings(this.settings);
    this.startRun('level');
  }

  /** Starts over what is on the board: a task or a level, each its own way. */
  private restartTask(): void {
    if (this.state.levelRun) this.restartLevel();
    else this.restartPuzzle();
  }

  /** How the player stands on the ladder: the stars of every level, by the fewest moves it was passed in, and the chapters they open. */
  private ladder(): LadderProgress {
    return ladderProgress(LEVELS, (id) => this.settings.levels.stats[id]?.bestMoves, LEVEL_GATES);
  }

  /** First level that has not been passed and can be played; the first one when there is none. */
  private nextLevel(): number {
    const { locked } = this.ladder();
    const open = LEVELS.findIndex((level, index) => !this.settings.levels.passed[level.id] && !locked[index]);
    return open === -1 ? 0 : open;
  }

  private showLevels(): void {
    this.leaveRun('menu');
    this.inMenu = true;
    this.paused = false;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.hints.reset();
    this.tools?.hide();
    saveSettings(this.settings);
    const ladder = this.ladder();
    const levels = LEVELS.map((level, index) => ({
      passed: this.settings.levels.passed[level.id] === true,
      goal: goalOf(level),
      faces: level.faces,
      stars: ladder.stars[index],
      locked: ladder.locked[index] ? { have: ladder.total, need: ladder.chapters[ladder.chapterOf(index)].gate } : undefined,
    }));
    this.shell.showPanel(
      levelsPanel(levels, this.kind === 'level' && this.piece === null ? this.levelIndex : this.nextLevel(), {
        onPick: (index) => this.startLevel(index, true),
        // What was played, as text to pass on: the report of the playtest.
        share: { label: () => this.shareLabel(), action: () => this.shareLevels() },
        onBack: () => this.showMenu(),
      }),
      true,
    );
  }

  /**
   * A level is over: its board is cleared, or it has come to a dead end, or, with moves that are
   * limited, they are spent. What it came to is written down at once: its window comes a moment
   * later, and the level may be started over or left before it does.
   */
  private countLevel(): void {
    this.later.flush();
    this.levelCounted = true;
    const { state } = this;
    const run = state.levelRun!;
    const { spec } = run;
    const passed = state.endReason === 'passed';
    const stuck = !passed && deadEnd(state);
    const left = Math.max(0, spec.moves - run.moves);
    const short = shortOf(state);
    const stat = levelStat(this.settings, spec.id);
    const summary: EventData = { ...this.step(), ...this.levelTry(), duration_sec: this.seconds() };
    if (passed) {
      stat.passes++;
      stat.firstPassTry ??= stat.tries;
      stat.bestLeft = Math.max(stat.bestLeft ?? 0, left);
      stat.bestMoves = Math.min(stat.bestMoves ?? run.moves, run.moves);
      this.settings.levels.passed[spec.id] = true;
      // The piece of the road the player is on, passed, moves their place to the piece after it; a piece
      // played by its address, further on or behind, moves nothing, and neither does any for one past the road.
      if (this.piece !== null) {
        this.deadEnds.forget();
        const { levels } = this.settings;
        levels.road = placeAfter(levels.road, levels.passed[FIRST_ID] === true, this.piece);
      }
    } else {
      stat.fails++;
      if (stuck) stat.stuck++;
      else noteShort(stat, short);
      // A piece of the road that comes to a dead end again shows the sign of its way at once, on the board it is taken back to or started over on.
      if (stuck && this.piece !== null) {
        this.deadEnds.reach();
        if (this.wait) this.wait.hurry = this.deadEnds.hurries;
      }
    }
    saveSettings(this.settings);
    if (passed) track('progression_completed', { ...summary, stars: levelStars(run.moves, spec.par) });
    else track('progression_failed', { ...summary, reason: stuck ? 'stuck' : 'moves', short });
    tell(passed ? 'level_completed' : 'level_failed', this.levelName());
  }

  /**
   * The window of a level that is over. A dead end can be taken back from here while the try has
   * moves to take back. No advertisement comes between levels.
   */
  private showLevelResult(): void {
    const { state } = this;
    const run = state.levelRun!;
    const { spec } = run;
    const passed = state.endReason === 'passed';
    const end = passed ? null : levelDeadEnd(state);
    const stuck = end !== null;
    const left = Math.max(0, spec.moves - run.moves);
    const short = shortOf(state);
    const lines: GoalLine[] = goalLines(state);
    const stat = this.levelRecord();
    this.frames.flush(this.lastFrame);
    const canUndo = stuck && this.undoable && this.undosLeft > 0 && this.history.length > 0;
    this.shell.showPanel(
      levelResultPanel(
        {
          passed,
          left: spec.moves > 0 ? left : null,
          moves: run.moves,
          best: stat?.bestMoves ?? null,
          // A level whose fewest moves are known is rated by its moves.
          stars: passed && stat && spec.par !== undefined ? levelStars(run.moves, spec.par) : undefined,
          goal: lines,
          // The level after the last of a chapter is offered once its chapter is open.
          hasNext: this.piece === null && this.levelIndex + 1 < LEVELS.length && !this.ladder().locked[this.levelIndex + 1],
          // A level that is failed says why: at a dead end, the dice that stand against the dice a combo takes.
          reason: passed
            ? undefined
            : end !== null
              ? end === 'count'
                ? t('levelStuck').replace('{left}', String(short)).replace('{need}', String(smallestGroup(spec)))
                : t(DEAD_END_LINE[end])
              : t('levelShort').replace('{short}', String(short)),
          undos: canUndo ? this.undosLeft : 0,
        },
        {
          onNext: () => this.startLevel(this.levelIndex + 1, true),
          onAgain: () => this.startRun('level'),
          onLevels: () => this.showLevels(),
          onUndo: () => this.undoLevel(true),
        },
      ),
      false,
    );
  }

  /** The part of the window the board has, in CSS pixels. */
  private stageRect(): Rect {
    const box = this.stage.getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height };
  }

  /**
   * Lays the board out below the words of the exercise, so they never cover it. Outside the
   * exercise the board has the whole stage.
   */
  private layoutGuide(): void {
    const active = this.state.tutorial !== null && !this.inMenu;
    this.view.setClear(active ? this.hud.reserve(this.stageRect()) + GUIDE_GAP_PX : this.inMenu ? 0 : this.hintRoom());
  }

  /**
   * How much of the top of the stage the line of a hint keeps, in CSS pixels, whether it is still
   * shown or has gone out: the board does not move when it goes. None where the piece has none.
   */
  private hintRoom(): number {
    const stage = this.stageRect();
    return Math.max(0, ...roomLines(this.hint?.key ?? null, this.fixedShown).map((key) => this.hud.hintRoom(stage, t(key))));
  }

  /**
   * What the exercise asks for at this moment: for the interface, its words, the input, the
   * count of the group; for the board, the arrows and frames drawn on it; for the net of the
   * die, the side to bring on top.
   */
  private updateGuide(state: RunState, stage: Rect): { board: BoardGuide | null; lesson: HudLesson | null; mark: MarkFace | null } {
    const view = this.inMenu ? null : tutorialView(state);
    if (!view) return { board: null, lesson: null, mark: null };
    const { mark, counter } = view;
    // Off the short way of the lesson, the way shown is the one found from where the player is.
    const path = view.astray && !state.player.action ? (this.wayBack?.path ?? []) : view.path;
    const dir = path[0] ?? null;
    let glyph: HudLesson['glyph'] = 'none';
    if (dir !== null) {
      if (!coarsePointer) glyph = 'keys';
      // With buttons on screen the pulsing side of the net is the prompt.
      else if (this.settings.controlMode === 'gesture') glyph = 'swipe';
    }
    const over = (x: number, y: number, z: number) => {
      const p = this.view.project(x, y, z);
      return { x: Math.round(stage.x + p.x), y: Math.round(stage.y + p.y) };
    };
    const lesson: HudLesson = {
      number: view.value === 1 ? LESSONS : view.value - 1,
      count: LESSONS,
      value: view.value,
      line: t(`tut_${view.line}` as TextKey),
      waits: view.waits,
      counter: counter && { value: view.value, have: counter.have, need: counter.need, at: over(counter.x, 1.5, counter.z) },
      // A face on the bottom cannot be lit: the sum of opposite faces says what it is.
      seven: mark?.face === 'bottom' ? over(mark.x, 2.25, mark.z) : null,
      glyph,
      dir,
      screen: dir ? this.swipeDirs[dir] : null,
    };

    // Arrows lie on the floor of the cell to go to, where it can be seen. A step onto another
    // die, or north into the cell the player's own die hides, is drawn at the height of the dice.
    const { player } = state;
    const onDie = player.level === 'top';
    const own = mark && mark.x === player.x && mark.z === player.z ? mark.face : null;
    const arrows: GuideArrow[] = [];
    let { x, z } = player;
    path.forEach((step, i) => {
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
    return { board: { arrows, frames }, lesson, mark: own };
  }

  /** The side of the seal a swipe being read points at; after a flick it stays lit for a moment. */
  private sealLit(time: number): Dir | null {
    const live = this.inputEnabled() ? this.tracker.direction : null;
    if (live) this.sealLight = { dir: live, until: time + SEAL_LINGER_MS };
    else if (this.sealLight && (time > this.sealLight.until || !this.inputEnabled())) this.sealLight = null;
    return this.sealLight?.dir ?? null;
  }

  /** Leaves the tutorial for a normal run, from where the player stands. */
  private skipTutorial(): void {
    if (!this.state.tutorial || this.inMenu) return;
    this.settings.tutorialDone = true;
    saveSettings(this.settings);
    track('progression_failed', { step_id: 'tutorial', reason: 'skipped', lesson: this.state.tutorial.step, duration_sec: this.seconds() });
    this.handoff = { x: this.state.player.x, z: this.state.player.z };
  }

  /**
   * How the game is played, from the menu: the pieces of the road by number, every one open, the
   * focus on the one the player is on. A piece picked starts as it does by its address, with no
   * screen before it, and the road goes on from it; the place that is kept moves only as it does
   * anywhere (`placeAfter`). `home` is the command of the list the player has come back from.
   */
  private showRoad(home?: string): void {
    this.leaveRun('menu');
    this.inMenu = true;
    this.paused = false;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.hints.reset();
    this.tools?.hide();
    saveSettings(this.settings);
    const { levels } = this.settings;
    this.shell.showPanel(
      roadPanel(roadCells(levels), roadFocus(levels.road, levels.passed[FIRST_ID] === true), {
        onPick: (index) => this.startPiece(index),
        onRules: () => this.showHowTo(),
        onBack: () => this.showMenu('howto'),
        home,
      }),
      true,
    );
  }

  /** The rules that hold everywhere, a few to a window: read from the list of the pieces of the road, and back leads to it. */
  private showHowTo(page = 0): void {
    const lines = HOW_TO_PLAY.map((key) => t(key).replace(/\n/g, ' '));
    this.shell.showPanel(levelRulesPanel(lines, page, { onPage: (next) => this.showHowTo(next), onBack: () => this.showRoad('rules') }, PANELS.howto), true);
  }

  /** What a file of the menu opens (`FILE_LEADS`). */
  private open(lead: FileLead): void {
    switch (lead) {
      case 'levels':
        return this.showLevels();
      case 'endless':
        return this.startRun('endless');
      case 'road':
        return this.showRoad();
      case 'readme':
        return this.showReadme();
      case 'records':
        return this.showRecords(() => this.showMenu());
      case 'system':
        return this.showSystem(() => this.showMenu());
    }
  }

  /** The note that came with the program, from the menu: a page to a window. Back leads to the menu. */
  private showReadme(page = 0): void {
    // A screen that lies on its side and is low holds a paragraph or two, not a page.
    const low = this.display.width > this.display.height && this.display.height < README_LOW;
    this.shell.showPanel(readmePanel(readmePages(language(), low ? README_SIGNS : undefined), page, { onPage: (next) => this.showReadme(next), onBack: () => this.showMenu('readme') }), true);
  }

  /** The main menu. `home` is the file of it the player has come back from: the figure waits there. */
  private showMenu(home?: string): void {
    this.leaveRun('menu');
    this.inMenu = true;
    this.paused = false;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.hints.reset();
    this.layoutGuide();
    // The menu is the shell's; a tool of the page that led here goes away.
    this.tools?.hide();
    // The session with a limit lasts as long as the rules say: the menu reads it from them.
    const rules = defaultConfig(this.settings.experiments, this.settings.tuning);
    this.shell.showMenu(
      {
        onEndless: () => this.open(FILE_LEADS.protocol),
        // The levels stand in the menu where the session of the day stood: the file opens their list. The
        // pieces of the road are listed in the file that says how the game is played.
        onLevels: () => this.open(FILE_LEADS.levels),
        onHowTo: () => this.open(FILE_LEADS.howto),
        onReadme: () => this.open(FILE_LEADS.readme),
        onRecords: () => this.open(FILE_LEADS.records),
        onSystem: () => this.open(FILE_LEADS.system),
      },
      {
        bestEndless: this.bestScore('endless'),
        levelsDone: LEVELS.filter((level) => this.settings.levels.passed[level.id] === true).length,
        levelsTotal: LEVELS.length,
        limitSec: (rules.timedTicks * rules.tickMs) / 1000,
        roadDone: roadDone(this.settings.levels),
        roadTotal: ROAD.length,
        sessions: Object.values(this.settings.runs).reduce((sum, runs) => sum + runs.length, 0),
      },
      home,
    );
  }

  private togglePause(): void {
    if (this.state.over || this.inMenu) return;
    if (this.paused) this.resume();
    else this.pause();
  }

  private pause(): void {
    // The passage between two boards is not paused: it is over in a moment, and the board waits then.
    if (this.paused || this.inMenu || this.state.over || this.passage) return;
    this.paused = true;
    this.controller.cancel();
    this.audio.setPaused(true);
    this.later.flush();
    // A level that has not been reported as started is not reported as paused, nor as going on again.
    if (!this.unsaid) tell('level_paused', this.levelName());
    this.showPause();
  }

  private resume(): void {
    this.paused = false;
    this.tools?.hide();
    this.shell.hide();
    this.audio.setPaused(false);
    if (!this.unsaid) tell('level_resumed', this.levelName());
    this.lastFrame = 0;
  }

  private showPause(): void {
    // A task and a level have no log of sessions: from their pause the way leads back to their list.
    const level = Boolean(this.state.levelRun);
    this.shell.showPanel(
      pausePanel({
        task: this.state.puzzle !== null || level,
        list: level ? COMMANDS.levels : undefined,
        onResume: () => this.resume(),
        onRestart: () => this.startRun(),
        // A level has its rules to read again only where the levels up to it have said some; a piece of the road has none.
        onRules: level && this.piece === null && this.levelRules().length > 0 ? () => this.showLevelRules() : undefined,
        onRecords: () => this.showRecords(() => this.showPause()),
        onTasks: () => (level ? this.showLevels() : this.showPuzzleLevels()),
        onSystem: () => this.showSystem(() => this.showPause()),
        onMenu: () => this.showMenu(),
      }),
      false,
    );
  }

  /** Asks the platform for its tables of players. The log is drawn again when they come. */
  private loadBoards(): void {
    for (const mode of SCORED) {
      if (!Array.isArray(this.boards.get(mode))) this.boards.set(mode, 'waiting');
      void boardEntries(mode)
        .then(
          (entries) => this.boards.set(mode, entries),
          () => this.boards.set(mode, 'failed'),
        )
        .then(() => this.shell.touch());
    }
  }

  /**
   * The players the platform has in its table of a kind of session, as far as the table has
   * come. The table of the session of the day is that of `day` alone.
   */
  private players(mode: Scored, day: Day): readonly PlayerLine[] {
    const board = this.boards.get(mode);
    if (board === undefined || typeof board === 'string') return [];
    if (mode === 'endless') return board;
    return board
      .map((entry) => ({ entry, kept: readDailyValue(entry.score) }))
      .filter(({ kept }) => kept.day === day.index)
      .map(({ entry, kept }) => ({ ...entry, score: kept.score }));
  }

  /**
   * The name the player's line of the log goes under: the one they have in the table of the
   * platform, where it keeps one; anywhere else the line says whose it is.
   */
  private ownName(): string {
    // A table that already has a line of the player knows best what they are called there.
    for (const mode of SCORED) {
      const board = this.boards.get(mode);
      const mine = board === undefined || typeof board === 'string' ? undefined : board.find((entry) => entry.own && entry.name !== '');
      if (mine) return mine.name;
    }
    return (hasBoard() ? playerName() : null) ?? word(RECORDS.you);
  }

  /**
   * The log of a kind of session as it stands now: the made-up players it is filled with, the
   * players of the platform, and the one who plays, best first.
   */
  private log(mode: Scored, day: Day = dayAt(platformNow())): Standing[] {
    const now = platformNow();
    const archive = mode === 'timed' ? dailyArchive(day, now) : endlessArchive(now);
    return standings(archive, this.players(mode, day), { name: this.ownName(), score: this.bestScore(mode, day.date) });
  }

  private showRecords(back: () => void): void {
    const shared = hasBoard();
    if (shared) this.loadBoards();
    track('records_opened', { network: shared });
    this.shell.showPanel(
      recordsPanel(
        (section) => {
          const mode = SCORED[section];
          const day = dayAt(platformNow());
          const board = this.boards.get(mode);
          return {
            lines: this.log(mode, day),
            link: shared && typeof board === 'string' ? board : null,
            day: mode === 'timed' ? eraDate(day.date) : null,
          };
        },
        this.state.mode === 'timed' ? 1 : 0,
        {
          onBack: back,
          // A guest is given a name by the platform's own sign-in; the log opens again with what it says.
          onRegister: canRegister()
            ? () =>
                void register().then((known) => {
                  track('player_registered', { known });
                  this.showRecords(back);
                })
            : undefined,
          share: { label: () => this.shareLabel(), action: (section) => this.share(SCORED[section]) },
        },
      ),
      this.inMenu,
    );
  }

  /** What the command of sharing reads: its name, or for a moment what came of the last sending. */
  private shareLabel(): PanelName {
    return this.shared === null ? COMMANDS.share : COMMANDS[this.shared];
  }

  /** Sends out the best the player has in a kind of session, with the address of the game. */
  private share(mode: Scored): void {
    const score = this.bestScore(mode);
    const text = score > 0 ? t('shareScore').replace('{score}', String(score)) : LOGO_TEXT;
    void shareOut(text).then((how) => {
      track('result_shared', { mode, how, score });
      this.noteShared(how);
    });
  }

  /** Sends out what the player did on the levels: the report of the playtest, as text. */
  private shareLevels(): void {
    const report = levelReport(
      LEVELS.map((level, index) => ({ ...level, limit: limitedLevel(LEVELS, index).moves })),
      this.settings.levels.stats,
    );
    void shareOut(report || LEVELS_UNPLAYED).then((how) => {
      track('result_shared', { mode: 'levels', how });
      this.noteShared(how);
    });
  }

  /** The command of sharing reads what came of the sending, for a moment. */
  private noteShared(how: Shared): void {
    this.shared = how;
    this.shell.touch();
    window.clearTimeout(this.sharedTimer);
    this.sharedTimer = window.setTimeout(() => {
      this.shared = null;
      this.shell.touch();
    }, SHARED_MS);
  }

  /** What the player can set: sound, motion, shake, swipes or buttons, the camera. In development the tools of the playtest open from here. */
  private showSystem(back: () => void, home?: string): void {
    const { tools } = this;
    const values = (): SystemValues => ({
      muted: this.settings.muted,
      reducedMotion: prefersReducedMotion(this.settings),
      shake: this.settings.shake,
      control: this.settings.controlMode,
      view: this.settings.view,
      language: language(),
    });
    this.shell.showPanel(
      systemPanel({
        values,
        home,
        // Back from the list of languages the panel stands on the line it was left at.
        onLanguage: () => this.showLanguages(() => this.showSystem(back, 'language')),
        onToggle: (key) => {
          if (key === 'muted') {
            this.settings.muted = !this.settings.muted;
            this.applySound();
          } else if (key === 'reducedMotion') {
            this.settings.reducedMotion = !prefersReducedMotion(this.settings);
          } else if (key === 'shake') {
            this.settings.shake = !this.settings.shake;
          } else if (key === 'view') {
            this.settings.view = this.settings.view === 'full' ? 'auto' : 'full';
          } else {
            this.settings.controlMode = this.settings.controlMode === 'gesture' ? 'dpad' : 'gesture';
            this.root.classList.toggle('gesture', this.settings.controlMode === 'gesture');
          }
          saveSettings(this.settings);
          track('settings_changed', { setting: key, value: String(values()[key]) });
        },
        // The panel of the playtest: a tool of development, over the settings.
        tools:
          import.meta.env.DEV && tools
            ? [
                {
                  id: 'playtest',
                  label: { native: 'DEV', name: 'PLAYTEST' },
                  action: () =>
                    tools.showPlaytest(this.settings, this.state.tick > 0 ? statsText(this.state) : this.lastStats, {
                      onApply: (experiments, mode, debugPanel) => {
                        this.settings.experiments = experiments;
                        this.settings.controlMode = mode;
                        this.settings.debugPanel = debugPanel;
                        saveSettings(this.settings);
                        this.startRun();
                      },
                      onBack: () => tools.hide(),
                      onReplayTutorial: () => {
                        this.settings.hintsSeen = [];
                        this.settings.experiments.guidedStart = true;
                        saveSettings(this.settings);
                        this.startRun('tutorial');
                      },
                    }),
                },
              ]
            : [],
        onBack: back,
      }),
      this.inMenu,
    );
  }

  /** The languages the voice speaks: picking one sets it and goes back to the settings. */
  private showLanguages(back: () => void): void {
    this.shell.showPanel(
      languagePanel({
        languages: LANGUAGES,
        current: language(),
        onPick: (code) => {
          setLanguage(code);
          this.settings.language = code;
          saveSettings(this.settings);
          track('settings_changed', { setting: 'language', value: code });
          // What was put into lines in the language before is put into lines again.
          this.hud.setLessonLines(TUTORIAL_LINES.map((line) => t(`tut_${line}` as TextKey)));
          this.layoutGuide();
          back();
        },
        onBack: back,
      }),
      this.inMenu,
    );
  }

  private showResult(): void {
    const state = this.state;
    // What the playtest reads after a session: kept in development only.
    if (import.meta.env.DEV) this.lastStats = statsText(state);
    const key = this.currentRecordKey();
    const mode: Scored = state.mode === 'timed' ? 'timed' : 'endless';
    // The session of the day is measured against the day it was started on.
    const { day } = this;
    const date = mode === 'timed' ? day.date : dayAt(platformNow()).date;
    let note: string | null = null;
    const scored = state.mode !== 'practice' && !state.config.custom;
    // The log as it stood before this session, and the best the player had in it: on this
    // device or, where the platform knows more, there.
    const before = scored ? this.log(mode, day) : [];
    const previous = scored ? (before.find((line) => line.own)?.score ?? 0) : this.bestScore(mode, day.date);
    const best = scored && state.score > previous;
    // The session goes up that log under the eyes of the player.
    const climb = scored
      ? new Climb(
          { lines: before, score: state.score, name: this.ownName(), record: best, reduced: prefersReducedMotion(this.settings), leadMs: CLIMB_LEAD_MS },
          (event) => this.audio.ui(event),
        )
      : undefined;
    if (state.mode === 'practice') {
      note = t('practiceNote');
    } else if (state.config.custom) {
      note = t('customNote');
    } else {
      addRun(this.settings, key, {
        score: state.score,
        chain: state.maxChain,
        ticks: state.tick,
        date,
      });
      // The run is over: what was kept of it goes out of storage with the record of it.
      const saved = this.saveWithoutRun() && storageAvailable();
      if (!saved) note = t('notSaved');
      // The session of the day says what it is: one for everyone, and new every day.
      else if (mode === 'timed') note = t(best ? 'dailyBest' : 'dailyNote');
      else if (best) note = t('newBest');
      // The table of the platform takes a new best of a session played by the rules everyone has.
      if (best && ruleKey(state.config) === ruleKey(defaultConfig())) {
        // In a table the game draws itself, a score of the session of the day goes with its day.
        // The table is read again once it has the score: the log then shows it as the platform has it.
        void submitScore(mode, mode === 'timed' && hasBoard() ? dailyValue(day.index, state.score) : state.score).then((taken) => {
          if (taken && hasBoard()) this.loadBoards();
        });
        tell('player_got_achievement');
      }
    }
    // What the session came to, for tuning the pace and the spawn: a session with a limit that ran its time is completed, any other end is a failure.
    const summary: EventData = { ...this.step(), ...runSummary(state, this.tally), ...this.visit(), contact: this.ritual.stage, scored, best };
    // The run is over: nothing of it is left to come back to, and the next one knows how this one went.
    this.dropRun();
    this.lossesInRow = state.endReason === 'full' ? this.lossesInRow + 1 : 0;
    this.lastRunEnd = Date.now();
    if (mode === 'timed') summary.day = day.date;
    if (state.endReason === 'time') track('progression_completed', summary);
    else track('progression_failed', { ...summary, reason: state.endReason ?? 'full' });
    this.frames.flush(this.lastFrame);
    tell(state.endReason === 'time' ? 'level_completed' : 'level_failed', this.kind);
    const result = () =>
      this.shell.showPanel(
        resultPanel(
          {
            timeUp: state.endReason === 'time',
            score: state.score,
            best: scored ? Math.max(previous, state.score) : previous,
            before: previous,
            day: mode === 'timed' ? eraDate(day.date) : null,
            maxChain: state.maxChain,
            ticks: state.tick,
            tickMs: state.config.tickMs,
            note,
          },
          {
            onAgain: () => answered(() => this.startRun()),
            onRecords: () => this.showRecords(result),
            onMenu: () => answered(() => this.showMenu()),
          },
          climb,
        ),
        false,
      );
    // The answer to the session comes when the player leaves its result: over the board, and
    // then whatever was asked for. How strong the link got is read then: the ritual keeps it
    // until the next run begins.
    // After it, at the break between sessions, the platform may show its advertisement.
    const answered = (next: () => void): void => {
      this.shell.hide();
      this.signal.answer(this.ritual.stage / CONTACT_STEPS.length, () => showInterstitial(next));
    };
    result();
  }

  private hintOnce(id: TextKey): void {
    // The tutorial speaks for itself, and a puzzle has its own rules; these belong to a normal run.
    if (this.state.tutorial || this.state.puzzle) return;
    if (!this.settings.experiments.guidedStart || this.settings.hintsSeen.includes(id)) return;
    this.settings.hintsSeen.push(id);
    saveSettings(this.settings);
    this.hints.show(t(id));
  }

  /**
   * A change to the run made between ticks: the player has read the words of the exercise, or
   * a lesson is laid out again. What the rules say about it is heard at once, as after a tick.
   */
  private outside(change: (state: RunState) => void): void {
    const { state } = this;
    state.events = [];
    change(state);
    this.view.notify(state.events);
    for (const event of state.events) {
      this.audio.handle(event, state);
      this.onEvent(state, event);
    }
    state.events = [];
  }

  /**
   * A player who has left the short way of a lesson is shown the way from where they are. It
   * is looked for once per position. Where there is none within reach, the lesson cannot be
   * finished from here and is laid out again.
   */
  private keepLesson(): void {
    const { state } = this;
    const view = state.tutorial ? tutorialView(state) : null;
    if (!view?.astray || state.player.action) {
      if (!view?.astray) this.wayBack = null;
      return;
    }
    const { player } = state;
    const dice = state.cubes.map((c) => `${c.x},${c.z},${c.ori.top}${c.ori.north}${c.state[0]}`).join(';');
    const key = `${state.tutorial!.step}|${player.x},${player.z},${player.level}|${dice}`;
    if (this.wayBack?.key === key) return;
    const path = tutorialHint(state);
    if (path) {
      this.wayBack = { key, path };
      return;
    }
    this.wayBack = null;
    this.outside((s) => tutorialRestart(s));
    this.hud.nudge(this.lastFrame);
  }

  private onTick(state: RunState): void {
    if (state.levelRun) this.levelTicks++;
    this.view.notify(state.events);
    for (const event of state.events) {
      // Levels mean nothing in the tutorial: no fanfare for passing one.
      if (!(state.tutorial && event.type === 'levelUp')) this.audio.handle(event, state);
      this.tally.note(event);
      this.onEvent(state, event);
    }
    this.tally.watch(state);
    // The line of a hint goes out when the move it speaks of is made.
    if (this.hint && !this.hint.done) {
      const { player } = state;
      const under = player.level === 'top' ? (cubeAt(state, player.x, player.z)?.state ?? null) : null;
      if (hintOver(this.hint.until, state.events, under)) this.hint.done = true;
    }
    // The line about a dim die: said once to a player, at the first step such a die stops, unless
    // the line of the lesson stands - that one wins, and this waits for a later step.
    if (this.fixedLine !== null) {
      if (fixedLineOver(state.events, this.now() - this.fixedLine)) this.fixedLine = null;
    } else if (saysFixed(state, this.settings.levels.fixedSaid, this.hint !== null && !this.hint.done)) {
      this.fixedLine = this.now();
      // The room of the line is taken now, and not before it has come.
      this.fixedShown = true;
      this.layoutGuide();
      this.settings.levels.fixedSaid = true;
      // Written once the move is over, and at once if the page is hidden before that.
      this.later.after(() => saveSettings(this.settings), 'settings');
    }
    // A scored session says how it stands at every whole minute.
    const minute = Math.round(60_000 / state.config.tickMs);
    if (state.tick % minute === 0 && (state.mode === 'endless' || state.mode === 'timed')) {
      track('session_checkpoint', { step_id: this.kind, ...checkpoint(state, state.tick / minute) });
    }
    // The combo that passes a level is answered by the passage: its dice light up one after another, each on its own note.
    if (!(state.levelRun && state.endReason === 'passed')) for (const beat of beatsOf(state, state.events)) this.beat(beat);
    const { player } = state;
    // A level says its rules in the window it opens with, and nothing while it is played.
    if (state.levelRun) return;
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

  /**
   * The game answers a beat: the board throws light and shakes, the points of a group leave it
   * for the score, and for a few hundredths of a second everything holds its breath.
   */
  private beat(beat: Beat): void {
    const { state } = this;
    const reducedMotion = prefersReducedMotion(this.settings);
    this.view.beat(beat, state, reducedMotion);
    this.audio.beat(beat, state);
    if (!reducedMotion) this.hold.hold(beat.tier);
    let at: { x: number; y: number } | null = null;
    if (beat.cells.length > 0) {
      const stage = this.stageRect();
      const cx = beat.cells.reduce((sum, cell) => sum + cell.x, 0) / beat.cells.length;
      const cz = beat.cells.reduce((sum, cell) => sum + cell.z, 0) / beat.cells.length;
      const p = this.view.project(cx, 1.1, cz);
      at = { x: Math.round(stage.x + p.x), y: Math.round(stage.y + p.y) };
    }
    // A puzzle and a level are not scored: nothing leaves for the score.
    this.hud.beat({ kind: beat.kind, value: beat.value, chain: beat.chain, points: state.puzzle || state.levelRun ? 0 : beat.points, tier: beat.tier, at });
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
        if (state.levelRun) this.onLevelStep(state, event.kind);
        this.beforeCommand = null;
        break;
      case 'deadEnd':
        puzzleStat(this.settings, PUZZLE_LEVELS[this.puzzleIndex].id).dead++;
        break;
      case 'match':
        // A puzzle and a level are not scored and their board stays as it is.
        if (!state.puzzle && !state.levelRun) this.ritual.send(event.value, 1);
        if (state.stats.clears >= 2 && !state.levelRun) this.hintOnce('hintChain');
        break;
      case 'chain':
        if (!state.puzzle && !state.levelRun) this.ritual.send(event.value, event.chain);
        // The program may note the pattern in its log, behind the board.
        if (!state.puzzle && !state.tutorial && !state.levelRun) this.signal.chain(event.chain);
        break;
      case 'levelUp':
        // A level of a scored session is passed: how long it took and what it did to the board.
        if (state.mode === 'endless' || state.mode === 'timed') {
          track('progression_completed', { step_id: `${this.kind}_level`, ...levelSummary(state, event.level - 1) });
        }
        break;
      case 'tutorialStep':
        track('progression_started', { step_id: 'tutorial_step', step_index: event.step });
        break;
      case 'tutorialDone':
        this.settings.tutorialDone = true;
        saveSettings(this.settings);
        track('progression_completed', { step_id: 'tutorial', duration_sec: this.seconds() });
        this.handoff = { x: state.player.x, z: state.player.z };
        break;
      case 'fell':
        if (!state.levelRun) this.hintOnce('hintFloor');
        break;
      case 'landed': {
        const own = state.player.level === 'top' ? cubeAt(state, state.player.x, state.player.z) : undefined;
        if (own && own.ori.top === 1 && !state.levelRun) this.hintOnce('hintOne');
        break;
      }
      default:
        break;
    }
  }

  /**
   * A step made on a level. A roll or a push is a move: it can be taken back while the try has
   * moves to take back, and the first one makes the start a try. Where its die goes is kept: the
   * group it lands in is what the level counts next.
   */
  private onLevelStep(state: RunState, kind: MoveKind): void {
    const run = state.levelRun!;
    const { player } = state;
    // The level the program opened on is reported as started now, with the first thing done on
    // it, and before the try is counted: it says the try it would have said at its start.
    if (this.unsaid) {
      this.unsaid = false;
      this.sayLevelStarted(true);
    }
    if (kind !== 'roll' && kind !== 'push') return;
    // A rolled die carries the player to its cell; a pushed one goes a cell further than they step.
    const { dx, dz } = DELTA[player.action!.dir];
    const landed = kind === 'roll' ? { x: player.x, z: player.z } : { x: player.x + dx, z: player.z + dz };
    if (this.beforeCommand) {
      // A die that was going and is rolled over is gone at once: its cell keeps the frame of its group.
      const over = resolveMove(this.beforeCommand, player.action!.dir).over;
      if (over && over.reactionId !== 0 && over.x === landed.x && over.z === landed.z) {
        this.ghosts = this.ghosts.filter((ghost) => run.moves - ghost.moves < GHOST_MOVES);
        this.ghosts.push({ x: over.x, z: over.z, value: over.ori.top, reactionId: over.reactionId, moves: run.moves });
      }
    }
    if (this.undoable && this.beforeCommand) this.history.push(this.beforeCommand);
    if (!this.tryCounted) {
      this.tryCounted = true;
      const stat = this.levelRecord();
      if (stat) stat.tries++;
    }
    // What the level before came to has been read: the readings are those of this one.
    this.outcome = null;
    this.lastMove = { ...landed, moves: run.moves };
  }

  /** The group that is short which the die of the last move stands in, until the next move is made. */
  private shortMade(state: RunState): ShortGroup | null {
    const { lastMove } = this;
    if (!lastMove || lastMove.moves !== state.levelRun?.moves) return null;
    return shortGroups(state).find((group) => group.cells.some((cell) => cell.x === lastMove.x && cell.z === lastMove.z)) ?? null;
  }

  /**
   * Sides of the die under the player a step to which is a commitment: the player is on a die
   * that is going, and the step leads onto one that stands. From there the way back onto the
   * group is a roll.
   */
  private commitSides(state: RunState): Dir[] {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    if (!state.levelRun || own?.state !== 'sinking' || player.action || state.over) return [];
    return DIRS.filter((dir) => resolveMove(state, dir).kind === 'hop' && cubeAt(state, player.x + DELTA[dir].dx, player.z + DELTA[dir].dz)?.state === 'idle');
  }

  /**
   * A level that is lost stands as it is for a moment, so that what is left on it is seen before
   * it is read: nothing is added to it, no press cuts that moment, and the last move can be
   * taken back in it. True once the moment has gone.
   */
  private failHeld(time: number): boolean {
    this.failedAt ??= time;
    return time - this.failedAt >= FAIL_HOLD_MS;
  }

  /** The die under the player, unfolded: what the corner of the screen shows of it. */
  private sealView(state: RunState, mark: MarkFace | null, active: Dir | null, pulse: Dir | null): HudSeal {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    const busy = player.action !== undefined || state.over;
    const previews = busy ? null : previewAll(state);
    const blocked = {} as Record<Dir, boolean>;
    for (const dir of DIRS) blocked[dir] = !previews || previews[dir].kind === 'blocked';
    const side = (dir: Dir) => {
      const up = roll(own!.ori, TURNS_UP[dir]);
      return { value: own!.ori[SIDE[dir]], turns: quarterTurns(up) };
    };
    return {
      axes: this.view.floorAxes(),
      faces: own ? { top: { value: own.ori.top, turns: quarterTurns(own.ori) }, N: side('N'), E: side('E'), S: side('S'), W: side('W') } : null,
      sinking: own?.state === 'sinking',
      blocked,
      active,
      pulse,
      marked: own && mark ? (DIRS.find((dir) => SIDE[dir] === mark) ?? null) : null,
      commits: state.levelRun && this.levelIndex + 1 >= LEVEL_OF_COMMIT ? this.commitSides(state) : [],
    };
  }

  /**
   * The swipe sign of a level: where the die under the figure (or its cell, on the floor) lies on
   * screen, which the sign stands to the right of, and how a cell of the board the way of the
   * swipe lies there, which its trail runs parallel to.
   */
  private signView(state: RunState, dir: Dir, over: (x: number, y: number, z: number) => { x: number; y: number }): HudSign {
    const corners = signBody(state).map((corner) => over(corner.x, corner.y, corner.z));
    const left = Math.min(...corners.map((corner) => corner.x));
    const top = Math.min(...corners.map((corner) => corner.y));
    const body = { x: left, y: top, w: Math.max(...corners.map((corner) => corner.x)) - left, h: Math.max(...corners.map((corner) => corner.y)) - top };
    // A cell of the board the way the swipe goes, as the board lies on screen: the trail is parallel to the board, not to the swipe.
    const { player } = state;
    const here = this.view.project(player.x, 0, player.z);
    const there = this.view.project(player.x + DELTA[dir].dx, 0, player.z + DELTA[dir].dz);
    return { dir, mode: signMode(this.settings.controlMode, coarsePointer, this.lastInput), body, step: { x: there.x - here.x, y: there.y - here.y } };
  }

  /** Everything the session shows over the board at this moment. */
  private hudView(state: RunState, stage: Rect, lesson: HudLesson | null, mark: MarkFace | null, lit: Dir | null, reducedMotion: boolean): HudView {
    const over = (x: number, y: number, z: number) => {
      const p = this.view.project(x, y, z);
      return { x: Math.round(stage.x + p.x), y: Math.round(stage.y + p.y) };
    };
    const labels: HudLabel[] = [];
    // A chain of a level that is passed says nothing over its dice once they are being sent under.
    const sent = state.levelRun !== null && state.endReason === 'passed' && this.passage?.beaten !== false;
    for (const reaction of state.reactions) {
      if (reaction.chain < 2 || sent) continue;
      const cubes = state.cubes.filter((cube) => cube.reactionId === reaction.id && cube.state === 'sinking');
      if (cubes.length === 0) continue;
      const cx = cubes.reduce((sum, cube) => sum + cube.x, 0) / cubes.length;
      const cz = cubes.reduce((sum, cube) => sum + cube.z, 0) / cubes.length;
      labels.push({ id: reaction.id, value: reaction.value, chain: reaction.chain, at: over(cx, 1.2, cz) });
    }

    const { puzzle } = state;
    const levelRun = state.levelRun ?? null;
    const level = PUZZLE_LEVELS[this.puzzleIndex];
    // A level counts the groups that are short: all of them on its first levels, later the one the last move made.
    const made = levelRun ? this.shortMade(state) : null;
    // The pieces of the road have a plaque over every die and heap of the working face from the start; they blink when the player has waited.
    const first = levelRun !== null && this.piece !== null;
    // No plaque stands over dice that are still coming.
    const short = !levelRun || state.over || this.passage ? [] : first ? roadCounters(state) : (levelRun.spec.chapter ?? 0) < CHAPTERS_COUNTED ? shortGroups(state) : made ? [made] : [];
    const counters: HudCounter[] = short.map((group) => {
      const cx = group.cells.reduce((sum, cell) => sum + cell.x, 0) / group.cells.length;
      const cz = group.cells.reduce((sum, cell) => sum + cell.z, 0) / group.cells.length;
      return { value: group.value, have: group.have, need: group.need, at: over(cx, 1.5, cz), blink: first && this.waiting.blink };
    });
    // A level has no line under its board: its rules are said in the window it opens with.
    let note: HudView['note'] = null;
    if (puzzle?.dead === 'noExit') note = { text: t('deadNoExit'), alarm: true };
    else if (puzzle?.dead === 'single') note = { text: t('deadSingle'), alarm: true };
    else if (puzzle && puzzle.held !== 0) note = { text: t('puzzleHeld'), alarm: false };
    else if (!levelRun && this.hints.text) note = { text: this.hints.text, alarm: false };

    const padBox = this.pad.getBoundingClientRect();
    return {
      header: puzzle
        ? { kind: 'task', number: this.puzzleIndex + 1, moves: puzzle.moves, target: level.par, best: this.settings.puzzle.stats[level.id]?.best ?? null }
        : levelRun
          ? {
              kind: 'level',
              // A piece of the road has no number: it is not a level of the list.
              number: this.piece === null ? this.levelIndex + 1 : null,
              limit: levelRun.spec.moves > 0 ? levelRun.spec.moves : null,
              made: levelRun.moves,
              goal: goalLines(state),
              outcome: this.outcome,
            }
          : {
              kind: 'session',
              score: state.score,
              best: this.bestScore(state.mode === 'timed' ? 'timed' : 'endless', this.day.date),
              level: state.mode === 'practice' ? null : state.level,
              clock: clockLeft(state),
              danger: secondsLeft(state),
              stage: this.ritual.stage,
              steps: CONTACT_STEPS.length,
              next: nextThreshold(state.removed),
            },
      seal: this.sealView(state, mark, lit, lesson?.dir ?? null),
      labels,
      lesson,
      note,
      counters,
      sign: levelRun && this.waiting.dir ? this.signView(state, this.waiting.dir, over) : null,
      // The hint stands once the board is whole, and goes when the move is made or the piece is over.
      // The line about a dim die stands in the same place, and only where the lesson has none standing.
      hint:
        this.passage || this.starting || state.over
          ? null
          : this.hint && !this.hint.done
            ? { text: t(this.hint.key) }
            : this.fixedLine !== null
              ? { text: t('roadHintFixed') }
              : null,
      tools: puzzle
        ? { canUndo: this.history.length > 0, urgent: puzzle.dead !== null }
        : levelRun
          ? this.undoable
            ? { canUndo: this.history.length > 0 && this.undosLeft > 0, urgent: false, undos: this.undosLeft }
            : { canUndo: false, urgent: false, retryOnly: true }
          : null,
      pad:
        this.settings.controlMode === 'dpad' && padBox.width > 0
          ? { pulse: lesson?.dir ?? null, box: { x: padBox.left, y: padBox.top, width: padBox.width, height: padBox.height } }
          : null,
      stage,
      contact: { program: this.ritual.look.program, peak: this.ritual.look.peak },
      reducedMotion,
    };
  }

  private frame(time: number): void {
    requestAnimationFrame((next) => this.frame(next));
    // A screen faster than the limit has some of its frames let pass.
    if (this.frameGap > 0 && this.lastFrame !== 0 && time > this.lastFrame && time - this.lastFrame < this.frameGap) return;
    const dt = this.lastFrame === 0 ? 0 : Math.max(0, time - this.lastFrame);
    this.lastFrame = time;
    this.tools?.tick(time);

    // The board a passage has put on waits until it is whole: its world stands and it takes no command.
    const running = !this.paused && !this.inMenu && !this.state.over && !this.signal.busy && !this.passage;
    if (this.governor?.frame(dt, running && !document.hidden)) this.applySamples();
    this.frames.frame(running && !document.hidden, dt, time);
    let alpha = 0;
    if (running) {
      // On a beat the simulation holds its breath; the picture goes on.
      // A board with no clock takes a small step of a frame that comes late: a roll is never played out between two pictures.
      const fed = Math.min(this.hold.take(dt), frameBound(this.state.levelRun !== null));
      const from = performance.now();
      alpha = this.runner.advance(fed, () => this.takeCommand(), (s) => this.onTick(s));
      span('sim', from);
      this.keepLesson();
      if (this.state.puzzle) {
        // Time on a level counts until it is first cleared: that is how hard it was to read.
        const stat = puzzleStat(this.settings, PUZZLE_LEVELS[this.puzzleIndex].id);
        if (stat.firstMoves === null) stat.playMs += Math.min(dt, 250);
      }
      // A level keeps the time played on it, try after try: its own tick is no clock.
      const stat = this.levelRecord();
      if (stat) stat.playMs += Math.min(dt, 250);
    }
    if (this.handoff) {
      // The tutorial is over: Endless starts on the spot, around the player.
      const start = this.handoff;
      this.startRun('endless', start);
      this.audio.begin();
    }
    // What is owed outside is paid on a frame in which nothing moves.
    this.later.frame(running && this.state.player.action !== null);
    let state = this.state;
    // What a level came to is written down on the frame it ends: its end may yet be cut by starting it over.
    if (state.over && state.levelRun && !this.levelCounted) this.countLevel();
    // A level that is passed begins its passage to the next board on the frame it ends, and one
    // that is lost stands for a moment before its window; anything else shows its result at once.
    const began = this.passage === null;
    if (state.over && !this.resultShown) {
      const lost = state.levelRun !== null && state.endReason !== 'passed';
      if (!lost || this.failHeld(time)) {
        this.resultShown = true;
        if (state.puzzle) this.showPuzzleResult();
        else if (!state.levelRun) this.showResult();
        else if (lost) this.showLevelResult();
        else this.startPassage();
      }
    }
    if (this.passage && !this.inMenu) {
      this.runPassage(began ? 0 : dt);
      // Another board may be on by now: the rest of the frame is its own.
      state = this.state;
    }
    // A frame counted for the window is counted again when the window changes; the camera goes on from where it is.
    if (this.framedAt !== -1 && this.framedAt !== this.view.fitted) {
      const frame = this.boardFrame();
      if (frame) this.view.refit(frame);
      this.framedAt = this.view.fitted;
    }

    // The ritual follows the dice sent in this run only and never feeds back into the rules.
    // A puzzle and a level have no contact: the board stays as it is at the start.
    const reached = this.ritual.update(state.puzzle || state.levelRun ? 0 : state.removed, running ? Math.min(dt, 250) : 0);
    if (reached.length > 0) this.audio.setContact(this.ritual.stage / CONTACT_STEPS.length);
    // A step of the contact is a beat of its own, and so is the moment it goes past the last.
    for (let i = 0; i < reached.length; i++) this.beat(stepBeat());
    const { peak } = this.ritual.look;
    if (peak > this.lastPeak + 0.5) this.beat(peakBeat());
    this.lastPeak = peak;
    const danger = secondsLeft(state);
    this.audio.warn(danger);
    // The last ten seconds of a Time Limited run are counted out loud.
    const clock = clockLeft(state);
    if (clock !== null && clock !== this.lastClock) {
      if (running && clock <= 10 && clock > 0 && this.lastClock !== -1) this.audio.tick();
      this.lastClock = clock;
    }

    const { experiments } = this.settings;
    const reducedMotion = prefersReducedMotion(this.settings);
    this.root.classList.toggle('reduced-motion', reducedMotion);
    // Under the boot and the menu the board is neither drawn nor shown, and its interface is put away.
    const covered = this.shell.covers;
    // A transmission takes the screen the same way: the interface of the session is put away.
    this.root.classList.toggle('shell-open', covered || this.signal.busy);
    this.world.look.opacity = covered ? 0 : 1;
    const stage = this.stageRect();
    const lit = this.sealLit(time);
    const guide = this.updateGuide(state, stage);
    const drawFrom = performance.now();
    if (!covered) {
      this.view.draw(state, alpha, time, {
        overlay: {
          boardPreview: experiments.boardPreview,
          matchHint: experiments.matchHint,
          guide: guide.board,
        },
        contact: this.ritual.look,
        warn: state.cubes.length >= state.config.warnOccupied && !state.over,
        danger: danger !== null,
        reducedMotion,
        shake: this.settings.shake,
        whole: this.settings.view === 'full',
        // The frame stays for as long as the group the die was of is going.
        ghosts: state.levelRun ? this.ghosts.filter((ghost) => state.reactions.some((reaction) => reaction.id === ghost.reactionId)) : [],
      });
      this.backdrop.draw(this.view.background, this.view.inverted);
    } else {
      this.backdrop.clear();
    }
    span('board', drawFrom);
    const shown = !covered && !this.inMenu && !this.signal.busy;
    // Under a panel, and while the board takes no input, a piece shows no sign and its wait is not counted.
    const waitFrom = performance.now();
    this.waiting = this.wait?.frame(state, time, shown && this.inputEnabled()) ?? { dir: null, blink: false };
    span('wait', waitFrom);
    const hudFrom = performance.now();
    // Under the command the program opens on, the readings keep their room and are not shown: nothing is on that screen but the board and the command.
    this.hud.frame(shown ? this.hudView(state, stage, guide.lesson, guide.mark, lit, reducedMotion) : null, time, this.starting);
    span('hud', hudFrom);
    // The readings stand above the board on a tall screen and beside it on a wide one: the
    // box of the page that keeps their room follows them.
    const header = `${this.hud.headerHeight}px`;
    const column = `${this.hud.columnWidth}px`;
    if (this.header.style.height !== header || this.header.style.width !== column) {
      this.header.style.height = header;
      this.header.style.width = column;
      this.root.classList.toggle('wide', this.hud.columnWidth > 0);
      this.layoutGuide();
    }
    this.shell.frame(time);
    // Something comes through behind the board only while a scored session is being played.
    const session =
      running && !state.puzzle && !state.tutorial && !state.levelRun
        ? {
            contact: this.ritual.stage / CONTACT_STEPS.length,
            noise: state.cubes.length / state.config.size ** 2,
            channel: this.ritual.look.channel,
          }
        : null;
    this.signal.frame(time, session);
    const presentFrom = performance.now();
    this.display.present(time);
    span('present', presentFrom);
    // The first picture with the program's own letters is on screen: the platform takes its loading screen away.
    if (!this.announced && this.shell.ready) {
      this.announced = true;
      tell('game_ready');
      // Whatever was pressed on the platform's page while the game was loading, the keys are the game's now.
      takeFocus();
    }
  }
}
