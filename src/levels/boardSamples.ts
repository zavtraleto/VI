import { parseBoard } from './boardFile';

/**
 * Boards the tests of the lab are run on, written as files of boards. They are kept here and
 * not taken from the list of the levels or from the road by their place there: the list and the
 * road are rebuilt, and a test of the tool is no test of them.
 */

/** A board with a push from the floor and a climb back: two rolls make a pair, the push a second, the last roll a link. */
export const DOWN_AND_UP = parseBoard(
  `id: P06
faces: 2
seed: 30282
chapter: 0
par: 4
exact: yes
way: 0,0,E 1,0,E 0,2,S,p 1,2,W
---
54*  .   .   .
 .   .  21   .
21  64   .   .
 .  24   .   .
`,
  'P06',
);

/** A board of the road as a lesson has it: cells cut out, two fixed dice, a die that is leaving for a stair, the player on the floor. */
export const LESSON = parseBoard(
  `id: R02
faces: 3
undos: 3
seed: 8102
chapter: 0
par: 4
exact: yes
way: 2,3,N 2,2,N 2,1,N 2,0,E
---
 -    -    .    .   31+   -
 -    -    .    -   31+   -
 -    -    .    -    -    -
 -    -   12    -    -    -
 -    -   62~1  -    -    -
 -    -    f    -    -    -
`,
  'R02',
);
