import type { LevelSpec, PuzzleDie, RunState } from '../rules/types';

/**
 * A level that begins where a run stands: the board of a play made into a board of its own. The
 * dice are where they are and lie as they lie; a die that is going is written as leaving, with
 * the moves it has left; a fixed die stays fixed; the player starts where they stand, on a die
 * or on the floor. The head is that of `base`, the level the run is of, without its way: the way
 * of a level is not the way of a board come to in the middle of it.
 *
 * Two things a level cannot say are lost. Dice that go together as one combo are written each as
 * leaving by itself, so a die brought to them joins the one it touches; and a move in which the
 * dice going were held is forgotten. The world has to stand: a die in the middle of a roll has
 * no cell to be written on.
 */
export function specFromState(state: RunState, base: LevelSpec): LevelSpec {
  const { sinkingTicks, actionTicks } = state.config;
  const sink = base.sinkMoves ?? Math.round((sinkingTicks - 1) / actionTicks);
  const dice: PuzzleDie[] = [];
  const leaving: { die: number; moves: number }[] = [];
  for (const cube of state.cubes) {
    if (cube.state === 'sinking') {
      const moves = Math.ceil((sinkingTicks - cube.t) / actionTicks);
      // A die with no move left is gone by the next: it is no die of the board to come.
      if (moves < 1) continue;
      leaving.push({ die: dice.length, moves: Math.min(sink, moves) });
    }
    dice.push({ x: cube.x, z: cube.z, top: cube.ori.top, north: cube.ori.north, ...(cube.fixed ? { fixed: true } : {}) });
  }
  const { par: _par, exact: _exact, solution: _solution, layout: _layout, ...head } = base;
  return {
    ...head,
    norm: dice.length,
    layout: {
      start: { x: state.player.x, z: state.player.z },
      dice,
      ...(leaving.length > 0 ? { leaving } : {}),
      ...(state.player.level === 'ground' ? { onFloor: true } : {}),
    },
  };
}
