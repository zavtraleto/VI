import type { LevelSpec } from '../rules/types';
import type { TextKey } from '../ui/i18n';

/**
 * The rules the levels say, in the order the ladder brings them: a combo; walking over the dice;
 * a combo that is leaving, walked over to the rest; a face that rides on the side; opposite
 * faces; then a chain, the floor, two faces at work at once, and the roll over a die that is
 * leaving. A level that brings a rule says it in a line beside its board (`line…`).
 */
export const LESSONS = ['lineCombo', 'lineStep', 'lineWalk', 'lineSide', 'lineSeven', 'lineLink', 'lineFloor', 'lineFaces', 'lineGlass'] as const satisfies readonly TextKey[];

/**
 * The rule of a lesson as it is read again from the pause of a level: the rule alone, in a
 * line, with no one speaking. What a level says beside its board is said once; what a player
 * looks up in the middle of a level has to be found at a glance.
 *
 * The lines of the lessons of the ladder as it was are kept while their words are; of the new
 * lessons, the combo and the ride on the side have no line of their own yet.
 */
const RULE_OF: Readonly<Record<string, TextKey>> = {
  lineStep: 'ruleStep',
  lineWalk: 'ruleWalk',
  lineSeven: 'ruleSeven',
  lineLink: 'ruleLink',
  lineFloor: 'ruleFloor',
  lineFaces: 'ruleTwos',
  lineGlass: 'ruleGlass',
  lessonThrees: 'ruleThrees',
  lessonStep: 'ruleStep',
  lessonWalk: 'ruleWalk',
  lessonLink: 'ruleLink',
  lessonHold: 'ruleHold',
  lessonFloor: 'ruleFloor',
  lessonClimb: 'ruleClimb',
  lessonSeven: 'ruleSeven',
  lessonTwos: 'ruleTwos',
  lessonGlass: 'ruleGlass',
  lessonFives: 'ruleFives',
};

/** The key of the rule a lesson leaves behind; null for a lesson that has none. */
export function ruleOf(lesson: string): TextKey | null {
  return RULE_OF[lesson] ?? null;
}

/** What of a level its rules are told by: the rule it brings. */
type Taught = Pick<LevelSpec, 'lesson'>;

/**
 * The rules a player on a level can read again, as the keys of their lessons: every rule the
 * levels up to it have brought, the level itself among them, in the order they came, each once.
 */
export function lessonsAt(levels: readonly Taught[], index: number): string[] {
  if (!levels[index]) return [];
  const lessons: string[] = [];
  for (const level of levels.slice(0, index + 1)) {
    if (level.lesson && !lessons.includes(level.lesson)) lessons.push(level.lesson);
  }
  return lessons;
}
