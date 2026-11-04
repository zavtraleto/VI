import { describe, expect, it } from 'vitest';
import { hiddenData, tellsLeaving, type HiddenAt, type LeftRun } from './leaving';

const LEVEL: HiddenAt = {
  where: 'level',
  visitSec: 95,
  place: 7,
  step: { step_id: 'level_P07', step_index: 7 },
  runSec: 40,
  over: false,
  paused: false,
  level: { moves: 3, undos: 1 },
  score: 0,
  adOpen: false,
  ads: 0,
};

describe('page_hidden', () => {
  it('on a board: the place, the seconds of the visit and of the try, its moves, and the advertisement', () => {
    expect(hiddenData(LEVEL)).toEqual({
      where: 'level',
      visit_sec: 95,
      step_id: 'level_P07',
      step_index: 7,
      run_sec: 40,
      over: false,
      paused: false,
      moves: 3,
      undos: 1,
      ad_open: false,
      ads: 0,
    });
  });

  it('in a session: its score for the moves; hidden under an advertisement, that is said', () => {
    const data = hiddenData({ ...LEVEL, where: 'endless', step: { step_id: 'endless' }, level: null, score: 1200, adOpen: true, ads: 2 });
    expect(data).toMatchObject({ where: 'endless', step_id: 'endless', score: 1200, ad_open: true, ads: 2 });
    expect(data).not.toHaveProperty('moves');
  });

  it('in the menu: the place of the row the player stands on, nothing of a run', () => {
    expect(hiddenData({ ...LEVEL, where: 'menu' })).toEqual({ where: 'menu', visit_sec: 95, step_index: 7, ad_open: false, ads: 0 });
    expect(hiddenData({ ...LEVEL, where: 'menu', place: null })).toEqual({ where: 'menu', visit_sec: 95, ad_open: false, ads: 0 });
  });
});

describe('a run that is left', () => {
  const played: LeftRun = { opened: true, inMenu: false, over: false, tick: 12, level: true, unsaid: false };

  it('is told once played, and not after its end, from the menu or before the program opened', () => {
    expect(tellsLeaving(played)).toBe(true);
    expect(tellsLeaving({ ...played, over: true })).toBe(false);
    expect(tellsLeaving({ ...played, inMenu: true })).toBe(false);
    expect(tellsLeaving({ ...played, opened: false })).toBe(false);
  });

  it('a level whose start was told is told with no move made: the player who never touched the board', () => {
    expect(tellsLeaving({ ...played, tick: 0 })).toBe(true);
  });

  it('a level laid under the opening command, never started, and a session that never ticked are not', () => {
    expect(tellsLeaving({ ...played, tick: 0, unsaid: true })).toBe(false);
    expect(tellsLeaving({ ...played, tick: 0, level: false })).toBe(false);
  });
});
