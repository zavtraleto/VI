import { chainTier } from '../app/juice';
import { CONTACT_STEPS, PHASE_SHIFT_MS, lineLevel } from '../app/ritual';
import { Display } from '../display/display';
import { quality } from '../display/quality';
import { loadSettings } from '../platform/settings';
import { Backdrop } from '../render/backdrop';
import { BOARD_PARAMS, boardChanged, boardDefaults, parseBoardValue, type BoardLook } from '../render/params';
import { BoardView, type CameraAngles } from '../render/view';
import { createRun, cubeAt, defaultConfig, type PuzzleDie, type RunState } from '../rules';
import { SHELL_PARAMS, parseShellValue, shellChanged, shellDefaults } from '../shell/theme';
import { FpsCounter } from '../ui/fps';
import { BoardPanel } from './boardPanel';
import { copyText } from './clipboard';

const SIZE = 7;
/** A face that can look north for each face on top. */
const NORTH: Record<number, number> = { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2 };
/** How often the time a frame takes is shown anew, in milliseconds. */
const COST_WINDOW_MS = 500;

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
const PLAYER = { x: 4, z: 4 };

function sampleState(full: boolean): RunState {
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
  if (full) return state;

  const { config } = state;
  const at = ([x, z]: number[]) => state.cubes.find((cube) => cube.x === x && cube.z === z)!;
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
 * address by its name. The board is the real one, with a sample state that does not run.
 */
export class BoardLab {
  readonly display = new Display();
  /** The look of the board and the colours of the program; the panel is bound to these objects. */
  readonly look: BoardLook = { board: boardDefaults(), shell: shellDefaults() };
  readonly camera: CameraAngles;
  /** Every cell holds a die: the heaviest board there is, for measuring. */
  full: boolean;
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
  private readonly container: HTMLElement;
  private readonly backdrop = new Backdrop(this.display);
  private readonly world = this.display.addLayer({ name: 'world', lines: null, samples: quality().samples, encoded: true });
  private readonly fps = new FpsCounter();
  private view: BoardView | null = null;
  /**
   * Where the sample board lies in the world, from `origin=x,z` of the address: the picture is
   * to be the same wherever it lies.
   */
  private readonly origin: { x: number; z: number };
  private state: RunState;
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
    this.state = sampleState(this.full);

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
      this.stale = false;
    }
    const { view } = this;
    view.draw(this.state, 0, timeMs, {
      overlay: { boardPreview: false, matchHint: false, guide: null },
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
    });
    this.backdrop.draw(view.background, view.inverted);
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
    this.state = sampleState(full);
    this.place();
    this.view?.reset();
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
