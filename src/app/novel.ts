/**
 * The records of the link, in the game for every player since 6 November 2026 (before, only under `?novel`)
 * (docs/superpowers/specs/2026-11-04-vi-star-novel-design.md): the stars of the row add up, and on
 * a sum a record opens, a short scene of two voices. Which ones there are, on what sums, and which
 * one is due. What a record says is in `src/ui/novel.ts`.
 */

/** A record of the link: its code, and the sum of the stars it opens on. */
export interface NovelEntry {
  code: string;
  stars: number;
}

/** The records, by the sum they open on, the lowest first: one every 20 stars (the owner, 4 November 2026). */
export const NOVEL: readonly NovelEntry[] = [
  { code: 'n01', stars: 20 },
  { code: 'n02', stars: 40 },
  { code: 'n03', stars: 60 },
  // Act II "Room" (docs/superpowers/specs/2026-11-05-vi-story-idea-design.md, section 10).
  { code: 'n04', stars: 80 },
  { code: 'n05', stars: 100 },
  { code: 'n06', stars: 120 },
  { code: 'n07', stars: 140 },
];

/** How a record is kept among the windows a player has been shown (`LevelProgress.told`): once there, its window does not come again. */
export function novelKey(code: string): string {
  return `novel:${code}`;
}

/**
 * The record whose window comes after a passage: the lowest the sum has come to whose window has
 * not been shown, played or put off. One a passage: where the sum has come to two, the other
 * comes on the next. Undefined where none is due.
 */
export function novelDue(sum: number, told: readonly string[], novel: readonly NovelEntry[] = NOVEL): NovelEntry | undefined {
  return novel.find((entry) => sum >= entry.stars && !told.includes(novelKey(entry.code)));
}

/**
 * The record the sum has not come to yet, the lowest of them: it, its number counted from one, and
 * the stars still wanting. Undefined once the sum has come to the last.
 */
export function novelNext(sum: number, novel: readonly NovelEntry[] = NOVEL): { entry: NovelEntry; number: number; left: number } | undefined {
  const index = novel.findIndex((entry) => sum < entry.stars);
  return index < 0 ? undefined : { entry: novel[index], number: index + 1, left: novel[index].stars - sum };
}
