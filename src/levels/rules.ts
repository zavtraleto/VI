import type { LevelSpec } from '../rules/types';
import type { TextKey } from '../ui/i18n';

/**
 * The rules the windows of the levels say, in the order the ladder brings them: a combo and the
 * faces that work; walking over the dice and over a combo that is leaving; a chain; what a link
 * gives the combo; the floor and the push; the ways up from the floor; opposite faces; then the
 * faces of the chapters that follow, and the roll over a die that is leaving between them.
 */
export const LESSONS = [
  'lessonThrees',
  'lessonWalk',
  'lessonLink',
  'lessonHold',
  'lessonFloor',
  'lessonClimb',
  'lessonSeven',
  'lessonTwos',
  'lessonGlass',
  'lessonFives',
] as const satisfies readonly TextKey[];

/**
 * The rule of every lesson as it is read again from the pause of a level: the rule alone, in a
 * line, with no one speaking. What a level opens with is said by a person and at length; what a
 * player looks up in the middle of a level has to be found at a glance.
 */
const RULE_OF: Readonly<Record<string, TextKey>> = {
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

/** What of a level its rules are told by: the faces that work on it, and the rule it brings. */
type Taught = Pick<LevelSpec, 'faces' | 'lesson'>;

const sameFaces = (a: Taught, b: Taught): boolean => String(a.faces ?? []) === String(b.faces ?? []);

/**
 * The rules a player on a level can read again, as the keys of their lines: the rule of the faces
 * that work on the level first, then every other rule the levels up to it have brought, in the
 * order they came. The first level of a chapter is the one that names its faces, and of those
 * only the chapter of the level is of use: the faces of a chapter left behind work no more.
 */
export function lessonsAt(levels: readonly Taught[], index: number): string[] {
  const here = levels[index];
  if (!here) return [];
  const faces: string[] = [];
  const others: string[] = [];
  levels.slice(0, index + 1).forEach((level, at) => {
    if (!level.lesson) return;
    const opens = at === 0 || !sameFaces(levels[at - 1], level);
    if (!opens) others.push(level.lesson);
    else if (sameFaces(level, here)) faces.push(level.lesson);
  });
  return [...faces, ...others];
}
