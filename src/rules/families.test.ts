import { describe, expect, it } from 'vitest';

/**
 * The bots are two families that do not know of each other. Those of the levels think in moves
 * on a board that waits; those of the session without a limit walk step by step against a
 * clock. A player of one kind brought in to measure the other measures the wrong thing, so the
 * files of one family name no file of the other. `goalBot.ts`, the player of the clock on levels
 * with a goal, is of the second family and reads the levels it plays.
 */
const SOURCES = import.meta.glob<string>('./*.ts', { query: '?raw', import: 'default', eager: true });

const importsOf = (file: string): string[] => {
  const text = SOURCES[`./${file}.ts`];
  if (text === undefined) throw new Error(`no file ${file}.ts`);
  return [...text.matchAll(/from '\.\/([A-Za-z]+)'/g)].map((match) => match[1]);
};

const OF_LEVELS = ['levelBot', 'levelScore', 'levelGraph', 'levelProof', 'levelReport', 'levelSolver', 'reach'];
const OF_THE_CLOCK = ['bot', 'paceBot'];

describe('the two families of bots', () => {
  it('name no file of the other: the players of the levels know nothing of the player of the clock', () => {
    for (const file of OF_LEVELS) {
      const named = importsOf(file);
      expect(named.length, `${file}.ts`).toBeGreaterThan(0);
      for (const other of [...OF_THE_CLOCK, 'goalBot']) expect(named, `${file}.ts`).not.toContain(other);
    }
  });

  it('name no file of the other: the player of the clock knows nothing of the players of the levels', () => {
    for (const file of OF_THE_CLOCK) {
      const named = importsOf(file);
      expect(named.length, `${file}.ts`).toBeGreaterThan(0);
      for (const other of [...OF_LEVELS.filter((name) => name !== 'reach'), 'goalBot', 'level']) expect(named, `${file}.ts`).not.toContain(other);
    }
  });
});
