import { DELTA, DIRS, cellIndex } from '../rules/board';
import { worldRuns } from '../rules/level';
import { moveOf, type SolverMove } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import type { Seconds } from './labFacts';

/** A move of the way shown is pressed this long after the one before it, at the least. */
export const SHOW_MOVE_MS = 600;
/** How often the run is looked at while a way is shown: a press waits for the player to stand free. */
const LOOK_MS = 50;

/**
 * The press that plays on a way from the run as it stands: the next free step towards where its
 * next move is made from, or that move itself. A move of the solver is made from its place, a
 * die to roll from on top or to push from the floor, and the player is put there for free; on
 * the board of the game he walks there, a key a step, and the steps are found here, on the rules
 * as they are, nothing stepped. The next move is the one after as many as the run has made.
 * `move` says the press is the move itself. `done` where the way is played out or the run is
 * over, `lost` where its next move cannot be got to: the run is not the one the way was found on.
 */
export function nextPress(state: RunState, way: readonly SolverMove[]): { dir: Dir; move: boolean } | 'done' | 'lost' {
  const run = state.levelRun;
  if (!run || state.over || run.moves >= way.length) return 'done';
  const move = way[run.moves];
  const { dx, dz } = DELTA[move.dir];
  const { size } = state.config;
  const cells = size * size;
  // A place is a cell up on the dice, or the same cell on the floor `cells` further on, as `scan` counts them.
  const goal = move.push ? cellIndex(size, move.x - dx, move.z - dz) + cells : cellIndex(size, move.x, move.z);
  const { x, z, level } = state.player;
  const start = cellIndex(size, x, z) + (level === 'ground' ? cells : 0);
  const board: RunState = { ...state, player: { x, z, level } };
  // The first step of the shortest walk to every place reached: the walk goes on from where the first step led.
  const first = new Map<number, Dir | null>([[start, null]]);
  const queue = [start];
  for (let at = 0; at < queue.length; at++) {
    const place = queue[at];
    const up = place < cells;
    const cell = up ? place : place - cells;
    board.player.x = cell % size;
    board.player.z = Math.floor(cell / size);
    board.player.level = up ? 'top' : 'ground';
    if (place === goal) {
      const made = resolveMove(board, move.dir).kind;
      if (made === (move.push ? 'push' : 'roll')) {
        const step = first.get(place);
        return step ? { dir: step, move: false } : { dir: move.dir, move: true };
      }
    }
    for (const dir of DIRS) {
      const intent = resolveMove(board, dir);
      // A roll or a push is a move of its own: the walk goes by free steps only.
      if (intent.kind === 'blocked' || intent.kind === 'roll' || intent.kind === 'push') continue;
      const down = intent.kind === 'descend' || intent.kind === 'walk';
      const next = cellIndex(size, intent.tx, intent.tz) + (down ? cells : 0);
      if (first.has(next)) continue;
      first.set(next, first.get(place) ?? dir);
      queue.push(next);
    }
  }
  return 'lost';
}

/**
 * The way «показать решение» plays, once the solver has counted the board: the way the file
 * keeps, where it holds the fewest moves, or else the one the solver found. Where there is none
 * to play, the line that says why.
 */
export function wayToShow(spec: LevelSpec, seconds: Seconds | string): readonly SolverMove[] | string {
  if (typeof seconds === 'string') return `решатель: ${seconds}`;
  const { check } = seconds;
  const way = check.kept === 'same' ? spec.solution : check.way;
  if (!way) return check.exact ? 'решения нет' : 'решатель сдался, решения не нашёл';
  return way.map(moveOf);
}

/** As much of the game as a way is shown on: its run, read, a key given to it, and the key it has not yet taken dropped. */
export interface ShowGame {
  readonly state: RunState;
  press(dir: Dir): void;
  cancel(): void;
}

/**
 * Plays a way on the board of the game, a key at a time, as a player would press them. A key is
 * given only when the player stands free and the world stands still, so that no press waits in
 * the buffer of the game behind another; a press the game has not taken yet, or has dropped, is
 * given again, since the next one is always read off the run as it is. A move is pressed
 * `SHOW_MOVE_MS` after the move before it at the least; the steps between go as fast as the
 * player takes them. `say` hears a line at every move made, at the end, and when it is stopped.
 */
export class WayShow {
  private timer = 0;
  private way: readonly SolverMove[] = [];
  /** The move last pressed, by its place in the way, and when it was first pressed. */
  private pressed = -1;
  private pressedAt = 0;
  private made = -1;

  constructor(
    private readonly game: ShowGame,
    private readonly say: (line: string) => void,
  ) {}

  get running(): boolean {
    return this.timer !== 0;
  }

  start(way: readonly SolverMove[]): void {
    this.stop();
    this.way = way;
    this.pressed = this.made = -1;
    this.pressedAt = 0;
    this.timer = window.setInterval(() => this.look(), LOOK_MS);
  }

  /**
   * The way is shown no further: the board stays as it stands, and a press the game has not taken
   * yet is dropped, so that no step comes after the stop. `said`, and it is told where it stopped.
   */
  stop(said = false): void {
    if (!this.running) return;
    if (said) this.say(`решение: остановлено на ${this.count()} — V сначала, E к расстановке`);
    window.clearInterval(this.timer);
    this.timer = 0;
    this.game.cancel();
  }

  /** The moves made of the way, as a line says them. */
  private count(): string {
    return `${Math.max(0, Math.min(this.made, this.way.length))} из ${this.way.length}`;
  }

  private look(): void {
    const { state } = this.game;
    const run = state.levelRun;
    if (!run) return;
    if (run.moves !== this.made) {
      this.made = run.moves;
      this.say(`решение: ${this.count()} — любая клавиша остановит, E к расстановке`);
    }
    if (state.player.action !== undefined || worldRuns(state)) return;
    const press = nextPress(state, this.way);
    if (press === 'done' || press === 'lost') {
      this.stop();
      // A run over before the way is played out is not the run the way was found on, no more than one where a move cannot be got to.
      const end = press === 'lost' ? `ход ${run.moves + 1} из ${this.way.length} не достать на доске —` : run.moves < this.way.length ? `партия кончилась на ${this.count()} —` : `${this.count()}, показано — V ещё раз,`;
      this.say(`решение: ${end} E к расстановке`);
      return;
    }
    if (press.move && this.pressed !== run.moves) {
      const now = performance.now();
      if (now - this.pressedAt < SHOW_MOVE_MS) return;
      this.pressed = run.moves;
      this.pressedAt = now;
    }
    this.game.press(press.dir);
  }
}
