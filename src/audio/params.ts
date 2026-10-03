import type { ParamSpec, ParamValues } from '../signal/scene';
import { MODE_NAMES, ROOT_NAMES } from './scale';

const number = (value: number, min: number, max: number, step: number): ParamSpec => ({ kind: 'number', value, min, max, step });
const choice = (value: string, options: readonly string[]): ParamSpec => ({ kind: 'choice', value, options: [...options] });

/**
 * Every parameter of the sound, by the folder it stands in on the lab's panel. Like the
 * picture, the sound is put together from these: nothing of it is a file.
 */
export const SOUND_GROUPS = {
  tuning: {
    /** The mode every note is taken from, and the note and the octave it stands on. */
    mode: choice('in', MODE_NAMES),
    root: choice('B', ROOT_NAMES),
    octave: number(3, 2, 5, 1),
    /**
     * Cents the whole tuning stands off concert pitch. The program is tuned from the line-up
     * tone of the test card its colours come from: with these the octaves of the root fall on
     * 250, 500 and 1000 Hz, and the six of the bells is the 1 kHz tone itself.
     */
    fine: number(21.3, -50, 50, 0.1),
    /** How far a note may slip out of tune at full contact, in cents. With no contact nothing slips. */
    drift: number(14, 0, 50, 1),
  },
  volume: {
    volMaster: number(0.8, 0, 1, 0.01),
    /** Knocks and lows of the board: a roll, a step, a push, a die landing. */
    volBoard: number(1, 0, 2, 0.01),
    /** Bells: a group sent, a chain. */
    volBell: number(1, 0, 2, 0.01),
    /** The dry voice of the program. */
    volProgram: number(1, 0, 2, 0.01),
    /** The soft voice of the other side. */
    volOther: number(1, 0, 2, 0.01),
  },
  space: {
    /** The one echo all voices share: how long it rings, in seconds, and how much of it comes back. */
    verbTail: number(3.4, 0.4, 6, 0.1),
    verbLevel: number(0.55, 0, 1.5, 0.01),
    /** How much more of the echo there is at full contact than at none: the border grows thin, and what is behind it is heard. */
    verbContact: number(0.6, 0, 1.5, 0.01),
    /** How far apart across the picture sounds are placed: 0 is all in the middle. */
    stereo: number(0.7, 0, 1, 0.01),
  },
  bell: {
    /** Octaves between the root and the bell on the note of the one. */
    bellOctave: number(1, 0, 2, 1),
    /** The modulator against the carrier: seven to two. A ratio that is not whole is what makes it a bell. */
    bellRatio: number(3.5, 1, 8, 0.01),
    /** How bright the strike is: the depth of the modulation. */
    bellBright: number(1.5, 0, 8, 0.05),
    /** How long a bell rings, in seconds. */
    bellTail: number(2.4, 0.2, 5, 0.05),
    /** A second carrier this many cents off: the tone beats slowly, as if something were a little wrong with it. */
    bellDetune: number(4, 0, 30, 0.5),
    /** How much of the octave under the note there is in it: the body of the bell. */
    bellBody: number(0.16, 0, 0.6, 0.01),
    /** The share of the echo a bell takes. */
    bellVerb: number(0.45, 0, 1, 0.01),
    /** Seconds between the notes of a group. */
    arpGap: number(0.075, 0.03, 0.2, 0.005),
    /** How much brighter and longer every link of a chain is than the one before. */
    chainGrow: number(0.2, 0, 0.6, 0.01),
  },
  knock: {
    /** Octaves between the root and the knock on the note of the one. */
    knockOctave: number(1, -1, 2, 1),
    /** How long a knock is, in seconds, and how much of it is the click of its attack. */
    knockLen: number(0.17, 0.03, 0.4, 0.005),
    knockClick: number(0.3, 0, 1, 0.01),
    /** How much of its upper tone there is in it: the wood of the table. */
    knockWood: number(0.28, 0, 1, 0.01),
    knockVerb: number(0.16, 0, 1, 0.01),
    /** How loud a roll is against the rest of the board. */
    rollGain: number(1, 0, 2, 0.01),
  },
  low: {
    /** The low under large events: how loud, how long, and how far above its note it starts. */
    lowGain: number(0.6, 0, 1, 0.01),
    lowLen: number(0.22, 0.05, 0.8, 0.01),
    lowDrop: number(2.4, 1, 5, 0.05),
  },
  program: {
    /** Octaves between the root and the click of the program, and how long the click is. */
    clickOctave: number(3, 1, 4, 1),
    clickLen: number(0.03, 0.01, 0.12, 0.005),
  },
  other: {
    /** The voice of the other side: how slowly it comes, how long it stays, how much echo it takes. */
    otherAttack: number(0.5, 0.02, 1.5, 0.01),
    otherTail: number(3.4, 0.5, 8, 0.1),
    otherVerb: number(0.85, 0, 1, 0.01),
    otherDetune: number(6, 0, 30, 0.5),
    /** The answer: how often, at full contact, what the player has played comes back, and how loud. */
    replyChance: number(0.5, 0, 1, 0.01),
    replyGain: number(0.6, 0, 2, 0.01),
    /** The contact below which nothing answers. */
    replyFrom: number(0.25, 0, 1, 0.01),
  },
  limits: {
    /** The most voices that sound at once: the oldest are taken off quietly. */
    maxVoices: number(24, 8, 48, 1),
  },
} satisfies Record<string, Record<string, ParamSpec>>;

export const SOUND_PARAMS: Record<string, ParamSpec> = Object.assign({}, ...Object.values(SOUND_GROUPS));

export function soundDefaults(): ParamValues {
  const values: ParamValues = {};
  for (const [name, spec] of Object.entries(SOUND_PARAMS)) values[name] = spec.value;
  return values;
}

/** Only the values that differ from the defaults: what is worth writing down. */
export function soundChanged(values: ParamValues): ParamValues {
  const changed: ParamValues = {};
  for (const [name, spec] of Object.entries(SOUND_PARAMS)) {
    const value = values[name];
    if (value !== undefined && value !== spec.value) changed[name] = value;
  }
  return changed;
}

/** A number of the sound by its name; the default stands in for one that is missing or not a number. */
export function soundNumber(values: ParamValues, name: string): number {
  const value = Number(values[name]);
  if (Number.isFinite(value)) return value;
  const spec = SOUND_PARAMS[name];
  return spec?.kind === 'number' ? spec.value : 0;
}
