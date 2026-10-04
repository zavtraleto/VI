import { describe, expect, it } from 'vitest';
import { Climb, passTimes, type ClimbLine } from './climb';
import type { ShellSound } from './screen';

const line = (name: string, score: number, kind: 'own' | 'subject' | null = null): ClimbLine => ({ name, score, own: kind === 'own', subject: kind === 'subject' });
/** A log of `count` lines, best first: 100 points apart, the last one has 100. */
const log = (count: number): ClimbLine[] => Array.from({ length: count }, (_, i) => line(`n${i + 1}`, (count - i) * 100));

describe('the moments a session goes past the lines of the log', () => {
  const gaps = (times: number[]): number[] => times.map((at, i) => at - (i > 0 ? times[i - 1] : 0));

  it('are none for a session that goes past nothing', () => {
    expect(passTimes(0)).toEqual([]);
  });

  it('come one after another, never two at once', () => {
    for (const count of [1, 2, 7, 60, 400]) {
      const times = passTimes(count);
      expect(times).toHaveLength(count);
      for (const gap of gaps(times)) expect(gap).toBeGreaterThan(0);
    }
  });

  it('set off slowly, run fast in the middle, and slow down to the place: the last gap is the longest', () => {
    const all = gaps(passTimes(60));
    const middle = all[30];
    expect(all[0]).toBeGreaterThan(middle * 5);
    expect(all[1]).toBeLessThan(all[0]);
    expect(all[59]).toBeGreaterThan(all[0]);
    expect(all[59]).toBeGreaterThan(all[58]);
    expect(all[58]).toBeGreaterThan(all[57]);
    expect(Math.max(...all)).toBe(all[59]);
  });

  it('give a short way its time: a few lines are gone past one by one', () => {
    const all = gaps(passTimes(3));
    for (const gap of all) expect(gap).toBeGreaterThan(200);
    expect(passTimes(3)[2]).toBeLessThan(1500);
  });

  it('never take longer than a few seconds, however long the log', () => {
    expect(passTimes(60).at(-1)).toBeLessThan(5000);
    expect(passTimes(400).at(-1)).toBeLessThan(6500);
    expect(passTimes(5000).at(-1)).toBeLessThan(6500);
  });
});

describe('a session going up the log', () => {
  /** Runs the way from its first frame to past its end, a frame every 16 ms. Returns what was heard. */
  function run(climb: Climb, heard: ShellSound[] = []): ShellSound[] {
    for (let time = 0; time < 12000 && !(climb.done && !climb.lit); time += 16) climb.update(time);
    return heard;
  }

  it('takes the place under every line that has as much or more', () => {
    const climb = new Climb({ lines: log(10), score: 550, name: 'me', record: true });
    expect(climb.gained).toBe(5);
    expect(climb.place).toBe(6);
    expect(climb.total).toBe(11);
    // A line with the same score was there first.
    expect(new Climb({ lines: log(10), score: 500, name: 'me', record: true }).place).toBe(7);
    expect(new Climb({ lines: [], score: 5, name: 'me', record: true }).place).toBe(1);
  });

  it('starts under the last line with nothing, and ends at its place with its score', () => {
    const climb = new Climb({ lines: log(10), score: 550, name: 'me', record: true });
    climb.update(0);
    expect(climb.shownPlace()).toBe(11);
    expect(climb.shownScore()).toBe(0);
    expect(climb.done).toBe(false);
    run(climb);
    expect(climb.done).toBe(true);
    expect(climb.shownPlace()).toBe(6);
    expect(climb.shownScore()).toBe(550);
  });

  it('never shows a score under that of a line it has gone past, nor a place it has not reached', () => {
    const lines = log(30);
    const climb = new Climb({ lines, score: 2950, name: 'me', record: true });
    let place = climb.shownPlace();
    let score = 0;
    for (let time = 0; time < 12000 && !climb.done; time += 16) {
      climb.update(time);
      expect(climb.shownPlace()).toBeLessThanOrEqual(place);
      expect(climb.shownScore()).toBeGreaterThanOrEqual(score);
      place = climb.shownPlace();
      score = climb.shownScore();
      // Every line under the session has less than the session shows.
      for (const below of lines.slice(place - 1)) expect(below.score).toBeLessThanOrEqual(score);
    }
    expect(climb.done).toBe(true);
  });

  it('waits for the end of the session to be heard out before it sets off', () => {
    const heard: ShellSound[] = [];
    const climb = new Climb({ lines: log(10), score: 550, name: 'me', record: true, leadMs: 1000 }, (event) => heard.push(event));
    climb.update(5000);
    climb.update(5900);
    expect(climb.shownScore()).toBe(0);
    expect(heard).toEqual([]);
    climb.update(6400);
    expect(climb.shownScore()).toBeGreaterThan(0);
  });

  it('is heard: a click for a line, a note for one of the six and for the best there was, and the place', () => {
    const lines = [line('top', 900), line('six', 700, 'subject'), line('mine', 500, 'own'), line('a', 300), line('b', 100)];
    const heard: ShellSound[] = [];
    const climb = new Climb({ lines, score: 800, name: 'me', record: true }, (event) => heard.push(event));
    run(climb);
    expect(heard.map((event) => event.kind)).toEqual(['climb', 'climb', 'past', 'past', 'placed']);
    expect(heard[2]).toMatchObject({ who: 'own' });
    expect(heard[3]).toMatchObject({ who: 'subject' });
    expect(heard[4]).toMatchObject({ record: true, moved: true });
    // The clicks rise with the place: each is further along the log than the one before.
    const along = heard.flatMap((event) => (event.kind === 'climb' || event.kind === 'past' ? [event.along] : []));
    expect(along).toEqual([...along].sort((a, b) => a - b));
    expect(along.at(-1)).toBeCloseTo(4 / 5);
  });

  it('says so when it goes past nothing', () => {
    const heard: ShellSound[] = [];
    const climb = new Climb({ lines: log(5), score: 50, name: 'me', record: false }, (event) => heard.push(event));
    run(climb);
    expect(heard).toEqual([{ kind: 'placed', along: 0, record: false, moved: false }]);
    expect(climb.shownPlace()).toBe(6);
    expect(climb.shownScore()).toBe(50);
  });

  it('shows the log around itself: the lines ahead over it, the lines gone past under it', () => {
    const climb = new Climb({ lines: log(10), score: 550, name: 'me', record: false });
    climb.update(0);
    // Under the last line: nothing below, the last lines of the log above.
    expect(climb.rows(5).map((row) => row?.name ?? null)).toEqual(['n9', 'n10', 'me', null, null]);
    climb.finish();
    const rows = climb.rows(5);
    expect(rows.map((row) => row?.name)).toEqual(['n4', 'n5', 'me', 'n6', 'n7']);
    expect(rows.map((row) => row?.place)).toEqual([4, 5, 6, 7, 8]);
    expect(rows.map((row) => row?.tone)).toEqual(['dim', 'dim', 'run', 'dim', 'dim']);
    expect(rows[2]?.score).toBe(550);
  });

  it('lights the line it has just gone past, for a moment', () => {
    const climb = new Climb({ lines: log(10), score: 550, name: 'me', record: false });
    const first = passTimes(5)[0];
    climb.update(0);
    climb.update(first + 5);
    expect(climb.rows(5)[3]).toMatchObject({ name: 'n10', tone: 'lit' });
    climb.update(first + 200);
    expect(climb.rows(5)[3]).toMatchObject({ name: 'n10', tone: 'dim' });
  });

  it('takes the place of the line the player had when it is a record: the log does not grow', () => {
    const lines = [line('a', 900), line('mine', 400, 'own'), line('b', 100)];
    const record = new Climb({ lines, score: 500, name: 'me', record: true });
    // On the way the session is a line more: its place is never past the last line of the log.
    expect(record.total).toBe(4);
    record.update(0);
    expect(record.shownPlace()).toBe(4);
    // On the way the old line is still there, written as the player's own.
    expect(record.rows(5)[0]).toMatchObject({ name: 'mine', tone: 'own' });
    record.finish();
    expect(record.total).toBe(3);
    expect(record.rows(5).map((row) => row?.name ?? null)).toEqual([null, 'a', 'me', 'b', null]);
    expect(record.rows(5).map((row) => row?.place ?? null)).toEqual([null, 1, 2, 3, null]);

    // Under the best there was, the best stays in the log above the session.
    const under = new Climb({ lines, score: 300, name: 'me', record: false });
    expect(under.total).toBe(4);
    under.finish();
    expect(under.rows(5).map((row) => row?.name ?? null)).toEqual(['a', 'mine', 'me', 'b', null]);
    expect(under.rows(5).map((row) => row?.place ?? null)).toEqual([1, 2, 3, 4, null]);
  });

  it('takes its place at once where nothing may move, once the end of the session has been heard out', () => {
    const heard: ShellSound[] = [];
    const climb = new Climb({ lines: log(10), score: 550, name: 'me', record: true, reduced: true, leadMs: 500 }, (event) => heard.push(event));
    climb.update(100);
    expect(climb.done).toBe(false);
    climb.update(700);
    expect(climb.done).toBe(true);
    expect(climb.shownPlace()).toBe(6);
    expect(heard.map((event) => event.kind)).toEqual(['placed']);
  });

  it('asks to be drawn only when what it shows has changed', () => {
    const climb = new Climb({ lines: log(10), score: 550, name: 'me', record: true });
    expect(climb.update(0)).toBe(true);
    expect(climb.update(0)).toBe(false);
    run(climb);
    expect(climb.lit).toBe(false);
    expect(climb.update(20000)).toBe(false);
  });
});
