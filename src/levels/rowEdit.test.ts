import { describe, expect, it } from 'vitest';
import rowJson from '../../boards/row.json?raw';
import { parseBoard, readBoardHead } from './boardFile';
import { BOARD_TEXTS } from './boardFiles';
import { buildRow, readRowFile, type RowFile, type RowPlaceFile } from './row';
import { helpNear, rowEdit, rowFileText, swapBoardTexts, withStatus, type PlaceFields } from './rowEdit';

const p = (board: string): RowPlaceFile => ({ board, role: 'apply', archetype: 'x', help: { plaques: 'near' } });
const sample = (): RowFile => ({
  chapters: [
    { title: 'a', places: [p('A1'), p('A2')] },
    { title: 'b', faces: [2, 3], places: [p('B1')] },
  ],
});
const codes = (file: RowFile): string[][] => file.chapters.map((chapter) => chapter.places.map((place) => place.board));
const fields: PlaceFields = { role: 'meet', teaches: 'link', archetype: 'new', help: { hint: 'roadHintChain', camera: 'cells' } };
/** The line an operation is refused with. */
const refusal = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return 'done';
};

describe('rowEdit: insert', () => {
  it('puts a board first in its chapter, or right after the place it is given', () => {
    expect(codes(rowEdit(sample(), { op: 'insert', board: 'N1', chapter: 0, after: null, place: fields }).file)).toEqual([['N1', 'A1', 'A2'], ['B1']]);
    const after = rowEdit(sample(), { op: 'insert', board: 'N1', chapter: 0, after: 'A1', place: fields });
    expect(codes(after.file)).toEqual([['A1', 'N1', 'A2'], ['B1']]);
    expect(after.file.chapters[0].places[1]).toEqual({ board: 'N1', ...fields });
    expect(after.statuses).toEqual({ N1: 'R' });
    expect(codes(rowEdit(sample(), { op: 'insert', board: 'N1', chapter: 1, after: 'B1', place: fields }).file)).toEqual([['A1', 'A2'], ['B1', 'N1']]);
  });
  it('refuses a board in the row already, in any letter case, a place that is not in the chapter, and a chapter there is none of', () => {
    expect(refusal(() => rowEdit(sample(), { op: 'insert', board: 'B1', chapter: 0, after: null, place: fields }))).toBe('row: B1 is in the row already');
    expect(refusal(() => rowEdit(sample(), { op: 'insert', board: 'b1', chapter: 0, after: null, place: fields }))).toBe('row: b1 is in the row already');
    expect(refusal(() => rowEdit(sample(), { op: 'insert', board: 'N1', chapter: 0, after: 'B1', place: fields }))).toBe('row: B1 is not in chapter 1');
    expect(refusal(() => rowEdit(sample(), { op: 'insert', board: 'N1', chapter: 2, after: null, place: fields }))).toMatch(/^row: /);
    expect(refusal(() => rowEdit(sample(), { op: 'insert', board: 'N1', chapter: -1, after: null, place: fields }))).toMatch(/^row: /);
  });
});

describe('rowEdit: move', () => {
  it('swaps a place with its neighbour inside its chapter', () => {
    const moved = rowEdit(sample(), { op: 'move', board: 'A2', way: 'up' });
    expect(codes(moved.file)).toEqual([['A2', 'A1'], ['B1']]);
    expect(moved.statuses).toEqual({});
    expect(codes(rowEdit(sample(), { op: 'move', board: 'A1', way: 'down' }).file)).toEqual([['A2', 'A1'], ['B1']]);
  });
  it('carries the first place of a chapter up to the end of the chapter before, and the last one down to the start of the next', () => {
    expect(codes(rowEdit(sample(), { op: 'move', board: 'B1', way: 'up' }).file)).toEqual([['A1', 'A2', 'B1'], []]);
    expect(codes(rowEdit(sample(), { op: 'move', board: 'A2', way: 'down' }).file)).toEqual([['A1'], ['A2', 'B1']]);
  });
  it('refuses to move a place past the start or the end of the row, and a board that is not in it', () => {
    expect(refusal(() => rowEdit(sample(), { op: 'move', board: 'A1', way: 'up' }))).toBe('row: A1 is at the start of the row');
    expect(refusal(() => rowEdit(sample(), { op: 'move', board: 'B1', way: 'down' }))).toBe('row: B1 is at the end of the row');
    expect(refusal(() => rowEdit(sample(), { op: 'move', board: 'Z9', way: 'down' }))).toMatch(/^row: Z9/);
  });
});

describe('rowEdit: remove and edit', () => {
  it('takes a place off, and its board goes where it is told', () => {
    const removed = rowEdit(sample(), { op: 'remove', board: 'A1', status: 'RC' });
    expect(codes(removed.file)).toEqual([['A2'], ['B1']]);
    expect(removed.statuses).toEqual({ A1: 'RC' });
    expect(rowEdit(sample(), { op: 'remove', board: 'B1', status: 'X' }).statuses).toEqual({ B1: 'X' });
    expect(refusal(() => rowEdit(sample(), { op: 'remove', board: 'Z9', status: 'X' }))).toMatch(/^row: Z9/);
  });
  it('says the board as the row has it, whatever letter case the operation gives', () => {
    expect(rowEdit(sample(), { op: 'remove', board: 'a1', status: 'X' }).statuses).toEqual({ A1: 'X' });
  });
  it('changes the fields of a place and keeps its board', () => {
    const edited = rowEdit(sample(), { op: 'edit', board: 'A2', place: fields });
    expect(edited.file.chapters[0].places[1]).toEqual({ board: 'A2', ...fields });
    expect(codes(edited.file)).toEqual(codes(sample()));
    expect(edited.statuses).toEqual({});
    expect(refusal(() => rowEdit(sample(), { op: 'edit', board: 'Z9', place: fields }))).toMatch(/^row: Z9/);
  });
  it('changes nothing of the file it is given', () => {
    const file = sample();
    const before = structuredClone(file);
    rowEdit(file, { op: 'insert', board: 'N1', chapter: 0, after: 'A1', place: fields });
    rowEdit(file, { op: 'move', board: 'B1', way: 'up' });
    rowEdit(file, { op: 'move', board: 'A2', way: 'down' });
    rowEdit(file, { op: 'remove', board: 'A1', status: 'X' });
    const edited = rowEdit(file, { op: 'edit', board: 'A1', place: fields });
    edited.file.chapters[0].places[1].help!.plaques = 'all';
    expect(file).toEqual(before);
  });
});

describe('helpNear', () => {
  it('is the help of the place before the new one, or of the one after it where it goes first', () => {
    expect(helpNear(sample(), 0, 'A1')).toEqual({ plaques: 'near' });
    const file = sample();
    file.chapters[1].places[0].help = { sign: 'E' };
    expect(helpNear(file, 1, null)).toEqual({ sign: 'E' });
    expect(helpNear({ chapters: [{ title: 'empty', places: [] }] }, 0, null)).toEqual({});
  });
  it('gives a copy, not the help of the file', () => {
    const file = sample();
    helpNear(file, 0, 'A1').plaques = 'all';
    expect(file.chapters[0].places[0].help).toEqual({ plaques: 'near' });
  });
});

describe('rowFileText', () => {
  it('writes boards/row.json as it is written: a chapter over lines, a place a line', () => {
    expect(rowFileText(readRowFile(rowJson))).toBe(rowJson);
  });
  it('writes a row that the next reading gives back, an empty chapter with it', () => {
    const file: RowFile = { chapters: [...sample().chapters, { title: 'c', floor: 'open', places: [] }] };
    expect(readRowFile(rowFileText(file))).toEqual(file);
  });
  it('writes the emotion of a place between its archetype and its event', () => {
    const file: RowFile = { chapters: [{ title: 'a', places: [{ event: 'e', emotion: 'gift', archetype: 'a', role: 'meet', board: 'A1' }] }] };
    expect(rowFileText(file)).toContain('{ "board": "A1", "role": "meet", "archetype": "a", "emotion": "gift", "event": "e" }');
  });
  it('lays the real row again after an insert of a board that is not of the row, once its file says R', () => {
    const file = readRowFile(rowJson);
    const name = [...BOARD_TEXTS.keys()].find((code) => readBoardHead(BOARD_TEXTS.get(code)!).status !== 'R' && !rowJson.includes(`"${code}"`) && (() => {
      try {
        parseBoard(BOARD_TEXTS.get(code)!, code);
        return true;
      } catch {
        return false;
      }
    })());
    expect(name).toBeDefined();
    const { file: next, statuses } = rowEdit(file, { op: 'insert', board: name!, chapter: 0, after: 'R03', place: { role: 'apply', archetype: 'test', help: helpNear(file, 0, 'R03') } });
    const texts = new Map(BOARD_TEXTS);
    expect(() => buildRow(next, texts)).toThrow(`row: ${name}: the file says status`);
    for (const [code, status] of Object.entries(statuses)) texts.set(code, withStatus(texts.get(code)!, status));
    const row = buildRow(readRowFile(rowFileText(next)), texts);
    expect(row.places[3].code).toBe(name);
    expect(row.places).toHaveLength(buildRow(file, BOARD_TEXTS).places.length + 1);
  });
});

describe('withStatus', () => {
  it('says the status anew in the head and leaves the rest of the file as it was', () => {
    const text = `id: a-1\nnote: заметка\nstatus: RC\norigin: проба\n# своя строка\nfaces: 2\n---\n 23* 65\n  .   .\n`;
    expect(withStatus(text, 'R')).toBe(text.replace('status: RC', 'status: R'));
    expect(readBoardHead(withStatus('id: a-1\nfaces: 2\n---\n21* 21\n .   .\n', 'R')).status).toBe('R');
  });
});

describe('swapBoardTexts', () => {
  const kept = [
    'id: R05',
    'note: своя заметка',
    'status: R',
    'batch: bridge 2026-10-10',
    'origin: проба 7 октября',
    'was: R05old',
    'mark: огонь',
    'words: 2026-10-12: слово',
    'tags: one two',
    'faces: 2',
    'par: 3',
    'exact: yes',
    'way: 0,1,N 0,0,E 1,0,S',
    '---',
    ' .   .   .',
    '24*  .  21',
    ' .   .   .',
    '',
  ].join('\n');
  const other = ['id: R05-try-1', 'note: копия', 'status: D', 'origin: копия R05', 'faces: 2 3', 'floor: shut', 'par: 2', 'way: 0,0,E 1,0,S', '---', '21*  .', ' .  31', ''].join('\n');
  const swapped = swapBoardTexts(kept, other, 'прежняя доска R05, заменена 2026-10-16');

  it('gives the kept file the board of the other, with the head and the id of its own', () => {
    expect(parseBoard(swapped.kept, 'R05', true)).toEqual({ ...parseBoard(other, 'R05-try-1', true), id: 'R05' });
    expect(readBoardHead(swapped.kept)).toEqual(readBoardHead(kept));
  });
  it('gives the other file the board that was kept, its own id, RC and the note it is told', () => {
    expect(parseBoard(swapped.other, 'R05-try-1', true)).toEqual({ ...parseBoard(kept, 'R05', true), id: 'R05-try-1' });
    expect(readBoardHead(swapped.other)).toEqual({ ...readBoardHead(other), status: 'RC', note: 'прежняя доска R05, заменена 2026-10-16' });
  });
});
