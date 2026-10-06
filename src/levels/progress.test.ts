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
  it('are the levels that follow one another and name one chapter', () => {
    const of = (chapter: number) => ({ chapter });
    expect(chaptersOf([of(0), of(0), of(1), of(4), of(4), of(4)])).toEqual([
      { chapter: 0, from: 0, to: 2 },
      { chapter: 1, from: 2, to: 3 },
      { chapter: 4, from: 3, to: 6 },
    ]);
    expect(chaptersOf([{}, {}])).toEqual([{ chapter: 0, from: 0, to: 2 }]);
    expect(chaptersOf([])).toEqual([]);
  });

  it('are five on the ladder as it stands: the course, the faces of a die, then 3s; 2s and 3s; 5s', () => {
    expect(chaptersOf(LEVELS)).toEqual([
      { chapter: 0, from: 0, to: 9 },
      { chapter: 1, from: 9, to: 18 },
      { chapter: 5, from: 18, to: 24 },
      { chapter: 6, from: 24, to: 29 },
      { chapter: 7, from: 29, to: 32 },
    ]);
  });
});

describe('the limit of moves of a level', () => {
  it('is generous and grows with the fewest moves: five times them and ten in the course and the chapters that teach', () => {
    for (const chapter of [0, 1, 2, 3, 4, 5]) {
      expect(moveLimit(1, chapter)).toBe(15);
      expect(moveLimit(4, chapter)).toBe(30);
      expect(moveLimit(8, chapter)).toBe(50);
    }
  });

  it('tightens in the last chapters, and no further than three times and ten', () => {
    expect(moveLimit(4, 6)).toBe(26);
    expect(moveLimit(4, 7)).toBe(22);
    expect(moveLimit(4, 99)).toBe(22);
  });

  it('is none for a level whose fewest moves are not known', () => {
    expect(moveLimit(undefined, 0)).toBe(0);
  });

  it('is laid on a level of the ladder as it is started, and leaves the level as it is kept', () => {
    const limited = limitedLevel(LEVELS, 9);
    expect(limited.moves).toBe(moveLimit(LEVELS[9].par, LEVELS[9].chapter!));
    expect(limited).toEqual({ ...LEVELS[9], moves: limited.moves });
    expect(LEVELS[9].moves).toBe(0);
  });

  it('never cuts short the way a level keeps', () => {
    LEVELS.forEach((level, index) => expect(limitedLevel(LEVELS, index).moves, level.id).toBeGreaterThanOrEqual(level.par! + 10));
  });
});

describe('the gates of the chapters', () => {
  const chapters = chaptersOf(LEVELS);

  it('ask for nothing before the course and the chapter after it, and for two fifths of the stars before any other', () => {
    expect(chapters.map(gateOf)).toEqual([0, 0, 22, 29, 35]);
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
    expect(fresh.chapters.map((chapter) => chapter.open)).toEqual([true, true, false, false, false]);
    expect(fresh.locked.slice(0, 18).every((locked) => !locked)).toBe(true);
    expect(fresh.locked.slice(18).every((locked) => locked)).toBe(true);

    // The course and the chapter after it passed with a star a level are four short of the next.
    const plain = ladderProgress(LEVELS, passedTo(18, 9));
    expect(plain.total).toBe(18);
    expect(plain.chapters[2]).toMatchObject({ gate: 22, open: false });

    // Seven levels a move over the fewest and one more passed open it.
    const clean = ladderProgress(LEVELS, passedTo(7, 1));
    expect(clean.total).toBe(21);
    const more = ladderProgress(LEVELS, (id) => (id === LEVELS[7].id ? 60 : passedTo(7, 1)(id)));
    expect(more.total).toBe(22);
    expect(more.chapters.map((chapter) => chapter.open)).toEqual([true, true, true, false, false]);
    expect(more.locked[18]).toBe(false);
    expect(more.locked[24]).toBe(true);
  });

  it('opens every chapter when the gates are switched off', () => {
    const open = ladderProgress(LEVELS, () => null, false);
    expect(open.chapters.every((chapter) => chapter.open)).toBe(true);
    expect(open.locked.some((locked) => locked)).toBe(false);
  });

  it('says of a level which chapter of the ladder it is in, counted from the first', () => {
    const progress = ladderProgress(LEVELS, () => null);
    expect(progress.chapterOf(0)).toBe(0);
    expect(progress.chapterOf(9)).toBe(1);
    expect(progress.chapterOf(18)).toBe(2);
    expect(progress.chapterOf(31)).toBe(4);
  });
});
