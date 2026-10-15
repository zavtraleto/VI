import { describe, expect, it } from 'vitest';
import { normalSpec, parseBoard, readBoardHead } from './boardFile';
import { CAMPAIGN } from './campaign';
import type { LevelSpec } from '../rules/types';
import { parkedBoards, spareBoards } from './boardSets';
import {
  asInRow,
  checkLibrary,
  codeWithEdition,
  compactOrigins,
  exportText,
  fileOfSpec,
  markOfKey,
  mergeHead,
  placeOf,
  sameBoardAnyFaces,
  sameDice,
  spareName,
  statusFor,
  type LibraryRowChapter,
  rowChapters,
} from './library';
import { fileBoard } from './boardFiles';
import { ROW as LAID } from './row.gen';

const ROW: readonly LibraryRowChapter[] = [
  { id: 0, title: 'prologue', faces: null, stops: ['R01', 'R02'] },
  { id: 1, title: 'road', faces: [2, 3], stops: ['P02', 'C1-04'] },
];

describe('the names of the library', () => {
  it('gives an older board of a code its edition, and a board of a reserve its seed', () => {
    expect(codeWithEdition('R07', 2)).toBe('R07e2');
    expect(spareName('P01', 30512)).toBe('P01_s30512');
  });
});

describe('the place of a board', () => {
  it('is its number in the row and its chapter, or none', () => {
    expect(placeOf('R02', ROW)).toEqual({ number: 2, chapter: 0, title: 'prologue' });
    expect(placeOf('C1-04', ROW)).toEqual({ number: 4, chapter: 1, title: 'road' });
    expect(placeOf('P13', ROW)).toBeNull();
  });
  it('plays a board of a chapter on the faces of the chapter, with the floor open', () => {
    const spec = { ...parkedBoards()[0], floor: false as const };
    const played = asInRow(spec, placeOf('P02', ROW), ROW);
    expect(played.faces).toEqual([2, 3]);
    expect(played.floor).toBeUndefined();
    expect(asInRow(spec, placeOf('R01', ROW), ROW)).toBe(spec);
  });
});

describe('a board as a file', () => {
  it('is read back as the same board under its name', () => {
    const named = spareBoards()[0];
    const spec = { ...named, id: named.id.slice(0, named.id.indexOf('_s')) };
    const name = spareName(spec.id, spec.seed);
    const text = fileOfSpec(spec, name, { status: 'D', origin: 'проба 7 октября, резерв (P01)' });
    const back = parseBoard(text, name);
    expect(back.id).toBe(name);
    expect(normalSpec({ ...back, id: spec.id })).toEqual(normalSpec({ ...spec, chapter: spec.chapter }));
    expect(readBoardHead(text)).toEqual({ status: 'D', origin: 'проба 7 октября, резерв (P01)' });
  });
  it('is the same dice whatever faces it works on, and the same board turned', () => {
    expect(sameDice(fileBoard('R03'), { ...fileBoard('R03'), faces: [5], values: [5] })).toBe(true);
    expect(sameDice(fileBoard('R03'), { ...fileBoard('R03'), solution: [] })).toBe(false);
    expect(sameDice(fileBoard('R03'), fileBoard('R04'))).toBe(false);
    expect(sameBoardAnyFaces(fileBoard('R03'), { ...fileBoard('R03'), faces: [5], values: [5] })).toBe(true);
  });
});

describe('the head merged', () => {
  it('adds what it lacks and takes nothing back', () => {
    const kept = { status: 'RC' as const, origin: 'лаборатория', mark: 'огонь' as const, words: [{ date: '2026-10-12', text: 'да' }], tags: ['мост'] };
    const merged = mergeHead(kept, {
      status: 'D',
      origin: 'лаборатория; акт I',
      mark: 'мимо',
      words: [{ date: '2026-10-12', text: 'да' }, { date: '2026-10-14', text: 'ещё' }],
      tags: ['мост', 'накат'],
      note: 'новая',
    });
    expect(merged).toEqual({
      status: 'RC',
      origin: 'лаборатория; акт I',
      mark: 'огонь',
      words: [{ date: '2026-10-12', text: 'да' }, { date: '2026-10-14', text: 'ещё' }],
      tags: ['мост', 'накат'],
      note: 'новая',
    });
    expect(mergeHead(merged, merged)).toEqual(merged);
  });
  it('drops the mark of a migrated head, once it is written anew', () => {
    expect(mergeHead({ status: 'RC', mark: 'норм', migrated: true }, {})).toEqual({ status: 'RC', mark: 'норм' });
  });
  it('says the editions of the road as a span, and a source once', () => {
    expect(compactOrigins(['проба 7 октября (P08)', 'дорога, редакция 3', 'дорога, редакция 4', 'дорога, редакция 5', 'дорога, редакция 5', 'пролог, дорога редакции 7'])).toEqual([
      'проба 7 октября (P08)',
      'дорога, редакции 3–5',
      'пролог, дорога редакции 7',
    ]);
    expect(compactOrigins(['дорога, редакция 1 (R09)', 'дорога, редакция 3 (R09)', 'дорога, редакция 2'])).toEqual(['дорога, редакции 1, 3 (R09)', 'дорога, редакция 2']);
  });
});

describe('the status a board is laid with', () => {
  it('is R in the row, RC out of it where it was R, else what the file says, else by the mark', () => {
    expect(statusFor('R01', 'X', 'мимо', ROW)).toBe('R');
    expect(statusFor('P13', 'R', undefined, ROW)).toBe('RC');
    expect(statusFor('P13', 'X', 'огонь', ROW)).toBe('X');
    expect(statusFor('P13', undefined, 'огонь', ROW)).toBe('RC');
    expect(statusFor('P13', undefined, 'норм', ROW)).toBe('RC');
    expect(statusFor('P13', undefined, 'мимо', ROW)).toBe('X');
    expect(statusFor('P13', undefined, undefined, ROW)).toBe('D');
  });
});

describe('checkLibrary', () => {
  const file = (spec: LevelSpec, status: string, name = spec.id): { name: string; text: string } => ({ name, text: fileOfSpec(spec, name).replace('---', `status: ${status}\n---`) });
  const row = [fileBoard('R01'), fileBoard('R02')];
  const chapters: readonly LibraryRowChapter[] = [{ id: 0, title: 'prologue', faces: null, stops: [fileBoard('R01').id, fileBoard('R02').id] }];
  it('is clean where the files and the code agree', () => {
    expect(checkLibrary([file(fileBoard('R01'), 'R'), file(fileBoard('R02'), 'R'), file(fileBoard('R03'), 'D', 'Z1')], { row }, chapters)).toEqual([]);
  });
  it('names the code of a board of the row with no file, with another status or another board, and of an R file out of the row', () => {
    const faults = checkLibrary([file(fileBoard('R01'), 'RC'), file(fileBoard('R04'), 'R', fileBoard('R02').id), file(fileBoard('R03'), 'R')], { row }, chapters);
    expect(faults).toEqual([
      `${fileBoard('R01').id}: in the row, and its file says status RC`,
      `${fileBoard('R02').id}: the file is another board than the one in the row`,
      `${fileBoard('R03').id}: status R, and it is not in the row`,
    ]);
    expect(checkLibrary([], { row }, chapters)).toEqual([
      `${fileBoard('R01').id}: in the row, and there is no file boards/${fileBoard('R01').id}.txt`,
      `${fileBoard('R02').id}: in the row, and there is no file boards/${fileBoard('R02').id}.txt`,
    ]);
  });
  it('names a file of the old statuses', () => {
    expect(checkLibrary([file(fileBoard('R03'), 'fire', 'Z1')], { row: [] }, [])).toEqual(['Z1: the status is of the old words; run node scripts/library.mjs import']);
  });
});

describe('the text given out', () => {
  it('says a board to a line, with its place and passport, the mark and the words', () => {
    const text = exportText(
      [
        { name: 'P13', status: 'R', place: { number: 28, chapter: 3, title: 'Большое' }, faces: [6], par: 5, route: 'K', turns: 2, away: 1, mark: 'огонь', words: [{ date: '2026-10-14', text: 'изи катка, хитрость' }] },
        { name: 'C1-04', status: 'X', place: null, faces: [2, 3], par: 3, route: 'K ~ L', mark: 'мимо', words: [{ date: '2026-10-14', text: 'репетативно и просто' }] },
      ],
      '2026-10-14',
    );
    expect(text).toBe(
      [
        '## Библиотека, выгрузка 2026-10-14',
        '',
        '- P13 (R, место 28, глава 3 «Большое», грани 6, par 5, K, turns 2 away 1) — огонь. 2026-10-14: «изи катка, хитрость».',
        '- C1-04 (X, —, глава —, грани 2 3, par 3, K ~ L) — мимо. 2026-10-14: «репетативно и просто».',
        '',
      ].join('\n'),
    );
  });
  it('says that nothing was marked, where nothing was', () => {
    expect(exportText([], '2026-10-14')).toBe('## Библиотека, выгрузка 2026-10-14\n\n- ничего не оценено\n');
  });
  it('reads the keys of a mark', () => {
    expect([markOfKey('Digit1'), markOfKey('Numpad2'), markOfKey('Digit3'), markOfKey('KeyE')]).toEqual(['огонь', 'норм', 'мимо', null]);
  });
});

describe('the files of boards/ and the code', () => {
  // The files as they lie on the disk, read by the bundler: every `boards/*.txt` as text.
  const texts = import.meta.glob<string>('../../boards/*.txt', { query: '?raw', import: 'default', eager: true });
  const files = Object.entries(texts).map(([path, text]) => ({ name: path.slice(path.lastIndexOf('/') + 1, -'.txt'.length), text }));
  const row = CAMPAIGN.map((stop) => stop.spec);
  const rowCodes = new Set(row.map((spec) => spec.id));
  it('every board of the row has a file with status R, and every R file is in the row', () => {
    const faults = checkLibrary(files, { row }, rowChapters(LAID));
    expect(faults).toEqual([]);
    expect(files.filter((file) => readBoardHead(file.text).status === 'R').map((file) => file.name).sort()).toEqual([...rowCodes].sort());
  });
  it('places every stop of the chapters', () => {
    for (const stop of CAMPAIGN) expect(placeOf(stop.spec.id, rowChapters(LAID))?.number).toBe(stop.number);
  });
});
