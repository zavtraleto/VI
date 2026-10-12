import { describe, expect, it } from 'vitest';
import { printBoard } from '../levels/boardFile';
import { ROAD } from '../levels/road';
import { askOf, boardHash, historyPath, safeName, versionOf } from './boardsServer';

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
    const text = printBoard(ROAD[2]);
    expect(boardHash(text)).toMatch(/^[0-9a-f]{8}$/);
    expect(boardHash(printBoard(ROAD[2], { note: 'another word', status: 'good' }))).toBe(boardHash(text));
    expect(boardHash(printBoard(ROAD[3]))).not.toBe(boardHash(text));
    expect(boardHash('no board at all')).toBeNull();
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
  it('refuses a method an address does not take, and an address there is none of', () => {
    expect(askOf('DELETE', '/H01')).toMatchObject({ kind: 'refused', status: 405 });
    expect(askOf('PUT', '/')).toMatchObject({ kind: 'refused', status: 405 });
    expect(askOf('GET', '/H01/other')).toMatchObject({ kind: 'refused', status: 404 });
  });
});
