import { describe, expect, it } from 'vitest';
import { printBoard, readBoardHead } from '../levels/boardFile';
import { fileBoard } from '../levels/boardFiles';
import { askOf, boardHash, exportFile, headPatchOf, historyPath, patchHead, renamedText, renameOf, rowOpOf, safeName, swapOf, versionOf } from './boardsServer';

describe('safeName', () => {
  it('takes the name of a board and nothing that could be a path', () => {
    expect(safeName('H01')).toBe('H01');
    expect(safeName('../x')).toBeNull();
    expect(safeName('a b')).toBeNull();
    expect(safeName('a/b')).toBeNull();
    expect(safeName('a\\b')).toBeNull();
    expect(safeName('')).toBeNull();
  });
});

describe('the history', () => {
  it('names the file of a version by its time and its hash, and reads the name back', () => {
    const path = historyPath('r', 'H01', 'abcd1234', new Date('2026-10-12T17:08:27Z'));
    expect(path).toBe('r/boards/.history/H01/20261012T170827Z-abcd1234.txt');
    expect(versionOf('20261012T170827Z-abcd1234.txt')).toEqual({ file: '20261012T170827Z-abcd1234.txt', time: '2026-10-12T17:08:27Z', hash: 'abcd1234' });
    expect(versionOf('plays.jsonl')).toBeNull();
  });
  it('knows a board by its dice and its head, not by its note', () => {
    const text = printBoard(fileBoard('R03'));
    expect(boardHash(text)).toMatch(/^[0-9a-f]{8}$/);
    expect(boardHash(printBoard(fileBoard('R03'), { note: 'another word', status: 'RC', mark: 'огонь', words: [{ date: '2026-10-14', text: 'слово' }] }))).toBe(boardHash(text));
    expect(boardHash(printBoard(fileBoard('R04')))).not.toBe(boardHash(text));
    expect(boardHash('no board at all')).toBeNull();
  });
});

describe('a head laid into a file', () => {
  const text = `id: H01\nnote: заметка\nstatus: RC\norigin: проба 7 октября\nwords: 2026-10-12: было\n# своя строка\nfaces: 2\n---\n 23* 65\n  .   .\n`;
  it('sets the mark and adds the words, and leaves the rest of the file as it was', () => {
    const patched = patchHead(text, { mark: 'огонь', words: [{ date: '2026-10-14', text: 'стало' }] });
    expect(patched).toBe(`id: H01\nnote: заметка\nstatus: RC\norigin: проба 7 октября\nmark: огонь\nwords: 2026-10-12: было\nwords: 2026-10-14: стало\n# своя строка\nfaces: 2\n---\n 23* 65\n  .   .\n`);
    expect(readBoardHead(patchHead(patched, { mark: 'мимо' })).mark).toBe('мимо');
  });
  it('is the same board, so no version of it is kept', () => {
    expect(boardHash(patchHead(text, { mark: 'норм', words: [{ date: '2026-10-14', text: 'а' }] }))).toBe(boardHash(text));
  });
  it('reads a patch from a body, and refuses what is none', () => {
    expect(headPatchOf('{"mark":"огонь","words":[{"date":"2026-10-14","text":" да "}]}')).toEqual({ mark: 'огонь', words: [{ date: '2026-10-14', text: 'да' }] });
    expect(headPatchOf('{"mark":"класс"}')).toBeNull();
    expect(headPatchOf('{"words":[{"date":"14 октября","text":"да"}]}')).toBeNull();
    expect(headPatchOf('{"words":[{"date":"2026-10-14","text":"две\\nстроки"}]}')).toBeNull();
    expect(headPatchOf('torn')).toBeNull();
  });
});

describe('askOf', () => {
  it('reads what an address asks for', () => {
    expect(askOf('GET', '/')).toEqual({ kind: 'list' });
    expect(askOf('GET', '')).toEqual({ kind: 'list' });
    expect(askOf('GET', '/H01')).toEqual({ kind: 'read', name: 'H01' });
    expect(askOf('PUT', '/H01')).toEqual({ kind: 'write', name: 'H01' });
    expect(askOf('GET', '/H01/history')).toEqual({ kind: 'history', name: 'H01' });
    expect(askOf('GET', '/H01/history/20261012T170827Z-abcd1234.txt')).toEqual({ kind: 'version', name: 'H01', file: '20261012T170827Z-abcd1234.txt' });
    expect(askOf('POST', '/H01/plays')).toEqual({ kind: 'play', name: 'H01' });
    expect(askOf('GET', '/H01/plays?x=1')).toEqual({ kind: 'plays', name: 'H01' });
  });
  it('refuses a name or a file that would lead out of the folder, however it is written', () => {
    for (const path of ['/..', '/%2e%2e', '/..%2Fx', '/a%2Fb', '/a%5Cb', '/H01.txt', '/a b']) {
      expect(askOf('PUT', path), path).toMatchObject({ kind: 'refused', status: 400 });
    }
    expect(askOf('GET', '/H01/history/..%2F..%2Fx.txt')).toMatchObject({ kind: 'refused', status: 400 });
    expect(askOf('GET', '/H01/history/plays.jsonl')).toMatchObject({ kind: 'refused', status: 400 });
    expect(askOf('GET', '/%E0%A4%A')).toMatchObject({ kind: 'refused', status: 400 });
  });
  it('reads the addresses of the library: the heads, a head, an export of a day', () => {
    expect(askOf('GET', '/?heads')).toEqual({ kind: 'heads' });
    expect(askOf('GET', '?heads')).toEqual({ kind: 'heads' });
    expect(askOf('PUT', '/H01/head')).toEqual({ kind: 'head', name: 'H01' });
    expect(askOf('POST', '?export=2026-10-14')).toEqual({ kind: 'export', date: '2026-10-14' });
    expect(askOf('POST', '?export=../x')).toMatchObject({ kind: 'refused', status: 400 });
    expect(askOf('GET', '/H01/head')).toMatchObject({ kind: 'refused', status: 405 });
    expect(askOf('PUT', '?heads')).toMatchObject({ kind: 'refused', status: 405 });
    expect(exportFile('2026-10-14')).toBe('export-2026-10-14.md');
  });
  it('refuses a method an address does not take, and an address there is none of', () => {
    expect(askOf('DELETE', '/H01')).toMatchObject({ kind: 'refused', status: 405 });
    expect(askOf('PUT', '/')).toMatchObject({ kind: 'refused', status: 405 });
    expect(askOf('GET', '/H01/other')).toMatchObject({ kind: 'refused', status: 404 });
  });
});

describe('a status laid into the head', () => {
  const file = (status: string) => `id: a-1\nstatus: ${status}\nfaces: 2\n---\n21* 21\n .   .\n`;
  it('takes the status of a verdict, and refuses R and a status no verdict gives', () => {
    expect(headPatchOf('{"status":"RC"}')).toEqual({ status: 'RC' });
    expect(headPatchOf('{"status":"R"}')).toBeNull();
    expect(headPatchOf('{"status":"Q"}')).toBeNull();
  });
  it('writes it over the one there was, and the board stays the board', () => {
    const after = patchHead(file('N'), { status: 'X', words: [{ date: '2026-10-16', text: 'скучно' }] });
    expect(readBoardHead(after)).toMatchObject({ status: 'X', words: [{ date: '2026-10-16', text: 'скучно' }] });
    expect(boardHash(file('N'), 'a-1')).not.toBeNull();
    expect(boardHash(after, 'a-1')).toBe(boardHash(file('N'), 'a-1'));
  });
  it('leaves a board of the row in the row: its status is not changed from the page', () => {
    expect(() => patchHead(file('R'), { status: 'D' })).toThrow('a board of the row keeps R');
    expect(readBoardHead(patchHead(file('R'), { words: [{ date: '2026-10-16', text: 'доделать: длинно' }] })).status).toBe('R');
  });
});

describe('a board renamed', () => {
  it('is asked with POST, by a name of a board to a name of a board', () => {
    expect(askOf('POST', '/a-1/rename')).toEqual({ kind: 'rename', name: 'a-1' });
    expect(askOf('GET', '/a-1/rename')).toMatchObject({ kind: 'refused', status: 405 });
    expect(renameOf('{"to":"bridge-2"}')).toBe('bridge-2');
    expect(renameOf('{"to":"../x"}')).toBeNull();
    expect(renameOf('{"to":"a.b"}')).toBeNull();
    expect(renameOf('nothing')).toBeNull();
  });
  it('takes the new name as its id and keeps the old one among the names it had', () => {
    const text = 'id: P13_s1\nwas: P13old\nfaces: 2\n---\n21* 21\n .   .\n';
    const renamed = renamedText(text, 'bridge-4');
    expect(renamed.split('\n')[0]).toBe('id: bridge-4');
    expect(readBoardHead(renamed).was).toEqual(['P13old', 'P13_s1']);
    expect(boardHash(renamed, 'bridge-4')).not.toBeNull();
  });
  it('starts the names it had where there were none', () => {
    const renamed = renamedText('id: a-1\nfaces: 2\n---\n21* 21\n .   .\n', 'a-2');
    expect(renamed.split('\n')[0]).toBe('id: a-2');
    expect(readBoardHead(renamed).was).toEqual(['a-1']);
  });
  it('does not keep among the names it had the name it is given back', () => {
    const back = renamedText(renamedText('id: a-1\nfaces: 2\n---\n21* 21\n .   .\n', 'a-2'), 'a-1');
    expect(back.split('\n')[0]).toBe('id: a-1');
    expect(readBoardHead(back).was).toEqual(['a-2']);
  });
});

describe('the row asked of the server', () => {
  it('reads the addresses of the row and of a swap', () => {
    expect(askOf('GET', '/?row')).toEqual({ kind: 'row-read' });
    expect(askOf('GET', '?row')).toEqual({ kind: 'row-read' });
    expect(askOf('POST', '/?row')).toEqual({ kind: 'row' });
    expect(askOf('PUT', '/?row')).toMatchObject({ kind: 'refused', status: 405 });
    expect(askOf('POST', '/R05/swap')).toEqual({ kind: 'swap', name: 'R05' });
    expect(askOf('GET', '/R05/swap')).toMatchObject({ kind: 'refused', status: 405 });
  });
  const place = { role: 'apply', archetype: 'bridge', teaches: 'walk', event: 'first', note: 'для людей', help: { hint: 'roadHintWalk', sign: 'N', plaques: 'near', wait: 'free', camera: 'hold' } };
  it('takes each of the four operations', () => {
    const insert = { op: 'insert', board: 'P30', chapter: 1, after: 'P02', place };
    expect(rowOpOf(JSON.stringify(insert))).toEqual(insert);
    expect(rowOpOf(JSON.stringify({ ...insert, after: null, place: { role: 'meet', archetype: 'x' } }))).toEqual({ ...insert, after: null, place: { role: 'meet', archetype: 'x' } });
    expect(rowOpOf('{"op":"move","board":"R05","way":"up"}')).toEqual({ op: 'move', board: 'R05', way: 'up' });
    expect(rowOpOf('{"op":"remove","board":"R05","status":"X"}')).toEqual({ op: 'remove', board: 'R05', status: 'X' });
    expect(rowOpOf(JSON.stringify({ op: 'edit', board: 'R05', place }))).toEqual({ op: 'edit', board: 'R05', place });
  });
  it('refuses an operation it does not know, and a word or a key that is none of the row', () => {
    const insert = { op: 'insert', board: 'P30', chapter: 1, after: null, place };
    for (const body of [
      { op: 'swap', board: 'R05' },
      { op: 'move', board: 'R05.txt', way: 'up' },
      { op: 'move', board: '../x', way: 'up' },
      { op: 'move', board: 'R05', way: 'left' },
      { op: 'remove', board: 'R05', status: 'R' },
      { op: 'remove', board: 'R05', status: 'D' },
      { ...insert, place: { ...place, role: 'boss' } },
      { ...insert, place: { ...place, teaches: 'fly' } },
      { ...insert, place: { ...place, help: { sign: 'NE' } } },
      { ...insert, place: { ...place, help: { plaques: 'some' } } },
      { ...insert, place: { ...place, help: { color: 'red' } } },
      { ...insert, place: { ...place, board: 'R06' } },
      { ...insert, place: { ...place, extra: 1 } },
      { ...insert, place: { role: 'apply' } },
      { ...insert, place: { ...place, archetype: '' } },
      { ...insert, place: { ...place, note: 3 } },
      { ...insert, place: { ...place, help: 'near' } },
      { ...insert, place: { ...place, help: null } },
      { ...insert, place: { ...place, help: ['near'] } },
      { ...insert, place: { ...place, teaches: null } },
      { op: 'insert', board: 'P30', chapter: 1, place },
      { ...insert, chapter: '1' },
      { ...insert, chapter: -1 },
      { ...insert, chapter: 1.5 },
      { ...insert, after: 'a/b' },
      { ...insert, more: true },
      { op: 'move', board: 'R05', way: 'up', status: 'X' },
    ]) {
      expect(rowOpOf(JSON.stringify(body)), JSON.stringify(body)).toBeNull();
    }
    expect(rowOpOf('torn')).toBeNull();
    expect(rowOpOf('null')).toBeNull();
  });
  it('reads the copy a swap is asked with', () => {
    expect(swapOf('{"from":"R05-try-1"}')).toBe('R05-try-1');
    expect(swapOf('{"from":"../x"}')).toBeNull();
    expect(swapOf('{"from":3}')).toBeNull();
    expect(swapOf('torn')).toBeNull();
  });
});
