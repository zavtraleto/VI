import { describe, expect, it } from 'vitest';
import { DEAD_ENDS_FOR_SIGN, ROAD, ROAD_HINTS, type HintUntil } from '../levels/road';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { createRun, step } from '../rules/sim';
import type { Dir, GameEvent, LevelSpec, RunState } from '../rules/types';
import { wrapCaption } from '../signal/caption';
import { hintAlpha, hintBox, hintResumes, HINT_FADE_MS, NOTE_SIZE, lineSize, toolButtons } from '../shell/hudLayout';
import { LANGUAGES, setLanguage, t, type TextKey } from '../ui/i18n';
import { DeadEnds, hintOver, probeHint } from './hint';
import { roadWait } from './signWay';

const move = (kind: Extract<GameEvent, { type: 'move' }>['kind']): GameEvent => ({ type: 'move', kind, dir: 'N' });
const match: GameEvent = { type: 'match', reactionId: 1, value: 2, count: 2, points: 4 };
const chain: GameEvent = { type: 'chain', reactionId: 1, value: 2, chain: 2, count: 1, points: 8 };

describe('when a hint goes out', () => {
  it('is at the first combo for a combo', () => {
    expect(hintOver('combo', [match], null)).toBe(true);
    expect(hintOver('combo', [move('roll')], null)).toBe(false);
    // A combo formed against a die laid as leaving joins it: the rules say chain, and it is a combo all the same.
    expect(hintOver('combo', [move('roll'), chain], null)).toBe(true);
    expect(hintOver('combo', [], null)).toBe(false);
  });

  it('is at the chain event of the rules for a chain, and a combo is not one', () => {
    expect(hintOver('chain', [chain], null)).toBe(true);
    expect(hintOver('chain', [move('roll'), match], null)).toBe(false);
  });

  it('is at a push for a push, and no other move is one', () => {
    expect(hintOver('push', [move('push')], 'idle')).toBe(true);
    for (const kind of ['roll', 'hop', 'mount', 'climb', 'walk', 'descend'] as const) expect(hintOver('push', [move(kind)], 'idle'), kind).toBe(false);
  });

  it('is at a step onto a die that is leaving for a walk: from a die or up from the floor, and onto no other die', () => {
    expect(hintOver('walk', [move('hop')], 'sinking')).toBe(true);
    expect(hintOver('walk', [move('mount')], 'sinking')).toBe(true);
    expect(hintOver('walk', [move('hop')], 'idle')).toBe(false);
    expect(hintOver('walk', [move('mount')], 'rising')).toBe(false);
    expect(hintOver('walk', [move('hop')], null)).toBe(false);
    expect(hintOver('walk', [move('roll'), move('descend')], 'sinking')).toBe(false);
    expect(hintOver('walk', [match], 'sinking')).toBe(false);
  });

  it('is found in the real events of a piece: the combo of R03 is a match, and the rolls before it are nothing', () => {
    const spec = ROAD.find((piece) => piece.id === 'R03') as LevelSpec;
    const state: RunState = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    const seen: GameEvent[] = [];
    const go = (dir: Dir | null): void => {
      step(state, dir);
      seen.push(...state.events);
    };
    go('W');
    for (let ticks = 0; (worldRuns(state) || state.player.action) && ticks < 1000; ticks++) go(null);
    expect(seen.some((event) => event.type === 'move' && event.kind === 'roll')).toBe(true);
    expect(hintOver('combo', seen, null)).toBe(true);
    expect(hintOver('chain', seen, null)).toBe(false);
    expect(hintOver('push', seen, null)).toBe(false);
  });
});

describe('the lines of the road', () => {
  const pieces = Object.entries(ROAD_HINTS);

  it('are three, for the chain, the walk over a leaving die and the push, on the pieces that will teach them', () => {
    expect(Object.keys(ROAD_HINTS)).toEqual(['R09', 'R13', 'R17']);
    const untils: HintUntil[] = pieces.map(([, hint]) => hint.until);
    expect(untils).toEqual(['chain', 'walk', 'push']);
  });

  it('have their text in every one of the seven languages, in at most eight words, with no exclamation mark', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const [id, hint] of pieces) {
        const line = t(hint.key as TextKey);
        expect(line.length, `${id} ${code}`).toBeGreaterThan(0);
        expect(line.split(/\s+/).length, `${id} ${code}: ${line}`).toBeLessThanOrEqual(8);
        expect(line, `${id} ${code}`).not.toMatch(/[!！]/);
      }
    }
    setLanguage('en');
  });

  it('differ from one another and from the lines of a session that have names close to theirs', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      const lines = [t('roadHintChain'), t('roadHintWalk'), t('roadHintPush')];
      expect(new Set(lines).size, code).toBe(3);
      expect(lines, code).not.toContain(t('hintChain'));
    }
    setLanguage('en');
  });

  it('fit a phone: one line, or two at the most, at the width the hint has, in every language', () => {
    // The serif of the voice is not measured here: a letter of it is taken as 0.6 of its height, wider than the real one.
    const size = lineSize({ width: 360, height: 530 });
    const letter = size * 0.6;
    const phone = hintBox({ x: 0, y: 110, width: 360, height: 530 }, { width: 360, height: 640 }, { top: 0, right: 0, bottom: 0, left: 0 }, size, 0).box;
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const [id, hint] of pieces) {
        const rows = wrapCaption(t(hint.key as TextKey), phone.width, (line) => line.length * letter);
        expect(rows.length, `${id} ${code}`).toBeLessThanOrEqual(2);
      }
    }
    setLanguage('en');
  });
});

describe('the line of the address of development', () => {
  it('is found by its short name or the name of its key, and is nothing for any other', () => {
    expect(probeHint('hintChain')).toEqual({ key: 'roadHintChain', until: 'chain' });
    expect(probeHint('roadHintWalk')).toEqual({ key: 'roadHintWalk', until: 'walk' });
    expect(probeHint('push')).toEqual({ key: 'roadHintPush', until: 'push' });
    expect(probeHint('hintOne')).toBeNull();
    expect(probeHint('')).toBeNull();
    expect(probeHint(null)).toBeNull();
  });
});

describe('the letters of the line', () => {
  it('are those of the words of the exercise: a fixed size on a tall stage, by the height of a wide one, between two sizes', () => {
    expect(lineSize({ width: 360, height: 530 })).toBe(19);
    expect(lineSize({ width: 390, height: 700 })).toBe(19);
    expect(lineSize({ width: 1680, height: 1080 })).toBe(46);
    expect(lineSize({ width: 1920, height: 1080 })).toBe(46);
    expect(lineSize({ width: 1280, height: 720 })).toBe(37);
    expect(lineSize({ width: 640, height: 360 })).toBe(26);
  });

  it('are larger than those of a note on every stage', () => {
    for (const stage of [{ width: 360, height: 530 }, { width: 640, height: 360 }, { width: 1680, height: 1080 }]) expect(lineSize(stage)).toBeGreaterThan(NOTE_SIZE);
  });
});

describe('where the line stands', () => {
  const NONE = { top: 0, right: 0, bottom: 0, left: 0 };
  const PHONE = lineSize({ width: 360, height: 530 });
  const DESK = lineSize({ width: 1680, height: 1080 });
  const LINE = PHONE * 1.3;

  it('is at the top of the stage on a phone, centred, inside the window, and the board is given the room under it', () => {
    const stage = { x: 0, y: 110, width: 360, height: 530 };
    const { box, room } = hintBox(stage, { width: 360, height: 640 }, NONE, PHONE, LINE * 2);
    expect(box.y).toBeGreaterThanOrEqual(stage.y);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(box.x + box.width / 2).toBeCloseTo(180);
    // The room kept covers the whole line: no cell of the board is laid under it.
    expect(stage.y + room).toBeGreaterThanOrEqual(box.y + box.height);
    expect(room).toBeLessThan(stage.height / 4);
  });

  it('is at the top of the stage on a wide screen, centred in the stage and not wider than forty letters', () => {
    const stage = { x: 240, y: 0, width: 1680, height: 1080 };
    const { box, room } = hintBox(stage, { width: 1920, height: 1080 }, NONE, DESK, DESK * 1.3);
    expect(box.x).toBeGreaterThanOrEqual(stage.x);
    expect(box.x + box.width).toBeLessThanOrEqual(1920);
    expect(box.width).toBeLessThanOrEqual(DESK * 40);
    expect(box.x + box.width / 2).toBeCloseTo(stage.x + stage.width / 2);
    expect(stage.y + room).toBeGreaterThanOrEqual(box.y + box.height);
    expect(room).toBeLessThan(stage.height / 8);
  });

  it('stays inside what the edges of the screen keep', () => {
    const stage = { x: 0, y: 110, width: 360, height: 530 };
    const safe = { top: 0, right: 40, bottom: 0, left: 30 };
    const { box } = hintBox(stage, { width: 360, height: 640 }, safe, PHONE, LINE);
    expect(box.x).toBeGreaterThanOrEqual(30);
    expect(box.x + box.width).toBeLessThanOrEqual(360 - 40);
  });

  it('takes no more than the line of a stage too narrow for it', () => {
    const { box } = hintBox({ x: 0, y: 0, width: 20, height: 100 }, { width: 20, height: 100 }, NONE, PHONE, LINE);
    expect(box.width).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(20);
  });
});

describe('how bright the line is', () => {
  it('comes in over 300 ms, stands, and goes out over 300 ms', () => {
    expect(HINT_FADE_MS).toBe(300);
    expect(hintAlpha(0, null, false)).toBe(0);
    expect(hintAlpha(150, null, false)).toBe(0.5);
    expect(hintAlpha(300, null, false)).toBe(1);
    expect(hintAlpha(99_999, null, false)).toBe(1);
    expect(hintAlpha(99_999, 0, false)).toBe(1);
    expect(hintAlpha(99_999, 150, false)).toBe(0.5);
    expect(hintAlpha(99_999, 300, false)).toBe(0);
    expect(hintAlpha(99_999, 5000, false)).toBe(0);
  });

  it('is never brighter than either of its two ramps when it is taken away while it comes in, and is gone 300 ms after', () => {
    expect(hintAlpha(60, 0, false)).toBe(0.2);
    expect(hintAlpha(60 + 30, 30, false)).toBeLessThanOrEqual(0.3);
    expect(hintAlpha(60 + 300, 300, false)).toBe(0);
  });

  it('is there or not there with reduced motion', () => {
    expect(hintAlpha(0, null, true)).toBe(1);
    expect(hintAlpha(10, 0, true)).toBe(0);
  });
});

describe('the dead ends of a piece', () => {
  it('are counted, and the second one is the first that hurries the sign', () => {
    const ends = new DeadEnds();
    ends.begin('R05');
    expect(ends.hurries).toBe(false);
    expect(ends.reach()).toBe(1);
    expect(ends.hurries).toBe(false);
    expect(ends.reach()).toBe(DEAD_ENDS_FOR_SIGN);
    expect(ends.hurries).toBe(true);
  });

  it('are not forgotten by a try started over, or a move taken back, which begin the same piece again', () => {
    const ends = new DeadEnds();
    ends.begin('R05');
    ends.reach();
    ends.begin('R05');
    expect(ends.count).toBe(1);
    ends.reach();
    ends.begin('R05');
    expect(ends.count).toBe(2);
    expect(ends.hurries).toBe(true);
  });

  it('are forgotten when another piece or level begins, or when the piece is passed', () => {
    const ends = new DeadEnds();
    ends.begin('R05');
    ends.reach();
    ends.reach();
    ends.begin('R06');
    expect(ends.count).toBe(0);
    expect(ends.hurries).toBe(false);
    ends.reach();
    ends.begin('P01');
    expect(ends.count).toBe(0);
    ends.reach();
    ends.reach();
    ends.forget();
    ends.begin('P01');
    expect(ends.count).toBe(0);
  });

  it('bring the sign at once to a piece that begins again, and not to one that has had none', () => {
    const spec = ROAD.find((piece) => piece.id === 'R03') as LevelSpec;
    const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    expect(roadWait('R03', false)!.frame(state, 0, true)).toEqual({ dir: null, blink: false });
    // Standing on the board the first moment, with no wait at all.
    expect(roadWait('R03', true)!.frame(state, 0, true)).toEqual({ dir: 'W', blink: false });
  });
});

describe('the line and the buttons of a level', () => {
  const NONE = { top: 0, right: 0, bottom: 0, left: 0 };
  const PHONE = lineSize({ width: 360, height: 530 });
  const DESK = lineSize({ width: 1680, height: 1080 });
  const LINE = PHONE * 1.3;
  /** The buttons as the hud puts them, in CSS pixels: the picture is zoomed by `zoom`; the label is some 60 picture pixels wide. */
  const tools = (stage: { x: number; y: number; width: number; height: number }, zoom: number) => {
    const { box } = toolButtons({ x: stage.x / zoom, y: stage.y / zoom, w: stage.width / zoom, h: stage.height / zoom }, zoom, 60);
    return { x: box.x * zoom, y: box.y * zoom, width: box.w * zoom, height: box.h * zoom };
  };

  it('stand in the top right corner of the stage, in a row a finger needs', () => {
    const stage = { x: 0, y: 110, width: 360, height: 530 };
    const buttons = tools(stage, 1.5);
    expect(buttons.height).toBeGreaterThanOrEqual(44);
    expect(buttons.x + buttons.width).toBeLessThanOrEqual(360);
    expect(buttons.y).toBeGreaterThanOrEqual(stage.y);
  });

  it('keep the line below them on a phone, inside the window, with the room covering the line', () => {
    const stage = { x: 0, y: 110, width: 360, height: 530 };
    const buttons = tools(stage, 1.5);
    const free = hintBox(stage, { width: 360, height: 640 }, NONE, PHONE, LINE * 2);
    const { box, room } = hintBox(stage, { width: 360, height: 640 }, NONE, PHONE, LINE * 2, buttons);
    expect(box.y).toBeGreaterThanOrEqual(buttons.y + buttons.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(stage.y + room).toBeGreaterThanOrEqual(box.y + box.height);
    expect(room).toBeGreaterThan(free.room);
    expect(room).toBeLessThan(stage.height / 3);
  });

  it('keep the longest line of any language below them on a phone, in at most two rows', () => {
    const stage = { x: 0, y: 110, width: 360, height: 530 };
    const buttons = tools(stage, 1.5);
    const { box } = hintBox(stage, { width: 360, height: 640 }, NONE, PHONE, LINE * 2, buttons);
    let longest = '';
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const hint of Object.values(ROAD_HINTS)) if (t(hint.key as TextKey).length > longest.length) longest = t(hint.key as TextKey);
    }
    setLanguage('en');
    const rows = wrapCaption(longest, box.width, (line) => line.length * PHONE * 0.6);
    expect(rows.length).toBeLessThanOrEqual(2);
    const { box: placed, room } = hintBox(stage, { width: 360, height: 640 }, NONE, PHONE, LINE * rows.length, buttons);
    expect(placed.y).toBeGreaterThanOrEqual(buttons.y + buttons.height);
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.x + placed.width).toBeLessThanOrEqual(360);
    expect(stage.y + room).toBeGreaterThanOrEqual(placed.y + placed.height);
    expect(room).toBeLessThan(stage.height / 3);
  });

  it('keep the line below them on a wide screen too, where its letters are large and its box reaches them', () => {
    const stage = { x: 240, y: 0, width: 1680, height: 1080 };
    for (const zoom of [1, 3]) {
      const buttons = tools(stage, zoom);
      const { box, room } = hintBox(stage, { width: 1920, height: 1080 }, NONE, DESK, DESK * 1.3, buttons);
      expect(box.y).toBeGreaterThanOrEqual(buttons.y + buttons.height);
      expect(box.x).toBeGreaterThanOrEqual(stage.x);
      expect(box.x + box.width).toBeLessThanOrEqual(1920);
      expect(stage.y + room).toBeGreaterThanOrEqual(box.y + box.height);
      // One row of the line under the buttons leaves the board more than four fifths of the stage.
      expect(room).toBeLessThan(stage.height / 5);
    }
  });

  it('are not in the way of a line that does not reach them: it stays where it was', () => {
    const stage = { x: 240, y: 0, width: 1680, height: 1080 };
    const buttons = tools(stage, 1);
    const free = hintBox(stage, { width: 1920, height: 1080 }, NONE, NOTE_SIZE, NOTE_SIZE * 1.3);
    const placed = hintBox(stage, { width: 1920, height: 1080 }, NONE, NOTE_SIZE, NOTE_SIZE * 1.3, buttons);
    expect(placed).toEqual(free);
  });
});

describe('a hint given again while it goes out', () => {
  it('comes back from how bright it was, and not from nothing', () => {
    expect(hintResumes(5000, 150, false)).toBe(150);
    expect(hintResumes(5000, 0, false)).toBe(HINT_FADE_MS);
    expect(hintAlpha(HINT_FADE_MS - 0, null, false)).toBe(1);
    expect(hintAlpha(hintResumes(5000, 150, false) + 0, null, false)).toBe(0.5);
    expect(hintResumes(5000, 400, false)).toBe(0);
    expect(hintResumes(40, 30, false)).toBeLessThanOrEqual(30);
  });
});
