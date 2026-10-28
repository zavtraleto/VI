import { cubeHeight, worldRuns, type Cube, type RunState } from '../rules';
import type { ParamSpec, ParamValues } from '../signal/scene';
import { inOutSine, outCubic, outQuad, tween, type Curve } from './ease';
import { BOARD_GROUPS } from './params';

/**
 * How high a die is shown, which is not always how high the rules have it. On a level a die that
 * leaves is shown by steps (docs/art/VI_Interface_Layer.md): a little lower the moment it leaves,
 * near the floor with its last move left to it, and gone after that; from one step to the next it
 * comes down gently with the roll of the figure (`restHeight`, below). A die the board is laid with as
 * leaving, a stair, stands half way up instead of a little lower while it has two moves left. The rules do not read this:
 * a die is stepped onto and rolled over by the height the rules give it (`cubeHeight`). A session
 * is shown as the rules are.
 */

/**
 * The steps, as shares of a whole die: the moment a die leaves, and with its last move left; and
 * where a stair stands with two moves left (`middle`), so that two stairs, one with a move left and
 * one with two, are two steps up from the floor.
 */
export interface LeavingSteps {
  first: number;
  last: number;
  middle: number;
}

/** The steps as the look is set, or as they are defined where the look says nothing of them. */
export function leavingSteps(values?: ParamValues): LeavingSteps {
  const first = Number(values?.leaveFirst ?? BOARD_GROUPS.road.leaveFirst.value);
  const last = Number(values?.leaveLast ?? BOARD_GROUPS.road.leaveLast.value);
  const middle = Number(values?.stairMiddle ?? BOARD_GROUPS.road.stairMiddle.value);
  return { first, last, middle };
}

/**
 * The height a die that leaves is shown at, from the share of its time to go that is left
 * (`share`, 1 the moment it leaves and 0 when it is gone) and the moves it goes in. A whole share
 * is the first step, or the middle one for a stair (`stair`); the share of one move is the last
 * step; nothing is nothing. In between it is the straight line from one to the next, so a die goes
 * down through a move as smoothly as the rules have it, only between other heights.
 */
export function leavingHeight(share: number, sinkMoves: number, steps: LeavingSteps = leavingSteps(), stair = false): number {
  const left = Math.min(1, Math.max(0, share));
  const top = stair ? steps.middle : steps.first;
  if (sinkMoves <= 1) return top * left;
  const lastShare = 1 / sinkMoves;
  if (left >= lastShare) return steps.last + ((top - steps.last) * (left - lastShare)) / (1 - lastShare);
  return (steps.last * left) / lastShare;
}

/**
 * Whether a die that leaves is a stair: one the board was laid with as leaving (`layout.leaving`
 * in `src/rules/spawn.ts`). The rules lay it as a combo of one die, which no combo made on the
 * board is: a stair with two moves left and a pair that has just left are alike in all else.
 */
export function isStair(cube: Cube, state: RunState): boolean {
  if (cube.state !== 'sinking' || cube.reactionId === 0) return false;
  return state.reactions.find((reaction) => reaction.id === cube.reactionId)?.total === 1;
}

/**
 * How much of a die is shown above the floor. `alpha` is the share of the next tick the picture
 * is ahead of the rules; a die on a level whose world stands stays put between ticks. On a level a die that leaves is shown by its steps: its share of time
 * left is counted from the tick it left on, when a whole window of moves is before it, and a die
 * laid as leaving with every move of that window is a die that has just left, shown at the middle
 * step and not the first.
 */
export function shownHeight(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number {
  const ahead = !worldRuns(state) ? 0 : alpha;
  if (!state.levelRun || cube.state !== 'sinking') return cubeHeight(cube, state.config, ahead);
  const { sinkingTicks, actionTicks } = state.config;
  // A level's dice go in so many moves and a tick: the tick is the one they leave on.
  const window = Math.max(1, sinkingTicks - 1);
  const moves = Math.max(1, Math.round(window / Math.max(1, actionTicks)));
  return leavingHeight((sinkingTicks - cube.t - ahead) / window, moves, leavingSteps(values), isStair(cube, state));
}

export type HeightOf = (cube: Cube, alpha: number) => number;

export interface LeavingEvent {
  kind: 'sent' | 'gone';
  /** The face of the group, 1 to 6. */
  value: number;
  cells: readonly { x: number; z: number }[];
  /** The dice it is about; `sent` is for the view only, to let go of their springs. */
  cubeIds: readonly number[];
  /** A `gone` that is the last combo of a board gone under, with every die of the board. */
  final?: boolean;
}

/** Where the dice of a finale go: under the floor, out of sight. */
const UNDER = -0.5;
/** The numbers of the look where the values given say nothing of one. */
const DEFAULTS: Record<string, ParamSpec> = BOARD_GROUPS.leaving;
/** The curves the first sinking of a group may go by, as `dropCurve` picks them: soft at the end, each of them. */
const SINK_CURVES: readonly Curve[] = [outCubic, inOutSine, outQuad];

/** How long the parts of the last combo of a board take, and all of it, to the frame its dice are under. */
export interface FinaleMs {
  hang: number;
  drop: number;
  total: number;
}

/**
 * The time of a finale: the dice stand lit for `finaleHangMs`, then go under the floor together in
 * `finaleDropMs`. With less motion nothing moves: they stand for all of that time, and are gone.
 * Whoever leads the passage to the next board counts its parts from the same numbers.
 */
export function finaleMs(values: ParamValues | undefined, reducedMotion: boolean): FinaleMs {
  const n = (name: string): number => Number(values?.[name] ?? DEFAULTS[name]?.value ?? 0);
  const hang = n('finaleHangMs');
  const drop = n('finaleDropMs');
  return reducedMotion ? { hang: hang + drop, drop: 0, total: hang + drop } : { hang, drop, total: hang + drop };
}

/**
 * Where a die that goes on a level rests, by the rules alone: on the step of the moves its window
 * has behind it, and through a move from that step to the next, gently - slow off the step, slow
 * onto the next (`inOutSine`) - so that it comes down with the roll of the figure and is there as
 * the roll lands. With its last move it goes down to the floor and is gone as it gets there. It
 * reads `cube.t` and nothing else: a move taken back brings it up the same way, a die the rules
 * hold stays where it is, and a player who presses ahead loses no step. Anything else, and
 * anywhere else, is `shownHeight`.
 */
export function restHeight(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number {
  if (!state.levelRun || cube.state !== 'sinking') return shownHeight(cube, state, alpha, values);
  const { sinkingTicks } = state.config;
  const actionTicks = Math.max(1, state.config.actionTicks);
  const window = Math.max(1, sinkingTicks - 1);
  const moves = Math.max(1, Math.round(window / actionTicks));
  const steps = leavingSteps(values);
  const stair = isStair(cube, state);
  const step = (move: number): number => leavingHeight((sinkingTicks - 1 - move * actionTicks) / window, moves, steps, stair);
  // Between ticks the picture is ahead of the rules only while the world runs, and not for a die the rules hold.
  const ahead = !worldRuns(state) || (cube.hold ?? 0) > 0 ? 0 : alpha;
  const done = Math.max(0, (cube.t - 1 + ahead) / actionTicks);
  const move = Math.floor(done);
  return tween(done - move, step(move), step(move + 1), inOutSine);
}

/** A die the show knows to be going: where it is, for the ring of its going, and the sinking it began with. */
interface Going {
  id: number;
  x: number;
  z: number;
  value: number;
  reactionId: number;
  /** `cube.t` as the show last saw it: a die taken with its window run out has gone; one taken sooner was rolled over. */
  t: number;
  /** The height it was drawn at when it was sent, and how long ago that was; -1 for a die that was not sent in sight. */
  from: number;
  ms: number;
  /** How far it is brought up to the last step while the rules hold it: 1 all the way, 0 not at all. */
  lift: number;
}

/**
 * The leaving of a group on a level (spec: docs/superpowers/specs/2026-10-13-vi-leaving-choreography-design.md,
 * section 11). Gentle, and with one accent: the board answers a combo on the tick it is made, and
 * from there the dice only settle. A group that is sent sinks to its first step in one soft
 * movement, all its dice together; with every roll of the figure it comes a step down with the
 * roll (`restHeight`); with the last it goes into the floor, silent. The
 * last combo of a board takes every die of the board under together (`finale`). Nothing here
 * strikes or comes back, but for one thing: a die the rules hold, where a new die has joined its
 * chain, is shown no lower than the last step (`holdRiseMs`), so that it still reads as a die. All in the time of the picture;
 * the rules are read, never written. Outside a level it does nothing.
 */
export class LeavingShow {
  private readonly going = new Map<number, Going>();
  /** The dice that stood whole on the frame before: one of them found going has just been sent. */
  private whole = new Set<number>();
  /** The last combo of a board is on its way under: where every die started from, how long its parts take and how long it has run. Null on a board that is played. */
  private final: (FinaleMs & { ms: number; gone: boolean; from: Map<number, number>; dice: { id: number; x: number; z: number; value: number }[] }) | null = null;

  /** A new board, or the board put on anew: a die found going on it is not sent again. */
  reset(): void {
    this.going.clear();
    this.whole.clear();
    this.final = null;
  }

  /**
   * Once a frame, before the dice are drawn. Says which dice have just been sent (`sent`: the
   * view lets go of their springs), and which groups have gone into the floor with their window
   * run out (`gone`: a ring over the floor). A die rolled over with a move still left to it comes
   * apart as it always did and is not said. `dip` is where the spring of a die holds it, so that
   * a die pressed under the figure sinks from where it is drawn. On a board that is over nothing
   * is said but what was sent; the combo that passes a board is the finale's.
   */
  frame(state: RunState, dtMs: number, reducedMotion: boolean, dip: (cubeId: number) => number, values?: ParamValues): LeavingEvent[] {
    if (!state.levelRun) {
      this.reset();
      return [];
    }
    if (this.final) {
      this.final.ms += dtMs;
      if (this.final.gone || this.final.ms < this.final.total - 1e-6) return [];
      this.final.gone = true;
      const { dice } = this.final;
      if (dice.length === 0) return [];
      return [{ kind: 'gone', final: true, value: dice[0].value, cells: dice.map(({ x, z }) => ({ x, z })), cubeIds: dice.map((die) => die.id) }];
    }
    const { sinkingTicks } = state.config;
    const actionTicks = Math.max(1, state.config.actionTicks);
    const passed = state.over && state.endReason === 'passed';
    const sent: Going[] = [];
    const seen = new Set<number>();
    const whole = new Set<number>();
    for (const cube of state.cubes) {
      if (cube.state !== 'sinking') {
        this.going.delete(cube.id);
        whole.add(cube.id);
        continue;
      }
      seen.add(cube.id);
      let going = this.going.get(cube.id);
      if (!going) {
        going = { id: cube.id, x: cube.x, z: cube.z, value: cube.ori.top, reactionId: cube.reactionId, t: cube.t, from: 0, ms: -1, lift: 0 };
        this.going.set(cube.id, going);
        // Whole a frame ago: just sent. A stair the board was laid with, a die found going, and the dice of the combo
        // that passes a board (the finale's) are where they rest at once.
        if (this.whole.has(cube.id) && !isStair(cube, state) && !passed && !reducedMotion) {
          going.from = 1 + dip(cube.id);
          going.ms = 0;
        }
        if (this.whole.has(cube.id) && !isStair(cube, state) && !passed) sent.push(going);
        continue;
      }
      going.x = cube.x;
      going.z = cube.z;
      going.reactionId = cube.reactionId;
      going.t = cube.t;
      if (going.ms >= 0) going.ms += dtMs;
      // Held, it comes up to the last step; let go, down from it.
      const held = (cube.hold ?? 0) > 0;
      const n = (name: string): number => Number(values?.[name] ?? DEFAULTS[name]?.value ?? 0);
      const ms = n(held ? 'holdRiseMs' : 'holdFallMs');
      going.lift = reducedMotion || ms <= 0 ? (held ? 1 : 0) : Math.min(1, Math.max(0, going.lift + (held ? dtMs : -dtMs) / ms));
    }
    this.whole = whole;

    const gone: Going[] = [];
    for (const going of this.going.values()) {
      if (seen.has(going.id)) continue;
      this.going.delete(going.id);
      if (!state.over && going.t >= sinkingTicks - actionTicks / 2) gone.push(going);
    }

    const events: LeavingEvent[] = [];
    if (sent.length > 0) events.push({ kind: 'sent', value: sent[0].value, cells: sent.map((g) => ({ x: g.x, z: g.z })), cubeIds: sent.map((g) => g.id) });
    // The dice of a group go together: one ring for each group that has gone.
    const byGroup = new Map<number, Going[]>();
    for (const going of gone) byGroup.set(going.reactionId, [...(byGroup.get(going.reactionId) ?? []), going]);
    for (const dice of byGroup.values()) events.push({ kind: 'gone', value: dice[0].value, cells: dice.map((g) => ({ x: g.x, z: g.z })), cubeIds: dice.map((g) => g.id) });
    return events;
  }

  /**
   * The height a die of a level is drawn at. One that goes rests where `restHeight` has it; one
   * that has just been sent comes to that from where it stood, in `dropMs`, soft at the end. In
   * a finale every die of the board, whatever it was doing, stands for the hang and goes under
   * the floor. Outside a level, what the rules have.
   */
  height(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number {
    if (!state.levelRun) return shownHeight(cube, state, alpha, values);
    const n = (name: string): number => Number(values?.[name] ?? DEFAULTS[name]?.value ?? 0);
    if (this.final) {
      const from = this.final.from.get(cube.id);
      if (from === undefined) return restHeight(cube, state, alpha, values);
      if (this.final.drop <= 0) return this.final.ms >= this.final.total - 1e-6 ? UNDER : from;
      // Slow off its place, and under the floor before it slows again: what is seen of it only gathers way.
      return tween((this.final.ms - this.final.hang) / this.final.drop, from, UNDER, inOutSine);
    }
    if (cube.state !== 'sinking') return 1;
    const going = this.going.get(cube.id);
    // A die held in its last move is shown up to the last step, as far as it has come up to it.
    const lifted = going && going.lift > 0 ? leavingSteps(values).last * inOutSine(going.lift) : 0;
    const rest = Math.max(restHeight(cube, state, alpha, values), lifted);
    const ms = n('dropMs');
    if (!going || going.ms < 0 || ms <= 0 || going.ms >= ms) return rest;
    const curve = SINK_CURVES[Math.max(0, Math.min(SINK_CURVES.length - 1, Math.round(n('dropCurve'))))];
    // What is left of the way from where it stood to where it rests; the rest may itself be going down by then.
    return rest + (going.from - rest) * (1 - curve(going.ms / ms));
  }

  /**
   * The board is passed: its last combo takes every die of it away, together. Each starts from
   * where it is drawn - a die of the combo from its full height, a die that was going from its
   * step, a die that stood from where it stood. Called once, on the frame the board is passed,
   * before `frame`; from then on `frame` says one thing, when they are under: `gone`, `final`,
   * with every die of the board.
   */
  finale(state: RunState, values: ParamValues, reducedMotion: boolean, dip: (cubeId: number) => number): void {
    if (!state.levelRun) return;
    const from = new Map<number, number>();
    for (const cube of state.cubes) {
      const fresh = cube.state !== 'sinking' || this.whole.has(cube.id);
      from.set(cube.id, fresh ? 1 + dip(cube.id) : this.height(cube, state, 0, values));
    }
    this.final = { ...finaleMs(values, reducedMotion), ms: 0, gone: false, from, dice: state.cubes.map((cube) => ({ id: cube.id, x: cube.x, z: cube.z, value: cube.ori.top })) };
    this.going.clear();
    this.whole.clear();
  }
}
