import { beatsOf, chainTier } from '../app/juice';
import { CONTACT_STEPS, PHASE_SHIFT_MS, lineLevel } from '../app/ritual';
import { Display } from '../display/display';
import { quality } from '../display/quality';
import { loadSettings } from '../platform/settings';
import { Backdrop } from '../render/backdrop';
import { LevelScene } from '../render/levelScene';
import { finaleMs } from '../render/leaving';
import { Water } from '../render/water';
import { BOARD_PARAMS, boardChanged, boardDefaults, parseBoardValue, type BoardLook } from '../render/params';
import type { DicePassing } from '../render/passing';
import { BoardView, type CameraAngles } from '../render/view';
import { createRun, cubeAt, defaultConfig, type PuzzleDie, type RunState } from '../rules';
import { SHELL_PARAMS, parseShellValue, shellChanged, shellDefaults } from '../shell/theme';
import { FpsCounter } from '../ui/fps';
import { BoardPanel } from './boardPanel';
import { copyText } from './clipboard';
import { SceneRun, leavingSceneState, type LeavingScene } from './leavingScenes';

const SIZE = 7;
/** A face that can look north for each face on top. */
const NORTH: Record<number, number> = { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2 };
/** How often the time a frame takes is shown anew, in milliseconds. */
const COST_WINDOW_MS = 500;
/** A scene of the leaving that has been played stands for this long before it is played again. */
const SCENE_REST_MS = 700;
/** The beat the last combo of a board is answered with, as the game has it (`FINALE_TIER` in `src/app/game.ts`). */
const FINALE_TIER = 3;

/**
 * The sample board: every value, a chain of threes that is open, a five that has all but gone
 * down, a die coming up and a low one, dice elsewhere that could go on with the chains.
 */
const SAMPLE: readonly [x: number, z: number, top: number][] = [
  [1, 0, 6], [5, 0, 2],
  [0, 1, 4], [3, 1, 5], [6, 1, 1],
  [2, 2, 3], [3, 2, 3], [5, 2, 6],
  [1, 3, 2], [3, 3, 3], [5, 3, 3],
  [0, 4, 5], [2, 4, 1], [4, 4, 4], [6, 4, 3],
  [1, 5, 6], [3, 5, 2], [5, 5, 4],
  [2, 6, 5], [4, 6, 2],
];
/** Cells of the chain of threes, of the five on its way out, of the dice coming up. */
const CHAIN = [[2, 2], [3, 2], [3, 3]];
const LEAVING = [2, 6];
const RISING = [1, 5];
const RISING_LOW = [3, 5];
const PENDING = [6, 6];
/** Dice that stand, to be looked at as fixed dice: a four and a six. */
const FIXED = [[0, 1], [5, 2]];
const PLAYER = { x: 4, z: 4 };

function sampleState(full: boolean, fixed: boolean): RunState {
  const dice: PuzzleDie[] = [];
  if (full) {
    for (let z = 0; z < SIZE; z++) {
      for (let x = 0; x < SIZE; x++) {
        const top = 1 + ((x * 2 + z * 3) % 6);
        dice.push({ x, z, top, north: NORTH[top] });
      }
    }
  } else {
    for (const [x, z, top] of SAMPLE) dice.push({ x, z, top, north: NORTH[top] });
  }
  const state = createRun({ seed: 1, config: defaultConfig(), puzzle: { size: SIZE, dice, start: PLAYER } });
  // A board to look at, not a puzzle: the signs of an open chain are those of a session.
  state.puzzle = null;
  state.mode = 'endless';
  const at = ([x, z]: number[]) => state.cubes.find((cube) => cube.x === x && cube.z === z)!;
  if (fixed) for (const cell of FIXED) at(cell).fixed = true;
  if (full) return state;

  const { config } = state;
  const leave = (cell: number[], reactionId: number, gone: number): void => {
    const cube = at(cell);
    cube.state = 'sinking';
    cube.reactionId = reactionId;
    cube.t = Math.round(config.sinkingTicks * gone);
  };
  for (const cell of CHAIN) leave(cell, 1, 0.3);
  leave(LEAVING, 2, Math.max(0.85, 1 - config.sinkLowHeight * 0.6));
  state.reactions.push({ id: 1, value: 3, chain: 1, total: CHAIN.length }, { id: 2, value: 5, chain: 2, total: 5 });
  const rising = at(RISING);
  rising.state = 'rising';
  rising.t = Math.round(config.risingTicks * 0.7);
  const low = at(RISING_LOW);
  low.state = 'rising';
  low.t = Math.round(config.risingTicks * Math.min(0.18, config.mountHeight * 0.8));
  state.pending.push({ x: PENDING[0], z: PENDING[1], ori: rising.ori, t: Math.round(config.warnTicks / 2) });
  return state;
}

/**
 * The page where the look of the board is looked at and tuned: `?lab=board`, with `&ui=0` to
 * leave the panel out. Any parameter of the board or of the shell's colours can be set in the
 * address by its name. The board is the real one, with a sample state that does not run; the
 * scenes of the leaving of a group (folder «Уход») are played on a small level by the rules
 * themselves, over and over, so that their numbers are tuned by eye.
 */
export class BoardLab {
  readonly display = new Display();
  /** The look of the board and the colours of the program; the panel is bound to these objects. */
  readonly look: BoardLook = { board: boardDefaults(), shell: shellDefaults() };
  readonly camera: CameraAngles;
  /** Every cell holds a die: the heaviest board there is, for measuring. */
  full: boolean;
  /** Two dice of the sample board are fixed dice: their screens are out. */
  fixed: boolean;
  /** How deep the contact is, in steps; and the channel sent most. */
  depth: number;
  channel: number;
  grey: boolean;
  /** Milliseconds of work a frame takes on this side of the graphics card. */
  cost = 0;
  /** What the last copy put on the clipboard. */
  copied: string | null = null;
  /** Cells along a side of the sample board. */
  readonly cells = SIZE;
  /** The cell the figure stands on: the followed view goes after it. */
  readonly stand = { ...PLAYER };
  /** How the board is seen at this moment: whole, or followed. */
  viewNow = 'full';
  /**
   * How much of the lines of the board is drawn, 0 to 1, and whether what is there is what an
   * erasing has left: the wave starts from the cell the figure stands on.
   */
  readonly grid = { share: 1, erasing: false };
  /** When the lines began to be erased and drawn as a passage does it; null while they are held by hand. */
  private gridPlay: number | null = null;
  private readonly container: HTMLElement;
  private readonly backdrop = new Backdrop(this.display);
  private readonly world = this.display.addLayer({ name: 'world', lines: null, samples: quality().samples, encoded: true });
  /** The water the board lies on, a probe; `?water=off` leaves it out, and the place behind the board is shown instead. */
  private readonly water = quality().water ? new Water(this.display, this.world) : null;
  /** The place behind the board of a level: shown here always, to be tuned. */
  private readonly levelScene = new LevelScene(this.display, this.look, this.world);
  private readonly fps = new FpsCounter();
  private view: BoardView | null = null;
  /**
   * Where the sample board lies in the world, from `origin=x,z` of the address: the picture is
   * to be the same wherever it lies.
   */
  private readonly origin: { x: number; z: number };
  private state: RunState;
  /** A scene of the leaving that is being played instead of the sample board; null while the sample is shown. */
  private scene: SceneRun | null = null;
  /** A scene that has been played is played again, until another board is asked for. */
  repeat = true;
  /** Milliseconds owed to the rules of the scene, and how long the scene has stood since it was played out. */
  private owed = 0;
  private rested = 0;
  /** The last combo of the scene's board is taking its dice away: how long ago it began, and whether they have been seen under the floor. Null otherwise. */
  private finale: { ms: number; under: boolean } | null = null;
  private readonly passing: DicePassing = { mode: 'leave', ranks: new Map(), count: 0, stair: -1, litMs: 0, moveMs: -1, stepMs: 0, moveForMs: 1, flashMs: 0, together: true };
  /** The view has to be built again before the next frame: its pictures are made once. */
  private stale = true;
  private peak = 0;
  private lastTime = 0;
  private spent = 0;
  private frames = 0;
  private since = 0;

  constructor() {
    const query = new URLSearchParams(window.location.search);
    const [x, z] = (query.get('origin') ?? '').split(',').map(Number);
    this.origin = { x: Number.isFinite(x) ? x : 0, z: Number.isFinite(z) ? z : 0 };
    for (const name of Object.keys(BOARD_PARAMS)) {
      const text = query.get(name);
      const value = text === null ? undefined : parseBoardValue(name, text);
      if (value !== undefined) this.look.board[name] = value;
    }
    for (const name of Object.keys(SHELL_PARAMS)) {
      const text = query.get(name);
      const value = text === null ? undefined : parseShellValue(name, text);
      if (value !== undefined) this.look.shell[name] = value;
    }
    const { yaw, pitch } = loadSettings().camera;
    this.camera = { yaw: Number(query.get('yaw') ?? yaw), pitch: Number(query.get('pitch') ?? pitch) };
    this.full = query.get('full') === '1';
    this.depth = Number(query.get('depth') ?? 0) || 0;
    this.channel = Number(query.get('channel') ?? 0) || 0;
    this.grey = query.get('grey') === '1';
    this.fixed = query.get('fixed') === '1';
    this.state = sampleState(this.full, this.fixed);

    // The part of the window the board takes: all of it.
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none';
    document.body.append(this.container);
    this.setGrey(this.grey);

    if (query.get('ui') !== '0') new BoardPanel(this);
    const loop = (time: number): void => {
      requestAnimationFrame(loop);
      this.fps.tick(time);
      this.frame(time);
    };
    requestAnimationFrame(loop);
  }

  /** Draws one frame. Called from the console where frames have to be stepped by hand. */
  frame(timeMs: number): void {
    const started = performance.now();
    const dt = this.lastTime === 0 ? 0 : Math.max(0, timeMs - this.lastTime);
    this.lastTime = timeMs;
    this.peak = Math.max(0, this.peak - dt / PHASE_SHIFT_MS);

    this.display.sync();
    if (this.stale || !this.view) {
      this.view?.dispose();
      this.view = new BoardView(this.container, this.world, this.look, SIZE, this.camera);
      if (this.origin.x !== 0 || this.origin.z !== 0) this.view.setBoard({ size: SIZE, holes: [], origin: this.origin });
      this.view.setWater(this.water);
      this.stale = false;
      // A number of the look was changed while a scene was on: it is played anew, by the new number.
      if (this.scene) this.playLeaving(this.scene.scene);
    }
    const { view } = this;
    const alpha = this.runScene(view, dt);
    const state = this.scene?.state ?? this.state;
    if (this.water) this.water.on = true;
    this.runGrid(timeMs);
    view.drawGrid(this.grid.share, !this.grid.erasing, this.scene ? state.player : this.stand);
    view.draw(state, alpha, timeMs, {
      overlay: { boardPreview: false, matchHint: false },
      contact: {
        grid: lineLevel('grid', this.depth),
        dice: lineLevel('dice', this.depth),
        backdrop: lineLevel('backdrop', this.depth),
        screen: lineLevel('screen', this.depth),
        program: lineLevel('program', this.depth),
        red: lineLevel('red', this.depth),
        peak: this.peak,
        channel: this.channel,
      },
      warn: false,
      danger: false,
      reducedMotion: false,
      shake: true,
      onLeaving: (event) => {
        if (event.final) {
          // The dice of the finale are under: the lines of the board go and come, as in a passage.
          if (this.finale && !this.finale.under) {
            this.finale.under = true;
            this.playGrid();
          }
        }
      },
    });
    this.backdrop.draw(view.background, view.inverted);
    this.levelScene.frame(timeMs, this.water ? null : state, { place: Number(this.look.board.backPlace ?? 0), day: Number(this.look.board.backDay ?? 0) }, false);
    this.display.present(timeMs);
    this.viewNow = view.mode;

    this.spent += performance.now() - started;
    this.frames++;
    if (timeMs - this.since >= COST_WINDOW_MS || timeMs < this.since) {
      this.cost = Math.round((this.spent / this.frames) * 100) / 100;
      this.spent = 0;
      this.frames = 0;
      this.since = timeMs;
    }
  }

  /** A parameter has changed: the view is built anew. */
  touch(): void {
    this.stale = true;
  }

  setCamera(): void {
    this.view?.setCamera(this.camera);
  }

  setFull(full: boolean): void {
    this.full = full;
    this.state = sampleState(full, this.fixed);
    this.endScene();
    this.place();
    this.view?.reset();
  }

  /** Plays a scene of the leaving of a group on its own small level, in place of the sample board. */
  playLeaving(scene: LeavingScene): void {
    this.endScene();
    this.scene = new SceneRun(scene, leavingSceneState(scene));
    this.view?.reset();
  }

  /** The sample board again, as it was set. */
  showSample(): void {
    this.setFull(this.full);
  }

  private endScene(): void {
    this.scene = null;
    this.finale = null;
    this.owed = 0;
    this.rested = 0;
    this.gridPlay = null;
    this.grid.share = 1;
    this.grid.erasing = false;
    this.view?.setPassing(null);
  }

  /**
   * One frame of the scene that is on: the rules are stepped by the time that has gone, the view
   * is told what they said and answers it as the game does, and the last combo of a board is led
   * as the passage of the game leads it. Returns how far the picture is into the next tick.
   */
  private runScene(view: BoardView, dt: number): number {
    const { scene } = this;
    if (!scene) return 0;
    const { state } = scene;
    const { tickMs } = state.config;
    if (!scene.done && !state.over) {
      this.owed += Math.min(dt, 100);
      while (this.owed >= tickMs && !scene.done && !state.over) {
        this.owed -= tickMs;
        const events = scene.tick();
        view.notify(events);
        const passed = state.over && state.endReason === 'passed';
        if (passed) this.beginFinale(view, state);
        else for (const beat of beatsOf(state, events)) view.beat(beat, state, false);
      }
    }
    if (this.finale) this.runFinale(dt);
    // Played out, and with a finale its lines back: it stands a moment, and is played again.
    const over = scene.done || state.over;
    const settled = !this.finale || (this.finale.under && this.gridPlay === null);
    if (over && settled) {
      this.rested += dt;
      if (this.repeat && this.rested >= SCENE_REST_MS) this.playLeaving(scene.scene);
    }
    return state.over || scene.done ? 0 : this.owed / tickMs;
  }

  /** The board of the scene is passed: every die of it flashes at once and the board answers, as `Game.startPassage` has it. */
  private beginFinale(view: BoardView, state: RunState): void {
    const { passing } = this;
    const last = state.cubes.reduce<(typeof state.cubes)[number] | null>((latest, cube) => (!latest || cube.t < latest.t ? cube : latest), null);
    const value = last?.ori.top ?? 0;
    passing.ranks.clear();
    state.cubes.forEach((cube, rank) => passing.ranks.set(cube.id, rank));
    passing.count = state.cubes.length;
    passing.litMs = 0;
    passing.moveMs = -1;
    this.finale = { ms: 0, under: false };
    view.setPassing(passing);
    view.finale(state, false);
    view.answer(value);
    view.beat({ kind: 'chain', value, tier: FINALE_TIER, cells: state.cubes.map(({ x, z }) => ({ x, z })) }, state, false);
  }

  /** One frame of the finale: what the view reads of the dice going. */
  private runFinale(dt: number): void {
    const { finale, passing } = this;
    if (!finale) return;
    finale.ms += dt;
    const times = finaleMs(this.look.board, false);
    passing.moveForMs = Math.max(1, times.drop);
    passing.flashMs = Number(this.look.board.comboHoldMs);
    passing.litMs = finale.ms;
    passing.moveMs = finale.under ? passing.moveForMs : finale.ms - times.hang;
  }

  setFixed(fixed: boolean): void {
    this.fixed = fixed;
    this.setFull(this.full);
  }

  /** Puts the figure on the cell it is told to stand on: on the die that is there, or on the floor. */
  place(): void {
    const { player } = this.state;
    player.x = this.stand.x;
    player.z = this.stand.z;
    player.level = cubeAt(this.state, player.x, player.z) ? 'top' : 'ground';
  }

  setGrey(grey: boolean): void {
    this.grey = grey;
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.display');
    if (canvas) canvas.style.filter = grey ? 'grayscale(1)' : '';
  }

  /** A group has been sent, or a chain has been added to: what the board answers with. */
  pulse(chain: number): void {
    const value = this.channel > 0 ? this.channel : 3;
    this.view?.notify([
      chain < 2
        ? { type: 'match', reactionId: 1, value, count: value, points: 0 }
        : { type: 'chain', reactionId: 1, value, chain, count: value, points: 0 },
    ]);
    // A chain is answered as a session answers it: sparks, a ring, and on a long one the colours of the picture part.
    if (chain >= 2) this.view?.beat({ kind: 'chain', value, tier: chainTier(chain), cells: CHAIN.map(([x, z]) => ({ x, z })) }, this.state, false);
  }

  /** The lines of the board are erased towards the figure and drawn from it again, in the times the look names. */
  playGrid(): void {
    this.gridPlay = this.lastTime;
  }

  /** The lines are held where the panel has put them. */
  holdGrid(): void {
    this.gridPlay = null;
  }

  /** One frame of the lines being erased and then drawn. */
  private runGrid(timeMs: number): void {
    if (this.gridPlay === null) return;
    const { grid } = this;
    const erase = Math.max(1, Number(this.look.board.eraseMs));
    const draw = Math.max(1, Number(this.look.board.drawMs));
    const elapsed = timeMs - this.gridPlay;
    grid.erasing = elapsed < erase;
    grid.share = grid.erasing ? 1 - elapsed / erase : Math.min(1, (elapsed - erase) / draw);
    if (elapsed >= erase + draw) this.gridPlay = null;
  }

  /** The contact goes past its last step. */
  turnOver(): void {
    this.peak = 1;
  }

  /** The deepest the contact can be set to here: its last step. */
  get deepest(): number {
    return CONTACT_STEPS.length;
  }

  /** Back to the look as it is defined. */
  reset(): void {
    Object.assign(this.look.board, boardDefaults());
    Object.assign(this.look.shell, shellDefaults());
    this.touch();
  }

  /** The tuned look as JSON: only the values that differ from the defaults. */
  json(): string {
    return JSON.stringify({ board: boardChanged(this.look.board), shell: shellChanged(this.look.shell) }, null, 2);
  }

  async copy(): Promise<boolean> {
    const text = this.json();
    const done = await copyText(text);
    this.copied = done ? text : null;
    return done;
  }
}

export function startBoardLab(): BoardLab {
  const lab = new BoardLab();
  // For the console, and for stepping frames where the browser does not run them itself.
  (window as unknown as { lab: BoardLab }).lab = lab;
  return lab;
}
