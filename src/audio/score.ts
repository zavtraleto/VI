import type { Beat } from '../app/juice';
import { CONTACT_STEPS } from '../app/ritual';
import { cubeAt, getCube, type GameEvent, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import { soundNumber } from './params';
import { COMMA, chainDegree, degreeHz, faceDegree, foldUnder, tuning, type Tuning } from './scale';
import { cents, spread, type Rand, type Variety } from './variation';

/**
 * What is played, and when. Something happens in a session - the rules say so, or a beat, or
 * the readings - and this turns it into a handful of notes: which voice, which pitch, how loud,
 * where across the picture, how long. Numbers only: the voices make the sound of them.
 *
 * Between the notes there is nothing. No sound here goes on by itself: whatever lasts is the
 * tail of a note that has been played.
 */

/** The voices there are: a bell, a knock, the dry click of the program, a low, the soft voice of the other side. */
export type VoiceKind = 'bell' | 'knock' | 'click' | 'low' | 'other';

/** One note for a voice to play. Times are in seconds, from the moment of what it answers. */
export interface Note {
  voice: VoiceKind;
  /** What it is within its sound: the lab and the tests read it, the voices do not. */
  part: string;
  hz: number;
  at: number;
  /** Its loudest, 0 to 1. */
  gain: number;
  /** Across the picture: -1 is the left edge, 1 the right. */
  pan: number;
  attack: number;
  /** How long it takes to die away after its attack. */
  decay: number;
  /** How much colour its strike has: the depth of modulation of a bell or a click, the share of click in a knock. */
  bright: number;
  /** Which of its attacks a knock has. */
  variant: number;
  /** Muffled: its upper part is cut. */
  dull: boolean;
  /** A low starts this many times above its note and falls to it in `fall` seconds. */
  drop: number;
  fall: number;
  /** Its share of the echo, against the share its voice has. */
  echo: number;
  /** How far apart the two halves of a bell stand, 0 to 1: a wide bell is on both sides at once. */
  wide: number;
}

/** Something to be heard, in the terms of the sound. `pan` is where on the board it is, -1 to 1. */
export type Cue =
  | { kind: 'roll'; face: number; crowd: number; pan: number }
  | { kind: 'step'; pan: number }
  | { kind: 'push'; pan: number }
  | { kind: 'fell'; pan: number }
  | { kind: 'landed'; crowd: number; pan: number }
  | { kind: 'blocked'; pan: number }
  | { kind: 'warned'; cell: number; pan: number }
  | { kind: 'risen'; face: number; pan: number }
  | { kind: 'group'; face: number; count: number; tier: number; pan: number }
  | { kind: 'chain'; face: number; chain: number; count: number; tier: number; pan: number }
  | { kind: 'chainEnd'; face: number; chain: number }
  | { kind: 'ones'; count: number; pan: number }
  | { kind: 'sunk'; face: number; pan: number }
  | { kind: 'points'; points: number; tier: number }
  | { kind: 'count' }
  | { kind: 'level' }
  | { kind: 'contact'; stage: number }
  | { kind: 'peak' }
  | { kind: 'danger'; secondsLeft: number }
  | { kind: 'clock' }
  | { kind: 'begin' }
  | { kind: 'deadEnd' }
  | { kind: 'end' }
  | { kind: 'cleared'; faces: number[] }
  // What comes back from the other side: the notes the player has just played, as their frequencies.
  | { kind: 'reply'; heard: readonly number[] }
  // The interface of the program.
  | { kind: 'uiStep'; face: number | null }
  | { kind: 'uiStuck' }
  | { kind: 'uiRun' }
  | { kind: 'uiBack' }
  | { kind: 'uiOpen' }
  | { kind: 'uiClose' }
  | { kind: 'bootCheck' }
  | { kind: 'bootAnswer'; found: boolean }
  | { kind: 'logo' }
  // The result of a session goes up the log of sessions: a line is gone past, `along` the log
  // from its last line (0) to its top (1); a record of one of the six, or the player's own best,
  // is gone past; the place is taken.
  | { kind: 'rank'; along: number }
  | { kind: 'rankPast'; own: boolean; along: number }
  | { kind: 'rankSet'; along: number; record: boolean; moved: boolean }
  // A sign of the words of the other side, by its number among all signs.
  | { kind: 'sign'; code: number }
  // A sign of the words the program prints for the laboratory: the instruction a level opens with.
  | { kind: 'typed'; code: number }
  // The window of a transmission: the picture is filed under `figure` and stays for `seconds`.
  | { kind: 'window'; figure: number; seconds: number; glimpse: boolean }
  | { kind: 'windowShut' };

/** What a cue is turned into notes with: the values of the panel, the contact, and the sound's own chance. */
export interface Setup {
  values: ParamValues;
  /** How far the contact has gone, 0 to 1. */
  contact: number;
  rand: Rand;
  variety: Variety;
}

/** The most notes in the run of a group, and the most voices in the chord of a chain. */
export const ARP_MOST = 9;
export const CHORD_MOST = 5;
/** The attacks a knock has. */
export const KNOCK_VARIANTS = 4;
/** The ladder of a chain stops rising past this link. */
const CHAIN_TOP = 10;
/** No bell is higher than this many semitones over the root: a note above it comes down an octave. A glint may go higher. */
const CEILING = 39;
const GLINT_CEILING = 51;
/** The first note of a link is its rung of the ladder: it is never brought down, so every link starts above the last. */
const LADDER_CEILING = 60;
/** The note that is held while the window of a transmission is open: what is taken off when it shuts. */
export const HELD = 'place';
/** The most notes of the player that come back at once. */
export const REPLY_MOST = 3;
/** The session ends: everything is cut off, and this long nothing sounds. */
const END_SILENCE = 0.9;
/** The most ones that are heard going one by one. */
const ONES_MOST = 12;

/**
 * The least time between two sounds of a kind, in seconds: a group of dice goes under on one
 * tick, the counter runs up every frame, and neither is played that many times.
 */
export const SPACING: Partial<Record<Cue['kind'], number>> = {
  count: 0.05,
  points: 0.04,
  sunk: 0.09,
  risen: 0.06,
  warned: 0.06,
  landed: 0.04,
  step: 0.03,
  contact: 0.25,
  uiStep: 0.045,
  rank: 0.03,
  sign: 0.07,
  reply: 1.4,
};

/** The sounds that begin with a cut: every tail is taken off before them. */
export const CUTS: readonly Cue['kind'][] = ['end'];

/** The sounds of the program and of what it shows: they are heard while a session waits, too. */
export const INTERFACE: readonly Cue['kind'][] = [
  'uiStep',
  'uiStuck',
  'uiRun',
  'uiBack',
  'uiOpen',
  'uiClose',
  'bootCheck',
  'bootAnswer',
  'logo',
  'rank',
  'rankPast',
  'rankSet',
  'sign',
  'typed',
  'window',
  'windowShut',
];

/** The clicks of the way up the log rise by this many octaves from its last line to its top. */
const RANK_OCTAVES = 2;

/** The board is looked at from a corner: this is how far it is turned, in degrees. */
const BOARD_TURN = 30;

/** Where a cell of the board is across the picture, -1 to 1. */
export function stereo(x: number, z: number, size: number): number {
  const mid = (size - 1) / 2;
  if (mid <= 0) return 0;
  const turn = (BOARD_TURN * Math.PI) / 180;
  const across = (x - mid) * Math.cos(turn) - (z - mid) * Math.sin(turn);
  return clamp(across / (mid * (Math.cos(turn) + Math.sin(turn))), -1, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The values of the panel, read once for a cue. */
interface Kit {
  tune: Tuning;
  /** Degrees in an octave of the mode. */
  octave: number;
  num(name: string): number;
  /** How far the contact has gone, 0 to 1. */
  contact: number;
  rand: Rand;
  variety: Variety;
  /** A ratio that takes a note a little out of tune: more of it the further the contact has gone. */
  drift(): number;
  /** The frequency of a bell on a degree: its own octave, and never above the ceiling. */
  bell(degree: number, ceiling?: number): number;
}

function kitOf(setup: Setup): Kit {
  const { values, rand, variety } = setup;
  const num = (name: string): number => soundNumber(values, name);
  const tune = tuning(String(values.mode), String(values.root), num('octave'), num('fine'));
  const octave = tune.steps.length;
  const slip = num('drift') * clamp(setup.contact, 0, 1);
  const drift = (): number => (slip > 0 ? cents(spread(slip, rand)) : 1);
  const bell = (degree: number, ceiling = CEILING): number => degreeHz(tune, foldUnder(tune.steps, degree + octave * num('bellOctave'), ceiling)) * drift();
  return { tune, octave, num, contact: clamp(setup.contact, 0, 1), rand, variety, drift, bell };
}

const BLANK = { at: 0, gain: 0.2, pan: 0, bright: 1, variant: 0, dull: false, drop: 1, fall: 0, echo: 1, wide: 0 };

function bell(part: string, hz: number, fields: Partial<Note>): Note {
  return { voice: 'bell', part, hz, ...BLANK, attack: 0.003, decay: 1, ...fields };
}

function knock(part: string, hz: number, fields: Partial<Note>): Note {
  return { voice: 'knock', part, hz, ...BLANK, attack: 0.002, decay: 0.09, ...fields };
}

function click(part: string, hz: number, fields: Partial<Note>): Note {
  return { voice: 'click', part, hz, ...BLANK, attack: 0.002, decay: 0.03, ...fields };
}

function low(part: string, hz: number, fields: Partial<Note>): Note {
  return { voice: 'low', part, hz, ...BLANK, attack: 0.004, decay: 0.2, ...fields };
}

function other(part: string, hz: number, fields: Partial<Note>): Note {
  return { voice: 'other', part, hz, ...BLANK, attack: 0.5, decay: 3, ...fields };
}

/** The ways the run of a group goes over the mode from the note it starts on, by the place of a note in it. */
const ORDERS: readonly ((i: number) => number)[] = [
  // Straight up the mode.
  (i) => i,
  // Up by every other degree: wider, nearer a chord.
  (i) => i * 2,
  // A dip under the first note, then up.
  (i) => (i === 0 ? 0 : i === 1 ? -1 : i - 1),
  // Two up, one back.
  (i) => (i % 2 === 0 ? i / 2 : (i + 3) / 2),
];

/** The ways its notes are spaced: evenly, hurrying, in pairs. Each gives the gap after a note against the usual one. */
const RHYTHMS: readonly ((i: number) => number)[] = [() => 1, (i) => 0.9 ** i, (i) => (i % 2 === 0 ? 0.62 : 1.38)];

/**
 * A group going: a bell on the note of its face, in a run of as many notes as it has dice, with
 * a short low under it. A link of a chain is the same a degree higher on the ladder, with a
 * chord that has one voice more for every link, and brighter, wider and longer with each. On
 * the strong beats there is a high glint over it.
 */
function gather(kit: Kit, face: number, count: number, chain: number, tier: number, pan: number): Note[] {
  const { num, rand, variety, octave, tune } = kit;
  const rung = clamp(Math.round(chain), 1, CHAIN_TOP);
  const base = chainDegree(tune.steps, face, rung);
  const grow = num('chainGrow') * (rung - 1);
  const size = clamp(Math.round(count), 1, ARP_MOST);
  // With two notes the last way is the same as the second: it is left out.
  const order = ORDERS[variety.pick('order', size <= 2 ? 3 : ORDERS.length, rand)];
  const rhythm = RHYTHMS[variety.pick('rhythm', RHYTHMS.length, rand)];
  // The run hurries a little with every link: the channel is open, and what goes through it gathers speed.
  const gap = num('arpGap') * (1 + spread(0.1, rand)) * Math.max(0.6, 1 - 0.05 * (rung - 1));
  const tail = num('bellTail') * (1 + grow);
  const reach = Math.min(1, 0.25 + 0.15 * (rung - 1));
  const apart = Math.min(0.85, 0.15 + 0.12 * (rung - 1));
  const strength = 1 + 0.07 * tier;
  const volume = num('volBell');

  const notes: Note[] = [];
  let at = 0;
  for (let i = 0; i < size; i++) {
    const along = size > 1 ? i / (size - 1) : 1;
    const side = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * (0.4 + 0.6 * along);
    notes.push(
      bell('arp', kit.bell(base + order(i), i === 0 ? LADDER_CEILING : CEILING), {
        at,
        // The last note of the run is the one that lands.
        gain: 0.2 * strength * (i === size - 1 ? 1.1 : 1 - 0.025 * i) * volume,
        pan: pan + reach * side,
        // The notes on the way die sooner; the one the run lands on is left to ring.
        decay: tail * (0.5 + 0.5 * along ** 2),
        bright: 1 + grow,
        echo: 1 + grow,
        wide: apart,
      }),
    );
    at += gap * rhythm(i);
  }

  if (rung >= 2) {
    // The octave under, then every other degree up: a voice more with every link.
    const chord = [-octave, 2, 4, octave, octave + 2];
    const voices = Math.min(rung, CHORD_MOST);
    for (let j = 0; j < voices; j++) {
      notes.push(
        bell('chord', kit.bell(base + chord[j]), {
          // Not struck all at once: the hand goes over them, as over strings.
          at: j * 0.012,
          gain: 0.085 * strength * volume,
          pan: pan + reach * (j % 2 === 0 ? -0.8 : 0.8),
          decay: tail * 1.35,
          bright: 0.55 * (1 + grow),
          echo: 1.4 + grow,
          wide: Math.min(1, apart + 0.2),
        }),
      );
    }
  }

  notes.push(
    low('low', degreeHz(tune, faceDegree(tune.steps, face) % octave, -1), {
      gain: num('lowGain') * (0.42 + 0.13 * tier) * volume,
      pan: pan * 0.3,
      decay: num('lowLen') * (1 + 0.3 * tier),
      drop: num('lowDrop'),
      fall: 0.05 + 0.01 * tier,
    }),
  );

  if (tier >= 3) {
    notes.push(bell('glint', kit.bell(base + 2 * octave, GLINT_CEILING), { at: at + gap, gain: 0.06 * volume, pan: -pan, decay: tail * 0.4, bright: 1.6 + grow, echo: 1.8, wide: 0.6 }));
    if (tier >= 4) {
      notes.push(bell('glint', kit.bell(base + 2 * octave + 2, GLINT_CEILING), { at: at + gap * 2.2, gain: 0.048 * volume, pan, decay: tail * 0.4, bright: 1.6 + grow, echo: 1.8, wide: 0.6 }));
    }
  }
  return notes;
}

/** The click of a place of the log: from two octaves under the highest click of the program at the last line, up to it at the top. */
function rankHz(kit: Kit, along: number): number {
  const { tune, octave, num } = kit;
  return degreeHz(tune, Math.round(clamp(along, 0, 1) * RANK_OCTAVES * octave), num('clickOctave') - RANK_OCTAVES);
}

/** How loud a die comes down: the more dice stand around it, the harder. */
function weight(kit: Kit, crowd: number): number {
  return kit.num('lowGain') * (0.22 + 0.33 * clamp(crowd, 0, 1)) * (1 + spread(0.08, kit.rand));
}

function play(cue: Cue, kit: Kit): Note[] {
  const { num, rand, variety, octave, tune } = kit;
  const { steps } = tune;
  const board = num('volBoard');
  const program = num('volProgram');
  const far = num('volOther');
  const bells = num('volBell');
  const clickOctave = num('clickOctave');
  const knockOctave = num('knockOctave');

  switch (cue.kind) {
    case 'roll':
      // The die has come down: a knock on the note of the face that lies up, and its weight
      // under it. The player plays the board as they go.
      return [
        knock('roll', degreeHz(tune, faceDegree(steps, cue.face), knockOctave) * cents(spread(7, rand)) * kit.drift(), {
          gain: 0.38 * num('rollGain') * (1 + spread(0.12, rand)) * board,
          pan: cue.pan,
          decay: num('knockLen') * (1 + spread(0.2, rand)),
          variant: variety.pick('roll', KNOCK_VARIANTS, rand),
          bright: num('knockClick') * (1 + spread(0.2, rand)),
        }),
        low('weight', degreeHz(tune, 0, -1) * cents(spread(35, rand)), {
          gain: 0.55 * weight(kit, cue.crowd) * board,
          pan: cue.pan * 0.3,
          decay: num('lowLen') * (0.7 + spread(0.1, rand)),
          drop: num('lowDrop'),
          fall: 0.04,
        }),
      ];
    case 'step':
      // A light tap with no note to it: nearly all of it is the click.
      return [
        knock('step', 950 * cents(spread(250, rand)), {
          gain: 0.22 * (1 + spread(0.15, rand)) * board,
          pan: cue.pan,
          decay: 0.028,
          variant: variety.pick('step', KNOCK_VARIANTS, rand),
          bright: 1,
        }),
      ];
    case 'push':
      return [
        knock('push', degreeHz(tune, 0, knockOctave - 1) * cents(spread(40, rand)), {
          gain: 0.34 * (1 + spread(0.1, rand)) * board,
          pan: cue.pan,
          decay: num('knockLen') * 1.7,
          variant: variety.pick('push', KNOCK_VARIANTS, rand),
          bright: 0.6,
          dull: true,
        }),
      ];
    case 'fell':
      return [
        knock('fell', degreeHz(tune, -2, knockOctave - 1) * cents(spread(40, rand)), {
          gain: 0.22 * board,
          pan: cue.pan,
          decay: num('knockLen') * 1.4,
          variant: variety.pick('push', KNOCK_VARIANTS, rand),
          bright: 0.5,
          dull: true,
        }),
      ];
    case 'landed':
      // The more dice stand around, the harder it comes down.
      return [
        low('landed', degreeHz(tune, 0, -1) * cents(spread(35, rand)), {
          gain: weight(kit, cue.crowd) * board,
          pan: cue.pan * 0.3,
          decay: num('lowLen') * (0.8 + spread(0.1, rand)),
          drop: num('lowDrop'),
          fall: 0.045,
        }),
      ];
    case 'blocked':
      return [click('blocked', degreeHz(tune, 0, 0), { gain: 0.2 * program, pan: cue.pan * 0.5, decay: 0.07, dull: true })];
    case 'warned':
      return [click('warned', degreeHz(tune, Math.round(clamp(cue.cell, 0, 1) * 7), clickOctave - 1), { gain: 0.14 * program, pan: cue.pan, decay: num('clickLen') })];
    case 'risen':
      return [bell('risen', kit.bell(faceDegree(steps, cue.face)), { gain: 0.045 * bells, pan: cue.pan, decay: num('bellTail') * 0.45, bright: 0.5, echo: 1.2 })];
    case 'group':
      return gather(kit, cue.face, cue.count, 1, cue.tier, cue.pan);
    case 'chain':
      return gather(kit, cue.face, cue.count, Math.max(2, cue.chain), cue.tier, cue.pan);
    case 'chainEnd': {
      // The channel closes. What the chain has climbed comes back down its ladder, quietly, to
      // the note it began on, and that one is left to die away: longer for a longer chain.
      const rung = clamp(Math.round(cue.chain), 1, CHAIN_TOP);
      const notes: Note[] = [];
      const first = Math.max(1, rung - CHORD_MOST + 2);
      const down: number[] = [];
      for (let link = rung; link >= first; link--) down.push(link);
      if (first > 1) down.push(1);
      const tail = Math.min(7, num('bellTail') * (1 + 0.3 * rung));
      down.forEach((link, i) => {
        const home = i === down.length - 1;
        notes.push(
          bell('ring', kit.bell(chainDegree(steps, cue.face, link)), {
            at: i * 0.11 * (1 + 0.12 * i),
            gain: (home ? 0.075 : 0.05) * bells,
            pan: home ? 0 : i % 2 === 0 ? -0.5 : 0.5,
            decay: home ? tail : tail * 0.6,
            bright: 0.4,
            echo: 1.8,
            wide: 0.5,
          }),
        );
      });
      return notes;
    }
    case 'ones': {
      // One note in several octaves, one after another: as many as there were ones. They go to
      // the other side, each with its echo. Then the same note once more, low, close and with
      // no echo at all: the one that has stayed.
      const notes: Note[] = [];
      const count = clamp(Math.round(cue.count), 1, ONES_MOST);
      let at = 0;
      for (let i = 0; i < count; i++) {
        notes.push(
          bell('one', kit.bell(faceDegree(steps, 1) + octave * ((i % 4) - 1)), {
            at,
            gain: 0.17 * bells,
            pan: cue.pan + (i % 2 === 0 ? -0.35 : 0.35),
            decay: num('bellTail') * 0.9,
            bright: 0.8,
            echo: 1.5,
            wide: 0.4,
          }),
        );
        at += 0.085 * (1 + spread(0.08, rand));
      }
      notes.push(bell('stays', kit.bell(faceDegree(steps, 1)), { at: at + 0.34, gain: 0.15 * bells, decay: num('bellTail') * 0.7, bright: 0.35, echo: 0 }));
      return notes;
    }
    case 'sunk':
      // The note of its face, falling an octave as it goes under.
      return [low('sunk', degreeHz(tune, faceDegree(steps, cue.face) % octave, -1), { gain: 0.2 * num('lowGain') * board, pan: cue.pan * 0.3, decay: 0.32, drop: 2, fall: 0.32 })];
    case 'points':
      // The program counts: the more points, the higher its note.
      return [
        click('points', degreeHz(tune, clamp(Math.floor(Math.log2(Math.max(1, cue.points))), 0, 11), clickOctave - 2), {
          gain: (0.2 + 0.02 * clamp(cue.tier, 0, 4)) * program,
          decay: 0.11,
          bright: 1.6,
        }),
      ];
    case 'count':
      return [click('count', degreeHz(tune, [0, 3][variety.pick('count', 2, rand)], clickOctave), { gain: 0.045 * program, decay: 0.012, bright: 0.6 })];
    case 'level':
      return [
        click('level', degreeHz(tune, 0, clickOctave - 1), { gain: 0.2 * program, decay: 0.09 }),
        click('level', degreeHz(tune, 2, clickOctave - 1), { at: 0.1, gain: 0.2 * program, decay: 0.09 }),
      ];
    case 'contact':
      // One long note in the voice of the other side: a degree higher at every step.
      return [
        other('contact', (degreeHz(tune, clamp(Math.round(cue.stage), 0, 2 * CONTACT_STEPS.length), -1) / COMMA) * kit.drift(), {
          gain: 0.26 * far,
          pan: spread(0.3, rand),
          attack: num('otherAttack'),
          decay: num('otherTail'),
          // The first steps are low: the octave over the note carries them on a small speaker.
          bright: 2,
        }),
      ];
    case 'peak':
      return [
        other('peak', (degreeHz(tune, 0, -1) / COMMA) * kit.drift(), { gain: 0.16 * far, attack: num('otherAttack'), decay: num('otherTail') * 1.3, bright: 2 }),
        other('peak', (degreeHz(tune, 1, 2) / COMMA) * kit.drift(), { at: 0.15, gain: 0.07 * far, attack: num('otherAttack') * 1.5, decay: num('otherTail') * 1.3, bright: 0 }),
      ];
    case 'danger': {
      // One low beat for a second of the countdown. The last ones are a little higher.
      const degree = cue.secondsLeft <= 1 ? 2 : cue.secondsLeft <= 3 ? 1 : 0;
      return [low('danger', degreeHz(tune, degree, -1), { gain: num('lowGain') * 0.75 * board, decay: num('lowLen') * 1.3, drop: num('lowDrop'), fall: 0.05 })];
    }
    case 'clock':
      return [click('clock', degreeHz(tune, 0, clickOctave), { gain: 0.18 * program, decay: num('clickLen') * 1.3 })];
    case 'begin':
      // The one, and the six over it: the same note.
      return [
        bell('begin', kit.bell(0), { gain: 0.13 * bells, pan: -0.3, decay: num('bellTail'), bright: 0.7 }),
        bell('begin', kit.bell(octave), { at: 0.16, gain: 0.13 * bells, pan: 0.3, decay: num('bellTail'), bright: 0.7 }),
      ];
    case 'deadEnd':
      return [
        click('deadEnd', degreeHz(tune, 1, 0), { gain: 0.2 * program, decay: 0.09, dull: true }),
        click('deadEnd', degreeHz(tune, 0, 0), { at: 0.13, gain: 0.2 * program, decay: 0.09, dull: true }),
      ];
    case 'end': {
      // After the cut and the silence: a low note, and the semitone over it. Each has its octave
      // with it, quietly, so that a small speaker carries them.
      const root = degreeHz(tune, 0, -1);
      const over = root * 2 ** (1 / 12);
      const tail = num('otherTail') * 1.2;
      return [
        other('last', root, { at: END_SILENCE, gain: 0.17 * far, attack: 0.08, decay: tail }),
        other('body', root * 2, { at: END_SILENCE, gain: 0.06 * far, attack: 0.08, decay: tail }),
        other('over', over, { at: END_SILENCE + 0.7, gain: 0.14 * far, attack: 0.2, decay: tail }),
        other('body', over * 2, { at: END_SILENCE + 0.7, gain: 0.05 * far, attack: 0.2, decay: tail }),
      ];
    }
    case 'cleared': {
      // The faces the task was solved with, together: its own chord.
      const faces = [...new Set(cue.faces.map((face) => clamp(Math.round(face), 1, 6)))].sort((a, b) => a - b);
      const used = faces.length > 0 ? faces : [1, 4];
      const notes = used.map((face, i) =>
        bell('face', kit.bell(faceDegree(steps, face)), { at: i * 0.05, gain: 0.15 * bells, pan: i % 2 === 0 ? -0.4 : 0.4, decay: num('bellTail') * 1.5, bright: 0.9, echo: 1.4 }),
      );
      notes.push(bell('top', kit.bell(faceDegree(steps, used[0]) + octave), { at: used.length * 0.05, gain: 0.1 * bells, decay: num('bellTail') * 1.5, bright: 1.2, echo: 1.6 }));
      return notes;
    }
    case 'reply': {
      // What the player has just played comes back: later, softly, from far off - and not quite
      // in tune, a comma under. At first one note; further in, the last few of them, as they
      // were played: over there they are learning to repeat it.
      const heard = cue.heard.slice(-REPLY_MOST);
      const wait = 0.5 + rand() * 0.9;
      const level = num('replyGain') * (0.06 + 0.1 * clamp(kit.contact, 0, 1)) * far;
      return heard.map((hz, i) =>
        other('reply', (hz / COMMA) * kit.drift(), {
          at: wait + i * 0.24,
          gain: level * (i === heard.length - 1 ? 1 : 0.8),
          pan: spread(0.6, rand),
          attack: 0.16,
          decay: num('otherTail') * 0.7,
          bright: 0.5,
        }),
      );
    }
    case 'uiStep':
      // A die of the menu is stepped onto: the note of its face, on glass. The menu is an instrument.
      if (cue.face !== null) {
        const face = clamp(Math.round(cue.face), 1, 6);
        return [bell('menu', kit.bell(faceDegree(steps, face)), { gain: 0.16 * bells, pan: ((face - 3.5) / 2.5) * 0.4, decay: num('bellTail') * 0.55, bright: 0.7, echo: 0.9, wide: 0.25 })];
      }
      return [click('step', degreeHz(tune, [0, 2][variety.pick('uiStep', 2, rand)], clickOctave), { gain: 0.07 * program, decay: 0.014, bright: 0.6 })];
    case 'uiStuck':
      return [click('stuck', degreeHz(tune, 0, 0), { gain: 0.18 * program, decay: 0.07, dull: true })];
    case 'uiRun':
      // Two notes up: the root, and the fifth over it.
      return [
        click('run', degreeHz(tune, 0, clickOctave - 1), { gain: 0.17 * program, decay: 0.06 }),
        click('run', degreeHz(tune, 3, clickOctave - 1), { at: 0.085, gain: 0.17 * program, decay: 0.09 }),
      ];
    case 'uiBack':
      return [
        click('back', degreeHz(tune, 3, clickOctave - 1), { gain: 0.15 * program, decay: 0.06 }),
        click('back', degreeHz(tune, 0, clickOctave - 1), { at: 0.085, gain: 0.15 * program, decay: 0.09 }),
      ];
    case 'uiOpen':
      return [click('open', degreeHz(tune, 3, clickOctave), { gain: 0.11 * program, decay: num('clickLen') })];
    case 'uiClose':
      return [click('close', degreeHz(tune, 0, clickOctave), { gain: 0.1 * program, decay: num('clickLen') * 0.8 })];
    case 'bootCheck':
      // A line of the check is written: the tone the program is tuned from, for an instant.
      return [click('check', degreeHz(tune, 0, clickOctave - 1), { gain: 0.1 * program, decay: 0.014, bright: 0.6 })];
    case 'bootAnswer':
      if (cue.found) return [click('answer', degreeHz(tune, 3, clickOctave - 1), { gain: 0.11 * program, decay: num('clickLen') })];
      // The device is not there: the semitone of the mode, downwards and dull.
      return [
        click('absent', degreeHz(tune, 1, 0), { gain: 0.2 * program, decay: 0.09, dull: true }),
        click('absent', degreeHz(tune, 0, 0), { at: 0.13, gain: 0.2 * program, decay: 0.12, dull: true }),
      ];
    case 'logo': {
      // The six faces one after another, as a hand goes over six strings: the name of the program as a chord.
      const notes = [1, 2, 3, 4, 5, 6].map((face, i) =>
        bell('logo', kit.bell(faceDegree(steps, face)), {
          at: i * 0.05 * (1 + 0.06 * i),
          gain: (face === 6 ? 0.12 : 0.095) * bells,
          pan: (i % 2 === 0 ? -1 : 1) * (0.15 + 0.1 * i),
          decay: num('bellTail') * 1.5,
          bright: 0.85,
          echo: 1.5,
          wide: 0.5,
        }),
      );
      notes.push(low('low', degreeHz(tune, 0, -1), { gain: num('lowGain') * 0.3 * bells, decay: num('lowLen') * 1.4, drop: num('lowDrop'), fall: 0.06 }));
      return notes;
    }
    case 'rank':
      // A line of the log is gone past: the program counts it with its click, and the higher
      // the session stands in the log, the higher the click.
      return [
        click('rank', rankHz(kit, cue.along), {
          gain: 0.1 * program,
          pan: (variety.pick('rank', 2, rand) === 0 ? -1 : 1) * 0.2,
          decay: 0.02,
          bright: 0.9,
        }),
      ];
    case 'rankPast':
      // The player's own best is gone past: the one and the six over it, the same note, as when
      // a session begins. A record of one of the six: the click, and with it one note in the
      // voice of the other side, a comma under.
      if (cue.own) {
        return [
          click('rank', rankHz(kit, cue.along), { gain: 0.1 * program, decay: 0.02, bright: 0.9 }),
          bell('own', kit.bell(0), { gain: 0.14 * bells, pan: -0.25, decay: num('bellTail') * 0.8, bright: 0.9 }),
          bell('own', kit.bell(octave), { at: 0.09, gain: 0.14 * bells, pan: 0.25, decay: num('bellTail') * 0.8, bright: 0.9 }),
        ];
      }
      return [
        click('rank', rankHz(kit, cue.along), { gain: 0.1 * program, decay: 0.02, bright: 0.9 }),
        other('six', (degreeHz(tune, 0, 0) / COMMA) * kit.drift(), { gain: 0.13 * far, pan: spread(0.4, rand), attack: 0.015, decay: 1.6, bright: 1.2, echo: 1.4 }),
      ];
    case 'rankSet': {
      // The place is taken. Where no line was gone past, the dull click of a step that leads
      // nowhere. Else a low under the last click, and a bell on the root; above the best there
      // was, the bell is a hand over the open notes of the mode, upwards, with a glint over it.
      if (!cue.moved) return [click('set', degreeHz(tune, 0, 0), { gain: 0.16 * program, decay: 0.07, dull: true })];
      const tail = num('bellTail');
      const notes: Note[] = [
        low('set', degreeHz(tune, 0, -1), { gain: num('lowGain') * 0.6 * program, decay: num('lowLen') * 1.4, drop: num('lowDrop'), fall: 0.05 }),
        click('set', rankHz(kit, cue.along), { gain: 0.17 * program, decay: 0.09 }),
      ];
      if (!cue.record) {
        notes.push(bell('set', kit.bell(0), { gain: 0.1 * bells, decay: tail * 0.7, bright: 0.6, echo: 1.2 }));
        return notes;
      }
      const hand = [0, 2, 3, octave, octave + 2];
      hand.forEach((degree, i) => {
        const last = i === hand.length - 1;
        notes.push(
          bell('record', kit.bell(degree), {
            at: i * 0.055,
            gain: (last ? 0.15 : 0.11) * bells,
            pan: (i % 2 === 0 ? -1 : 1) * (0.2 + 0.1 * i),
            decay: tail * (last ? 1.6 : 1),
            bright: 1,
            echo: 1.5,
            wide: 0.5,
          }),
        );
      });
      notes.push(bell('glint', kit.bell(2 * octave, GLINT_CEILING), { at: hand.length * 0.055 + 0.12, gain: 0.06 * bells, decay: tail * 0.5, bright: 1.6, echo: 1.8, wide: 0.6 }));
      return notes;
    }
    case 'sign': {
      // The other side writes: every sign has its note, so the same word is the same melody.
      // The pitch is uneven, and a comma under the program's.
      const degree = ((Math.round(cue.code) % (2 * octave)) + 2 * octave) % (2 * octave);
      return [
        other('sign', (degreeHz(tune, degree, 1) / COMMA) * cents(spread(12, rand)), {
          gain: 0.07 * far,
          pan: spread(0.35, rand),
          attack: 0.012,
          decay: 0.42 * (1 + spread(0.2, rand)),
          bright: 0.4,
          echo: 0.9,
        }),
      ];
    }
    case 'typed': {
      // The laboratory's instruction is a record the program prints: its own click, a sign at a
      // time, dry and with no tail. The click is on one of three notes of the mode, by the sign,
      // so that the same words click the same way and no line of them is one note.
      const degree = [0, 2, 3][((Math.round(cue.code) % 3) + 3) % 3];
      return [click('typed', degreeHz(tune, degree, clickOctave - 1), { gain: 0.045 * program, decay: 0.012, bright: 0.6, echo: 0 })];
    }
    case 'window': {
      // The program opens what it has received, with its own click. While the window stands
      // open one long quiet note is held: the note of the place. A glimpse is that note alone,
      // and it is cut off with the frame.
      const seconds = clamp(cue.seconds, 0.5, 10);
      const hz = degreeHz(tune, ((Math.round(cue.figure) % octave) + octave) % octave, 0) / COMMA;
      const opened = click('open', degreeHz(tune, 3, clickOctave), { gain: 0.11 * program, decay: num('clickLen') });
      if (cue.glimpse) return [opened, other(HELD, hz, { at: 0.04, gain: 0.13 * far, attack: 0.3, decay: seconds * 1.5, bright: 1.5 })];
      const attack = Math.min(1.6, seconds * 0.32);
      return [opened, other(HELD, hz, { at: 0.35, gain: 0.085 * far, attack, decay: Math.max(0.5, seconds - attack - 0.5), bright: 1.5 })];
    }
    case 'windowShut':
      return [click('close', degreeHz(tune, 0, clickOctave), { gain: 0.1 * program, decay: num('clickLen') * 0.8 })];
  }
}

/** The signs that are written without a sound: the spaces between words, and what is not a letter or a number. */
export function silentSign(sign: string): boolean {
  return !/[\p{L}\p{N}]/u.test(sign);
}

/**
 * How many notes of the player come back from the other side after a sound: none below the
 * contact it begins at, then more often the further the contact has gone. Deep in, it is
 * sometimes not one note but the last few. `often` is how readily this kind of sound is
 * answered, against the usual.
 */
export function replyCount(contact: number, values: ParamValues, rand: Rand, often = 1): number {
  const from = clamp(soundNumber(values, 'replyFrom'), 0, 0.99);
  const depth = (clamp(contact, 0, 1) - from) / (1 - from);
  if (depth <= 0) return 0;
  if (rand() >= soundNumber(values, 'replyChance') * depth * often) return 0;
  if (depth > 0.6 && rand() < 0.5) return rand() < 0.5 ? REPLY_MOST : 2;
  return 1;
}

/** The note of a sound that the other side may answer: the knock of a roll, the first bell of a group. */
export function leadNote(cue: Cue, notes: readonly Note[]): Note | null {
  if (cue.kind === 'roll') return notes.find((note) => note.part === 'roll') ?? null;
  if (cue.kind === 'group' || cue.kind === 'chain') return notes.find((note) => note.part === 'arp') ?? null;
  return null;
}

/** The notes of a cue. Sounds whose volume is turned to nothing are left out. */
export function notesFor(cue: Cue, setup: Setup): Note[] {
  const kit = kitOf(setup);
  const width = clamp(kit.num('stereo'), 0, 1);
  // The further the contact has gone, the thinner the border: there is more of the echo in everything.
  const space = 1 + kit.num('verbContact') * kit.contact;
  return play(cue, kit)
    .map((note) => ({
      ...note,
      hz: clamp(note.hz, 40, 6000),
      gain: Math.min(1, note.gain),
      pan: clamp(note.pan, -1, 1) * width,
      attack: Math.max(0.002, note.attack),
      decay: Math.max(0.01, note.decay),
      echo: note.echo * space,
      wide: clamp(note.wide, 0, 1) * width,
    }))
    .filter((note) => note.gain >= 0.0005);
}

/**
 * What the sound keeps of a run between its events: the chains that are open, the faces of the
 * dice that are going down, the faces sent so far. It is the sound's own: the rules never see it.
 */
export class ScoreMemory {
  /** Open chains by the id of their reaction: the face they go by and how many links they have. */
  readonly open = new Map<number, { face: number; chain: number }>();
  /** The face of every die that is going down, by its id. */
  readonly sinking = new Map<number, number>();
  /** The faces sent since the run began. */
  readonly sent = new Set<number>();
  /**
   * Dice that are on their way and have not come down yet, in the order they set off, each with
   * the tick it set off at: one the player rolls, with the face that will lie up, or one that
   * was pushed, with none.
   */
  readonly moving: { face: number | null; pan: number; tick: number }[] = [];

  reset(): void {
    this.open.clear();
    this.sinking.clear();
    this.sent.clear();
    this.moving.length = 0;
  }
}

/**
 * What the rules have just said, as sounds. A group and a link of a chain are left to their
 * beat: here they are only kept in mind, so that the dice can go under on their own note and
 * the chain can ring out when its last die has gone.
 */
export function cuesOfEvent(event: GameEvent, state: RunState, memory: ScoreMemory): Cue[] {
  const { size } = state.config;
  const { player } = state;
  const here = stereo(player.x, player.z, size);
  const alive = (id: number): boolean => state.reactions.some((reaction) => reaction.id === id);
  const going = (pick: (cube: RunState['cubes'][number]) => boolean, face: number): void => {
    for (const cube of state.cubes) if (cube.state === 'sinking' && pick(cube)) memory.sinking.set(cube.id, face);
  };

  const cues: Cue[] = [];
  if (event.type === 'chain') {
    // Chains taken into this one are no longer chains of their own: nothing is said of them.
    for (const id of [...memory.open.keys()]) if (!alive(id)) memory.open.delete(id);
  }
  for (const [id, chain] of [...memory.open]) {
    if (alive(id)) continue;
    memory.open.delete(id);
    if (chain.chain >= 2) cues.push({ kind: 'chainEnd', face: chain.face, chain: chain.chain });
  }

  switch (event.type) {
    case 'move':
      // A roll is heard when the die comes down, not when it sets off: until then it is only kept in mind.
      if (event.kind === 'roll') {
        memory.moving.push({ face: cubeAt(state, player.x, player.z)?.ori.top ?? 1, pan: here, tick: state.tick });
      } else if (event.kind === 'push') {
        memory.moving.push({ face: null, pan: here, tick: state.tick });
        cues.push({ kind: 'push', pan: here });
      } else {
        cues.push({ kind: 'step', pan: here });
      }
      break;
    case 'blocked':
      cues.push({ kind: 'blocked', pan: here });
      break;
    case 'landed': {
      let around = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx !== 0 || dz !== 0) && cubeAt(state, player.x + dx, player.z + dz)) around++;
        }
      }
      // A die that set off too long ago never came down - its board was laid out anew: it is forgotten.
      const late = state.tick - state.config.actionTicks - 2;
      while (memory.moving.length > 0 && memory.moving[0].tick < late) memory.moving.shift();
      const moved = memory.moving.shift();
      if (moved && moved.face !== null) cues.push({ kind: 'roll', face: moved.face, crowd: around / 8, pan: moved.pan });
      else cues.push({ kind: 'landed', crowd: around / 8, pan: here });
      break;
    }
    case 'warned':
      cues.push({ kind: 'warned', cell: size > 1 ? (event.x + event.z) / (2 * (size - 1)) : 0, pan: stereo(event.x, event.z, size) });
      break;
    case 'risen': {
      const cube = getCube(state, event.cubeId);
      if (cube) cues.push({ kind: 'risen', face: cube.ori.top, pan: stereo(cube.x, cube.z, size) });
      break;
    }
    case 'lifted': {
      const cube = cubeAt(state, player.x, player.z);
      if (cube) cues.push({ kind: 'risen', face: cube.ori.top, pan: here });
      break;
    }
    case 'displaced': {
      const cube = getCube(state, event.cubeId);
      cues.push({ kind: 'step', pan: cube ? stereo(cube.x, cube.z, size) : here });
      break;
    }
    case 'match':
      memory.open.set(event.reactionId, { face: event.value, chain: 1 });
      memory.sent.add(event.value);
      going((cube) => cube.reactionId === event.reactionId, event.value);
      break;
    case 'chain':
      memory.open.set(event.reactionId, { face: event.value, chain: event.chain });
      memory.sent.add(event.value);
      going((cube) => cube.reactionId === event.reactionId, event.value);
      break;
    case 'happyOne':
      memory.sent.add(1);
      going((cube) => cube.ori.top === 1 && cube.reactionId === 0, 1);
      break;
    case 'removed':
      cues.push({ kind: 'sunk', face: memory.sinking.get(event.cubeId) ?? 1, pan: 0 });
      memory.sinking.delete(event.cubeId);
      break;
    case 'fell':
      cues.push({ kind: 'fell', pan: here });
      break;
    case 'deadEnd':
      cues.push({ kind: 'deadEnd' });
      break;
    case 'cleared':
      cues.push({ kind: 'cleared', faces: [...memory.sent].sort((a, b) => a - b) });
      break;
    case 'gameOver':
      cues.push({ kind: 'end' });
      break;
    default:
      // A die that starts to come up, a level (it has its beat), the steps of the exercise: nothing is heard.
      break;
  }
  return cues;
}

/**
 * A beat as a sound. The picture and the sound answer the same beat with the same strength: its
 * tier is what makes a group heavier and a link of a chain brighter. `contact` is how far the
 * contact has gone, 0 to 1: a step of it takes its note from there.
 */
export function cueOfBeat(beat: Beat, size: number, contact: number): Cue | null {
  const cells = beat.cells;
  const pan = cells.length > 0 ? cells.reduce((sum, cell) => sum + stereo(cell.x, cell.z, size), 0) / cells.length : 0;
  switch (beat.kind) {
    case 'match':
      return { kind: 'group', face: beat.value, count: Math.max(1, cells.length), tier: beat.tier, pan };
    case 'chain':
      return { kind: 'chain', face: beat.value, chain: beat.chain, count: Math.max(1, cells.length), tier: beat.tier, pan };
    case 'one':
      return { kind: 'ones', count: Math.max(1, cells.length), pan };
    case 'level':
      return { kind: 'level' };
    case 'step':
      return { kind: 'contact', stage: Math.round(clamp(contact, 0, 1) * CONTACT_STEPS.length) };
    case 'peak':
      return { kind: 'peak' };
    default:
      return null;
  }
}
