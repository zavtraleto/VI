import { DELTA, DIRS, cubeAt } from './board';
import { resolveMove } from './movement';
import type { Cube, Dir, MoveKind, RunState } from './types';

export interface MovePreview {
  kind: MoveKind | 'blocked';
  /** Top value the moved cube will show; set for roll and push. */
  top?: number;
  /** The step would start a clear, extend a chain or trigger Happy One. */
  clears: boolean;
}

/**
 * Would a cube showing `value` clear if the player moved it to (x, z)? `movingId` is the
 * cube being moved, `over` the low sinking cube it would replace.
 */
function wouldClear(
  state: RunState,
  movingId: number,
  x: number,
  z: number,
  value: number,
  ridden: boolean,
  over: Cube | undefined,
): boolean {
  const others = (cx: number, cz: number) =>
    DIRS.map((d) => cubeAt(state, cx + DELTA[d].dx, cz + DELTA[d].dz)).filter(
      (c): c is Cube => c !== undefined && c.id !== movingId && c !== over,
    );

  if (value === 1) {
    const chained = (c: Cube) => c.state === 'sinking' && c.reactionId !== 0;
    if (!(over && over.reactionId !== 0) && !others(x, z).some(chained)) return false;
    // A pushed 1 sinks itself; a ridden 1 stays, so it needs another 1 to take away.
    if (!ridden || state.config.experiments.soloOne) return true;
    return state.cubes.some((c) => c.id !== movingId && c.state === 'idle' && c.ori.top === 1);
  }

  if (over && over.reactionId !== 0 && over.ori.top === value) return true;
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
    return {
      kind: intent.kind,
      top,
      clears: wouldClear(state, intent.cube.id, intent.cubeX, intent.cubeZ, top, intent.kind === 'roll', intent.over),
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
