import { DELTA, DIRS, cubeAt } from './board';
import { resolveMove } from './movement';
import type { Dir, MoveKind, RunState } from './types';

export interface MovePreview {
  kind: MoveKind | 'blocked';
  /** Top value the moved cube will show; set for roll and push. */
  top?: number;
  /** The step would start a clear, extend a chain or trigger Happy One. */
  clears: boolean;
}

/** Would a cube showing `value` clear if it stood at (x, z)? `movingId` is the cube being moved. */
function wouldClear(state: RunState, movingId: number, x: number, z: number, value: number, shielded: boolean): boolean {
  const others = (cx: number, cz: number) =>
    DIRS.map((d) => cubeAt(state, cx + DELTA[d].dx, cz + DELTA[d].dz)).filter(
      (c): c is NonNullable<typeof c> => c !== undefined && c.id !== movingId,
    );

  if (value === 1) {
    if (!others(x, z).some((c) => c.state === 'sinking')) return false;
    if (!shielded) return true;
    return state.cubes.some((c) => c.id !== movingId && c.state === 'idle' && c.ori.top === 1);
  }

  const seen = new Set<string>([`${x},${z}`]);
  const stack = [{ x, z }];
  let count = 0;
  while (stack.length > 0) {
    const cell = stack.pop()!;
    count++;
    for (const n of others(cell.x, cell.z)) {
      if (n.ori.top !== value) continue;
      if (n.state === 'sinking' && n.reactionId !== 0) return true;
      const key = `${n.x},${n.z}`;
      if (n.state === 'idle' && !seen.has(key)) {
        seen.add(key);
        stack.push({ x: n.x, z: n.z });
      }
    }
  }
  return count >= value;
}

export function previewMove(state: RunState, dir: Dir): MovePreview {
  const intent = resolveMove(state, dir);
  if (intent.kind === 'blocked') return { kind: 'blocked', clears: false };
  if (intent.cube && intent.newOri && intent.cubeX !== undefined && intent.cubeZ !== undefined) {
    const top = intent.newOri.top;
    const shielded = intent.kind === 'roll';
    return {
      kind: intent.kind,
      top,
      clears: wouldClear(state, intent.cube.id, intent.cubeX, intent.cubeZ, top, shielded),
    };
  }
  return { kind: intent.kind, clears: false };
}

export function previewAll(state: RunState): Record<Dir, MovePreview> {
  return {
    N: previewMove(state, 'N'),
    E: previewMove(state, 'E'),
    S: previewMove(state, 'S'),
    W: previewMove(state, 'W'),
  };
}
