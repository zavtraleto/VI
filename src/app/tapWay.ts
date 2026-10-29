import { DELTA, DIRS, cubeAt, resolveMove, step as tick, type Dir, type GameEvent, type MoveKind, type RunState } from '../rules';

/** A step of the way a tap asks for: where it goes, and what the rules are to make of it. */
export interface TapStep {
  dir: Dir;
  kind: MoveKind;
}

/**
 * What a tap on a cell asks for (docs/superpowers/specs/2026-10-29-vi-tap-control-design.md):
 * `roll` takes the player's die along a line to the cell, `push` shoves the die beside the player
 * on the floor, `walk` goes there by steps that move no die. Null where none of them leads.
 */
export interface TapWay {
  kind: 'roll' | 'push' | 'walk';
  steps: TapStep[];
}

/** The kinds of step that move no die and spend no move: the walk is made of them alone. */
const FREE: readonly MoveKind[] = ['hop', 'walk', 'mount', 'climb', 'descend'];
/** A step that touches the floor costs this many steps up on the dice: the walk keeps to the dice where it can. */
const FLOOR_COST = 4;

/**
 * The way a tap on the cell (x, z) asks for, worked out on the board as it stands; nothing is
 * moved. The board is only read, and the rules decide every step: no step goes on a slant.
 */
export function planTap(state: RunState, x: number, z: number): TapWay | null {
  const { player } = state;
  if (x === player.x && z === player.z) return null;
  // A die that is going is walked to where steps lead to it; where they do not, the die under the player is rolled over it.
  if (cubeAt(state, x, z)?.state === 'sinking') return walkTo(state, x, z) ?? rollTo(state, x, z);
  return rollTo(state, x, z) ?? pushTo(state, x, z) ?? walkTo(state, x, z);
}

/**
 * Up on a die that rolls, a tap on an empty cell in its row or column rolls the die there, a cell
 * at a time; so does a tap on a die that is going, which the die rolled onto it covers.
 */
function rollTo(state: RunState, x: number, z: number): TapWay | null {
  const { player } = state;
  const there = cubeAt(state, x, z);
  if (player.level !== 'top' || (there && there.state !== 'sinking')) return null;
  const dir = lineDir(player.x, player.z, x, z);
  if (!dir) return null;
  if (resolveMove(state, dir).kind !== 'roll') return null;
  const count = Math.abs(x - player.x) + Math.abs(z - player.z);
  return { kind: 'roll', steps: Array.from({ length: count }, () => ({ dir, kind: 'roll' as const })) };
}

/** On the floor, a tap on the die beside the player pushes it, once. */
function pushTo(state: RunState, x: number, z: number): TapWay | null {
  const { player } = state;
  if (player.level !== 'ground') return null;
  const dir = DIRS.find((d) => player.x + DELTA[d].dx === x && player.z + DELTA[d].dz === z);
  if (!dir || resolveMove(state, dir).kind !== 'push') return null;
  return { kind: 'push', steps: [{ dir, kind: 'push' }] };
}

/**
 * The cheapest way to the cell by steps that move no die: onto the die that stands there, or
 * onto its floor where none does. A step on the floor costs more than one on the dice, so the walk
 * keeps to them where it can; of two as cheap the first found is kept.
 */
function walkTo(state: RunState, x: number, z: number): TapWay | null {
  const { size } = state.config;
  const cells = size * size;
  const goal = x + z * size + (cubeAt(state, x, z) ? 0 : cells);
  const { player } = state;
  // The board is read and never written: only the player of this copy is moved about.
  const board: RunState = { ...state, player: { x: player.x, z: player.z, level: player.level } };
  const start = player.x + player.z * size + (player.level === 'ground' ? cells : 0);
  const cost = new Float64Array(2 * cells).fill(Infinity);
  const from = new Int32Array(2 * cells).fill(-1);
  const step: (TapStep | null)[] = new Array(2 * cells).fill(null);
  const done = new Uint8Array(2 * cells);
  cost[start] = 0;
  for (;;) {
    // The boards are small: the cheapest place left is looked for among them all.
    let place = -1;
    for (let i = 0; i < 2 * cells; i++) if (!done[i] && cost[i] < Infinity && (place < 0 || cost[i] < cost[place])) place = i;
    if (place < 0) return null;
    if (place === goal) break;
    done[place] = 1;
    const up = place < cells;
    const cell = up ? place : place - cells;
    board.player.x = cell % size;
    board.player.z = Math.floor(cell / size);
    board.player.level = up ? 'top' : 'ground';
    for (const dir of DIRS) {
      const intent = resolveMove(board, dir);
      if (intent.kind === 'blocked' || !FREE.includes(intent.kind)) continue;
      const down = intent.kind === 'walk' || intent.kind === 'descend';
      const next = intent.tx + intent.tz * size + (down ? cells : 0);
      const price = cost[place] + (down || !up ? FLOOR_COST : 1);
      if (done[next] || price >= cost[next]) continue;
      cost[next] = price;
      from[next] = place;
      step[next] = { dir, kind: intent.kind };
    }
  }
  const steps: TapStep[] = [];
  for (let at = goal; at !== start; at = from[at]) steps.push(step[at]!);
  steps.reverse();
  return { kind: 'walk', steps };
}

/** The side (x2, z2) lies on from (x1, z1), where it is in the same row or column. */
function lineDir(x1: number, z1: number, x2: number, z2: number): Dir | null {
  if (x1 !== x2 && z1 !== z2) return null;
  const dx = Math.sign(x2 - x1);
  const dz = Math.sign(z2 - z1);
  return DIRS.find((d) => DELTA[d].dx === dx && DELTA[d].dz === dz) ?? null;
}

/** An event of a group made: a combo, a link of a chain, or the ones swept away. A roll a tap asked for stops at it. */
export function makesGroup(event: GameEvent): boolean {
  return event.type === 'match' || event.type === 'chain' || event.type === 'happyOne';
}

/**
 * Whether a step of a tap's way is still the step it was planned as: the board is played a tick
 * on, on a copy, with no command, as the rules will have it when the step is made (the die rolled
 * last lands on that tick). With `afterMove` a group made on that tick ends the way: a roll stops
 * where it makes one.
 */
export function stepHolds(state: RunState, step: TapStep, afterMove: boolean): boolean {
  const probe = structuredClone(state);
  tick(probe, null);
  if (probe.over) return false;
  if (afterMove && probe.events.some(makesGroup)) return false;
  return resolveMove(probe, step.dir).kind === step.kind;
}
