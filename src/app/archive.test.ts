import { describe, expect, it } from 'vitest';
import { ARCHIVE_LINES, dailyArchive, endlessArchive } from './archive';
import { ARCHIVE_ENDLESS, ARCHIVE_TIMED } from './archiveData';
import { dayAt } from './daily';
import { standings, placeOf } from './standings';

const DAY_MS = 86_400_000;
const day = (date: string) => dayAt(Date.parse(`${date}T12:00:00Z`));
/** A date of the program as days since 1970: `H13.03.21` is 21 March 2001. */
const eraDay = (text: string): number => {
  const [, year, month, date] = /^H(\d\d)\.(\d\d)\.(\d\d)$/.exec(text)!.map(Number);
  return Date.UTC(1988 + year, month - 1, date) / DAY_MS;
};

for (const [name, lines] of [
  ['without a limit', endlessArchive()],
  ['of a day', dailyArchive(day('2026-10-04'))],
] as const) {
  describe(`the archive of the sessions ${name}`, () => {
    it('has about fifty lines, best first, each with a score that can be made', () => {
      expect(lines).toHaveLength(ARCHIVE_LINES);
      for (let i = 1; i < lines.length; i++) expect(lines[i].score).toBeLessThanOrEqual(lines[i - 1].score);
      for (const line of lines) expect(line.score).toBeGreaterThan(0);
    });

    it('has the records of the six at its top, each of them once', () => {
      const subjects = lines.filter((line) => line.subject);
      expect(subjects.map((line) => line.name).sort()).toEqual(['被験者 01', '被験者 02', '被験者 03', '被験者 04', '被験者 05', '被験者 06']);
      expect(lines.slice(0, 6).every((line) => line.subject)).toBe(true);
      expect(lines[0].name).toBe('被験者 06');
    });

    it('dates every other session by the era, on a working day, and never after the last start the program remembers', () => {
      for (const line of lines.filter((candidate) => !candidate.subject)) {
        expect(line.name).toMatch(/^H1[0-3]\.\d\d\.\d\d$/);
        const at = eraDay(line.name);
        expect(at).toBeGreaterThanOrEqual(Date.UTC(1998, 3, 1) / DAY_MS - 2);
        expect(at).toBeLessThanOrEqual(Date.UTC(2001, 2, 21) / DAY_MS);
        expect([1, 2, 3, 4, 5]).toContain(new Date(at * DAY_MS).getUTCDay());
      }
    });

    it('has room for players of every strength: a few lines under a hundred points, a few over ten thousand', () => {
      expect(lines.filter((line) => line.score < 300).length).toBeGreaterThanOrEqual(5);
      expect(lines.filter((line) => line.score > 10000).length).toBeGreaterThanOrEqual(5);
    });
  });
}

describe('the archive', () => {
  it('is made of sessions the player made of the rules has played', () => {
    expect(ARCHIVE_ENDLESS.length).toBeGreaterThanOrEqual(ARCHIVE_LINES);
    expect(ARCHIVE_TIMED.length).toBeGreaterThanOrEqual(ARCHIVE_LINES * 4);
    for (const line of endlessArchive()) expect(ARCHIVE_ENDLESS).toContain(line.score);
    for (const line of dailyArchive(day('2026-10-04'))) expect(ARCHIVE_TIMED).toContain(line.score);
  });

  it('has the sixth about three times over everyone else in the sessions without a limit', () => {
    const [sixth, next] = endlessArchive();
    expect(sixth.score / next.score).toBeGreaterThan(2.5);
    expect(sixth.score / next.score).toBeLessThan(4);
  });

  it('is the same every time for the sessions without a limit, and for one day', () => {
    expect(endlessArchive()).toEqual(endlessArchive());
    expect(dailyArchive(day('2026-10-04'))).toEqual(dailyArchive(dayAt(Date.parse('2026-10-04T23:59:00Z'))));
  });

  it('starts anew with the day, as the table of the day does', () => {
    const one = dailyArchive(day('2026-10-04')).map((line) => `${line.name} ${line.score}`);
    const next = dailyArchive(day('2026-10-05')).map((line) => `${line.name} ${line.score}`);
    expect(next).not.toEqual(one);
    expect(next.filter((line) => one.includes(line)).length).toBeLessThan(ARCHIVE_LINES / 2);
  });
});

describe('the log of a kind of session', () => {
  const archive = [
    { name: '被験者 03', score: 900, subject: true },
    { name: 'H12.11.02', score: 300, subject: false },
    { name: 'H11.02.08', score: 100, subject: false },
  ];
  const me = { name: '被験者 07', score: 0 };

  it('is the archive alone before the player has a score', () => {
    const log = standings(archive, [], me);
    expect(log.map((line) => line.rank)).toEqual([1, 2, 3]);
    expect(log.some((line) => line.own)).toBe(false);
  });

  it('puts the one who plays among the lines by score, under the number the program has for them', () => {
    const log = standings(archive, [], { ...me, score: 300 });
    expect(log.map((line) => `${line.rank} ${line.name}`)).toEqual(['1 被験者 03', '2 H12.11.02', '3 被験者 07', '4 H11.02.08']);
    expect(log[2]).toMatchObject({ own: true, subject: false, score: 300 });
  });

  it('puts the players of the platform among them, and knows the one who plays by the name the platform has', () => {
    const players = [
      { name: 'Ada', score: 500, own: false },
      { name: 'Green Chicken', score: 200, own: true },
      { name: 'Nobody', score: 0, own: false },
    ];
    const log = standings(archive, players, { ...me, score: 150 });
    expect(log.map((line) => line.name)).toEqual(['被験者 03', 'Ada', 'H12.11.02', 'Green Chicken', 'H11.02.08']);
    expect(log[3]).toMatchObject({ own: true, score: 200 });
  });

  it('takes the more of what the platform and the device have for the one who plays', () => {
    const players = [{ name: 'Green Chicken', score: 200, own: true }];
    expect(standings(archive, players, { ...me, score: 950 })[0]).toMatchObject({ name: 'Green Chicken', own: true, score: 950, rank: 1 });
  });

  it('gives a score its place under every line that has as much', () => {
    expect(placeOf(archive, 1000)).toBe(1);
    expect(placeOf(archive, 300)).toBe(3);
    expect(placeOf(archive, 1)).toBe(4);
  });
});
