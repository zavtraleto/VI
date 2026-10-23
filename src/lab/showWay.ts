import { nextPress } from '../app/wayPress';
import { worldRuns } from '../rules/level';
import { moveOf, type SolverMove } from '../rules/levelSolver';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import type { Seconds } from './labFacts';

// The press is found by the game as well, which shows a way for an advertisement: it lives there.
export { nextPress };

/** A move of the way shown is pressed this long after the one before it, at the least. */
export const SHOW_MOVE_MS = 600;
/** How often the run is looked at while a way is shown: a press waits for the player to stand free. */
const LOOK_MS = 50;

/**
 * The way «показать решение» plays, once the solver has counted the board: the way the file
 * keeps, where it holds the fewest moves, or else the one the solver found. `same` says only that
 * the file and the solver agree on the fewest moves, and a file may keep them with no way, or a
 * way of another length: the file's way is played where it is of that length. Where there is
 * none to play, the line that says why.
 */
export function wayToShow(spec: LevelSpec, seconds: Seconds | string): readonly SolverMove[] | string {
  if (typeof seconds === 'string') return `решатель: ${seconds}`;
  const { check } = seconds;
  const way = check.kept === 'same' && check.par !== null && spec.solution?.length === check.par ? spec.solution : check.way;
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
      // A way is said to be shown only where it cleared the board: a run that ended otherwise, or a move that cannot be got to, is not the run the way was found on.
      const end = press === 'lost' ? `ход ${run.moves + 1} из ${this.way.length} не достать на доске —` : state.endReason !== 'passed' ? `партия кончилась на ${this.count()}, доска не очищена —` : `${this.count()}, показано — V ещё раз,`;
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
