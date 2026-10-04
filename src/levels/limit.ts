import { solveLevel } from '../rules/levelSolver';
import { candidate } from './generate';
import type { Recipe } from './recipes';

/**
 * How far the solver gets: boards laid at random, of the sizes the ladder uses, are solved to
 * the fewest moves, and what is counted is the boards it saw and the time it took. Run with
 * `node scripts/ladder.mjs limit`.
 */
const open = { par: [0, 99], compact: true } as const;
export const LIMIT_BOARDS: readonly (Recipe & { name: string })[] = [
  { name: '3x3, 4 dice', slot: 101, size: 3, dice: 4, faces: [2, 3], ...open },
  { name: '4x4, 7 dice', slot: 102, size: 4, dice: 7, faces: [2, 3], ...open },
  { name: '4x4, 10 dice', slot: 103, size: 4, dice: 10, faces: [2, 3, 4], ...open, compact: false },
  { name: '5x5, 10 dice', slot: 104, size: 5, dice: 10, faces: [2, 3, 4], ...open, compact: false },
];

export interface LimitRow {
  name: string;
  seed: number;
  par: number | null;
  exhausted: boolean;
  states: number;
  ms: number;
}

export function solverLimit(boards: number, maxStates: number, only?: string, say?: (row: LimitRow) => void): LimitRow[] {
  const rows: LimitRow[] = [];
  for (const recipe of LIMIT_BOARDS) {
    if (only && !recipe.name.startsWith(only)) continue;
    let laid = 0;
    for (let seed = 1; laid < boards && seed < 1000; seed++) {
      const spec = candidate(recipe, seed);
      if (!spec) continue;
      laid++;
      const from = Date.now();
      const { solution, exhausted, states } = solveLevel(spec, { maxStates });
      const row = { name: recipe.name, seed, par: solution?.par ?? null, exhausted, states, ms: Date.now() - from };
      rows.push(row);
      say?.(row);
    }
  }
  return rows;
}
