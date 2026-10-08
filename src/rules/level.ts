import { DELTA, DIRS, cellIndex, cubeAt, inBounds } from './board';
import { canMove, scan } from './reach';
import { faceWorks } from './reactions';
import { refillLevel } from './spawn';
import type { Cube, GoalLine, LevelRun, LevelSpec, RulesConfig, RunState } from './types';

/**
 * A level: a run the world of which moves only with a move. A move is a roll or a push; while
 * the player thinks, or steps from die to die, the dice stand as they are. A group goes in a
 * number of moves and not of seconds; whether dice come, and for whom, is the level's own; and
 * the level ends the moment its goal is met or its moves are spent.
 *
 * A die on its way out is glass at once: it can be rolled over from the first move. So a step
 * from a group onto a die that stands is a commitment: the way back is a roll, not a step.
 *
 * A level may be a board given die by die. Such a board is the same every time, nothing comes
 * to it, and a board to be cleared is lost at a dead end: one die standing and nothing going.
 * It may name a die as leaving from the start, a combo of one with so many moves left to it, and
 * may start the player on the floor: beside such a die, that is the way up.
 *
 * A level may shut its floor: the player then stays on the dice, and a board to be cleared is
 * lost as well where the player has no move left, on a leaving die with no die to step to.
 *
 * On a board nothing comes to, the floor is strict: a die that cannot be pushed is not climbed
 * from it, and the one way up is a die that is leaving. Up on the dice a die is rolled and shows
 * another face; down on the floor it is pushed and shows the same one. So the floor is a part of
 * the way and not a place to wander: a board to be cleared is lost there as well, where the
 * player has nothing to push and nothing to go up by, or where too few dice show a face that
 * works for any combo, since a push turns no die.
 *
 * A board nothing comes to has no shelves. In a session, and on a level that dice come to, the
 * free cells beside a chain are a step: the player comes down onto them and goes up from them
 * onto any die. On a board to be cleared they are floor like any other: a die with room behind
 * it is pushed from there, and stepped onto only where it cannot be. No board of the ladder is
 * cleared in fewer moves with the shelves than without, and a rule that changes nothing is not
 * taught.
 */

/** Moves a group takes to go: a die that lands on any of them joins it. */
export const LEVEL_SINK_MOVES = 6;
/** Moves a new link gives back to the dice of the chain it joined. */
export const LEVEL_LIFT_MOVES = 2;
/**
 * How high a die stands from the moment it comes: as glass, with its faces to be read, for as
 * long as the player thinks. It takes the next beat to come up whole.
 */
export const LEVEL_GHOST_HEIGHT = 0.5;
/** Dice that come in one beat while the board is short of its number. */
export const LEVEL_REFILL = 1;
/** Share of the dice that come placed and turned to be of use. */
export const LEVEL_HELP_RATE = 0.65;
/** Moves that may be taken back in one try of a level, unless the level says otherwise. */
export const LEVEL_UNDOS = 3;

/**
 * A board given die by die has to be a board: every die on a cell of its own, as many of them
 * as the level says, and the player starting on one. Where cells are cut out of it, each is a
 * cell of the square, cut out once, no die stands on one, and what is left holds together by
 * its sides: a board in two parts is two boards. Where the player starts on the floor, the start
 * is a cell of the board with no die on it. The player does not start on a fixed die: there
 * would be nothing to roll. A die named as leaving is one of the dice laid, and
 * goes in a move at the least and in no more than a combo of the level does. Anything else is a
 * mistake in the level, and it says so.
 */
function checkLayout(spec: LevelSpec): void {
  const wrong = (what: string): never => {
    throw new Error(`level ${spec.id}: ${what}`);
  };
  const { size } = spec;
  const holes = new Set<string>();
  for (const { x, z } of spec.holes ?? []) {
    if (!inBounds(size, x, z)) wrong(`a cell cut out that is off the board at ${x},${z}`);
    if (holes.has(`${x},${z}`)) wrong(`a cell cut out twice at ${x},${z}`);
    holes.add(`${x},${z}`);
  }
  if (holes.size > 0) {
    const cells: { x: number; z: number }[] = [];
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) if (!holes.has(`${x},${z}`)) cells.push({ x, z });
    if (cells.length === 0) wrong('every cell is cut out');
    const reached = new Set([`${cells[0].x},${cells[0].z}`]);
    const queue = [cells[0]];
    for (let at = 0; at < queue.length; at++) {
      for (const dir of DIRS) {
        const x = queue[at].x + DELTA[dir].dx;
        const z = queue[at].z + DELTA[dir].dz;
        if (!inBounds(size, x, z) || holes.has(`${x},${z}`) || reached.has(`${x},${z}`)) continue;
        reached.add(`${x},${z}`);
        queue.push({ x, z });
      }
    }
    if (reached.size !== cells.length) wrong('the board is in two parts');
  }
  const { layout } = spec;
  if (!layout) return;
  if (layout.dice.length !== spec.norm) wrong(`${layout.dice.length} dice laid, ${spec.norm} named`);
  const taken = new Set<string>();
  for (const { x, z } of layout.dice) {
    if (!inBounds(size, x, z)) wrong(`a die off the board at ${x},${z}`);
    if (holes.has(`${x},${z}`)) wrong(`a die on a cell that is cut out at ${x},${z}`);
    if (taken.has(`${x},${z}`)) wrong(`two dice at ${x},${z}`);
    taken.add(`${x},${z}`);
  }
  const { start } = layout;
  const at = `${start.x},${start.z}`;
  if (layout.onFloor) {
    if (!inBounds(size, start.x, start.z)) wrong(`a start off the board at ${at}`);
    if (holes.has(at)) wrong(`a start on a cell that is cut out at ${at}`);
    if (taken.has(at)) wrong(`a die on the floor the player starts on at ${at}`);
  } else if (!taken.has(at)) wrong(`no die to start on at ${at}`);
  else if (layout.dice.some((die) => die.fixed && die.x === start.x && die.z === start.z)) wrong(`a start on a fixed die at ${at}`);
  const sinkMoves = spec.sinkMoves ?? LEVEL_SINK_MOVES;
  for (const { die, moves } of layout.leaving ?? []) {
    if (!Number.isInteger(die) || die < 0 || die >= layout.dice.length) wrong(`no die ${die} to be leaving: ${layout.dice.length} are laid`);
    if (!Number.isInteger(moves) || moves < 1 || moves > sinkMoves) wrong(`a die leaving in ${moves} moves, where it is 1 to ${sinkMoves}`);
  }
}

/**
 * The config of a level: a board of its size with the player in the middle. Everything is
 * counted in beats, a beat being the ticks a move takes. A die that comes at the end of one
 * beat stands half up at once and is whole by the end of the next. A group sinks for its moves
 * and a tick: its dice take their first tick of sinking on the tick they land, and with that
 * tick a die landing on the last move of the window still finds the group, and one landing on
 * the next does not. A die that sinks is rolled over and stepped off at any height. What
 * belongs to the pace of Endless is switched off. On a board given die by die the player starts
 * where the board says.
 */
export function levelConfig(config: RulesConfig, spec: LevelSpec): RulesConfig {
  checkLayout(spec);
  const sinkingTicks = (spec.sinkMoves ?? LEVEL_SINK_MOVES) * config.actionTicks + 1;
  const lift = ((spec.liftMoves ?? LEVEL_LIFT_MOVES) * config.actionTicks) / sinkingTicks;
  const middle = Math.floor(spec.size / 2);
  return {
    ...config,
    size: spec.size,
    startX: spec.layout?.start.x ?? middle,
    startZ: spec.layout?.start.z ?? middle,
    startCubes: spec.norm,
    targetCubes: spec.norm,
    warnTicks: 0,
    risingTicks: Math.round(config.actionTicks / (1 - LEVEL_GHOST_HEIGHT)),
    sinkLowHeight: 1,
    stepDownHeight: 1,
    feedRate: spec.feedRate ?? config.feedRate,
    sinkingTicks,
    sinkStartTicks: sinkingTicks,
    sinkFloorTicks: sinkingTicks,
    chainLift: lift,
    chainLiftMin: lift,
    helpRate: spec.helpRate ?? LEVEL_HELP_RATE,
    warnOccupied: spec.size * spec.size,
    wipeBonus: 0,
    custom: false,
    // An object of its own: the one it was given belongs to whoever made the run.
    experiments: {
      ...config.experiments,
      // A board nothing comes to has a strict floor, unless the level says otherwise.
      floorClimb: spec.climb ?? spec.arrival !== 'none',
      dockSteps: spec.arrival !== 'none',
      soloOne: false,
      gentleStart: false,
      floorLift: false,
      chainCalm: false,
      timeFloor: false,
      waves: false,
      surge: false,
      opening: false,
      lastSliver: false,
      gift: false,
    },
  };
}

/** Dice that stand on the board or are coming up: everything that is not on its way out. */
function standing(state: RunState): number {
  return state.cubes.filter((cube) => cube.state !== 'sinking').length;
}

/** The lines of a goal with what a run has of each: no more is shown than was asked for. */
function linesOf(spec: LevelSpec, sent: readonly number[], bestChain: number, cleared: number): GoalLine[] {
  const { goal } = spec;
  const line = (what: GoalLine['what'], value: number, have: number, need: number): GoalLine => ({ what, value, have: Math.min(have, need), need });
  if (goal.kind === 'send') return [line('dice', 0, sent.reduce((sum, count) => sum + count, 0), goal.count)];
  if (goal.kind === 'chain') return [line('links', 0, bestChain, goal.links)];
  if (goal.kind === 'clear') return [line('cleared', 0, cleared, spec.norm)];
  return goal.items.map(({ value, count }) => line('face', value, sent[value - 1] ?? 0, count));
}

/** One line per thing the goal of the level counts, as the run stands. Empty for a run that is not a level. */
export function goalLines(state: RunState): GoalLine[] {
  const run = state.levelRun;
  if (!run) return [];
  return linesOf(run.spec, run.sent, run.bestChain, run.spec.norm - standing(state));
}

/** The goal of a level before its first move: nothing sent, no chain made, every die standing. */
export function goalOf(spec: LevelSpec): GoalLine[] {
  return linesOf(spec, [], 0, 0);
}

export function goalReached(state: RunState): boolean {
  const lines = goalLines(state);
  return lines.length > 0 && lines.every((line) => line.have >= line.need);
}

/**
 * A board to be cleared has come to a dead end: nothing is going, and the dice that stand are
 * too few for any group the level lets them make. One die is always too few; where only 3s
 * work, so are two. The level ends there, and this goes on saying why.
 */
export function levelStuck(state: RunState): boolean {
  const run = state.levelRun;
  if (!run || run.spec.goal.kind !== 'clear') return false;
  if (state.reactions.length > 0 || state.cubes.some((cube) => cube.state === 'moving')) return false;
  const left = standing(state);
  // With nothing going, the dice that stand have to make a group of their own: fewer than the smallest working group cannot.
  return left > 0 && left < smallestGroup(run.spec);
}

/**
 * A level with its floor shut has come to where nothing can be done: dice stand, and the player
 * has no move, standing on a die that is leaving with no die to step to. The world moves only
 * with a move, so it would stand so for good; the level ends there.
 */
export function levelStranded(state: RunState): boolean {
  const run = state.levelRun;
  if (!run || run.spec.goal.kind !== 'clear' || run.spec.floor !== false) return false;
  if (state.cubes.some((cube) => cube.state === 'moving')) return false;
  return standing(state) > 0 && !canMove(state);
}

/**
 * A level with an open floor has come to where nothing can be done: dice stand, and the player
 * has nothing to roll, nothing to push and nothing to go up by. That is the player down on the
 * floor among dice that cannot be pushed; and the player still up on a die that is leaving, with
 * no die to step to and nothing to do on the floor below, which is the same end a step sooner.
 * Where a die that cannot be pushed is climbed there is always a move, and the answer is no.
 */
export function floorStuck(state: RunState): boolean {
  const run = state.levelRun;
  if (!run || !boardGiven(run.spec) || run.spec.floor === false) return false;
  if (state.cubes.some((cube) => cube.state === 'moving')) return false;
  return standing(state) > 0 && !canMove(state);
}

/** A board to be cleared that nothing comes to: what stands on it is all there will ever be, so a dead end of the floor is one for good. */
const boardGiven = (spec: LevelSpec): boolean => spec.goal.kind === 'clear' && spec.arrival === 'none';

/** The faces that make a combo where a level names none. */
const EVERY_FACE: readonly number[] = [2, 3, 4, 5, 6];

/**
 * The player is on the floor, nothing is leaving, no step leads up onto a die, and for no
 * working face do as many dice show it as its combo takes. A push turns no die, so the board
 * cannot be cleared whatever is pushed where. Where a die that cannot be pushed is climbed the
 * way up is there, and the answer is no.
 */
export function floorLost(state: RunState): boolean {
  const run = state.levelRun;
  if (!run || !boardGiven(run.spec) || state.player.level !== 'ground') return false;
  if (state.cubes.length === 0 || state.cubes.some((cube) => cube.state !== 'idle')) return false;
  const { size } = state.config;
  const { places } = scan(state);
  if (state.cubes.some((cube) => places[cellIndex(size, cube.x, cube.z)])) return false;
  const faces = run.spec.faces ?? EVERY_FACE;
  return !faces.some((face) => face >= 2 && state.cubes.filter((cube) => cube.ori.top === face).length >= face);
}

/**
 * Why a board to be cleared can go no further, if it cannot: too few dice stand for a combo
 * (`count`); with the floor shut, the player has no move left (`stranded`); on the floor, there
 * is nothing to push and nothing to go up by (`floor`), or too few dice show a face that works
 * (`faces`). The level ends there, and this goes on saying why.
 */
export type LevelDeadEnd = 'count' | 'stranded' | 'floor' | 'faces';

export function levelDeadEnd(state: RunState): LevelDeadEnd | null {
  if (levelStuck(state)) return 'count';
  if (levelStranded(state)) return 'stranded';
  if (floorStuck(state)) return 'floor';
  return floorLost(state) ? 'faces' : null;
}

/** Dice the smallest group of a level takes: two where every face works, else the least of its faces that makes groups. */
export function smallestGroup(spec: Pick<LevelSpec, 'faces'>): number {
  const groups = (spec.faces ?? [2]).filter((face) => face >= 2);
  return groups.length > 0 ? Math.min(...groups) : Infinity;
}

/** Dice that stand together showing one face, and are too few to go: what they have and what the face asks for. */
export interface ShortGroup {
  value: number;
  have: number;
  need: number;
  cells: { x: number; z: number }[];
}

/**
 * The groups that are short: two or more standing dice of one face side by side, fewer than the
 * face asks for. Two 3s are one; a die alone is not a group, and a 1 makes none.
 */
export function shortGroups(state: RunState): ShortGroup[] {
  const groups: ShortGroup[] = [];
  const seen = new Set<number>();
  const standing = state.cubes.filter((cube) => cube.state === 'idle').sort((a, b) => a.z - b.z || a.x - b.x);
  for (const first of standing) {
    const value = first.ori.top;
    if (value < 2 || seen.has(first.id) || !faceWorks(state, value)) continue;
    const members: Cube[] = [first];
    seen.add(first.id);
    for (let i = 0; i < members.length; i++) {
      for (const dir of DIRS) {
        const next = cubeAt(state, members[i].x + DELTA[dir].dx, members[i].z + DELTA[dir].dz);
        if (!next || next.state !== 'idle' || next.ori.top !== value || seen.has(next.id)) continue;
        seen.add(next.id);
        members.push(next);
      }
    }
    if (members.length >= 2 && members.length < value) groups.push({ value, have: members.length, need: value, cells: members.map(({ x, z }) => ({ x, z })) });
  }
  return groups;
}

/** Open chains: the value and how many more moves a die that lands still joins. */
export function chainWindows(state: RunState): { value: number; moves: number }[] {
  const { actionTicks, sinkingTicks } = state.config;
  const windows: { value: number; moves: number }[] = [];
  for (const reaction of state.reactions) {
    // What a die has left is its way down and the ticks it is held for; the die that has the most keeps the group open.
    const ticks = state.cubes.filter((c) => c.state === 'sinking' && c.reactionId === reaction.id).map((c) => c.t - (c.hold ?? 0));
    if (ticks.length === 0) continue;
    windows.push({ value: reaction.value, moves: Math.floor((sinkingTicks - Math.min(...ticks)) / actionTicks) });
  }
  return windows;
}

/** False while a level holds the world still: the picture must not run ahead of it. */
export function worldRuns(state: RunState): boolean {
  const run = state.levelRun;
  if (!run) return true;
  return !state.over && (run.beat > 0 || state.cubes.some((c) => c.state === 'moving'));
}

/** Counts what the tick has sent: a die is sent on the tick it becomes part of a group. */
function countSent(state: RunState, run: LevelRun): void {
  for (const event of state.events) {
    if (event.type === 'match' || event.type === 'chain') {
      run.sent[event.value - 1] += event.count;
      run.bestChain = Math.max(run.bestChain, event.type === 'chain' ? event.chain : 1);
    } else if (event.type === 'happyOne') {
      run.sent[0] += event.count;
    }
  }
}

/**
 * The end of a beat: the tick a moved die lands, or the last tick of a beat the world played by
 * itself. What the tick has sent is counted towards the goal; the level ends if the goal is met,
 * if its board is at a dead end, or if the moves are spent, and a goal met with the last move is
 * a level passed; and if the level goes on and is one that dice come to, the board gets its next
 * die. A dead end is found on the beat the last group has gone, and not before: while a group is
 * going, the last die may still be brought to it. A player left with no move, or down on the
 * floor among faces that make no combo, is found on the beat that left them so.
 */
export function endBeat(state: RunState): void {
  const run = state.levelRun;
  if (!run || state.over) return;
  countSent(state, run);
  const { spec } = run;
  if (goalReached(state)) {
    state.over = true;
    state.endReason = 'passed';
    state.events.push({ type: 'levelPassed' });
    return;
  }
  if (levelDeadEnd(state) !== null || (spec.moves > 0 && run.moves >= spec.moves)) {
    state.over = true;
    state.endReason = 'failed';
    state.events.push({ type: 'levelFailed' });
    return;
  }
  if (spec.arrival === 'refill') refillLevel(state, LEVEL_REFILL);
}
