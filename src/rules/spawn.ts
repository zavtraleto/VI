import { DELTA, DIRS, cellIndex, cubeAt, cubeHeight, freeCells, inBounds, isFree, nearestFree } from './board';
import { helpChance, spawnIntervalTicks, topWeights } from './config';
import { ALL_ORIENTATIONS, orientationsWithTop, roll } from './orientation';
import { inChain } from './reactions';
import { nextRandom, randomInt } from './rng';
import type { Cube, CubeState, Dir, Orientation, Reaction, RunState } from './types';

export function addCube(
  state: RunState,
  x: number,
  z: number,
  ori: Orientation,
  cubeState: CubeState = 'idle',
): Cube {
  const cube: Cube = { id: state.nextCubeId++, x, z, ori, state: cubeState, t: 0, reactionId: 0 };
  state.cubes.push(cube);
  state.grid[cellIndex(state.config.size, x, z)] = cube.id;
  return cube;
}

function randomOrientation(state: RunState): Orientation {
  return ALL_ORIENTATIONS[randomInt(state, ALL_ORIENTATIONS.length)];
}

/** True when a grid of top values (0 = empty) already holds a clearable group. */
export function hasReadyGroup(tops: number[], size: number): boolean {
  const seen = new Array<boolean>(tops.length).fill(false);
  for (let i = 0; i < tops.length; i++) {
    const value = tops[i];
    if (value < 2 || seen[i]) continue;
    let count = 0;
    const stack = [i];
    seen[i] = true;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      count++;
      const x = cur % size;
      const z = Math.floor(cur / size);
      for (const dir of DIRS) {
        const nx = x + DELTA[dir].dx;
        const nz = z + DELTA[dir].dz;
        if (!inBounds(size, nx, nz)) continue;
        const ni = cellIndex(size, nx, nz);
        if (!seen[ni] && tops[ni] === value) {
          seen[ni] = true;
          stack.push(ni);
        }
      }
    }
    if (count >= value) return true;
  }
  return false;
}

interface Placement {
  x: number;
  z: number;
  ori: Orientation;
}

function tryStartLayout(state: RunState): Placement[] | null {
  const { size, startCubes, startX, startZ } = state.config;
  const cells: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (i !== cellIndex(size, startX, startZ)) cells.push(i);
  }
  // Partial Fisher-Yates: the first startCubes - 1 entries become the picked cells.
  for (let i = 0; i < startCubes - 1; i++) {
    const j = i + randomInt(state, cells.length - i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const picked = [cellIndex(size, startX, startZ), ...cells.slice(0, startCubes - 1)];
  const tops = new Array<number>(size * size).fill(0);
  const layout: Placement[] = picked.map((i) => {
    const ori = randomOrientation(state);
    tops[i] = ori.top;
    return { x: i % size, z: Math.floor(i / size), ori };
  });

  let cubeNeighbours = 0;
  let emptyNeighbours = 0;
  for (const dir of DIRS) {
    const nx = startX + DELTA[dir].dx;
    const nz = startZ + DELTA[dir].dz;
    if (!inBounds(size, nx, nz)) continue;
    if (tops[cellIndex(size, nx, nz)] > 0) cubeNeighbours++;
    else emptyNeighbours++;
  }
  if (cubeNeighbours === 0 || emptyNeighbours === 0) return null;
  if (hasReadyGroup(tops, size)) return null;
  return layout;
}

const FALLBACK_CELLS: readonly [number, number][] = [
  [3, 4], [4, 4], [0, 0], [2, 0], [4, 0], [6, 0], [1, 2],
  [3, 2], [5, 2], [0, 4], [6, 4], [0, 6], [2, 6], [4, 6],
];

export function fallbackLayout(count = FALLBACK_CELLS.length): Placement[] {
  const ori = orientationsWithTop(6)[0];
  return FALLBACK_CELLS.slice(0, count).map(([x, z]) => ({ x, z, ori }));
}

export function placeStartLayout(state: RunState, forceFallback = false): void {
  const { startCubes, startX, startZ } = state.config;
  let layout: Placement[] | null = null;
  for (let attempt = 0; attempt < 100 && !forceFallback && !layout; attempt++) {
    layout = tryStartLayout(state);
  }
  if (!layout) {
    layout = fallbackLayout(startCubes);
    // The fallback is drawn for the usual start cell; any other start takes its first cube.
    if (!layout.some((p) => p.x === startX && p.z === startZ)) layout[0] = { ...layout[0], x: startX, z: startZ };
  }
  for (const p of layout) addCube(state, p.x, p.z, p.ori);
}

/** Top values of everything that will be resting on the board: cubes and announced spawns. */
function topsGrid(state: RunState): number[] {
  const size = state.config.size;
  const tops = new Array<number>(state.grid.length).fill(0);
  for (const c of state.cubes) {
    if (c.state !== 'sinking') tops[cellIndex(size, c.x, c.z)] = c.ori.top;
  }
  for (const p of state.pending) tops[cellIndex(size, p.x, p.z)] = p.ori.top;
  return tops;
}

/** Size of the same-value group that cell `i` belongs to. */
function groupSizeAt(tops: number[], size: number, i: number): number {
  const value = tops[i];
  const seen = new Set<number>([i]);
  const stack = [i];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const x = cur % size;
    const z = Math.floor(cur / size);
    for (const dir of DIRS) {
      const nx = x + DELTA[dir].dx;
      const nz = z + DELTA[dir].dz;
      if (!inBounds(size, nx, nz)) continue;
      const ni = cellIndex(size, nx, nz);
      if (!seen.has(ni) && tops[ni] === value) {
        seen.add(ni);
        stack.push(ni);
      }
    }
  }
  return seen.size;
}

/** A cube showing `top` here would look like it should join a running chain or Happy One. */
function besideMatchingSinking(state: RunState, x: number, z: number, top: number): boolean {
  for (const dir of DIRS) {
    const n = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
    if (n && n.state === 'sinking' && (top === 1 || n.ori.top === top)) return true;
  }
  return false;
}

/** Picks an index with probability proportional to its weight. */
function weightedIndex(state: RunState, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = nextRandom(state) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

function orientationWithTop(state: RunState, top: number): Orientation {
  const options = orientationsWithTop(top);
  return options[randomInt(state, options.length)];
}

/** Top values of the resting cubes around a cell: the ones a new cube could pair up with. */
function neighbourTops(state: RunState, x: number, z: number): number[] {
  const tops: number[] = [];
  for (const dir of DIRS) {
    const n = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
    if (n && n.state === 'idle' && n.ori.top >= 2) tops.push(n.ori.top);
  }
  return tops;
}

/**
 * A cube showing `top` on this cell would neither complete a group by itself nor look as if
 * it had joined a chain: clears are the player's doing.
 */
function staysQuiet(state: RunState, tops: number[], x: number, z: number, top: number): boolean {
  const size = state.config.size;
  const i = cellIndex(size, x, z);
  const before = tops[i];
  tops[i] = top;
  const readyGroup = top >= 2 && groupSizeAt(tops, size, i) >= top;
  tops[i] = before;
  return !readyGroup && !besideMatchingSinking(state, x, z, top);
}

/**
 * Picks an orientation for a new cube. The top value follows the level's weights; a
 * helpful spawn instead tries to show a value that a neighbour already shows, so the
 * player is one move away from a group. Either way the cube must not complete a group by
 * itself.
 */
function chooseOrientation(state: RunState, x: number, z: number, helpful = false): Orientation {
  const tops = topsGrid(state);
  const weights = topWeights(state.config, state.level);
  const wanted = helpful ? neighbourTops(state, x, z) : [];
  let top = 1;
  for (let attempt = 0; attempt < 12; attempt++) {
    top =
      attempt < 3 && wanted.length > 0
        ? wanted[randomInt(state, wanted.length)]
        : weightedIndex(state, weights) + 1;
    if (staysQuiet(state, tops, x, z, top)) break;
  }
  return orientationWithTop(state, top);
}

/** Cards in the decks that decide which spawns feed a running chain and which are helpful. */
const FEED_DECK = 5;
const HELP_DECK = 10;

/**
 * Yes or no, with `rate` of the answers being yes. The answer is dealt from a small shuffled
 * deck rather than tossed each time, so the help neither dries up nor comes in a row. A deck
 * is used up before the next one is made, whatever the rate has become meanwhile.
 */
function deal(state: RunState, deck: boolean[], size: number, rate: number): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  if (deck.length === 0) {
    const yes = Math.round(size * rate);
    for (let i = 0; i < size; i++) deck.push(i < yes);
    for (let i = size - 1; i > 0; i--) {
      const j = randomInt(state, i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return deck.pop()!;
}

/**
 * Steps from the player to every cell, -1 where there is no way. On the floor the way lies
 * over free cells; up on the cubes it lies over free cells and standing cubes, and a rising
 * cube is a wall.
 */
function reach(state: RunState): number[] {
  const { size } = state.config;
  const { player } = state;
  const up = player.level === 'top';
  const steps = new Array<number>(size * size).fill(-1);
  const start = cellIndex(size, player.x, player.z);
  steps[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const x = cur % size;
    const z = Math.floor(cur / size);
    for (const dir of DIRS) {
      const nx = x + DELTA[dir].dx;
      const nz = z + DELTA[dir].dz;
      if (!inBounds(size, nx, nz)) continue;
      const next = cellIndex(size, nx, nz);
      if (steps[next] !== -1) continue;
      const cube = cubeAt(state, nx, nz);
      if (cube && (!up || cube.state === 'rising')) continue;
      steps[next] = steps[cur] + 1;
      queue.push(next);
    }
  }
  return steps;
}

/** Rolls that turn up a side the camera shows: the south face going north, the east one going west. */
const SHOWN_ROLLS: readonly Dir[] = ['N', 'W'];

/**
 * A cube for the chain that is running. It comes up one move away from the sinking cubes,
 * never next to them: either with the chain's value on top, to be pushed in from the floor,
 * or with that value on a side the camera shows, so that one roll turns it up. Bringing it
 * in, and in time, is still the player's doing.
 */
function chainFeeder(state: RunState, free: readonly { x: number; z: number }[]): Placement | null {
  let reaction: Reaction | undefined;
  for (const r of state.reactions) {
    if (!reaction || r.chain > reaction.chain) reaction = r;
  }
  if (!reaction) return null;
  const { id, value } = reaction;
  const chain = state.cubes.filter((c) => inChain(c) && c.reactionId === id);
  if (chain.length === 0 || !deal(state, state.feedDeck, FEED_DECK, state.config.feedRate)) return null;

  const isOpen = (x: number, z: number) => free.some((c) => c.x === x && c.z === z);
  const touchesChain = (x: number, z: number) => chain.some((c) => Math.abs(c.x - x) + Math.abs(c.z - z) === 1);
  const tops = topsGrid(state);
  const steps = reach(state);
  const { size } = state.config;
  // A push is made from the floor and a roll from on top: the cube suits where the player is.
  const onFloor = state.player.level === 'ground';
  const options: { x: number; z: number; oris: readonly Orientation[] }[] = [];
  const weights: number[] = [];
  for (const { x, z } of free) {
    if (touchesChain(x, z)) continue;
    const to = steps[cellIndex(size, x, z)];
    const near = to >= 0 && to <= 4 ? 2 : 1;
    for (const dir of DIRS) {
      const { dx, dz } = DELTA[dir];
      // The cell the cube is brought to: empty, and next to the chain.
      if (!isOpen(x + dx, z + dz) || !touchesChain(x + dx, z + dz)) continue;
      // A push needs floor behind the cube for the player to stand on.
      if (isOpen(x - dx, z - dz) && staysQuiet(state, tops, x, z, value)) {
        options.push({ x, z, oris: orientationsWithTop(value) });
        weights.push((onFloor ? 3 : 1) * near);
      }
      if (!SHOWN_ROLLS.includes(dir)) continue;
      const oris = ALL_ORIENTATIONS.filter((o) => roll(o, dir).top === value && staysQuiet(state, tops, x, z, o.top));
      if (oris.length > 0) {
        options.push({ x, z, oris });
        weights.push((onFloor ? 1 : 3) * near);
      }
    }
  }
  if (options.length === 0) return null;
  const { x, z, oris } = options[weightedIndex(state, weights)];
  return { x, z, ori: oris[randomInt(state, oris.length)] };
}

/**
 * How much a helpful spawn favours a cell, by the player's steps to it. Up on the cubes a new
 * cube right beside the player is in the way and one a couple of steps off is material; on
 * the floor the nearest cube is the way back up.
 */
const NEAR_UP: readonly number[] = [1, 2, 8, 8, 5, 3, 2];
const NEAR_FLOOR: readonly number[] = [1, 10, 8, 5, 3, 2, 2];
const NEAR_FAR = 1;
const NEAR_NO_WAY = 0.25;
/** A cell that touches other cubes is this much likelier: the new cube lands among them. */
const NEAR_TOUCHING = 1.6;

/**
 * Where the next cube goes. A helpful spawn prefers cells the player can get to in a few
 * steps and cells that touch other cubes, so new cubes are in play at once; otherwise any
 * free cell will do.
 */
function chooseCell(
  state: RunState,
  free: readonly { x: number; z: number }[],
  helpful: boolean,
): { x: number; z: number } {
  if (!helpful) return free[randomInt(state, free.length)];
  const steps = reach(state);
  const near = state.player.level === 'ground' ? NEAR_FLOOR : NEAR_UP;
  const weights = free.map((cell) => {
    const to = steps[cellIndex(state.config.size, cell.x, cell.z)];
    const touching = DIRS.some((dir) => {
      const n = cubeAt(state, cell.x + DELTA[dir].dx, cell.z + DELTA[dir].dz);
      return n !== undefined && n.state !== 'sinking';
    });
    return (to < 0 ? NEAR_NO_WAY : (near[to] ?? NEAR_FAR)) * (touching ? NEAR_TOUCHING : 1);
  });
  return free[weightedIndex(state, weights)];
}

export function spawnCube(state: RunState, x: number, z: number, ori: Orientation): Cube {
  const cube = addCube(state, x, z, ori, 'rising');
  state.events.push({ type: 'spawn', cubeId: cube.id });
  const { player } = state;
  if (player.level === 'ground' && player.x === x && player.z === z) {
    player.level = 'top';
    state.events.push({ type: 'lifted' });
  }
  return cube;
}

function hasPendingAt(state: RunState, x: number, z: number): boolean {
  return state.pending.some((p) => p.x === x && p.z === z);
}

/** Announces a cube on a cell; it starts rising when the warning runs out. */
function announce(state: RunState, x: number, z: number, ori: Orientation): void {
  if (state.config.warnTicks <= 0) {
    spawnCube(state, x, z, ori);
    return;
  }
  state.pending.push({ x, z, ori, t: 0 });
  state.events.push({ type: 'warned', x, z });
}

function advancePending(state: RunState): void {
  if (state.pending.length === 0) return;
  const due: typeof state.pending = [];
  state.pending = state.pending.filter((p) => {
    p.t++;
    if (p.t < state.config.warnTicks) return true;
    due.push(p);
    return false;
  });
  for (const p of due) {
    // If something has moved onto the announced cell, the cube comes up in the nearest free one.
    const cell = isFree(state, p.x, p.z) ? p : nearestFree(state, p.x, p.z);
    if (cell) spawnCube(state, cell.x, cell.z, p.ori);
  }
}

/** Cubes on the board plus those already announced. */
function committed(state: RunState): number {
  return state.cubes.length + state.pending.length;
}

/**
 * Cubes in play: resting, rising or announced. A sinking cube is on its way out, so what the
 * player clears starts coming back the moment it is cleared.
 */
export function population(state: RunState): number {
  return state.cubes.filter((c) => c.state !== 'sinking').length + state.pending.length;
}

/**
 * Is a way back up already there for a player on the ground: a cube announced on a cell they
 * can walk to, or a rising one they can walk up to and still step onto?
 */
function hasWayUp(state: RunState): boolean {
  const { config } = state;
  const steps = reach(state);
  const within = (x: number, z: number) => inBounds(config.size, x, z) && steps[cellIndex(config.size, x, z)] >= 0;
  if (state.pending.some((p) => within(p.x, p.z))) return true;
  return state.cubes.some(
    (c) =>
      c.state === 'rising' &&
      cubeHeight(c, config) <= config.mountHeight &&
      DIRS.some((dir) => within(c.x + DELTA[dir].dx, c.z + DELTA[dir].dz)),
  );
}

/**
 * Lift: a player left on the ground gets the next cube under their feet. It is a last
 * resort, not an extra cube: it waits while another way up is within the player's reach, and
 * it takes the place of the next regular spawn.
 */
function runLift(state: RunState): void {
  const { config, player } = state;
  if (!config.experiments.floorLift || player.level !== 'ground') {
    state.liftTimer = 0;
    return;
  }
  state.liftTimer++;
  if (state.liftTimer < config.floorLiftTicks) return;
  if (hasWayUp(state)) return;
  if (!isFree(state, player.x, player.z)) return;
  if (committed(state) >= config.size * config.size) return;
  state.liftTimer = 0;
  state.spawnTimer = 0;
  announce(state, player.x, player.z, chooseOrientation(state, player.x, player.z));
}

/** Timed spawn. Never queues spawns while the board is full. */
export function runSpawn(state: RunState): void {
  advancePending(state);
  if (!state.spawnEnabled) return;
  runLift(state);

  const { config } = state;
  const free = freeCells(state).filter((c) => !hasPendingAt(state, c.x, c.z));
  const gentle = config.experiments.gentleStart && state.tick < config.gentleTicks;
  if (free.length === 0 || (gentle && committed(state) >= config.warnOccupied)) {
    state.spawnTimer = 0;
    return;
  }
  state.spawnTimer++;
  if (state.spawnTimer < spawnIntervalTicks(config, state.level, population(state))) return;
  state.spawnTimer = 0;
  const feeder = chainFeeder(state, free);
  if (feeder) {
    announce(state, feeder.x, feeder.z, feeder.ori);
    return;
  }
  const helpful = deal(state, state.helpDeck, HELP_DECK, helpChance(config, state.level));
  const cell = chooseCell(state, free, helpful);
  announce(state, cell.x, cell.z, chooseOrientation(state, cell.x, cell.z, helpful));
}
