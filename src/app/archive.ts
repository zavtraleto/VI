import { ARCHIVE_ENDLESS } from './archiveData';

/**
 * The players a log has while few people play: made-up ones, so that the table of a new game
 * does not stand empty and a session has someone to go past. Their scores are real - the
 * player made of the rules has played every session (`node scripts/archive.mjs`) - and they
 * are written the way players of the platform are: most under the kind of name the platform
 * gives a guest, a colour and an animal, the rest under names of their own.
 *
 * There are a few hundred of them, each with a strength, and they behave as a crowd does. The
 * log of the sessions starts with some of them and takes the others in one by one as the days
 * go by.
 *
 * They are lines of the game's own table only: nothing of them is sent to the platform.
 */
export interface ArchiveLine {
  name: string;
  score: number;
}

const DAY_MS = 86_400_000;
/** The players: as many as there are sessions played for them, the weakest first. */
const PLAYERS = ARCHIVE_ENDLESS.length;
/** Players in the log of the sessions without a limit when it starts, and how often one more comes into it. */
const FIRST = 50;
const FIRST_DAY_MS = Date.UTC(2026, 9, 4);
const JOIN_MS = DAY_MS / 2;
/** Share of the players that go under a name of the kind the platform gives a guest. */
const GUEST_SHARE = 0.74;
/** Widest a name gets in the table, in signs: a longer one would be cut there. */
const NAME_ROOM = 16;

const COLOURS = [
  'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Orange', 'White', 'Black', 'Gray', 'Brown', 'Teal', 'Gold', 'Silver', 'Coral',
  'Amber', 'Violet', 'Indigo', 'Lime', 'Olive', 'Crimson', 'Azure', 'Ivory', 'Jade', 'Peach', 'Plum', 'Rose', 'Tan', 'Aqua', 'Bronze',
];
const ANIMALS = [
  'Chicken', 'Mackerel', 'Angelfish', 'Otter', 'Falcon', 'Badger', 'Heron', 'Lynx', 'Moose', 'Panda', 'Koala', 'Gecko', 'Rabbit', 'Salmon',
  'Tiger', 'Walrus', 'Zebra', 'Beaver', 'Bison', 'Camel', 'Cobra', 'Crane', 'Dingo', 'Eagle', 'Ferret', 'Gopher', 'Hornet', 'Iguana', 'Jackal',
  'Lemur', 'Marmot', 'Newt', 'Ocelot', 'Parrot', 'Quail', 'Raccoon', 'Seal', 'Tapir', 'Urchin', 'Viper', 'Wombat', 'Yak', 'Antelope', 'Bobcat',
  'Cheetah', 'Dolphin', 'Finch', 'Giraffe', 'Hamster', 'Ibis', 'Jaguar', 'Kiwi', 'Llama', 'Mole', 'Narwhal', 'Octopus', 'Penguin', 'Robin',
  'Shark', 'Toucan', 'Vulture', 'Weasel', 'Swan', 'Stork', 'Sloth', 'Puffin', 'Owl', 'Mantis', 'Lobster', 'Hedgehog', 'Goose', 'Frog', 'Fox',
  'Duck', 'Deer', 'Crab', 'Catfish', 'Bat', 'Bear', 'Wolf',
];
/** Names players give themselves: first names and handles, of no one in particular. */
const OWN_NAMES = [
  'kuro_neko', 'Tomás', 'alex2009', 'nika', 'mr.fox', 'Lena', 'Sasha', 'dice_goblin', 'Mika', 'Ren', 'oleg_k', 'yuki', 'Zhenya', 'pixelcat',
  'Marta', 'leo', 'Sofia', 'Timur', 'nord', 'qwerty', 'Anya', 'Bruno', 'hana', 'Kai', 'Dasha', 'max', 'luna', 'Pavel', 'noob_master', 'Emre',
  'João', 'Aiko', 'tofu', 'Vika', 'Arjun', 'rei', 'Stas', 'olive', 'Nico', 'milk_tea', 'Gosha', 'zero', 'Ilya', 'bee', 'Katya', 'sam', 'Mateo',
  'ghost', 'Lera', 'Мария', 'Даня', 'ольга', 'Кирилл', 'Настя', 'N0body', 'six_sides', 'Theo', 'ami', 'Lukas', 'pip', 'Zoe', 'rollin', 'Ines',
  'dmitry', 'Chen', 'momo', 'Felix', 'tanya_s', 'Omar', 'kite', 'Julia', 'vlad99', 'Noor', 'echo',
];

/** Numbers between 0 and 1 from a seed: the same seed gives the same crowd. */
function chance(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** The same things in an order taken from `rand`. */
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** A name for each player, no two alike, none too long for the table. Whose name is whose has nothing to do with how strong they are. */
function makeNames(count: number): string[] {
  const rand = chance(7);
  const own = shuffled(OWN_NAMES, rand);
  const made = new Set<string>();
  while (made.size < count) {
    if (own.length > 0 && rand() >= GUEST_SHARE) {
      made.add(own.pop()!);
      continue;
    }
    const name = `${COLOURS[Math.floor(rand() * COLOURS.length)]} ${ANIMALS[Math.floor(rand() * ANIMALS.length)]}`;
    if (name.length <= NAME_ROOM) made.add(name);
  }
  return [...made];
}

let names: string[] | null = null;
let joining: number[] | null = null;
/** The log last made: it is asked for on every frame it is drawn. */
let endless: { count: number; lines: ArchiveLine[] } | null = null;

function nameOf(player: number): string {
  names ??= makeNames(PLAYERS);
  return names[player];
}

/**
 * The order the players come into the log of the sessions without a limit: first the ones it
 * starts with, spread evenly from the weakest to the strongest, then the others in no order.
 */
function joiningOrder(): number[] {
  if (joining) return joining;
  const first = new Set<number>();
  for (let i = 0; i < FIRST; i++) first.add(Math.round((i * (PLAYERS - 1)) / (FIRST - 1)));
  const later = ARCHIVE_ENDLESS.map((_, player) => player).filter((player) => !first.has(player));
  joining = [...first, ...shuffled(later, chance(11))];
  return joining;
}

/** How many players have come into the logs by a moment: one more every half a day. */
function joinedBy(nowMs: number): number {
  const since = Math.floor((nowMs - FIRST_DAY_MS) / JOIN_MS);
  return Math.min(PLAYERS, FIRST + Math.max(0, Number.isFinite(since) ? since : 0));
}

const byScore = (a: ArchiveLine, b: ArchiveLine): number => b.score - a.score;

/** The made-up players in the log of the sessions without a limit at a moment, best first: one more every half a day. */
export function endlessArchive(nowMs: number): readonly ArchiveLine[] {
  const count = joinedBy(nowMs);
  if (endless?.count === count) return endless.lines;
  const lines = joiningOrder()
    .slice(0, count)
    .map((player) => ({ name: nameOf(player), score: ARCHIVE_ENDLESS[player] }))
    .filter((line) => line.score > 0)
    .sort(byScore);
  endless = { count, lines };
  return lines;
}

/**
 * What the players of the bot score in a live session of each step, from the one who has just
 * been shown the rules to the one who plays for prizes (newbie … esports): steps 1 to 3 are the
 * medians `scripts/pace.mjs live=1|2|3` played (docs/superpowers/specs/2026-10-22-vi-live-sessions-design.md,
 * «Отклонения»); steps 4 to 7 go on along their line. The owner, 28 October 2026: the log of a
 * live session is counted roughly («считай примерно»), not played session by session.
 */
const LIVE_ANCHORS: readonly (readonly number[])[] = [
  [80, 196, 2471, 24261, 510838],
  [53, 462, 2912, 24415, 710201],
  [53, 204, 3069, 34050, 831947],
  [50, 190, 3200, 36000, 860000],
  [48, 180, 3300, 38000, 880000],
  [45, 170, 3400, 40000, 900000],
  [42, 160, 3500, 42000, 920000],
];
/** The strongest player of the logs stands this far along the named ones, as in the log without a limit (`scripts/archive.mjs`). */
const STRONGEST = 3.2;
/** How far a session of a player strays from what their strength makes, up or down, as a power of e. */
const LIVE_SPREAD = 1;

/** The logs of the live sessions last made, by step. */
const lives = new Map<number, { count: number; lines: ArchiveLine[] }>();

/** What a player scores in a live session of a step: the line of the step at their strength, strayed from by a chance of their own. */
function liveScore(step: number, player: number): number {
  const anchors = LIVE_ANCHORS[Math.min(LIVE_ANCHORS.length, Math.max(1, step)) - 1];
  const strength = (STRONGEST * player) / Math.max(1, PLAYERS - 1);
  const low = Math.min(Math.floor(strength), anchors.length - 2);
  const t = strength - low;
  const made = Math.exp(Math.log(anchors[low]) + t * (Math.log(anchors[low + 1]) - Math.log(anchors[low])));
  const stray = Math.exp((chance(1000 + step * 7919 + player * 31)() - 0.5) * LIVE_SPREAD);
  return Math.max(1, Math.round(made * stray));
}

/**
 * The made-up players in the log of a live session of a step (1-based) at a moment, best first:
 * the same crowd as in the log without a limit, come in the same way, each with what they
 * would score in that session.
 */
export function liveArchive(step: number, nowMs: number): readonly ArchiveLine[] {
  const count = joinedBy(nowMs);
  const kept = lives.get(step);
  if (kept?.count === count) return kept.lines;
  const lines = joiningOrder()
    .slice(0, count)
    .map((player) => ({ name: nameOf(player), score: liveScore(step, player) }))
    .sort(byScore);
  lives.set(step, { count, lines });
  return lines;
}
