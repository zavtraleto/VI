import { describe, expect, it } from 'vitest';
import { COUNTING_LINE, LINES, LinePool } from './lines';
import { seededRandom } from './scene';

describe('the lines', () => {
  it('are all different and each says where it comes from', () => {
    const texts = LINES.map((line) => line.text);
    expect(new Set(texts).size).toBe(texts.length);
    for (const line of LINES) {
      expect(line.text.trim().length).toBeGreaterThan(0);
      expect(line.source).toMatch(/^(art 4\.7|journal 2\.\d+|draft)$/);
    }
    expect(texts).toContain(COUNTING_LINE);
    expect(LINES.length).toBeGreaterThanOrEqual(24);
  });

  it('are short: a line of the other side is a few words', () => {
    for (const line of LINES) {
      expect(line.text.replace(/\s*\|\s*/g, ' ').split(/\s+/).length, line.text).toBeLessThanOrEqual(8);
      for (const row of line.text.split('|')) expect(row.trim().length, line.text).toBeLessThanOrEqual(24);
    }
  });
});

describe('LinePool', () => {
  it('says every line once in a session and then has nothing left', () => {
    const pool = new LinePool(seededRandom(3));
    const said: string[] = [];
    for (let line = pool.next(); line !== null; line = pool.next()) said.push(line);
    expect(said.length).toBe(LINES.length);
    expect(new Set(said).size).toBe(LINES.length);
    expect(pool.next()).toBeNull();
  });

  it('can say them all again in the next session, in another order', () => {
    const pool = new LinePool(seededRandom(3));
    const first = [pool.next(), pool.next(), pool.next()];
    while (pool.next() !== null);
    pool.reset();
    const again: (string | null)[] = [];
    for (let line = pool.next(); line !== null; line = pool.next()) again.push(line);
    expect(again.length).toBe(LINES.length);
    expect(again.slice(0, 3)).not.toEqual(first);
  });

  it('takes a chance of exactly 1 without leaving the list', () => {
    const pool = new LinePool(() => 0.999999, ['a', 'b', 'c']);
    expect([pool.next(), pool.next(), pool.next(), pool.next()]).toEqual(['c', 'b', 'a', null]);
  });
});
