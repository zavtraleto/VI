import { frameDef } from './compose';
import { randomFrame, type Frame } from './director';
import { LINES } from './lines';
import { MOODS, contactValues, type Mood, type ParamValues, type SceneDef } from './scene';

/** One transmission as data: enough to build its picture again. */
export interface SignalCard {
  /** What is in the picture and how it stands. */
  frame: Frame;
  /** How strong the link was, 0..1: how heavy the picture is. */
  contact: number;
  seed: number;
  /** The number the program files the picture under. */
  figure: number;
  /** What the other side says under the picture, or nothing. */
  caption: string | null;
  /** How long it stays on screen. */
  seconds: number;
}

/**
 * The numbers the art document gives its first pictures (IMAGE 0001 is the sea and the pole).
 * The corridor with the door half shut has none there and takes a free one. Every other frame
 * gets a number made from what it is.
 */
const FIGURES: Record<string, number> = {
  'sea_pole:a': 1,
  'room_chair:a': 2,
  'sea_pole:b': 3,
  'corridor_door:a': 4,
  'room_chair:b': 6,
  'corridor_door:b': 9,
};

/** An answer to a session and a glimpse before one, in seconds. */
export const ANSWER_SECONDS = 5;
export const GLIMPSE_SECONDS = 3;
/** A picture comes with a line of the other side this often: a bare frame is sometimes the stronger. */
const CAPTION_CHANCE = 0.55;

/** The mood a session has earned: the stronger the contact, 0..1, the heavier. */
export function moodFor(contact: number): Mood {
  const level = Math.min(1, Math.max(0, contact));
  return MOODS[Math.min(MOODS.length - 1, Math.floor(level * MOODS.length * 0.999))];
}

function hash(text: string): number {
  let value = 7;
  for (const char of text) value = (Math.imul(value, 31) + char.codePointAt(0)!) >>> 0;
  return value;
}

/** The number a frame is filed under: its own from the art document, or one made from what it is. */
export function figureOf(frame: Frame): number {
  const key = `${frame.recipe.id}:${frame.variant}`;
  return FIGURES[key] ?? 100 + (hash(key) % 9000);
}

/**
 * A transmission picked by chance, with no thought for the story. The contact decides how far
 * the merge has gone in it and how heavy it is; the rest is chance. What it says, if it says
 * anything, is one of the lines that are written down.
 */
export function randomCard(random: () => number, contact: number, seconds = ANSWER_SECONDS): SignalCard {
  const frame = randomFrame(random, contact);
  const seed = 1 + Math.floor(random() * 9999);
  const spoken = random() < CAPTION_CHANCE;
  const line = LINES[Math.min(LINES.length - 1, Math.floor(random() * LINES.length))].text;
  return { frame, contact, seed, figure: figureOf(frame), caption: spoken ? line : null, seconds };
}

/** The scene of a card and the values it is built from. */
export function cardScene(card: SignalCard): { def: SceneDef; values: ParamValues } {
  const def = frameDef(card.frame.recipe);
  const values = contactValues(def, card.frame.variant, card.contact);
  for (const [name, value] of Object.entries(card.frame.values)) {
    if (name in values && value !== undefined) values[name] = value;
  }
  return { def, values };
}

/** Half-width kana, the plain ones: what an old program has for a name it cannot write out. */
const KANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ';
const sign = (text: string): string => KANA[hash(text) % KANA.length];

/**
 * The name the program gives the file in the title of its window: the number of the figure,
 * four signs and a byte. It is made up, but not at random: the signs stand for the place, the
 * things in it, how heavy it is and the seed, so the same picture always comes under the same name.
 */
export function cardTitle(card: SignalCard): string {
  const { recipe } = card.frame;
  const word =
    sign(`place ${recipe.place}`) + sign(`things ${recipe.things.join()} ${card.frame.variant}`) + sign(`mood ${moodFor(card.contact)}`) + sign(`seed ${card.seed}`);
  const byte = (card.seed & 0xff).toString(16).toUpperCase().padStart(2, '0');
  return `図${String(card.figure).padStart(4, '0')} ${word}:${byte}`;
}
