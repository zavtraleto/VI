import { describe, expect, it } from 'vitest';
import { endlessArchive } from './archive';
import { ARCHIVE_ENDLESS } from './archiveData';
import { standings, placeOf } from './standings';

const DAY_MS = 86_400_000;
const at = (moment: string): number => Date.parse(`${moment}Z`);
const START = at('2026-10-04T00:00:00');
const names = (lines: readonly { name: string }[]): string[] => lines.map((line) => line.name);

describe('the sessions the made-up players have played', () => {
  it('are a few hundred, a session for each player', () => {
    expect(ARCHIVE_ENDLESS.length).toBeGreaterThanOrEqual(200);
  });

  it('are of every strength: many under a thousand points, some over a hundred thousand', () => {
    expect(ARCHIVE_ENDLESS.filter((score) => score < 1000).length).toBeGreaterThan(60);
    expect(ARCHIVE_ENDLESS.filter((score) => score > 100_000).length).toBeGreaterThan(5);
  });
});

describe('the made-up players of the log of the sessions without a limit', () => {
  const first = endlessArchive(START);

  it('are fifty when the log starts, best first, each with a score that was really made', () => {
    expect(first).toHaveLength(50);
    for (let i = 1; i < first.length; i++) expect(first[i].score).toBeLessThanOrEqual(first[i - 1].score);
    for (const line of first) expect(ARCHIVE_ENDLESS).toContain(line.score);
    // A clock that is behind the start of the log shows the log as it started.
    expect(endlessArchive(START - 30 * DAY_MS)).toEqual(first);
    expect(endlessArchive(Number.NaN)).toEqual(first);
  });

  it('are of every strength from the start: weak ones for a beginner to go past, strong ones to look up to', () => {
    expect(first.filter((line) => line.score < 300).length).toBeGreaterThanOrEqual(8);
    expect(first.filter((line) => line.score > 30_000).length).toBeGreaterThanOrEqual(5);
  });

  it('are called as players of the platform are: a colour and an animal for most, a name of their own for the rest', () => {
    const all = endlessArchive(START + 400 * DAY_MS);
    const guests = all.filter((line) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line.name));
    expect(guests.length / all.length).toBeGreaterThan(0.6);
    expect(guests.length / all.length).toBeLessThan(0.9);
    expect(new Set(names(all)).size).toBe(all.length);
    for (const line of all) {
      expect(line.name.trim()).toBe(line.name);
      expect(line.name.length).toBeGreaterThan(1);
      // No name is cut by the table.
      expect(line.name.length).toBeLessThanOrEqual(16);
      // Nothing of the program's own way of writing is in them.
      expect(line.name).not.toMatch(/被験者|^H\d\d\.|^Guest /);
    }
  });

  it('take one more in every half a day, and none of those who are there leaves or changes', () => {
    const later = endlessArchive(START + 10 * DAY_MS);
    expect(later).toHaveLength(70);
    expect(endlessArchive(START + 10.4 * DAY_MS)).toHaveLength(70);
    expect(endlessArchive(START + 10.5 * DAY_MS)).toHaveLength(71);
    const kept = new Map(later.map((line) => [line.name, line.score]));
    for (const line of first) expect(kept.get(line.name)).toBe(line.score);
  });

  it('stop growing when every player is in', () => {
    const all = endlessArchive(START + 1000 * DAY_MS);
    expect(all.length).toBe(ARCHIVE_ENDLESS.filter((score) => score > 0).length);
    expect(endlessArchive(START + 2000 * DAY_MS)).toEqual(all);
  });
});

describe('the log of a kind of session', () => {
  const archive = [
    { name: 'Teal Otter', score: 900 },
    { name: 'nika', score: 300 },
    { name: 'Gold Heron', score: 100 },
  ];
  const me = { name: 'YOU', score: 0 };

  it('is the made-up players alone before the player has a score', () => {
    const log = standings(archive, [], me);
    expect(log.map((line) => line.rank)).toEqual([1, 2, 3]);
    expect(log.some((line) => line.own)).toBe(false);
  });

  it('puts the one who plays among the lines by score', () => {
    const log = standings(archive, [], { ...me, score: 300 });
    expect(log.map((line) => `${line.rank} ${line.name}`)).toEqual(['1 Teal Otter', '2 nika', '3 YOU', '4 Gold Heron']);
    expect(log[2]).toMatchObject({ own: true, score: 300 });
  });

  it('puts the players of the platform among them, and knows the one who plays by the name the platform has', () => {
    const players = [
      { name: 'Ada', score: 500, own: false },
      { name: 'Green Chicken', score: 200, own: true },
      { name: 'Nobody', score: 0, own: false },
    ];
    const log = standings(archive, players, { ...me, score: 150 });
    expect(log.map((line) => line.name)).toEqual(['Teal Otter', 'Ada', 'nika', 'Green Chicken', 'Gold Heron']);
    expect(log[3]).toMatchObject({ own: true, score: 200 });
  });

  it('takes the more of what the platform and the device have for the one who plays', () => {
    const players = [{ name: 'Green Chicken', score: 200, own: true }];
    expect(standings(archive, players, { ...me, score: 950 })[0]).toMatchObject({ name: 'Green Chicken', own: true, score: 950, rank: 1 });
  });

  it('has no two of a name: a made-up player called as a real one is left out', () => {
    const players = [
      { name: 'teal otter ', score: 40, own: false },
      { name: 'Nika', score: 700, own: true },
    ];
    const log = standings(archive, players, me);
    expect(log.map((line) => line.name)).toEqual(['Nika', 'Gold Heron', 'teal otter ']);
  });

  it('gives a score its place under every line that has as much', () => {
    expect(placeOf(archive, 1000)).toBe(1);
    expect(placeOf(archive, 300)).toBe(3);
    expect(placeOf(archive, 1)).toBe(4);
  });
});
