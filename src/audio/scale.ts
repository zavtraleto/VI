/**
 * The one tuning of the whole game. Every sound that has a pitch takes its note from one mode,
 * so whatever sounds together sounds in accord. Pure numbers: nothing here makes a sound.
 */

/** A mode: the semitones of its degrees over the root, within one octave. */
export const MODES = {
  /** The Japanese in (miyako-bushi): two semitones in it, beautiful and uneasy at once. */
  in: [0, 1, 5, 7, 8],
  hirajoshi: [0, 2, 3, 7, 8],
  pentatonic: [0, 3, 5, 7, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
} as const satisfies Record<string, readonly number[]>;

export type ModeName = keyof typeof MODES;
export const MODE_NAMES = Object.keys(MODES) as ModeName[];

/** The twelve notes a root can be, by name. */
export const ROOT_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * A mode on a root: the root is a MIDI note, 69 is the A of 440 Hz. `fine` is how far the whole
 * of it stands off concert pitch, in hundredths of a semitone.
 */
export interface Tuning {
  steps: readonly number[];
  root: number;
  fine: number;
}

/**
 * The other side is out of tune with the program by this much: the septimal comma, 64 to 63,
 * a little over a quarter of a semitone. Six doublings against seven times nine: what is left
 * over between the six and the seven.
 */
export const COMMA = 64 / 63;

/** The tuning for the names a panel holds. A name that is not known gives the in on A. */
export function tuning(mode: string, root: string, octave: number, fine = 0): Tuning {
  const steps = (MODES as Record<string, readonly number[]>)[mode] ?? MODES.in;
  const index = (ROOT_NAMES as readonly string[]).indexOf(root);
  return { steps, root: 12 * (Math.round(octave) + 1) + (index === -1 ? 9 : index), fine: Number.isFinite(fine) ? fine : 0 };
}

/** Semitones of a degree over the root. Degrees go on through the octaves: up, and below 0 down. */
export function semitones(steps: readonly number[], degree: number): number {
  const whole = Math.round(degree);
  const octave = Math.floor(whole / steps.length);
  return steps[whole - octave * steps.length] + 12 * octave;
}

/**
 * The degree of a face. Six faces are six notes: the first five degrees of the mode one after
 * another, and the six is the note of the one an octave up. The one and the six are one note.
 */
export function faceDegree(steps: readonly number[], face: number): number {
  const value = Math.max(1, Math.min(6, Math.round(face)));
  return value === 6 ? steps.length : value - 1;
}

/** The ladder of a chain: the note of the face for the group that starts it, a degree up for every link. */
export function chainDegree(steps: readonly number[], face: number, chain: number): number {
  return faceDegree(steps, face) + Math.max(0, Math.round(chain) - 1);
}

export function hertz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The frequency of a degree, `octaves` above the octave of the root. */
export function degreeHz(tune: Tuning, degree: number, octaves = 0): number {
  return hertz(tune.root + semitones(tune.steps, degree) + 12 * octaves + tune.fine / 100);
}

/** A degree brought down by whole octaves until it is no more than `top` semitones over the root: the same note, lower. */
export function foldUnder(steps: readonly number[], degree: number, top: number): number {
  let folded = Math.round(degree);
  while (semitones(steps, folded) > top) folded -= steps.length;
  return folded;
}
