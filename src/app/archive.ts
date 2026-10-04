import { ARCHIVE_ENDLESS, ARCHIVE_TIMED } from './archiveData';
import type { Day } from './daily';

/**
 * The players a log has while few people play: made-up ones, so that the table of a new game
 * does not stand empty and a session has someone to go past. Their scores are real - the
 * player made of the rules has played every session (`node scripts/archive.mjs`) - and they
 * are written the way players of the platform are: most under the kind of name the platform
 * gives a guest, a colour and an animal, the rest under names of their own.
 *
 * There are a few hundred of them, each with a strength, and they behave as a crowd does. The
 * log of the sessions without a limit starts with some of them and takes the others in one by
 * one as the days go by. The session of a day is played by some of them, different ones every
 * day, and their lines come into its table through the day.
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
/** Players who play the session of a day. */
const DAILY = 56;
/** The first of them have played within the first half hour of the day: one every so much of a day. */
const EARLY = 6;
const EARLY_STEP = 0.0035;
/** How much earlier in the day than evenly the rest come: the table fills fast, then slowly. */
const ARRIVAL_POWER = 1.6;
/** How far the session of a day may be from what the player usually makes, in places of the players. */
const DAY_SWING = 18;
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
/** The log last made of each kind: it is asked for on every frame it is drawn. */
let endless: { count: number; lines: ArchiveLine[] } | null = null;
let daily: { seed: number; players: { line: ArchiveLine; arrives: number }[] } | null = null;

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

const byScore = (a: ArchiveLine, b: ArchiveLine): number => b.score - a.score;

/** The made-up players in the log of the sessions without a limit at a moment, best first: one more every half a day. */
export function endlessArchive(nowMs: number): readonly ArchiveLine[] {
  const since = Math.floor((nowMs - FIRST_DAY_MS) / JOIN_MS);
  const count = Math.min(PLAYERS, FIRST + Math.max(0, Number.isFinite(since) ? since : 0));
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
 * The made-up players in the table of the session of a day at a moment, best first. Who plays
 * that day, when in the day, and how well against their usual is taken from the seed of the
 * day: the same for everyone, and different the day after. A line is in the table from the
 * moment its player has played.
 */
export function dailyArchive(day: Pick<Day, 'seed' | 'index'>, nowMs: number): readonly ArchiveLine[] {
  if (daily?.seed !== day.seed) {
    const rand = chance(day.seed);
    const today = shuffled(ARCHIVE_ENDLESS.map((_, player) => player), rand).slice(0, DAILY);
    const last = ARCHIVE_TIMED.length - 1;
    const taken = new Set<number>();
    const players = today.map((player, i) => {
      const arrives = i < EARLY ? (i + 1) * EARLY_STEP : rand() ** ARRIVAL_POWER;
      // A good day or a bad one: the session of a player some places away. Past either end of
      // the players it comes back in, and no session is made twice in a day: two players with
      // the very same score would give the table away.
      let other = Math.round(player + (rand() * 2 - 1) * DAY_SWING);
      if (other < 0) other = -other;
      if (other > last) other = 2 * last - other;
      for (let step = 1; taken.has(other) && step <= last; step++) {
        const near = [other + step, other - step].find((at) => at >= 0 && at <= last && !taken.has(at));
        if (near !== undefined) other = near;
      }
      taken.add(other);
      return { line: { name: nameOf(player), score: ARCHIVE_TIMED[other] ?? 0 }, arrives };
    });
    daily = { seed: day.seed, players };
  }
  // How much of the day has gone by; a day that is over has all its lines.
  const gone = (nowMs - day.index * DAY_MS) / DAY_MS;
  return daily.players
    .filter((player) => player.arrives <= gone && player.line.score > 0)
    .map((player) => player.line)
    .sort(byScore);
}
