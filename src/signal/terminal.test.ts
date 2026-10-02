import { describe, expect, it } from 'vitest';
import KANJI from '../shell/fonts/kanji.txt?raw';
import { seededRandom } from './scene';
import { terminalLines } from './terminal';

const TIME = { h: 9, m: 5, s: 7 };

describe('terminalLines', () => {
  it('logs the readings of the moment: the link, the noise and the open channel', () => {
    const lines = terminalLines(seededRandom(2), { contact: 3 / 7, noise: 0.62, channel: 3 }, TIME, false);
    expect(lines[0]).toBe('09:05:07 \u63a5\u7d9a 3/7');
    expect(lines[1]).toBe('09:05:07 NOISE 62%');
    expect(lines[2]).toMatch(/^09:05:07 CH3 /);
    // The same readings again as bytes: the seventh, the link, the noise, the channel.
    expect(lines[3]).toMatch(/^0[0-9A-F]{3}  07 03 3E 03 [0-9A-F]{2} [0-9A-F]{2}$/);
  });

  it('names no channel before the first group is sent', () => {
    const lines = terminalLines(seededRandom(2), { contact: 0, noise: 0, channel: 0 }, TIME, false);
    expect(lines.some((line) => / CH\d /.test(line))).toBe(false);
  });

  it('notes a pattern only when a chain set it off', () => {
    const reading = { contact: 0.5, noise: 0.3, channel: 5 };
    expect(terminalLines(seededRandom(4), reading, TIME, true).some((line) => line.endsWith('PATTERN DETECTED'))).toBe(true);
    for (let seed = 1; seed < 30; seed++) {
      expect(terminalLines(seededRandom(seed), reading, TIME, false).some((line) => line.includes('PATTERN'))).toBe(false);
    }
  });

  it('is a short burst, the same from the same chance, and keeps readings inside their range', () => {
    const wild = { contact: 9, noise: -2, channel: 6 };
    for (let seed = 1; seed < 40; seed++) {
      const lines = terminalLines(seededRandom(seed), wild, TIME, seed % 2 === 0);
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines.length).toBeLessThanOrEqual(7);
      expect(lines[0]).toContain('7/7');
      expect(lines[1]).toContain('NOISE 0%');
      expect(terminalLines(seededRandom(seed), wild, TIME, seed % 2 === 0)).toEqual(lines);
    }
  });

  it('writes only signs the font of the program has', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 200; seed++) {
      for (const line of terminalLines(seededRandom(seed), { contact: 0.4, noise: 0.5, channel: 2 }, TIME, seed % 3 === 0)) {
        for (const sign of line) if (sign >= '\u3400' && sign <= '\u9fff') seen.add(sign);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const sign of seen) expect(KANJI.includes(sign), sign).toBe(true);
  });
});
