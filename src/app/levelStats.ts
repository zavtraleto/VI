import type { LevelStat } from '../platform/settings';
import type { LevelGoal, RunState } from '../rules';
import { goalLines } from '../rules';

/** How far short of its goal a level stands: what its lines lack, added up. */
export function shortOf(state: RunState): number {
  return goalLines(state).reduce((sum, line) => sum + Math.max(0, line.need - line.have), 0);
}

/** A goal in plain words. */
function goalWords(goal: LevelGoal): string {
  if (goal.kind === 'send') return `send ${goal.count}`;
  if (goal.kind === 'chain') return `chain ${goal.links}`;
  if (goal.kind === 'clear') return 'clear';
  return `order ${goal.items.map((item) => `${item.count} of ${item.value}`).join(' and ')}`;
}

/**
 * Playtest report: one line per level that was played. Plain ASCII in English, so it survives
 * any messenger and reads the same whoever plays. A line says how many tries the level took,
 * whether it was passed, in how many moves against the fewest it is known to take, the moves
 * taken back, the dead ends, the time, and what the player said when asked if they liked it.
 */
export function levelReport(
  levels: readonly { id: string; goal: LevelGoal; moves: number; par?: number }[],
  stats: Readonly<Record<string, LevelStat>>,
): string {
  const lines: string[] = [];
  levels.forEach((level, i) => {
    const s = stats[level.id];
    if (!s || s.tries === 0) return;
    const limited = level.moves > 0;
    const par = level.par !== undefined ? ` (par ${level.par})` : '';
    const best = limited ? `best ${s.bestLeft} left` : `best in ${s.bestMoves} moves${par}`;
    const result = s.firstPassTry === null ? `not passed${par}` : `passed on try ${s.firstPassTry}, ${best}`;
    const short = limited && s.short.length > 0 ? `, short by ${s.short.join(' ')}` : '';
    const limit = limited ? `, in ${level.moves} moves` : '';
    const liked = s.liked === null || s.liked === undefined ? '-' : s.liked ? 'yes' : 'no';
    lines.push(
      `${i + 1}. ${goalWords(level.goal)}${limit}: ${result}, tries ${s.tries}, passes ${s.passes}, fails ${s.fails}${short}, undos ${s.undos}, dead ends ${s.stuck ?? 0}, ${Math.round(s.playMs / 1000)}s, liked ${liked}`,
    );
  });
  if (lines.length === 0) return '';
  return [`VI levels playtest, ${lines.length} of ${levels.length} levels played`, ...lines].join('\n');
}
