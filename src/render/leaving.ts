import { cubeHeight, isHeld, worldRuns, type Cube, type Orientation, type RunState } from '../rules';
import type { ParamSpec, ParamValues } from '../signal/scene';
import { inCubic, inExpo, inQuart, outCubic, tween, type Curve } from './ease';
import { BOARD_GROUPS } from './params';

/**
 * How high a die is shown, which is not always how high the rules have it. On a level a die that
 * leaves is shown by steps (docs/art/VI_Interface_Layer.md): a little lower the moment it leaves,
 * near the floor with its last move left to it, and gone after that; from one step to the next it
 * is driven by the show of its leaving (`LeavingShow`, below). A die the board is laid with as
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
 * is ahead of the rules; a die held by the tutorial stays put between ticks, and so does one on a
 * level whose world stands. On a level a die that leaves is shown by its steps: its share of time
 * left is counted from the tick it left on, when a whole window of moves is before it, and a die
 * laid as leaving with every move of that window is a die that has just left, shown at the middle
 * step and not the first.
 */
export function shownHeight(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number {
  const ahead = isHeld(state, cube) || !worldRuns(state) ? 0 : alpha;
  if (!state.levelRun || cube.state !== 'sinking') return cubeHeight(cube, state.config, ahead);
  const { sinkingTicks, actionTicks } = state.config;
  // A level's dice go in so many moves and a tick: the tick is the one they leave on.
  const window = Math.max(1, sinkingTicks - 1);
  const moves = Math.max(1, Math.round(window / Math.max(1, actionTicks)));
  return leavingHeight((sinkingTicks - cube.t - ahead) / window, moves, leavingSteps(values), isStair(cube, state));
}

export type HeightOf = (cube: Cube, alpha: number) => number;

export interface LeavingEvent {
  kind: 'sent' | 'impact' | 'step' | 'gone';
  /** The face of the group, 1 to 6. */
  value: number;
  cells: readonly { x: number; z: number }[];
  /** The dice it is about; `sent` is for the view only, to let go of their springs. */
  cubeIds: readonly number[];
  /** A `gone` that is the last combo of a board gone under, with every die of the board. */
  final?: boolean;
}

/** A die the rules have taken away that the show still draws: under the floor it goes. */
export interface Ghost {
  /** The die it was: whoever draws it keeps the glass that die had. */
  id: number;
  x: number;
  z: number;
  ori: Orientation;
  value: number;
  height: number;
}

type Phase = 'lift' | 'hang' | 'drop' | 'settle' | 'still';

interface Going {
  id: number;
  x: number;
  z: number;
  ori: Orientation;
  value: number;
  reactionId: number;
  /** `cube.t` as the show last saw it, and the moves of its window it had behind it then: a move more is a landing. */
  t: number;
  moves: number;
  /** The step it goes to, where the phase that is on started from, and how high its lift takes it. */
  target: number;
  from: number;
  top: number;
  phase: Phase;
  /** Time into the phase. */
  ms: number;
  /** It is on the way it was sent by, the lift and the long drop; a landing that comes meanwhile cuts that short. */
  first: boolean;
  /** It has struck: its first strike is the beat of its group, wherever it comes down; every other is a step. */
  struck: boolean;
  /** The rules have taken it: it goes under the floor and is let go of. */
  ghost: boolean;
  height: number;
}

const DROP_CURVES: readonly Curve[] = [inCubic, inQuart, inExpo];
/** Where a ghost is driven to: under the floor, out of sight. */
const UNDER = -0.5;
/** The numbers of the look where the values given say nothing of one. */
const DEFAULTS: Record<string, ParamSpec> = BOARD_GROUPS.leaving;

/** How long the parts of the last combo of a board take, and all of it, to the frame its dice are under. */
export interface FinaleMs {
  lift: number;
  hang: number;
  drop: number;
  total: number;
}

/**
 * The time of a finale: the lift, the hang - as long as the `sounding` dice of the combo take to
 * sound one by one, and no shorter than the look says - and the drop under the floor. With less
 * motion nothing lifts or drops: the dice sound for as long as all of it takes, and are gone. Whoever leads the passage to the
 * next board counts its parts from the same numbers.
 */
export function finaleMs(sounding: number, values: ParamValues | undefined, reducedMotion: boolean): FinaleMs {
  const n = (name: string): number => Number(values?.[name] ?? DEFAULTS[name]?.value ?? 0);
  const hang = Math.max(n('finaleHangMs'), Math.max(0, sounding) * n('finaleNoteMs'));
  // With less motion the dice stand for all of that time, and are gone when they would have gone under.
  if (reducedMotion) return { lift: 0, hang: n('finaleLiftMs') + hang + n('finaleDropMs'), drop: 0, total: n('finaleLiftMs') + hang + n('finaleDropMs') };
  const lift = n('finaleLiftMs');
  const drop = n('finaleDropMs');
  return { lift, hang, drop, total: lift + hang + drop };
}

/**
 * The leaving of a group on a level, as one body: a sent group gets ready - pressed down a little
 * as the look is set, lifted where it says so - holds, drops onto its first step and settles; a
 * chain that is added to does so with the die that joins it; every landing of the figure's roll
 * drives the group one step down; the last landing drives it under the floor and a ring runs over
 * the floor where it stood; and the last combo of a board takes every die of the board under at
 * once (`finale`). No spring and no passage moves a die that goes on a level: only this does
 * (spec: docs/superpowers/specs/2026-10-13-vi-leaving-choreography-design.md, with its section 10). All in the time of
 * the picture: the rules know nothing of it and are read, never written. Outside a level it does
 * nothing and `height` is what `shownHeight` gives.
 */
export class LeavingShow {
  private readonly going = new Map<number, Going>();
  /** The dice that stood whole on the frame before: one of them found going has just been sent. */
  private whole = new Set<number>();

  /** The last combo of a board is on its way under: how long its parts take, and whether it has gone. Null on a board that is played. */
  private final: (FinaleMs & { gone: boolean }) | null = null;

  /** A new board, or the board put on anew: a die found going on it is not sent again. */
  reset(): void {
    this.going.clear();
    this.whole.clear();
    this.final = null;
  }

  /**
   * The board is passed: its last combo takes every die of it away, as the strongest strike of
   * all. Each lifts from where it is drawn - a die of the combo from its full height, a die that
   * was going from its step, a die that stood from where it stood - hangs while the `sounding`
   * dice of the combo sound, and goes under the floor with all the others. Called once, on the
   * frame the board is passed, before `frame`; from then on `frame` drives nothing else and
   * says one thing, when they are under: `gone`, `final`, with every die of the board.
   */
  finale(state: RunState, sounding: number, values: ParamValues, reducedMotion: boolean, dip: (cubeId: number) => number): void {
    if (!state.levelRun) return;
    const lift = Number(values.finaleLiftHeight ?? DEFAULTS.finaleLiftHeight.value);
    this.final = { ...finaleMs(sounding, values, reducedMotion), gone: false };
    const before = this.going;
    const going = new Map<number, Going>();
    for (const cube of state.cubes) {
      const was = before.get(cube.id);
      // A die that was going is where the show had it; one the combo has just taken, or one that stands, is whole.
      const from = was && !was.ghost ? was.height : cube.state === 'sinking' && !this.whole.has(cube.id) ? shownHeight(cube, state, 0, values) : 1 + dip(cube.id);
      going.set(cube.id, { id: cube.id, x: cube.x, z: cube.z, ori: cube.ori, value: cube.ori.top, reactionId: cube.reactionId, t: cube.t, moves: 0, target: UNDER, from, top: from + lift, phase: reducedMotion ? 'hang' : 'lift', ms: 0, first: false, struck: true, ghost: false, height: from });
    }
    this.going.clear();
    for (const [id, entry] of going) this.going.set(id, entry);
    this.whole.clear();
  }

  /**
   * Once a frame, before the dice are drawn: notices the dice that have just been sent, the
   * landings and the dice the rules have taken; moves every timeline on by `dtMs`. Returns what
   * fell due on this frame. `dip` is where the spring of a die holds it, so that a die pressed
   * under the figure lifts from where it is drawn.
   *
   * Nothing here waits for the world to stand: a player who presses the next move ahead has the
   * rules take it on the tick the die lands, and the world never stands between two rolls. A die
   * is sent when the show saw it whole on the frame before; a landing is a move of its window
   * done, counted from `cube.t`. On a board that is over the dice that go are still driven to
   * their steps, and nothing is said of their strikes; the combo that passes a board is the
   * finale's (`finale`).
   */
  frame(state: RunState, dtMs: number, values: ParamValues, reducedMotion: boolean, dip: (cubeId: number) => number): LeavingEvent[] {
    if (!state.levelRun) {
      this.going.clear();
      this.whole.clear();
      this.final = null;
      return [];
    }
    const n = (name: string): number => Number(values[name] ?? DEFAULTS[name]?.value ?? 0);
    if (this.final) {
      // The last combo of the board: every die goes by the one timeline, and they are under together.
      let under = this.going.size > 0;
      for (const going of this.going.values()) {
        going.ms += dtMs;
        this.advance(going, n);
        if (going.phase !== 'still') under = false;
      }
      if (!under || this.final.gone) return [];
      this.final.gone = true;
      const dice = [...this.going.values()];
      return [{ kind: 'gone', final: true, value: dice[0].value, cells: dice.map((g) => ({ x: g.x, z: g.z })), cubeIds: dice.map((g) => g.id) }];
    }
    const steps = leavingSteps(values);
    const { sinkingTicks } = state.config;
    const actionTicks = Math.max(1, state.config.actionTicks);
    /** The moves of its window a die has behind it; a move is done on the tick its window passes a whole move. */
    const done = (t: number): number => Math.floor((t - 1) / actionTicks);
    const { over } = state;
    const sent: Going[] = [];
    const seen = new Set<number>();
    const whole = new Set<number>();
    // The chain every die is of now: a die that joins two chains makes them one on its tick, before the show has
    // looked at the dice of the second.
    for (const cube of state.cubes) {
      const known = this.going.get(cube.id);
      if (known && cube.state === 'sinking') known.reactionId = cube.reactionId;
    }

    for (const cube of state.cubes) {
      if (cube.state !== 'sinking') {
        this.going.delete(cube.id);
        whole.add(cube.id);
        continue;
      }
      seen.add(cube.id);
      let going = this.going.get(cube.id);
      // A die that was going under and is here again: a move was taken back. It is found anew.
      if (going?.ghost) going = undefined;
      if (!going) {
        // The combo that passes a board is the finale's to take away, whole; a move that lost the board sends its
        // dice as any move does.
        if (over && state.endReason === 'passed') {
          this.going.delete(cube.id);
          continue;
        }
        // Whole a frame ago: just sent, it lifts. A stair the board was laid with, or a die found going (the board
        // was put on with it so, or a move was taken back), stands on its step at once.
        const fresh = this.whole.has(cube.id) && !isStair(cube, state);
        const moves = done(cube.t);
        const target = this.stepOf(cube, state, 1 + moves * actionTicks, steps);
        const from = 1 + dip(cube.id);
        // How it gets ready: lifted over its full height, or pressed under it. A die the figure has pressed deeper
        // than that already is not brought up to be pressed: it stays where it is.
        const ready = n('liftHeight');
        const top = ready >= 0 ? 1 + ready : Math.min(from, 1 + ready);
        going = { id: cube.id, x: cube.x, z: cube.z, ori: cube.ori, value: cube.ori.top, reactionId: cube.reactionId, t: cube.t, moves, target, from, top, phase: 'still', ms: 0, first: fresh, struck: !fresh, ghost: false, height: target };
        if (fresh) {
          going.height = going.from;
          going.phase = reducedMotion ? 'still' : 'lift';
          if (reducedMotion) {
            going.height = target;
            going.first = false;
            going.struck = true;
          }
          sent.push(going);
          // The chain it joins is one body with it (the owner, 13 October: a die added must weigh as much as a combo
          // made): every die of it lifts by as much from where it is, hangs, and strikes its own step with the new one.
          if (!reducedMotion) {
            for (const other of this.going.values()) {
              if (other.reactionId !== cube.reactionId || other.ghost || sent.includes(other)) continue;
              other.from = other.height;
              other.top = other.height + n('liftHeight');
              other.phase = 'lift';
              other.ms = 0;
              other.first = true;
              other.struck = false;
            }
          }
        }
        this.going.set(cube.id, going);
        continue;
      }
      going.x = cube.x;
      going.z = cube.z;
      going.ori = cube.ori;
      going.reactionId = cube.reactionId;
      going.t = cube.t;
      const moves = done(cube.t);
      if (moves === going.moves) continue;
      const back = moves < going.moves;
      going.moves = moves;
      const target = this.stepOf(cube, state, 1 + moves * actionTicks, steps);
      if (target === going.target) continue;
      going.target = target;
      going.first = false;
      if (back && !reducedMotion) {
        // A move taken back: the die comes up to the step it stood on, softly, and strikes nothing.
        going.from = going.height;
        going.phase = 'settle';
        going.ms = 0;
      } else {
        // A landing: the rules have taken the die a move down. It is driven to its new step from where it is.
        this.drive(going, reducedMotion);
      }
    }
    this.whole = whole;

    // The rules have taken a die. With its window run out it is driven under the floor as a ghost; one taken with
    // a move still left to it (rolled over) comes apart as it always did and is let go of here at once.
    const gone: Going[] = [];
    for (const going of this.going.values()) {
      if (seen.has(going.id)) continue;
      if (going.ghost && !over) continue;
      const ranOut = going.t >= sinkingTicks - actionTicks / 2;
      if (going.ghost || over || !ranOut) {
        this.going.delete(going.id);
        continue;
      }
      if (reducedMotion) {
        gone.push(going);
        this.going.delete(going.id);
        continue;
      }
      going.ghost = true;
      going.target = UNDER;
      going.first = false;
      this.drive(going, false);
    }

    const events: LeavingEvent[] = [];
    if (sent.length > 0) {
      events.push({ kind: 'sent', value: sent[0].value, cells: sent.map((g) => ({ x: g.x, z: g.z })), cubeIds: sent.map((g) => g.id) });
      if (reducedMotion) events.push(...this.grouped(sent, 'impact'));
    }

    const struck: Going[] = [];
    const stepped: Going[] = [];
    for (const going of this.going.values()) {
      going.ms += dtMs;
      const hit = this.advance(going, n);
      if (hit === 'gone') gone.push(going);
      else if (hit === 'struck') {
        (going.struck ? stepped : struck).push(going);
        going.first = false;
        going.struck = true;
      }
    }
    for (const going of gone) this.going.delete(going.id);
    // A board that is over says nothing of its strikes; what was sent is still said, for the springs of those dice.
    if (over) return events.filter((event) => event.kind === 'sent');
    events.push(...this.grouped(struck, 'impact'), ...this.grouped(stepped, 'step'), ...this.grouped(gone, 'gone'));
    return events;
  }

  /** The height a sinking die of a level is drawn at: by its timeline. Outside a level, what the rules have. */
  height(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number {
    if (!state.levelRun) return shownHeight(cube, state, alpha, values);
    return this.going.get(cube.id)?.height ?? shownHeight(cube, state, alpha, values);
  }

  ghosts(): readonly Ghost[] {
    const ghosts: Ghost[] = [];
    for (const going of this.going.values()) if (going.ghost) ghosts.push({ id: going.id, x: going.x, z: going.z, ori: going.ori, value: going.value, height: going.height });
    return ghosts;
  }

  ghostHeight(x: number, z: number): number {
    for (const going of this.going.values()) if (going.ghost && going.x === x && going.z === z) return Math.max(0, going.height);
    return 0;
  }

  /** The step a die stands on with `t` of its window gone, by the look's steps. */
  private stepOf(cube: Cube, state: RunState, t: number, steps: LeavingSteps): number {
    const { sinkingTicks, actionTicks } = state.config;
    const window = Math.max(1, sinkingTicks - 1);
    const moves = Math.max(1, Math.round(window / Math.max(1, actionTicks)));
    return leavingHeight((sinkingTicks - t) / window, moves, steps, isStair(cube, state));
  }

  /** Drives a die from where it is drawn to its target: a drop, or at once with less motion. */
  private drive(going: Going, reducedMotion: boolean): void {
    if (reducedMotion) {
      going.phase = 'still';
      going.height = going.target;
      return;
    }
    going.from = going.height;
    going.phase = 'drop';
    going.ms = 0;
  }

  /** How long the phase a die is in takes. */
  private phaseMs(going: Going, n: (name: string) => number): number {
    switch (going.phase) {
      case 'lift':
        return this.final ? this.final.lift : n('liftMs');
      case 'hang':
        return this.final ? this.final.hang : n('hangMs');
      case 'drop':
        return this.final ? this.final.drop : going.first ? n('dropMs') : n('stepMs');
      case 'settle':
        return n('leaveSettleMs');
      default:
        return 0;
    }
  }

  /**
   * Moves one die on by the time it has, through as many phases as that time covers, so that a
   * long frame leaves it where a run of short ones would. Says whether a drop has ended on the
   * way: the strike of the die, or its going under.
   */
  private advance(going: Going, n: (name: string) => number): 'struck' | 'gone' | null {
    let hit: 'struck' | 'gone' | null = null;
    for (let guard = 0; guard < 8; guard++) {
      if (going.phase === 'still') {
        going.height = going.target;
        return hit;
      }
      const ms = this.phaseMs(going, n);
      const share = ms > 0 ? going.ms / ms : 1;
      switch (going.phase) {
        case 'lift':
          going.height = tween(share, going.from, going.top, outCubic);
          break;
        case 'drop': {
          const under = going.target <= UNDER;
          // The last combo of a board goes late and all at once; any other drop by the curve of the look.
          const curve = this.final ? inExpo : DROP_CURVES[Math.max(0, Math.min(DROP_CURVES.length - 1, Math.round(n('dropCurve'))))];
          const to = going.target - (under ? 0 : n('settleOver'));
          // A die of a chain that was pressed under its step with the die that joined is held there through the
          // drop: it has nowhere down to go, and comes back to its step after the strike with the rest.
          going.height = going.from < to ? going.from : tween(share, going.from, to, curve);
          break;
        }
        case 'settle':
          going.height = tween(share, going.from, going.target, outCubic);
          break;
        default:
          break;
      }
      // A hair of the sum of the frames is not a frame: a phase that is over in all but that is over.
      if (going.ms < ms - 1e-6) return hit;
      // The phase has run out: on to the next, with the time left over.
      going.ms -= ms;
      going.from = going.height;
      switch (going.phase) {
        case 'lift':
          going.phase = 'hang';
          break;
        case 'hang':
          going.phase = 'drop';
          break;
        case 'drop':
          hit = going.target <= UNDER ? 'gone' : 'struck';
          going.phase = going.target <= UNDER ? 'still' : 'settle';
          break;
        default:
          going.phase = 'still';
      }
    }
    return hit;
  }

  /** One event for the dice of each group: they go together, so they strike together. */
  private grouped(dice: readonly Going[], kind: LeavingEvent['kind']): LeavingEvent[] {
    const byGroup = new Map<number, Going[]>();
    for (const going of dice) {
      const list = byGroup.get(going.reactionId) ?? [];
      list.push(going);
      byGroup.set(going.reactionId, list);
    }
    return [...byGroup.values()].map((list) => ({ kind, value: list[0].value, cells: list.map((g) => ({ x: g.x, z: g.z })), cubeIds: list.map((g) => g.id) }));
  }
}
