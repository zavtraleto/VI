import { describe, expect, it } from 'vitest';
import { firstLines, type EarlyFrame } from './perfFirst';

/** Frames 16 ms apart from `from` on, with the gaps named by their number made longer. */
function frames(from: number, count: number, late: Record<number, number> = {}, built: Record<number, number> = {}): EarlyFrame[] {
  const list: EarlyFrame[] = [];
  let at = from;
  for (let i = 0; i < count; i++) {
    const gap = late[i] ?? 16;
    at += gap;
    list.push({ at, gap, shaders: built[i] ?? 0 });
  }
  return list;
}

describe('the first seconds of play in ?perf', () => {
  it('says nothing has started before the command is pressed', () => {
    expect(firstLines([], null, null, [])).toBe('first: no start yet');
  });

  it('names the latest frame after the start and the latest around the first move', () => {
    // Started at 1000; the frame after the first move comes 180 ms late with two shaders built in it.
    const list = frames(1000, 200, { 0: 40, 63: 180 }, { 63: 2 });
    const move = list[62].at;
    const lines = firstLines(list, 1000, move, []).split('\n');
    expect(lines[0]).toBe('start+10s max 180 >33ms 2  move1 max 180 sh 2');
    expect(lines[1]).toBe('vi: none');
  });

  it('leaves out of the first move what came before it and long after it', () => {
    const list = frames(1000, 400, { 5: 90, 300: 70 });
    const move = list[100].at;
    expect(firstLines(list, 1000, move, []).split('\n')[0]).toBe('start+10s max 90 >33ms 2  move1 max 16 sh 0');
  });

  it('lists the measures of the game from the press of the start on, the longest first, one of a name', () => {
    const measures = [
      { name: 'vi-sound-open', startTime: 980, duration: 34.2 },
      { name: 'vi-board', startTime: 2000, duration: 12 },
      { name: 'vi-board', startTime: 2100, duration: 61 },
      { name: 'vi-start-said', startTime: 2300, duration: 0.4 },
      { name: 'other', startTime: 2000, duration: 500 },
      { name: 'vi-hud', startTime: 20_000, duration: 90 },
      { name: 'vi-rehearse', startTime: -500, duration: 80 },
    ];
    expect(firstLines([], 1000, null, measures).split('\n')[1]).toBe('vi: board 61  sound-open 34  start-said 0');
  });

  it('counts from the first move where the board was opened without the command', () => {
    const list = frames(500, 60, { 3: 50 });
    expect(firstLines(list, null, 500, [{ name: 'vi-sim', startTime: 520, duration: 9 }])).toBe('move1 max 50 sh 0\nvi: sim 9');
  });
});
