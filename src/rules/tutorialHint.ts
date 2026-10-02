import { DIRS } from './board';
import { step } from './sim';
import type { Dir, RunState } from './types';

/** The longest way that is looked for, in moves, and the most positions that are tried. */
const MAX_MOVES = 9;
const MAX_TRIED = 500;

/** What tells two positions apart: where the player is, and every die with how it lies. */
function signature(state: RunState): string {
  const { player } = state;
  const dice = state.cubes
    .map((cube) => `${cube.x},${cube.z},${cube.ori.top}${cube.ori.north},${cube.state === 'sinking' ? 's' : cube.state === 'rising' ? 'r' : 'i'}`)
    .sort()
    .join(';');
  return `${player.x},${player.z},${player.level}|${dice}`;
}

/**
 * The shortest way from where the player is to the end of the part of the lesson in hand, for
 * a player who has left the way the lesson was laid for. It is found by trying moves on copies
 * of the run with the rules themselves, breadth first. `null` when there is no way within
 * reach: the lesson has to be laid out again (`tutorialRestart`).
 *
 * It is for whoever shows the way, and is asked only when the position has changed: a search
 * costs some milliseconds.
 */
export function tutorialHint(state: RunState): Dir[] | null {
  const tutorial = state.tutorial;
  if (!tutorial || tutorial.done) return null;
  const from = tutorial.step;
  const seen = new Set<string>([signature(state)]);
  let front: { state: RunState; path: Dir[] }[] = [{ state, path: [] }];
  let tried = 0;

  for (let depth = 0; depth < MAX_MOVES && front.length > 0; depth++) {
    const next: typeof front = [];
    for (const node of front) {
      for (const dir of DIRS) {
        if (++tried > MAX_TRIED) return null;
        const copy = structuredClone(node.state);
        step(copy, dir);
        if (!copy.player.action) continue;
        // The move is played out to its end: what it brings about happens when the die lands.
        let done = copy.tutorial!.done || copy.tutorial!.step !== from;
        for (let i = 0; i <= copy.config.actionTicks + 1 && !done; i++) {
          step(copy, null);
          done = copy.tutorial!.done || copy.tutorial!.step !== from;
        }
        const path = [...node.path, dir];
        if (done) return path;
        const key = signature(copy);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state: copy, path });
      }
    }
    front = next;
  }
  return null;
}
