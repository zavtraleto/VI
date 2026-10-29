import type { Plot } from './plot';

/**
 * The plots boards are laid from (the plan docs/superpowers/plans/2026-10-28-vi-level-generator.md,
 * step 6): the plots of the boards of the acts, written by the boards and by the spec of the
 * generator, section 3.3, for the tests; the briefs of the rebuild of places 31–100 come next.
 * The name of a plot is the word of its batch.
 */

/**
 * The opening of act II (`act-k23`): a pair of 2s goes, the near link keeps the combo the very
 * next move, and the far 2 comes in two rolls in a line, on the last move it can.
 */
const ACT_K23: Plot = {
  name: 'act-k23',
  size: 4,
  holes: [0, 1, 2, 3].flatMap((z) => [0, 1].map((x) => ({ x, z }))),
  faces: [2],
  dice: [
    { name: 'a', face: 2, event: 0 },
    { name: 'o', face: 2, event: 0, comes: { by: 'roll', rolls: [1, 1] } },
    { name: 'n', face: 2, event: 1, comes: { by: 'roll', rolls: [1, 1] } },
    { name: 'f', face: 2, event: 2, comes: { by: 'roll', rolls: [2, 2], line: 'straight' } },
  ],
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'link', by: 'n' },
    { kind: 'link', by: 'f', spare: 0 },
  ],
  figure: ['na', 'fo'],
  lessons: [{ kind: 'keeps', after: 0, moves: [1, 1], slack: 2 }, { kind: 'safeFirst' }],
  want: { instead: ['act-k23'] },
  brief: 'пара двоек уходит; ближнее звено следующим же ходом держит комбо, и дальняя двойка успевает',
};

/**
 * The twist of act II (`act-k25`): the combo that asks to be made on the second move throws two
 * dice away. The player brings their own die round in two rolls, a 2 comes to it with a turn, and
 * a 3 rolls over the leaving 2 into the 3s that stand. The board itself lost the bait when every
 * face came to work (0.2.66): the combo of 3s on the second move is now a way of par. The lesson
 * is kept as the plot wants it; the judge drops the board on it.
 */
const ACT_K25: Plot = {
  name: 'act-k25',
  size: 4,
  holes: [0, 1, 2, 3].map((x) => ({ x, z: 0 })),
  faces: [2, 3],
  dice: [
    { name: 'a', face: 2, event: 0, comes: { seq: 'rr', line: 'turn' } },
    { name: 'o', face: 2, event: 0, comes: { seq: 'rr', line: 'turn' } },
    { name: 'b', face: 3, event: 1 },
    { name: 'c', face: 3, event: 1 },
    { name: 'd', face: 3, event: 1, comes: { seq: 'r' }, on: 'a' },
  ],
  events: [
    { kind: 'combo', by: 'a' },
    { kind: 'combo', by: 'd' },
  ],
  figure: ['bao', 'c..'],
  lessons: [{ kind: 'bait', at: 1, move: 'event', fate: 'dead' }, { kind: 'safeFirst' }],
  want: { instead: ['act-k25'] },
  brief: 'комбо, которое просится на втором ходу, бросает две кости; свою кость довести самому',
};

/**
 * The briefs of the rebuild of places 31–100 (docs/superpowers/specs/2026-10-28-vi-rebuild-31-100-design.md,
 * section 5): each plot is the brief's idea, its rules on the board, and its check as the gates (`want`).
 */

/**
 * «Стена» (56–58): a fixed die stands on the straight way to the combo; the way is a loop round it that keeps the face.
 * On 4s, and with a link after: a combo and a link of 3s is a thought the row has three times over (16, 40, 68).
 */
const WALL: Plot = {
  name: 'wall',
  size: 5,
  brief: 'Стена: фиксированная кость на прямой к комбо, путь — петля вокруг',
  // Rounds 3–4 (29 October): a fixed die that is a part of the combo it stands by is never in the way to it. It stands in the
  // way of the 4s and goes after them, with a 2 rolled to it: `K K` on 2s and 4s, a thought the row has not.
  dice: [
    { name: 'a', face: 4, event: 0 },
    { name: 'b', face: 4, event: 0 },
    { name: 'c', face: 4, event: 0 },
    { name: 'o', face: 4, event: 0, comes: { by: 'roll', rolls: [3, 5], line: 'turn' } },
    { name: 'f', face: 2, event: 1, fixed: true },
    { name: 'g', face: 2, event: 1, comes: { by: 'roll', rolls: [1, 3] } },
  ],
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'combo', by: 'g' },
  ],
  route: 'K K',
  want: { d: [4, 6], par: [5, 8], hidden: [1, 9], fixedCost: 2 },
};

/**
 * «Стена» as a peak (61–80, where the fixed die comes back in combinations): round 2 of `wall` found boards whose way
 * goes down to the floor and up again over the leaving 4s, the fixed die worth two moves, D 10, rank 8, new to the row.
 */
const WALL_PEAK: Plot = {
  name: 'wall-peak',
  size: 4,
  brief: 'Стена-пик: фиксированная кость на дороге, путь вниз на пол и обратно наверх по уходящим',
  dice: [
    { name: 'f', face: 4, event: 0, fixed: true },
    { name: 'a', face: 4, event: 0 },
    { name: 'b', face: 4, event: 0 },
    { name: 'o', face: 4, event: 0, comes: { by: 'roll', rolls: [3, 5], line: 'turn' } },
    { name: 'l', face: 4, event: 1, comes: { by: 'roll', rolls: [1, 2] } },
  ],
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'link', by: 'l' },
  ],
  route: 'K v ^ L',
  want: { d: [8, 10], par: [6, 8], fixedCost: 2 },
};

/** «Упор» (58–62): down to the floor, and a die pushed against a fixed one makes the combo there. */
const STOP: Plot = {
  name: 'stop',
  size: 5,
  brief: 'Упор: с пола толкнуть кость к фиксированной, там и собирается комбо',
  dice: [
    { name: 'a', face: 3, event: 0 },
    { name: 'b', face: 3, event: 0 },
    { name: 'o', face: 3, event: 0, comes: { by: 'roll', rolls: [1, 3] } },
    { name: 'f', face: 4, event: 1, fixed: true },
    { name: 'c', face: 4, event: 1 },
    { name: 'd', face: 4, event: 1 },
    { name: 'p', face: 4, event: 1, comes: { by: 'push', rolls: [2, 3] } },
    { name: 'q', face: 4, event: 2, comes: { by: 'push', rolls: [1, 2] } },
  ],
  // A combo and then a push onto the floor is the row's `K v P` on 2s and 3s (36, `three-at-once-1`): round 3 on 2s and 3s
  // came out like it, a pushed link or not. On 3s and 4s, the fixed 4 being what the pushed 4 stops against.
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'combo', by: 'p' },
    { kind: 'link', by: 'q' },
  ],
  needs: ['floor'],
  // Round 1 (29 October): ways that came up again over the leaving dice were R14 (32), `K v P ^ L`; the push and the pushed link are the thought.
  route: 'K v P Q',
  // The brief checks that there is no way without the push (`needs: floor`), not what the fixed die costs: round 2 lost its two boards on that.
  want: { d: [5, 7], par: [5, 8] },
};

/** «Две далёкие грани» (51–60): two heaps of other faces, and which goes first is the whole board. */
const FAR_FACES: Plot = {
  name: 'far-faces',
  size: 5,
  brief: 'Две далёкие грани: кучки троек и четвёрок — какую первой',
  dice: [
    { name: 'a', face: 4, event: 0 },
    { name: 'b', face: 4, event: 0 },
    { name: 'c', face: 4, event: 0 },
    { name: 'o', face: 4, event: 0, comes: { by: 'roll', rolls: [2, 4] } },
    { name: 'e', face: 3, event: 1 },
    { name: 'f', face: 3, event: 1 },
    { name: 'g', face: 3, event: 1, comes: { by: 'roll', rolls: [2, 4] } },
  ],
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'combo', by: 'g' },
  ],
  // Round 1 (29 October): the boards that held the forks came out D 7.5, the peak of the ten 51–60; the band takes it.
  want: { d: [5, 7.5], par: [5, 7], forks: 3, ways: 2 },
};

/** «Три приёма» (peaks 71–99): a combo and a link, down to the floor and a push, and the 1s at the end — none of them told. */
const THREE_TRICKS: Plot = {
  name: 'three-tricks',
  size: 5,
  brief: 'Три приёма: комбо и звено, толчок с пола, единицы',
  dice: [
    { name: 'a', face: 3, event: 0 },
    { name: 'b', face: 3, event: 0 },
    { name: 'o', face: 3, event: 0, comes: { by: 'roll', rolls: [1, 3] } },
    { name: 'l', face: 3, event: 1, comes: { by: 'roll', rolls: [1, 2] } },
    { name: 'e', face: 2, event: 2 },
    { name: 'p', face: 2, event: 2, comes: { by: 'push', rolls: [2, 3] } },
    { name: 'g', face: 1, event: 3, comes: { by: 'push', rolls: [1, 2] } },
    { name: 'h', face: 1, event: 3 },
  ],
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'link', by: 'l' },
    { kind: 'combo', by: 'p' },
    { kind: 'ones', by: 'g' },
  ],
  want: { d: [8, 9], par: [7, 10], rank: 5, forks: 4 },
};

/**
 * «Финал» (100): everything the player can do, and the plan seen at a glance: a combo and its link, down to the
 * floor and a push, up again over the leaving dice, and the 4s to end. Three faces.
 */
const FINALE: Plot = {
  name: 'finale',
  size: 6,
  brief: 'Финал: толчки — подготовка в начале, развязка — цепочка, которая уводит всё',
  // The player starts on a die and cannot step down from a standing one: the push comes once a combo is leaving.
  dice: [
    { name: 'b', face: 3, event: 0 },
    { name: 'c', face: 3, event: 0 },
    { name: 'o', face: 3, event: 0, comes: { by: 'roll', rolls: [2, 3] } },
    { name: 'l', face: 3, event: 1, comes: { by: 'roll', rolls: [1, 2] } },
    { name: 'a', face: 2, event: 2 },
    { name: 'p', face: 2, event: 2, comes: { by: 'push', rolls: [1, 2] } },
    { name: 'd', face: 4, event: 3 },
    { name: 'e', face: 4, event: 3 },
    { name: 'g', face: 4, event: 3 },
    { name: 'h', face: 4, event: 3, comes: { by: 'roll', rolls: [1, 3] } },
  ],
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'link', by: 'l' },
    { kind: 'combo', by: 'p' },
    { kind: 'combo', by: 'h' },
  ],
  want: { d: [9.5, 10], par: [7, 10], rank: 8, forks: 6 },
};

/** «Сноубол позже» (81–95): the thought of `act-k21` deeper — from the first move a run of consequences to be untangled, without losing the board. */
const SNOWBALL: Plot = {
  name: 'snowball',
  size: 4,
  brief: 'Сноубол: с первого хода цепь последствий, которую долго распутывать',
  dice: [
    { name: 'a', face: 3, event: 0 },
    { name: 'b', face: 3, event: 0, comes: { by: 'roll', rolls: [1, 2] } },
    { name: 'o', face: 3, event: 0, comes: { by: 'roll', rolls: [2, 3] } },
    { name: 'l', face: 3, event: 1, comes: { by: 'roll', rolls: [2, 3] } },
    { name: 'm', face: 3, event: 2, comes: { by: 'roll', rolls: [1, 2] } },
  ],
  events: [
    { kind: 'combo', by: 'o' },
    { kind: 'link', by: 'l' },
    { kind: 'link', by: 'm' },
  ],
  want: { d: [8, 9], par: [8, 10], instead: ['act-k21'] },
};

/**
 * The boards of places 48–100 the rebuild keeps (docs/superpowers/specs/2026-10-28-vi-rebuild-31-100-design.md, section
 * 3.2): with places 1–47, the row a new board is new against. The rest of 48–100 goes to the shelf, and a board like
 * one of those is no repeat in the row that is coming.
 */
export const REBUILD_KEEPS: readonly string[] = [
  'dd-15-no-way-down', 'P06', 'ones-over-leaving-1', 'act-k25', 'hidden-face-1', 'two-combos-3', 'dd-14-turn-to-fours',
  'bridge-5', 'dd-21-wood-fives', 'tight-room-1', 'P08', 'fixed-combo-1', 'dd-62-fours-around', 'pair-and-fours-1',
  'act-k21', 'dd-19-three-threes-apart', 'collapse-after-prep-1', 'P09', 'trap-5', 'tight-room-5', 'dd-20-chain-on-the-run',
  'three-moves-1', 'ones-broom-below-1', 'three-moves-2', 'dd-13-stone-row',
];

/** The places of the row as they will stand after the rebuild of 31–100: 1–47, and of the rest those it keeps. */
export function rowAfterRebuild<T extends { code: string; number: number }>(places: readonly T[]): T[] {
  return places.filter((place) => place.number <= 47 || REBUILD_KEEPS.includes(place.code));
}

export const PLOTS: Readonly<Record<string, Plot>> = {
  finale: FINALE,
  snowball: SNOWBALL,
  'act-k23': ACT_K23,
  'act-k25': ACT_K25,
  wall: WALL,
  'wall-peak': WALL_PEAK,
  stop: STOP,
  'far-faces': FAR_FACES,
  'three-tricks': THREE_TRICKS,
};
