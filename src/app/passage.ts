import { roadPlace } from '../levels/road';
import { riseSpan, stoodBy } from '../render/passing';

/**
 * The passage between two boards: the pieces of the road and the levels of the list follow one
 * another with no window between them, joined at the cell the player stands on. The dice of the
 * combo that cleared a board light up one after another, stand lit for a moment and go under the
 * floor one after another; the lines of the board are erased towards the cell of the player; the
 * next board is put on with its starting cell on that cell, the camera travels to it while its
 * lines are drawn from the cell; then its dice come up out of the floor, the nearest first and a
 * stair last, and the board is the player's. Nothing here reads a clock or draws: whoever owns
 * the frame says how long the passage has run, and draws what this says.
 */

/** The numbers of the passage, in milliseconds: the look of the board has them (`road`). */
export interface PassageTimes {
  /** From one die of the combo lighting up to the next, and from one going under to the next. */
  comboStepMs: number;
  /** How long the combo stands lit before it goes. */
  comboHoldMs: number;
  /** How long one die takes to go under the floor. */
  sinkMs: number;
  /** How long the lines of the board take to be erased. */
  eraseMs: number;
  /** The time the camera is given to come to the next board. */
  cameraMs: number;
  /** How long the lines of the next board take to be drawn. */
  drawMs: number;
  /** How long one die of the next board takes to come up, and from one beginning to the next. */
  riseMs: number;
  riseStepMs: number;
}

export type PassagePhase = 'combo' | 'sink' | 'erase' | 'draw' | 'rise' | 'done';

export interface PassageView {
  phase: PassagePhase;
  /** 0..1 inside the phase. */
  at: number;
  /** Dice of the last combo lit so far. */
  lit: number;
  /** The board is the next one from here on. */
  swapped: boolean;
  /** Camera share 0..1 toward the next frame. */
  camera: number;
  /** Lines of the shown board, 0..1. */
  lines: number;
  /** Dice of the next board that stand so far, the stair last. */
  risen: number;
}

/** What a passage is counted from: the dice that light up, the dice of the next board, and whether one of those is a stair. */
export interface PassageCounts {
  combo: number;
  dice: number;
  stair: boolean;
}

/** When each part of the passage ends, in milliseconds from its start. */
interface Ends {
  combo: number;
  sink: number;
  erase: number;
  draw: number;
  rise: number;
}

/** Kept between calls and filled anew by each: a passage is asked where it stands on every frame. */
const ENDS: Ends = { combo: 0, sink: 0, erase: 0, draw: 0, rise: 0 };

function ends(times: PassageTimes, counts: PassageCounts, reduced: boolean): Ends {
  const apart = Math.max(0, counts.combo - 1) * times.comboStepMs;
  ENDS.combo = counts.combo * times.comboStepMs + times.comboHoldMs;
  ENDS.sink = ENDS.combo + times.sinkMs + apart;
  // With motion kept low there is no point and no wave: the board is changed in one frame, with its dice on it.
  ENDS.erase = ENDS.sink + (reduced ? 0 : times.eraseMs);
  ENDS.draw = ENDS.erase + (reduced ? 0 : times.drawMs);
  ENDS.rise = ENDS.draw + (reduced ? 0 : riseSpan(counts.dice, counts.stair, times.riseStepMs, times.riseMs));
  return ENDS;
}

/** When the parts of a passage that the dice are timed from begin, in milliseconds from its start. */
export interface PassageMarks {
  /** The dice of the combo begin to go under. */
  sink: number;
  /** The next board is put on. */
  swap: number;
  /** Its dice begin to come up. */
  rise: number;
}

/** When the dice of the combo begin to go under, when the next board is put on, and when its dice begin to come; written into `into` where one is given. */
export function passageMarks(times: PassageTimes, counts: PassageCounts, reduced: boolean, into: PassageMarks = { sink: 0, swap: 0, rise: 0 }): PassageMarks {
  const end = ends(times, counts, reduced);
  into.sink = end.combo;
  into.swap = end.erase;
  into.rise = end.draw;
  return into;
}

/** How long the whole passage takes. */
export function passageEnd(times: PassageTimes, counts: PassageCounts, reduced: boolean): number {
  return ends(times, counts, reduced).rise;
}

const share = (elapsed: number, from: number, to: number): number => (to > from ? Math.min(1, Math.max(0, (elapsed - from) / (to - from))) : 1);

/**
 * Where the passage stands `elapsedMs` after the combo that cleared the board: its phase and
 * how far through it; how many dice of the combo are lit; whether the next board is on; how far
 * the camera is given to have come; how much of the lines of the board that is on is there, all
 * to none while they are erased and none to all while they are drawn; how many dice of the next
 * board stand. With motion kept low the lines are neither erased nor drawn and the dice do not
 * come up: when the dice of the combo are gone the next board is there, whole. Written into
 * `into` where one is given: whoever asks on every frame keeps one.
 */
export function passageAt(
  elapsedMs: number,
  times: PassageTimes,
  counts: PassageCounts,
  reduced: boolean,
  into: PassageView = { phase: 'combo', at: 0, lit: 0, swapped: false, camera: 0, lines: 1, risen: 0 },
): PassageView {
  const end = ends(times, counts, reduced);
  const t = Math.max(0, elapsedMs);
  into.lit = counts.combo;
  into.swapped = t >= end.erase;
  into.camera = !into.swapped ? 0 : reduced ? 1 : share(t, end.erase, end.erase + times.cameraMs);
  into.lines = 1;
  into.risen = 0;
  if (t < end.combo) {
    into.phase = 'combo';
    into.at = share(t, 0, end.combo);
    if (times.comboStepMs > 0) into.lit = Math.min(counts.combo, Math.floor(t / times.comboStepMs) + 1);
  } else if (t < end.sink) {
    into.phase = 'sink';
    into.at = share(t, end.combo, end.sink);
  } else if (t < end.erase) {
    into.phase = 'erase';
    into.at = share(t, end.sink, end.erase);
    into.lines = 1 - into.at;
  } else if (t < end.draw) {
    into.phase = 'draw';
    into.at = share(t, end.erase, end.draw);
    into.lines = into.at;
  } else if (t < end.rise) {
    into.phase = 'rise';
    into.at = share(t, end.draw, end.rise);
    into.risen = stoodBy(t - end.draw, counts.dice, counts.stair, times.riseStepMs, times.riseMs);
  } else {
    into.phase = 'done';
    into.at = 1;
    into.risen = counts.dice;
  }
  return into;
}

/** A board of the game by its place: a piece of the road or a level of the list. */
export interface Board {
  road?: number;
  level?: number;
}

/**
 * The board the program opens on: the piece of the road the player stopped on, the first for
 * one who is new, and for one who is past the road `onward`, the level of the list the player
 * goes on with. `road` is the code that is kept of the player's place on the road, and
 * `firstPassed` whether they passed the first level of the build before, which was what the
 * first block of the road is (`roadPlace`).
 */
export function startBoard(road: string | undefined, firstPassed: boolean, onward: number): Board {
  const place = roadPlace(road, firstPassed);
  return place === null ? { level: onward } : { road: place };
}

/**
 * Where the file of the levels in the menu leads: to the piece of the road the player is on,
 * while the road is not finished; null is the list of the levels, for one who is past the road
 * and at the address that opens on the list (`list`). `road` and `firstPassed` are what is kept
 * of the player's place (`roadPlace`).
 */
export function levelsFile(road: string | undefined, firstPassed: boolean, list: boolean): Board | null {
  const place = list ? null : roadPlace(road, firstPassed);
  return place === null ? null : { road: place };
}

/**
 * Which board comes after this one: the next piece of the road; after its last `onward`, the
 * level of the list the player goes on with, so that one who has passed levels of the list is
 * not walked through them again; the next level after a level of the list; null after the last.
 */
export function boardAfter(current: Board, road: number, levels: number, onward: number): Board | null {
  if (current.road !== undefined && current.road + 1 < road) return { road: current.road + 1 };
  const level = current.road !== undefined ? onward : (current.level ?? 0) + 1;
  return level < levels ? { level } : null;
}

/**
 * The order the dice of a board light up and go in, or come in: the nearest to the cell `from`
 * first, by steps along the board; of two as near, the one in the lower row, then in the lower
 * column, so that the order is the same every time. Dice named as `late` come after all the
 * others: those that were going before the combo, or a stair. Gives the places of `dice` in
 * that order.
 */
export function orderOf(dice: readonly { x: number; z: number; late?: boolean }[], from: { x: number; z: number }): number[] {
  const far = (i: number): number => Math.abs(dice[i].x - from.x) + Math.abs(dice[i].z - from.z);
  return dice
    .map((_, i) => i)
    .sort((a, b) => Number(dice[a].late === true) - Number(dice[b].late === true) || far(a) - far(b) || dice[a].z - dice[b].z || dice[a].x - dice[b].x);
}
