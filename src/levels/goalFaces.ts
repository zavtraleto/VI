import { moveOf, tryWay } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';

const ascending = (faces: Iterable<number>): number[] => [...new Set(faces)].filter((face) => face >= 2).sort((a, b) => a - b);

/**
 * The faces a level asks the player to put together, shown in the corner where the seal lay (word
 * of the owner, 16 October 2026): those whose combos and links are on the way the board keeps,
 * smallest first, so that they do not tell which goes first. A board that keeps no way, or a way
 * that no longer holds, shows the faces it names. The 1s are not among them.
 */
export function goalFaces(spec: LevelSpec): number[] {
  const named = ascending(spec.faces ?? []);
  if (!spec.solution || spec.solution.length === 0) return named;
  try {
    const { state, values } = tryWay(spec, spec.solution.map(moveOf));
    const found = ascending(values);
    return state.endReason === 'passed' && found.length > 0 ? found : named;
  } catch {
    return named;
  }
}
