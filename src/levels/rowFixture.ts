import { buildRow, type Row } from './row';

/**
 * A row of five places in two chapters, made up for the tests of what reads a row: none of them names
 * the row of the game. Every board is that of B01_s290 under another code.
 */
const board = (code: string): string =>
  [`id: ${code}`, 'status: R', 'faces: 2', 'par: 3', 'exact: yes', 'way: 0,1,N 0,0,E 1,0,S', '---', ' .   .   .', '24*  .  21', ' .   .   .'].join('\n');

export const FIXTURE: Row = buildRow(
  {
    chapters: [
      {
        title: 'first',
        places: [
          { board: 'F1', role: 'meet', archetype: 'a', help: { sign: 'N', plaques: 'all', wait: 'first', camera: 'hold' } },
          { board: 'F2', role: 'learn', archetype: 'b', help: { plaques: 'near', wait: 'lesson', camera: 'hold' } },
          { board: 'F3', role: 'apply', archetype: 'c', help: { hint: 'roadHintChain', plaques: 'near', wait: 'free', camera: 'cells' } },
        ],
      },
      {
        title: 'second',
        faces: [2, 3],
        floor: 'open',
        places: [
          { board: 'G1', role: 'meet', archetype: 'd', help: { hint: 'roadHintWalk' } },
          { board: 'G2', role: 'rest', archetype: 'e' },
        ],
      },
    ],
  },
  new Map(['F1', 'F2', 'F3', 'G1', 'G2'].map((code) => [code, board(code)])),
);
