import { moveOf, tryWay } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';

/** A face a level asks for, and how many dice of it go on the way the board keeps: none known, where it keeps no way. */
export interface GoalFace {
  face: number;
  dice: number | null;
}

const ascending = (faces: Iterable<number>): number[] => [...new Set(faces)].filter((face) => face >= 2).sort((a, b) => a - b);

/**
 * The faces a level asks the player to put together, shown in the corner where the seal lay (word
 * of the owner, 16 October 2026): those whose combos and links are on the way the board keeps,
 * smallest first, so that they do not tell which goes first, each with the dice of it that go on
 * that way. A board that keeps no way, or a way that no longer holds, shows the faces it names,
 * with no count. The 1s are not among them.
 */
export function goalOf(spec: LevelSpec): GoalFace[] {
  const named = ascending(spec.faces ?? []).map((face) => ({ face, dice: null }));
  if (!spec.solution || spec.solution.length === 0) return named;
  try {
    const { state, values } = tryWay(spec, spec.solution.map(moveOf));
    const found = ascending(values);
    if (state.endReason !== 'passed' || found.length === 0) return named;
    const sent = state.levelRun!.sent;
    return found.map((face) => ({ face, dice: sent[face - 1] }));
  } catch {
    return named;
  }
}

/** The faces a level asks for, as `goalOf` finds them. */
export function goalFaces(spec: LevelSpec): number[] {
  return goalOf(spec).map((goal) => goal.face);
}
