import { DELTA, DIRS, cubeAt } from '../rules/board';
import { faceWorks } from '../rules/reactions';
import type { Cube, RunState } from '../rules/types';
import type { ShortGroup } from '../rules/level';

/**
 * The plaques of the stages of the first level, from the board as it stands: over every standing
 * die of a face that works, and over every heap of such dice side by side, that is smaller than
 * the combo its face asks for, from the first moment. `shortGroups` starts at two dice and counts
 * the die the player stands on; here a lone die has its plaque too, and the die under the
 * player's feet has none, for it is not left as it is. A die that is going is not standing.
 */
export function firstCounters(state: RunState): ShortGroup[] {
  const own = state.player.level === 'top' ? cubeAt(state, state.player.x, state.player.z) : undefined;
  const standing = state.cubes.filter((cube) => cube.state === 'idle' && cube !== own).sort((a, b) => a.z - b.z || a.x - b.x);
  const groups: ShortGroup[] = [];
  const seen = new Set<number>();
  for (const first of standing) {
    const value = first.ori.top;
    if (value < 2 || seen.has(first.id) || !faceWorks(state, value)) continue;
    const members: Cube[] = [first];
    seen.add(first.id);
    for (let i = 0; i < members.length; i++) {
      for (const dir of DIRS) {
        const next = cubeAt(state, members[i].x + DELTA[dir].dx, members[i].z + DELTA[dir].dz);
        if (!next || next === own || next.state !== 'idle' || next.ori.top !== value || seen.has(next.id)) continue;
        seen.add(next.id);
        members.push(next);
      }
    }
    if (members.length < value) groups.push({ value, have: members.length, need: value, cells: members.map(({ x, z }) => ({ x, z })) });
  }
  return groups;
}
