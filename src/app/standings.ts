import type { ArchiveLine } from './archive';

/** A line of the log of sessions as it is shown: its place, whose it is, what it came to. */
export interface Standing {
  rank: number;
  name: string;
  score: number;
  /** The line of the one who is playing. */
  own: boolean;
}

/** A player the platform knows, as its table gives them. */
export interface PlayerLine {
  name: string;
  score: number;
  own: boolean;
}

/** A name as it is compared: two that read the same are the same. */
const plain = (name: string): string => name.trim().toLowerCase();

/**
 * The log of one kind of session: the made-up players it is filled with, the players the
 * platform knows, and the one who plays, best first. The player has one line: what the platform
 * has for them or what this device has kept, whichever is more. A player with no score has no
 * line. A made-up player who happens to be called as a real one is left out: there are not two
 * of a name.
 */
export function standings(archive: readonly ArchiveLine[], players: readonly PlayerLine[], own: { name: string; score: number }): Standing[] {
  const theirs = players.find((line) => line.own);
  const best = Math.max(own.score, theirs?.score ?? 0);
  const ownName = theirs?.name.trim() || own.name;
  const real = players.filter((line) => !line.own && line.score > 0);
  const taken = new Set([...real.map((line) => plain(line.name)), plain(ownName)]);
  const all: Omit<Standing, 'rank'>[] = [
    ...archive.filter((line) => !taken.has(plain(line.name))).map((line) => ({ ...line, own: false })),
    ...real.map((line) => ({ name: line.name, score: line.score, own: false })),
  ];
  if (best > 0) all.push({ name: ownName, score: best, own: true });
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
