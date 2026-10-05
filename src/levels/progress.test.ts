import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import { chaptersOf, gateOf, ladderProgress, levelStars, limitedLevel, moveLimit, starsHeld } from './progress';

describe('the stars of a level', () => {
  it('gives three within a move of the fewest, two within three moves more, one for any other pass', () => {
    expect(levelStars(4, 4)).toBe(3);
    expect(levelStars(5, 4)).toBe(3);
    expect(levelStars(6, 4)).toBe(2);
    expect(levelStars(8, 4)).toBe(2);
    expect(levelStars(9, 4)).toBe(1);
    expect(levelStars(40, 4)).toBe(1);
  });

  it('gives one for a pass of a level whose fewest moves are not known', () => {
    expect(levelStars(12, undefined)).toBe(1);
  });

  it('holds none on a level that has not been passed', () => {
    expect(starsHeld(null, 4)).toBe(0);
    expect(starsHeld(undefined, 4)).toBe(0);
    expect(starsHeld(5, 4)).toBe(3);
    expect(starsHeld(9, 4)).toBe(1);
  });
});

describe('the chapters of the ladder', () => {
  it('are the levels that follow one another with the same faces at work', () => {
    const faces = (...values: number[]) => ({ faces: values });
    expect(chaptersOf([faces(3), faces(3), faces(2, 3), faces(5), faces(5), faces(5)])).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 6 },
    ]);
    expect(chaptersOf([])).toEqual([]);
  });

  it('are three on the ladder as it stands: 3s; 2s and 3s; 5s', () => {
    expect(chaptersOf(LEVELS)).toEqual([
      { from: 0, to: 8 },
      { from: 8, to: 16 },
      { from: 16, to: 23 },
    ]);
  });
});

describe('the limit of moves of a level', () => {
  it('is generous and grows with the fewest moves: five times them and ten in the first chapter', () => {
    expect(moveLimit(1, 0)).toBe(15);
    expect(moveLimit(4, 0)).toBe(30);
    expect(moveLimit(8, 0)).toBe(50);
  });

  it('tightens chapter by chapter, and no further than three times and ten', () => {
    expect(moveLimit(4, 1)).toBe(26);
    expect(moveLimit(4, 2)).toBe(22);
    expect(moveLimit(4, 7)).toBe(22);
  });

  it('is none for a level whose fewest moves are not known', () => {
    expect(moveLimit(undefined, 0)).toBe(0);
  });

  it('is laid on a level of the ladder as it is started, and leaves the level as it is kept', () => {
    const limited = limitedLevel(LEVELS, 9);
    expect(limited.moves).toBe(moveLimit(LEVELS[9].par, 1));
    expect(limited).toEqual({ ...LEVELS[9], moves: limited.moves });
    expect(LEVELS[9].moves).toBe(0);
  });

  it('never cuts short the way a level keeps', () => {
    LEVELS.forEach((level, index) => expect(limitedLevel(LEVELS, index).moves, level.id).toBeGreaterThanOrEqual(level.par! + 10));
  });
});

describe('the gates of the chapters', () => {
  const chapters = chaptersOf(LEVELS);

  it('ask for two fifths of the stars of the levels before a chapter, and nothing before the first', () => {
    expect(chapters.map(gateOf)).toEqual([0, 10, 20]);
  });

  /** A ladder passed so far, every level in so many moves over its fewest. */
  const passedTo = (count: number, over: number) => (id: string) => {
    const index = LEVELS.findIndex((level) => level.id === id);
    return index < count ? LEVELS[index].par! + over : null;
  };

  it('counts the stars held and opens a chapter once its gate is met', () => {
    const fresh = ladderProgress(LEVELS, () => null);
    expect(fresh.total).toBe(0);
    expect(fresh.stars).toHaveLength(LEVELS.length);
    expect(fresh.chapters.map((chapter) => chapter.open)).toEqual([true, false, false]);
    expect(fresh.locked.slice(0, 8).every((locked) => !locked)).toBe(true);
    expect(fresh.locked.slice(8).every((locked) => locked)).toBe(true);

    // The first chapter passed with a star a level is two short of the second.
    const plain = ladderProgress(LEVELS, passedTo(8, 9));
    expect(plain.total).toBe(8);
    expect(plain.chapters[1]).toMatchObject({ gate: 10, open: false });

    // Three levels a move over the fewest and one more passed open it.
    const clean = ladderProgress(LEVELS, passedTo(3, 1));
    expect(clean.total).toBe(9);
    const more = ladderProgress(LEVELS, (id) => (id === 'B04' ? 30 : passedTo(3, 1)(id)));
    expect(more.total).toBe(10);
    expect(more.chapters.map((chapter) => chapter.open)).toEqual([true, true, false]);
    expect(more.locked[8]).toBe(false);
    expect(more.locked[16]).toBe(true);
  });

  it('opens every chapter when the gates are switched off', () => {
    const open = ladderProgress(LEVELS, () => null, false);
    expect(open.chapters.every((chapter) => chapter.open)).toBe(true);
    expect(open.locked.some((locked) => locked)).toBe(false);
  });

  it('says of a level which chapter it is in', () => {
    const progress = ladderProgress(LEVELS, () => null);
    expect(progress.chapterOf(0)).toBe(0);
    expect(progress.chapterOf(8)).toBe(1);
    expect(progress.chapterOf(22)).toBe(2);
  });
});
