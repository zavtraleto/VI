import { describe, expect, it } from 'vitest';
import { rowBoards, spareBoards } from './boardSets';
import { normalSpec, parseBoard, printBoard, readBoardHead, withHead } from './boardFile';

const SAMPLE = `id: H01
note: третья кость подъезжает толчком
status: D
faces: 3
floor: open
par: 2
exact: yes
way: 1,2,E 2,2,N
---
 -   .   .
 .  23   .
 .  65*  -
`;

describe('parseBoard', () => {
  it('reads a board with holes, a start and a way', () => {
    const spec = parseBoard(SAMPLE, 'H01');
    expect(spec.id).toBe('H01');
    expect(spec.size).toBe(3);
    expect(spec.holes).toEqual([{ x: 0, z: 0 }, { x: 2, z: 2 }]);
    expect(spec.layout!.start).toEqual({ x: 1, z: 2 });
    expect(spec.layout!.dice).toEqual([{ x: 1, z: 1, top: 2, north: 3 }, { x: 1, z: 2, top: 6, north: 5 }]);
    expect(spec.faces).toEqual([3]);
    expect(spec.par).toBe(2);
    expect(spec.exact).toBe(true);
    expect(spec.solution).toEqual(['1,2,E', '2,2,N']);
    expect(spec.floor).toBeUndefined();
    expect(readBoardHead(SAMPLE)).toEqual({ note: 'третья кость подъезжает толчком', status: 'D' });
  });
  it('reads fixed, leaving and a floor start', () => {
    const spec = parseBoard(`id: L\nfaces: 3\nfloor: shut\n---\n 31+ 31+ 12~1\n  .   .  f\n  .   .   .\n`, 'L');
    expect(spec.layout!.onFloor).toBe(true);
    expect(spec.layout!.start).toEqual({ x: 2, z: 1 });
    expect(spec.layout!.dice[0].fixed).toBe(true);
    expect(spec.layout!.leaving).toEqual([{ die: 2, moves: 1 }]);
    expect(spec.floor).toBe(false);
  });
  it.each([
    ['two starts', ' 23* 65*\n  .   .', /one start/],
    ['start and floor start', ' 23*  f\n  .   .', /one start/],
    ['no start', ' 23  65\n  .   .', /one start/],
    ['leaving longer than sink', ' 23* 65~3\n  .   .', /~3/],
    ['leaving zero', ' 23* 65~0\n  .   .', /~0/],
    ['an orientation that is no die', ' 22*  .\n  .   .', /22/],
    ['a short row', ' 23*\n  .   .', /row 1/],
  ])('refuses %s', (_, grid, message) => {
    expect(() => parseBoard(`id: X\nfaces: 2\n---\n${grid}\n`, 'X')).toThrow(message);
  });
  it('refuses an unknown line and exact without par', () => {
    expect(() => parseBoard(`id: X\nfoo: 1\nfaces: 2\n---\n 23* .\n .   .\n`, 'X')).toThrow(/foo/);
    expect(() => parseBoard(`id: X\nexact: yes\nfaces: 2\n---\n 23* .\n .   .\n`, 'X')).toThrow(/exact/);
  });
  it('names the cell of a die that leaves in too many moves, and the board in what the rules refuse', () => {
    expect(() => parseBoard(`id: X\nfaces: 2\n---\n 23* 65~3\n  .   .\n`, 'X')).toThrow(/board X: cell 1,0/);
    expect(() => parseBoard(`id: X\nfaces: 2\n---\n 23*  -   .\n  -   -   -\n  .   .   .\n`, 'X')).toThrow(/board X: .*two parts/);
  });
});

describe('parseBoard, loose', () => {
  it('reads a board the rules refuse as it is written: no start, two starts, a die that leaves too late, a board in two parts', () => {
    const none = parseBoard(`id: X\nfaces: 2\n---\n 23  65\n  .   .\n`, 'X', true);
    expect(none.layout!.dice).toHaveLength(2);
    expect(none.layout!.start).toEqual({ x: -1, z: -1 });
    // Written again it is the same file, and still a board with no start.
    expect(printBoard(none)).toContain('23  65');
    expect(() => parseBoard(printBoard(none), 'X')).toThrow(/one start is needed, found 0/);
    expect(parseBoard(`id: X\nfaces: 2\n---\n 23* 65*\n  .   .\n`, 'X', true).layout!.start).toEqual({ x: 0, z: 0 });
    expect(parseBoard(`id: X\nfaces: 2\n---\n 23* 65~3\n  .   .\n`, 'X', true).layout!.leaving).toEqual([{ die: 1, moves: 3 }]);
    expect(parseBoard(`id: X\nfaces: 2\n---\n 23*  -   .\n  -   -   -\n  .   .   .\n`, 'X', true).holes).toHaveLength(4);
    expect(parseBoard(`id: X\nfaces: 2\n---\n .   .\n .   .\n`, 'X', true).norm).toBe(0);
  });
  it('still refuses what cannot be read', () => {
    expect(() => parseBoard(`id: X\nfaces: 2\n---\n 22*  .\n  .   .\n`, 'X', true)).toThrow(/22/);
    expect(() => parseBoard(`id: X\nfaces: 2\n---\n 23*\n  .   .\n`, 'X', true)).toThrow(/row 1/);
    expect(() => parseBoard(`id: X\nfoo: 1\nfaces: 2\n---\n 23* .\n .   .\n`, 'X', true)).toThrow(/foo/);
  });
});

describe('printBoard', () => {
  it.each([...rowBoards(), ...spareBoards()].map((spec) => [spec.id, spec] as const))('round-trips %s', (_, spec) => {
    const text = printBoard(spec);
    expect(normalSpec(parseBoard(text, spec.id))).toEqual(normalSpec(spec));
  });
  it('keeps note and status', () => {
    const spec = parseBoard(SAMPLE, 'H01');
    expect(readBoardHead(printBoard(spec, readBoardHead(SAMPLE)))).toEqual({ note: 'третья кость подъезжает толчком', status: 'D' });
  });
});

describe('the head of the library', () => {
  const HEAD = `id: Q1
status: RC
origin: проба 7 октября
mark: огонь
words: 2026-10-12: изи катка, хитрость
words: 2026-10-14: всё ещё хороша
tags: мост накат
faces: 3
---
 -   .   .
 .  23   .
 .  65*  -
`;
  it('reads the status, where the board is from, the mark, the words by their days and the tags', () => {
    expect(readBoardHead(HEAD)).toEqual({
      status: 'RC',
      origin: 'проба 7 октября',
      mark: 'огонь',
      words: [
        { date: '2026-10-12', text: 'изи катка, хитрость' },
        { date: '2026-10-14', text: 'всё ещё хороша' },
      ],
      tags: ['мост', 'накат'],
    });
    expect(parseBoard(HEAD, 'Q1').id).toBe('Q1');
  });
  it('writes them back in the same order', () => {
    expect(printBoard(parseBoard(HEAD, 'Q1'), readBoardHead(HEAD))).toBe(HEAD);
  });
  it.each([
    ['fire', 'RC', 'огонь'],
    ['good', 'RC', 'норм'],
    ['miss', 'X', 'мимо'],
    ['idea', 'D', undefined],
    ['work', 'D', undefined],
  ] as const)('reads the old status %s as %s with the mark %s, and writes it new', (old, status, mark) => {
    const text = HEAD.replace('status: RC', `status: ${old}`).replace('mark: огонь\n', '');
    const head = readBoardHead(text);
    expect(head).toMatchObject({ status, migrated: true });
    expect(head.mark).toBe(mark);
    const again = printBoard(parseBoard(text, 'Q1'), head);
    expect(again).toContain(`status: ${status}\n`);
    expect(readBoardHead(again).migrated).toBeUndefined();
  });
  it('keeps the mark a file says over the one its old status meant', () => {
    expect(readBoardHead(HEAD.replace('status: RC', 'status: fire').replace('mark: огонь', 'mark: мимо')).mark).toBe('мимо');
  });
  it('refuses a status that is none, a mark that is none and words with no date', () => {
    expect(() => parseBoard(HEAD.replace('status: RC', 'status: maybe'), 'Q1')).toThrow(/"status: maybe" is none of N D RC R X/);
    expect(() => parseBoard(HEAD.replace('mark: огонь', 'mark: класс'), 'Q1')).toThrow(/mark: класс/);
    expect(() => parseBoard(HEAD.replace('words: 2026-10-14: ', 'words: '), 'Q1')).toThrow(/has no date/);
  });
});

describe('the head of the workshop', () => {
  const text = [
    'id: bridge-3',
    'status: N',
    'batch: bridge 2026-10-16',
    'origin: заказ',
    'was: P13_s30460 P13x',
    'faces: 2',
    '---',
    '21* 21',
    ' .   .',
  ].join('\n');
  it('reads a new board, its batch and the names it had', () => {
    expect(readBoardHead(text)).toEqual({ status: 'N', batch: 'bridge 2026-10-16', origin: 'заказ', was: ['P13_s30460', 'P13x'] });
  });
  it('writes them back in the order of the keys, and the hash of the board does not see them', () => {
    const spec = parseBoard(text, 'bridge-3', true);
    const written = printBoard(spec, readBoardHead(text));
    expect(written.split('\n').slice(0, 5)).toEqual(['id: bridge-3', 'status: N', 'batch: bridge 2026-10-16', 'origin: заказ', 'was: P13_s30460 P13x']);
    expect(printBoard(normalSpec(parseBoard(written, 'x', true)))).toBe(printBoard(normalSpec(spec)));
  });
  it('says N among the statuses a file may have', () => {
    expect(() => parseBoard(text.replace('status: N', 'status: Q'), 'q', true)).toThrow('"status: Q" is none of N D RC R X');
  });
  it('keeps them when the head of the library is said anew', () => {
    expect(readBoardHead(withHead(text, { ...readBoardHead(text), status: 'RC' }))).toEqual({ status: 'RC', batch: 'bridge 2026-10-16', origin: 'заказ', was: ['P13_s30460', 'P13x'] });
  });
});
