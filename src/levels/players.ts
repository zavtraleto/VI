/**
 * What people did on the boards, held as data so the measures and the bots can be set against it
 * (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md, sections 4 and 7, step 1). Two sources,
 * neither of which asks the owner to record anything:
 *
 * - the players of Playgama: per board, how many began it, how many passed it and how many failed it
 *   at least once (the telemetry events progression_started / _completed / _failed by step_id, as the
 *   cabinet of Playgama gave them for 5 October to 4 November 2026). Boards are named by their code, which
 *   does not change when the row is rebuilt. A board the cabinet did not list among its 50 commonest
 *   failures had three failures or fewer; it is held as one player failing once;
 * - the owner's own playtest of places 31-60 on 4 November 2026 (row 0.2.93; the boards have not changed
 *   since): the moves of his first passing try against par.
 */

/** A board as the players of the platform met it. */
export interface CrowdBoard {
  code: string;
  /** Players who began it, passed it, failed it at least once; failures in all. */
  began: number;
  passed: number;
  failedPlayers: number;
  failures: number;
  /** The failures are fewer than the cabinet lists: held as one player failing once. */
  fewFailures?: true;
}

/** Boards begun by ten players or more, 5 October - 4 November 2026. */
export const CROWD: readonly CrowdBoard[] = [
  { code: 'R01', began: 119, passed: 111, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'R03', began: 94, passed: 70, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'side-up-1', began: 70, passed: 65, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'B01_s290', began: 45, passed: 40, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'H06', began: 40, passed: 25, failedPlayers: 8, failures: 17 },
  { code: 'R02', began: 35, passed: 31, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'R05', began: 26, passed: 24, failedPlayers: 12, failures: 26 },
  { code: 'R04', began: 25, passed: 22, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'R07', began: 25, passed: 23, failedPlayers: 7, failures: 11 },
  { code: 'H08', began: 24, passed: 17, failedPlayers: 2, failures: 4 },
  { code: 'R11', began: 22, passed: 21, failedPlayers: 6, failures: 14 },
  { code: 'R08', began: 18, passed: 16, failedPlayers: 11, failures: 19 },
  { code: 'H07', began: 18, passed: 14, failedPlayers: 5, failures: 6 },
  { code: 'three-under-1', began: 14, passed: 12, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'P07', began: 13, passed: 12, failedPlayers: 3, failures: 6 },
  { code: 'R09', began: 12, passed: 10, failedPlayers: 2, failures: 7 },
  { code: 'which-first-2', began: 12, passed: 11, failedPlayers: 2, failures: 5 },
  { code: 'R14', began: 11, passed: 8, failedPlayers: 7, failures: 22 },
  { code: 'C1-07', began: 11, passed: 10, failedPlayers: 3, failures: 5 },
  { code: 'bridge-first-1', began: 11, passed: 11, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'R10', began: 10, passed: 10, failedPlayers: 5, failures: 24 },
  { code: 'R13', began: 10, passed: 10, failedPlayers: 1, failures: 1, fewFailures: true },
  { code: 'P02', began: 10, passed: 10, failedPlayers: 4, failures: 8 },
  { code: 'two-pairs-2', began: 10, passed: 9, failedPlayers: 3, failures: 4 },
];

/** A board as the owner played it on 4 November 2026: the moves of his first passing try. */
export interface OwnerPlay {
  place: number;
  code: string;
  par: number;
  moves: number;
}

/** His words of places 31-60 that name the moves (an «=» of his is par itself). */
export const OWNER_PLAYS: readonly OwnerPlay[] = [
  { place: 32, code: 'climb-twos-fours-1', par: 4, moves: 5 },
  { place: 33, code: 'climb-threes-1', par: 5, moves: 6 },
  { place: 35, code: 'climb-threes-fours-1', par: 5, moves: 13 },
  { place: 36, code: 'climb-threes-2', par: 3, moves: 3 },
  { place: 37, code: 'climb-twos-1', par: 5, moves: 5 },
  { place: 38, code: 'ones-twos-1', par: 4, moves: 4 },
  { place: 39, code: 'ones-fours-1', par: 5, moves: 5 },
  { place: 40, code: 'climb-twos-threes-2', par: 4, moves: 19 },
  { place: 41, code: 'ones-twos-2', par: 4, moves: 4 },
  { place: 42, code: 'ones-twos-3', par: 5, moves: 5 },
  { place: 43, code: 'link-fives-1', par: 2, moves: 2 },
  { place: 44, code: 'ones-fours-2', par: 5, moves: 7 },
  { place: 45, code: 'climb-twos-2', par: 6, moves: 6 },
  { place: 46, code: 'ones-twos-4', par: 6, moves: 13 },
  { place: 50, code: 'climb-twos-threes-3', par: 4, moves: 4 },
  { place: 51, code: 'climb-threes-fours-2', par: 6, moves: 17 },
  { place: 52, code: 'ones-threes-1', par: 5, moves: 8 },
  { place: 53, code: 'climb-fours-1', par: 6, moves: 10 },
  { place: 54, code: 'roll-threes-1', par: 8, moves: 10 },
  { place: 55, code: 'ones-over-leaving-1', par: 4, moves: 7 },
  { place: 56, code: 'two-combos-3', par: 5, moves: 5 },
  { place: 57, code: 'climb-twos-threes-4', par: 6, moves: 12 },
  { place: 58, code: 'P08', par: 4, moves: 4 },
  { place: 59, code: 'under-fives-1', par: 6, moves: 49 },
  { place: 60, code: 'ones-threes-2', par: 8, moves: 60 },
];

/** Spearman's rank correlation, ties by their mean rank; null when either side does not vary. */
export function spearman(a: readonly number[], b: readonly number[]): number | null {
  if (a.length !== b.length || a.length < 3) return null;
  const ranks = (xs: readonly number[]): number[] => {
    const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const out = new Array<number>(xs.length);
    for (let i = 0; i < order.length; ) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      for (let k = i; k <= j; k++) out[order[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return out;
  };
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? null : num / Math.sqrt(da * db);
}
