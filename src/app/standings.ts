import type { ArchiveLine } from './archive';

/** A line of the log of sessions as it is shown: its place, whose it is, what it came to. */
export interface Standing {
  rank: number;
  name: string;
  score: number;
  /** The line of the one who is playing. */
  own: boolean;
  /** A record of one of the six. */
  subject: boolean;
}

/** A player the platform knows, as its table gives them. */
export interface PlayerLine {
  name: string;
  score: number;
  own: boolean;
}

/**
 * The log of one kind of session: the archive of the program, the players the platform knows,
 * and the one who plays, best first. The player has one line: what the platform has for them
 * or what this device has kept, whichever is more. A player with no score has no line.
 */
export function standings(archive: readonly ArchiveLine[], players: readonly PlayerLine[], own: { name: string; score: number }): Standing[] {
  const theirs = players.find((line) => line.own);
  const best = Math.max(own.score, theirs?.score ?? 0);
  const all: Omit<Standing, 'rank'>[] = [
    ...archive.map((line) => ({ ...line, own: false })),
    ...players.filter((line) => !line.own && line.score > 0).map((line) => ({ name: line.name, score: line.score, own: false, subject: false })),
  ];
  if (best > 0) all.push({ name: theirs?.name.trim() || own.name, score: best, own: true, subject: false });
  // Of two equal scores the one that was there first stands higher: the player comes after.
  return all
    .map((line, i) => ({ line, i }))
    .sort((a, b) => b.line.score - a.line.score || Number(a.line.own) - Number(b.line.own) || a.i - b.i)
    .map(({ line }, i) => ({ ...line, rank: i + 1 }));
}

/** The place a score would take in a log: one below every line that has more, or as much. */
export function placeOf(lines: readonly { score: number }[], score: number): number {
  return 1 + lines.filter((line) => line.score >= score).length;
}
