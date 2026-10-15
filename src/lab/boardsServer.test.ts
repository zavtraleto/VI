import { describe, expect, it } from 'vitest';
import { printBoard, readBoardHead } from '../levels/boardFile';
import { fileBoard } from '../levels/boardFiles';
import { askOf, boardHash, exportFile, headPatchOf, historyPath, patchHead, safeName, versionOf } from './boardsServer';

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
