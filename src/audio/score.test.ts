import { describe, expect, it } from 'vitest';
import { beatsOf, chainTier, matchTier, peakBeat, stepBeat } from '../app/juice';
import { CONTACT_STEPS } from '../app/ritual';
import { ROAD } from '../levels/road';
import { createRun, defaultConfig, step, type GameEvent } from '../rules';
import { emptyRun, land, place, put } from '../rules/testkit';
import { soundDefaults } from './params';
import { COMMA, degreeHz, faceDegree, tuning } from './scale';
import { ARP_MOST, CHORD_MOST, HELD, INTERFACE, REPLY_MOST, ScoreMemory, cueOfBeat, cuesOfEvent, leadNote, noteLaid, notesFor, replyCount, silentSign, stereo, type Cue, type Note, type Setup } from './score';
import { Variety, soundRandom } from './variation';

function setup(contact = 0, seed = 1): Setup {
  return { values: soundDefaults(), contact, rand: soundRandom(seed), variety: new Variety() };
}

function part(notes: readonly Note[], name: string): Note[] {
  return notes.filter((note) => note.part === name);
}

const DEFAULTS = soundDefaults();
const TUNE = tuning(String(DEFAULTS.mode), String(DEFAULTS.root), Number(DEFAULTS.octave), Number(DEFAULTS.fine));
/** The frequency of the root: what every note is so many semitones above. */
const ROOT = degreeHz(TUNE, 0);
const BELL_OCTAVE = Number(DEFAULTS.bellOctave);
const faceHz = (face: number): number => degreeHz(TUNE, faceDegree(TUNE.steps, face), BELL_OCTAVE);

/** A group of a face, of as many dice as the face asks for. */
const group = (face: number, count = face): Cue => ({ kind: 'group', face, count, tier: matchTier(count), pan: 0 });
const link = (face: number, chain: number, count = face): Cue => ({ kind: 'chain', face, chain, count, tier: chainTier(chain), pan: 0 });

/** Every cue there is, for what has to hold for all of them. */
const EVERY: Cue[] = [
  { kind: 'roll', face: 3, crowd: 0.25, pan: -0.4 },
  { kind: 'step', pan: 0.2 },
  { kind: 'push', pan: 0 },
  { kind: 'fell', pan: 0 },
  { kind: 'landed', crowd: 0.5, pan: 0.3 },
  { kind: 'blocked', pan: 0 },
  { kind: 'warned', cell: 0.4, pan: -1 },
  { kind: 'risen', face: 5, pan: 1 },
  group(6),
  link(4, 6, 9),
  { kind: 'chainEnd', face: 4, chain: 6 },
  { kind: 'ones', count: 4, pan: 0 },
  { kind: 'sunk', face: 2, pan: 0 },
  { kind: 'points', points: 96, tier: 2 },
  { kind: 'count' },
  { kind: 'level' },
  { kind: 'contact', stage: 9 },
  { kind: 'peak' },
  { kind: 'danger', secondsLeft: 2 },
  { kind: 'clock' },
  { kind: 'begin' },
  { kind: 'deadEnd' },
  { kind: 'end' },
  { kind: 'cleared', faces: [2, 3, 5] },
  { kind: 'reply', heard: [500, 750, 1000] },
  { kind: 'uiStep', face: 4 },
  { kind: 'uiStep', face: null },
  { kind: 'uiStuck' },
  { kind: 'uiRun' },
  { kind: 'uiBack' },
  { kind: 'uiOpen' },
  { kind: 'uiClose' },
  { kind: 'bootCheck' },
  { kind: 'bootAnswer', found: true },
  { kind: 'bootAnswer', found: false },
  { kind: 'logo' },
  { kind: 'rank', along: 0.4 },
  { kind: 'rankPast', own: true, along: 0.5 },
  { kind: 'rankPast', own: false, along: 0.9 },
  { kind: 'rankSet', along: 0.7, record: true, moved: true },
  { kind: 'rankSet', along: 0.7, record: false, moved: true },
  { kind: 'rankSet', along: 0, record: false, moved: false },
  { kind: 'sign', code: 1103 },
  { kind: 'typed', code: 1103 },
  { kind: 'window', figure: 1, seconds: 5, glimpse: false },
  { kind: 'window', figure: 4, seconds: 3, glimpse: true },
  { kind: 'windowShut' },
];

describe('a group sent', () => {
  it('plays as many notes as it has dice, with a low under them', () => {
    for (let face = 2; face <= 6; face++) {
      for (let count = face; count <= ARP_MOST; count++) {
        const notes = notesFor(group(face, count), setup());
        const run = part(notes, 'arp');
        expect(run.length).toBe(count);
        expect(run.every((note) => note.voice === 'bell')).toBe(true);
        expect(part(notes, 'low').length).toBe(1);
        expect(part(notes, 'low')[0].voice).toBe('low');
      }
    }
  });

  it('starts on the note of its face and goes on one note after another', () => {
    for (let face = 2; face <= 6; face++) {
      const run = part(notesFor(group(face), setup()), 'arp');
      expect(run[0].hz).toBeCloseTo(faceHz(face), 6);
      expect(run[0].at).toBe(0);
      for (let i = 1; i < run.length; i++) expect(run[i].at).toBeGreaterThan(run[i - 1].at);
    }
  });

  it('keeps to the notes of the mode', () => {
    const allowed = new Set(TUNE.steps.map((s) => s % 12));
    for (let seed = 1; seed <= 12; seed++) {
      for (const note of part(notesFor(group(6, 9), setup(0, seed)), 'arp')) {
        const semis = 12 * Math.log2(note.hz / ROOT);
        expect(Math.abs(semis - Math.round(semis))).toBeLessThan(1e-6);
        expect(allowed.has(((Math.round(semis) % 12) + 12) % 12)).toBe(true);
      }
    }
  });

  it('gives the six the note of the one, an octave up', () => {
    const one = part(notesFor({ kind: 'ones', count: 1, pan: 0 }, setup()), 'one')[0].hz;
    const six = part(notesFor(group(6), setup()), 'arp')[0].hz;
    expect(Math.log2(six / one)).toBeCloseTo(Math.round(Math.log2(six / one)), 9);
    expect(faceHz(6) / faceHz(1)).toBeCloseTo(2, 9);
  });

  it('is never played the same way twice in a row', () => {
    const s = setup();
    let last = '';
    for (let i = 0; i < 40; i++) {
      const run = part(notesFor(group(4), s), 'arp');
      const shape = run.map((note) => note.hz.toFixed(2)).join(',');
      expect(shape).not.toBe(last);
      last = shape;
    }
  });

  it('is heavier when it is large', () => {
    const small = part(notesFor({ kind: 'group', face: 3, count: 3, tier: 0, pan: 0 }, setup()), 'low')[0];
    const large = part(notesFor({ kind: 'group', face: 3, count: 6, tier: 1, pan: 0 }, setup()), 'low')[0];
    expect(large.gain).toBeGreaterThan(small.gain);
  });
});

describe('a chain', () => {
  it('starts every link higher than the last', () => {
    for (let face = 2; face <= 6; face++) {
      let last = part(notesFor(group(face), setup()), 'arp')[0].hz;
      for (let chain = 2; chain <= 10; chain++) {
        const first = part(notesFor(link(face, chain), setup()), 'arp')[0].hz;
        expect(first).toBeGreaterThan(last);
        last = first;
      }
    }
  });

  it('adds a voice with every link, up to the most there are', () => {
    expect(part(notesFor(group(3), setup()), 'chord').length).toBe(0);
    let last = 0;
    for (let chain = 2; chain <= 8; chain++) {
      const voices = part(notesFor(link(3, chain), setup()), 'chord').length;
      expect(voices).toBe(Math.min(chain, CHORD_MOST));
      expect(voices).toBeGreaterThanOrEqual(last);
      last = voices;
    }
    expect(last).toBe(CHORD_MOST);
  });

  it('grows brighter, wider and longer', () => {
    const wide = (notes: Note[]): number => Math.max(...part(notes, 'arp').map((note) => Math.abs(note.pan)));
    const long = (notes: Note[]): number => Math.max(...notes.filter((note) => note.voice === 'bell').map((note) => note.decay));
    let last = notesFor(link(4, 2, 6), setup());
    for (let chain = 3; chain <= 6; chain++) {
      const now = notesFor(link(4, chain, 6), setup());
      expect(part(now, 'arp')[0].bright).toBeGreaterThan(part(last, 'arp')[0].bright);
      expect(wide(now)).toBeGreaterThan(wide(last));
      expect(long(now)).toBeGreaterThan(long(last));
      last = now;
    }
  });

  it('has a high glint on the strong beats only, and a heavier low', () => {
    expect(part(notesFor(link(3, 2), setup()), 'glint').length).toBe(0);
    expect(part(notesFor(link(3, 3), setup()), 'glint').length).toBe(0);
    expect(part(notesFor(link(3, 4), setup()), 'glint').length).toBeGreaterThan(0);
    expect(part(notesFor(link(3, 6), setup()), 'glint').length).toBeGreaterThan(0);
    const low = (chain: number): number => part(notesFor(link(3, chain), setup()), 'low')[0].gain;
    expect(low(6)).toBeGreaterThan(low(2));
  });

  it('never plays more notes in a run than the most there are', () => {
    expect(part(notesFor(link(2, 5, 30), setup()), 'arp').length).toBe(ARP_MOST);
  });

  it('comes back down its ladder when it ends, to the note it began on', () => {
    for (const chain of [2, 4, 9]) {
      const notes = notesFor({ kind: 'chainEnd', face: 3, chain }, setup());
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].hz).toBeLessThan(notes[i - 1].hz);
        expect(notes[i].at).toBeGreaterThan(notes[i - 1].at);
      }
      const home = notes[notes.length - 1];
      expect(home.hz).toBeCloseTo(faceHz(3), 6);
      expect(home.decay).toBeGreaterThan(notes[0].decay);
      expect(notes.length).toBeLessThanOrEqual(CHORD_MOST);
    }
  });

  it('hurries its run a little with every link', () => {
    const span = (chain: number): number => {
      let sum = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const run = part(notesFor(link(4, chain, 6), setup(0, seed)), 'arp');
        sum += run[run.length - 1].at;
      }
      return sum;
    };
    expect(span(6)).toBeLessThan(span(2));
  });

  it('rings out longer the longer it was', () => {
    const tail = (chain: number): number => Math.max(...notesFor({ kind: 'chainEnd', face: 3, chain }, setup()).map((note) => note.at + note.decay));
    expect(notesFor({ kind: 'chainEnd', face: 3, chain: 2 }, setup()).length).toBeGreaterThan(0);
    expect(tail(4)).toBeGreaterThan(tail(2));
    expect(tail(7)).toBeGreaterThan(tail(4));
  });
});

describe('the ones', () => {
  it('are one note in several octaves, as many as there were ones', () => {
    for (let count = 1; count <= 7; count++) {
      const notes = part(notesFor({ kind: 'ones', count, pan: 0 }, setup()), 'one');
      expect(notes.length).toBe(count);
      for (const note of notes) {
        const octaves = Math.log2(note.hz / faceHz(1));
        expect(octaves).toBeCloseTo(Math.round(octaves), 9);
      }
      for (let i = 1; i < notes.length; i++) expect(notes[i].at).toBeGreaterThan(notes[i - 1].at);
    }
    const four = part(notesFor({ kind: 'ones', count: 4, pan: 0 }, setup()), 'one');
    expect(new Set(four.map((note) => note.hz.toFixed(1))).size).toBeGreaterThan(1);
  });

  it('leave one behind: the same note once more, after them, with no echo', () => {
    const notes = notesFor({ kind: 'ones', count: 4, pan: 0.5 }, setup());
    const gone = part(notes, 'one');
    const [stays, ...more] = part(notes, 'stays');
    expect(more.length).toBe(0);
    expect(stays.hz).toBeCloseTo(faceHz(1), 6);
    expect(stays.at).toBeGreaterThan(gone[gone.length - 1].at);
    expect(stays.echo).toBe(0);
    expect(stays.pan).toBe(0);
    expect(gone.every((note) => note.echo > 0)).toBe(true);
  });
});

describe('a roll', () => {
  it('knocks on the note of the face that has come up', () => {
    const knockOctave = Number(soundDefaults().knockOctave);
    for (let face = 1; face <= 6; face++) {
      const [note] = notesFor({ kind: 'roll', face, crowd: 0, pan: 0 }, setup());
      expect(note.voice).toBe('knock');
      const want = degreeHz(TUNE, faceDegree(TUNE.steps, face), knockOctave);
      // A few cents either way: no two knocks are quite alike.
      expect(Math.abs(1200 * Math.log2(note.hz / want))).toBeLessThan(15);
    }
  });

  it('is not the same ten times in a row', () => {
    const s = setup();
    const notes = Array.from({ length: 10 }, () => notesFor({ kind: 'roll', face: 3, crowd: 0, pan: 0 }, s)[0]);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].variant).not.toBe(notes[i - 1].variant);
      expect(notes[i].hz).not.toBe(notes[i - 1].hz);
    }
    expect(new Set(notes.map((note) => note.variant)).size).toBeGreaterThan(2);
  });

  it('is placed across the board', () => {
    const s = setup();
    expect(notesFor({ kind: 'roll', face: 3, crowd: 0, pan: -1 }, s)[0].pan).toBeLessThan(0);
    expect(notesFor({ kind: 'roll', face: 3, crowd: 0, pan: 1 }, s)[0].pan).toBeGreaterThan(0);
  });

  it('has the weight of the die under the knock, heavier among other dice', () => {
    const weight = (crowd: number): Note => part(notesFor({ kind: 'roll', face: 3, crowd, pan: 0 }, setup()), 'weight')[0];
    expect(weight(0).voice).toBe('low');
    expect(weight(1).gain).toBeGreaterThan(weight(0).gain);
    // The knock is the sound; the weight is only under it.
    const [knock] = notesFor({ kind: 'roll', face: 3, crowd: 1, pan: 0 }, setup());
    expect(weight(1).gain).toBeLessThan(knock.gain);
  });
});

describe('the rest of a session', () => {
  it('lands harder among other dice', () => {
    const alone = notesFor({ kind: 'landed', crowd: 0, pan: 0 }, setup())[0];
    const crowded = notesFor({ kind: 'landed', crowd: 1, pan: 0 }, setup())[0];
    expect(alone.voice).toBe('low');
    expect(crowded.gain).toBeGreaterThan(alone.gain);
  });

  it('counts a full board with one low beat a call, the last ones higher', () => {
    const beat = (secondsLeft: number): Note[] => notesFor({ kind: 'danger', secondsLeft }, setup());
    expect(beat(8).length).toBe(1);
    expect(beat(8)[0].voice).toBe('low');
    expect(beat(8)[0].hz).toBe(beat(5)[0].hz);
    expect(beat(2)[0].hz).toBeGreaterThan(beat(8)[0].hz);
    expect(beat(1)[0].hz).toBeGreaterThanOrEqual(beat(2)[0].hz);
  });

  it('answers larger points with a higher note', () => {
    const at = (points: number): number => notesFor({ kind: 'points', points, tier: 0 }, setup())[0].hz;
    expect(at(40)).toBeGreaterThan(at(4));
    expect(at(600)).toBeGreaterThan(at(40));
  });

  it('goes two notes up for a level', () => {
    const notes = notesFor({ kind: 'level' }, setup());
    expect(notes.length).toBe(2);
    expect(notes.every((note) => note.voice === 'click')).toBe(true);
    expect(notes[1].hz).toBeGreaterThan(notes[0].hz);
    expect(notes[1].at).toBeGreaterThan(notes[0].at);
  });

  it('takes the next degree at every step of the contact', () => {
    let last = 0;
    for (let stage = 1; stage <= CONTACT_STEPS.length; stage++) {
      const notes = notesFor({ kind: 'contact', stage }, setup());
      expect(notes.length).toBe(1);
      expect(notes[0].voice).toBe('other');
      expect(notes[0].hz).toBeGreaterThan(last);
      last = notes[0].hz;
    }
  });

  it('ends a session with a silence, then a low note and the semitone over it', () => {
    const notes = notesFor({ kind: 'end' }, setup());
    expect(Math.min(...notes.map((note) => note.at))).toBeGreaterThanOrEqual(0.5);
    const low = part(notes, 'last')[0];
    const over = part(notes, 'over')[0];
    expect(over.hz / low.hz).toBeCloseTo(2 ** (1 / 12), 6);
    expect(over.at).toBeGreaterThan(low.at);
  });

  it('rings the faces a task was solved with', () => {
    const notes = part(notesFor({ kind: 'cleared', faces: [5, 2, 3, 2] }, setup()), 'face');
    expect(notes.map((note) => note.hz.toFixed(3))).toEqual([2, 3, 5].map((face) => faceHz(face).toFixed(3)));
  });
});

describe('every sound', () => {
  it('is a handful of notes that begin, end and stay within bounds', () => {
    for (let seed = 1; seed <= 5; seed++) {
      for (const contact of [0, 1]) {
        const s = setup(contact, seed);
        for (const cue of EVERY) {
          const notes = notesFor(cue, s);
          expect(notes.length).toBeGreaterThan(0);
          expect(notes.length).toBeLessThanOrEqual(ARP_MOST + CHORD_MOST + 4);
          for (const note of notes) {
            expect(Number.isFinite(note.hz) && note.hz >= 40 && note.hz <= 6000).toBe(true);
            expect(note.at).toBeGreaterThanOrEqual(0);
            expect(note.gain).toBeGreaterThan(0);
            expect(note.gain).toBeLessThanOrEqual(1);
            expect(note.decay).toBeGreaterThan(0);
            expect(note.at + note.attack + note.decay).toBeLessThan(12);
            expect(Math.abs(note.pan)).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('is in tune with no contact, and slips by a few cents as the contact grows', () => {
    const off = (contact: number): number => {
      let most = 0;
      for (let seed = 1; seed <= 10; seed++) {
        for (const note of part(notesFor(group(5), setup(contact, seed)), 'arp')) {
          const semis = 12 * Math.log2(note.hz / ROOT);
          most = Math.max(most, Math.abs(semis - Math.round(semis)) * 100);
        }
      }
      return most;
    };
    expect(off(0)).toBeLessThan(0.001);
    expect(off(1)).toBeGreaterThan(1);
    expect(off(1)).toBeLessThanOrEqual(Number(soundDefaults().drift) + 0.001);
  });

  it('is silent where a volume is turned to nothing', () => {
    const s = setup();
    s.values.volBell = 0;
    expect(notesFor(group(4), s).filter((note) => note.voice === 'bell').length).toBe(0);
  });
});

describe('the other side', () => {
  it('does not answer at low contact, and answers more often the further it has gone', () => {
    const values = soundDefaults();
    const from = Number(values.replyFrom);
    const answers = (contact: number): number => {
      const rand = soundRandom(7);
      let count = 0;
      for (let i = 0; i < 2000; i++) if (replyCount(contact, values, rand) > 0) count++;
      return count;
    };
    expect(answers(0)).toBe(0);
    expect(answers(from)).toBe(0);
    expect(answers(0.6)).toBeGreaterThan(0);
    expect(answers(1)).toBeGreaterThan(answers(0.6));
    // Never always: what comes back every time is an echo, not an answer.
    expect(answers(1)).toBeLessThan(1500);
  });

  it('gives back one note at first, and deep in sometimes the last few', () => {
    const values = soundDefaults();
    const sizes = (contact: number): Set<number> => {
      const rand = soundRandom(3);
      const seen = new Set<number>();
      for (let i = 0; i < 3000; i++) seen.add(replyCount(contact, values, rand));
      return seen;
    };
    expect([...sizes(0.5)].sort()).toEqual([0, 1]);
    expect(Math.max(...sizes(1))).toBe(REPLY_MOST);
    expect(sizes(1).has(1)).toBe(true);
  });

  it('answers a roll more rarely than a group', () => {
    const values = soundDefaults();
    const answers = (often: number): number => {
      const rand = soundRandom(11);
      let count = 0;
      for (let i = 0; i < 4000; i++) if (replyCount(1, values, rand, often) > 0) count++;
      return count;
    };
    expect(answers(0.25)).toBeLessThan(answers(1) / 2);
  });

  it('gives a note back later, softly, in its own voice and a comma under', () => {
    const played = notesFor(group(4), setup())[0];
    const [back, ...more] = notesFor({ kind: 'reply', heard: [played.hz] }, setup(0.8));
    expect(more.length).toBe(0);
    expect(back.voice).toBe('other');
    expect(back.at).toBeGreaterThanOrEqual(0.5);
    expect(back.gain).toBeLessThan(played.gain);
    // Out of tune by the comma, give or take the slip of the contact.
    const off = 1200 * Math.log2(played.hz / back.hz);
    expect(off).toBeGreaterThan(1200 * Math.log2(COMMA) - Number(soundDefaults().drift));
    expect(off).toBeLessThan(1200 * Math.log2(COMMA) + Number(soundDefaults().drift));
  });

  it('repeats the last few notes in the order they were played, and no more than there may be', () => {
    const notes = notesFor({ kind: 'reply', heard: [400, 500, 600, 700, 800] }, setup(1));
    expect(notes.length).toBe(REPLY_MOST);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].at).toBeGreaterThan(notes[i - 1].at);
      expect(notes[i].hz).toBeGreaterThan(notes[i - 1].hz);
    }
    expect(notesFor({ kind: 'reply', heard: [] }, setup(1))).toEqual([]);
  });

  it('is answered on the note the player has played: the knock of a roll, the first bell of a group', () => {
    const roll: Cue = { kind: 'roll', face: 3, crowd: 0, pan: 0 };
    expect(leadNote(roll, notesFor(roll, setup()))?.part).toBe('roll');
    expect(leadNote(group(4), notesFor(group(4), setup()))?.hz).toBeCloseTo(faceHz(4), 6);
    expect(leadNote(link(4, 3), notesFor(link(4, 3), setup()))?.part).toBe('arp');
    expect(leadNote({ kind: 'level' }, notesFor({ kind: 'level' }, setup()))).toBeNull();
    expect(leadNote({ kind: 'uiRun' }, notesFor({ kind: 'uiRun' }, setup()))).toBeNull();
  });

  it('has more of the echo in everything the further the contact has gone', () => {
    const echo = (contact: number): number => part(notesFor(group(4), setup(contact)), 'arp')[0].echo;
    expect(echo(1)).toBeGreaterThan(echo(0.5));
    expect(echo(0.5)).toBeGreaterThan(echo(0));
  });

  it('writes with a note for every sign: the same sign is the same note, a comma under the mode', () => {
    const at = (sign: string, seed: number): number => notesFor({ kind: 'sign', code: sign.codePointAt(0)! }, setup(0, seed))[0].hz;
    const near = (a: number, b: number): boolean => Math.abs(1200 * Math.log2(a / b)) <= 24;
    expect(near(at('m', 1), at('m', 2))).toBe(true);
    expect(near(at('m', 1), at('n', 1))).toBe(false);
    const note = notesFor({ kind: 'sign', code: 'a'.codePointAt(0)! }, setup())[0];
    expect(note.voice).toBe('other');
    expect(note.echo).toBeGreaterThan(0);
    // Uneven, but around a note of the mode brought down by the comma.
    const semis = 12 * Math.log2((note.hz * COMMA) / ROOT);
    expect(Math.abs(semis - Math.round(semis)) * 100).toBeLessThanOrEqual(12.001);
    expect(new Set(TUNE.steps.map((step) => step % 12)).has(((Math.round(semis) % 12) + 12) % 12)).toBe(true);
  });

  it('prints the words of the instruction with the click of the program: dry, short, in tune, the same sign the same click', () => {
    const at = (sign: string, seed = 1): Note => notesFor({ kind: 'typed', code: sign.codePointAt(0)! }, setup(0, seed))[0];
    const note = at('a');
    expect(note.voice).toBe('click');
    expect(note.echo).toBe(0);
    expect(note.decay).toBeLessThanOrEqual(0.02);
    // Quieter than a line of the check at the start: there is a click to a sign, not to a line.
    expect(note.gain).toBeLessThan(notesFor({ kind: 'bootCheck' }, setup())[0].gain);
    // On a note of the mode, not a comma under it: it is the program that prints, not the other side that sings.
    const semis = 12 * Math.log2(note.hz / ROOT);
    expect(Math.abs(semis - Math.round(semis))).toBeLessThan(0.001);
    expect(at('m', 1).hz).toBe(at('m', 2).hz);
    expect(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((sign) => at(sign).hz)).size).toBeGreaterThan(1);
    expect(notesFor({ kind: 'typed', code: 'a'.codePointAt(0)! }, setup()).length).toBe(1);
  });

  it('says nothing for a space or a mark between words', () => {
    for (const sign of [' ', '.', ',', '-', '!', '?']) expect(silentSign(sign)).toBe(true);
    for (const sign of ['a', 'Z', '7', String.fromCodePoint(0x44f), String.fromCodePoint(0x63a5)]) expect(silentSign(sign)).toBe(false);
  });
});

describe('the program', () => {
  it('plays the note of its face when a die of the menu is stepped onto', () => {
    for (let face = 1; face <= 6; face++) {
      const notes = notesFor({ kind: 'uiStep', face }, setup());
      expect(notes.length).toBe(1);
      expect(notes[0].voice).toBe('bell');
      expect(notes[0].hz).toBeCloseTo(faceHz(face), 6);
    }
    const plain = notesFor({ kind: 'uiStep', face: null }, setup());
    expect(plain.length).toBe(1);
    expect(plain[0].voice).toBe('click');
  });

  it('goes two notes up to run and the same two down to go back', () => {
    const run = notesFor({ kind: 'uiRun' }, setup());
    const back = notesFor({ kind: 'uiBack' }, setup());
    expect(run.length).toBe(2);
    expect(run[1].hz).toBeGreaterThan(run[0].hz);
    expect(run[1].at).toBeGreaterThan(run[0].at);
    expect(back.map((note) => note.hz)).toEqual([run[1].hz, run[0].hz]);
  });

  it('speaks in its own dry voice', () => {
    const kinds: Cue[] = [{ kind: 'uiStep', face: null }, { kind: 'uiRun' }, { kind: 'uiBack' }, { kind: 'uiStuck' }, { kind: 'uiOpen' }, { kind: 'uiClose' }, { kind: 'bootCheck' }, { kind: 'bootAnswer', found: true }];
    for (const cue of kinds) for (const note of notesFor(cue, setup())) expect(note.voice).toBe('click');
  });

  it('opens and closes a panel with clicks that differ', () => {
    expect(notesFor({ kind: 'uiOpen' }, setup())[0].hz).not.toBe(notesFor({ kind: 'uiClose' }, setup())[0].hz);
  });

  it('answers a line of the check that finds its device, and falls a semitone, dull, for the one that is not there', () => {
    const found = notesFor({ kind: 'bootAnswer', found: true }, setup());
    expect(found.length).toBe(1);
    expect(found[0].dull).toBe(false);
    const absent = notesFor({ kind: 'bootAnswer', found: false }, setup());
    expect(absent.length).toBe(2);
    expect(absent.every((note) => note.dull)).toBe(true);
    expect(absent[0].hz / absent[1].hz).toBeCloseTo(2 ** (1 / 12), 6);
    expect(absent[1].at).toBeGreaterThan(absent[0].at);
  });

  it('says its name as the six faces one after another, the six an octave over the one', () => {
    const notes = part(notesFor({ kind: 'logo' }, setup()), 'logo');
    expect(notes.map((note) => note.hz.toFixed(3))).toEqual([1, 2, 3, 4, 5, 6].map((face) => faceHz(face).toFixed(3)));
    for (let i = 1; i < notes.length; i++) expect(notes[i].at).toBeGreaterThan(notes[i - 1].at);
    expect(notes[5].hz / notes[0].hz).toBeCloseTo(2, 9);
  });

  it('holds one long quiet note of the other side while a window stands open', () => {
    const notes = notesFor({ kind: 'window', figure: 1, seconds: 5, glimpse: false }, setup());
    expect(notes[0].voice).toBe('click');
    const [held] = part(notes, HELD);
    expect(held.voice).toBe('other');
    // It has died away by the time the window shuts by itself.
    expect(held.at + held.attack + held.decay).toBeLessThanOrEqual(5);
    expect(held.gain).toBeLessThan(0.1);
    // Another place, another note.
    const other = part(notesFor({ kind: 'window', figure: 2, seconds: 5, glimpse: false }, setup()), HELD)[0];
    expect(other.hz).not.toBe(held.hz);
  });

  it('gives a glimpse one note that would outlast its frame: it is cut off with it', () => {
    const [held] = part(notesFor({ kind: 'window', figure: 4, seconds: 3, glimpse: true }, setup()), HELD);
    expect(held.voice).toBe('other');
    expect(held.at + held.attack + held.decay).toBeGreaterThan(3);
  });

  it('counts the lines a session goes past on its way up the log with clicks that rise two octaves from its last line to its top', () => {
    const at = (along: number): Note => notesFor({ kind: 'rank', along }, setup())[0];
    expect(at(0).voice).toBe('click');
    const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((along) => at(along).hz);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(at(1).hz / at(0).hz).toBeCloseTo(4, 6);
    // The top of the log is the highest click the program has.
    expect(at(1).hz).toBeCloseTo(degreeHz(TUNE, 0, Number(DEFAULTS.clickOctave)), 6);
    // Two in a row do not come from the same side.
    const variety = new Variety();
    const rand = soundRandom(3);
    const sides = [0, 1, 2, 3].map(() => notesFor({ kind: 'rank', along: 0.5 }, { values: DEFAULTS, contact: 0, rand, variety })[0].pan);
    for (let i = 1; i < sides.length; i++) expect(Math.sign(sides[i])).toBe(-Math.sign(sides[i - 1]));
  });

  it('rings the one and the six for the best the player had, and answers a record of the six in the voice of the other side', () => {
    const own = notesFor({ kind: 'rankPast', own: true, along: 0.5 }, setup());
    const bells = part(own, 'own');
    expect(bells.map((note) => note.voice)).toEqual(['bell', 'bell']);
    expect(bells[1].hz / bells[0].hz).toBeCloseTo(2, 9);
    const six = notesFor({ kind: 'rankPast', own: false, along: 0.5 }, setup());
    const [far] = part(six, 'six');
    expect(far.voice).toBe('other');
    // A comma under the program's note: the other side is never quite in tune with it.
    expect(far.hz).toBeCloseTo(ROOT / COMMA, 6);
    // Both keep the click of the line itself, so the count does not miss a beat.
    for (const notes of [own, six]) expect(part(notes, 'rank')).toHaveLength(1);
  });

  it('lands on a low and a bell; over the best there was the bell is a run upwards; with nothing gone past it is one dull click', () => {
    const plain = notesFor({ kind: 'rankSet', along: 0.5, record: false, moved: true }, setup());
    expect(plain.map((note) => note.voice).sort()).toEqual(['bell', 'click', 'low']);
    const record = notesFor({ kind: 'rankSet', along: 0.5, record: true, moved: true }, setup());
    const run = part(record, 'record');
    expect(run.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < run.length; i++) {
      expect(run[i].at).toBeGreaterThan(run[i - 1].at);
      expect(run[i].hz).toBeGreaterThan(run[i - 1].hz);
    }
    expect(run[0].hz).toBeCloseTo(faceHz(1), 6);
    expect(part(record, 'set').some((note) => note.voice === 'low')).toBe(true);
    const still = notesFor({ kind: 'rankSet', along: 0, record: false, moved: false }, setup());
    expect(still).toHaveLength(1);
    expect(still[0]).toMatchObject({ voice: 'click', dull: true });
  });

  it('is heard while a session waits; the session is not', () => {
    for (const kind of ['uiStep', 'uiRun', 'uiBack', 'logo', 'rank', 'rankPast', 'rankSet', 'sign', 'typed', 'window', 'windowShut'] as const) expect(INTERFACE).toContain(kind);
    for (const kind of ['roll', 'group', 'chain', 'danger', 'points', 'reply'] as const) expect(INTERFACE).not.toContain(kind);
  });
});

describe('what the rules say', () => {
  it('places a cell across the board', () => {
    expect(stereo(3, 3, 7)).toBeCloseTo(0, 9);
    expect(stereo(0, 3, 7)).toBeLessThan(0);
    expect(stereo(6, 3, 7)).toBeGreaterThan(0);
    for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) expect(Math.abs(stereo(x, z, 7))).toBeLessThanOrEqual(1);
  });

  it('hears a roll when the die comes down, as the face that has come up under the player', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    put(s, 2, 2, 4);
    place(s, 2, 2, 'top');
    // Setting off is silent: the knock is the die meeting the table.
    expect(cuesOfEvent({ type: 'move', kind: 'roll', dir: 'N' }, s, memory)).toEqual([]);
    expect(cuesOfEvent({ type: 'landed' }, s, memory)).toEqual([{ kind: 'roll', face: 4, crowd: 0, pan: stereo(2, 2, s.config.size) }]);
    // A die that comes down with no roll before it is only its weight.
    expect(cuesOfEvent({ type: 'landed' }, s, memory)).toEqual([{ kind: 'landed', crowd: 0, pan: stereo(2, 2, s.config.size) }]);
    expect(cuesOfEvent({ type: 'move', kind: 'walk', dir: 'N' }, s, new ScoreMemory())[0].kind).toBe('step');
  });

  it('hears a push at once, and the pushed die when it stops', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    place(s, 2, 2, 'ground');
    expect(cuesOfEvent({ type: 'move', kind: 'push', dir: 'N' }, s, memory)[0].kind).toBe('push');
    expect(cuesOfEvent({ type: 'landed' }, s, memory)[0].kind).toBe('landed');
  });

  it('keeps the dice that are on their way in the order they set off', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    put(s, 2, 2, 4);
    place(s, 2, 2, 'top');
    cuesOfEvent({ type: 'move', kind: 'roll', dir: 'N' }, s, memory);
    put(s, 4, 4, 6);
    place(s, 4, 4, 'top');
    cuesOfEvent({ type: 'move', kind: 'roll', dir: 'N' }, s, memory);
    expect(cuesOfEvent({ type: 'landed' }, s, memory)[0]).toMatchObject({ kind: 'roll', face: 4 });
    expect(cuesOfEvent({ type: 'landed' }, s, memory)[0]).toMatchObject({ kind: 'roll', face: 6 });
    memory.reset();
    expect(memory.moving.length).toBe(0);
  });

  it('forgets a die that set off and never came down, so the next roll is not heard as that one', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    put(s, 2, 2, 4);
    place(s, 2, 2, 'top');
    cuesOfEvent({ type: 'move', kind: 'roll', dir: 'N' }, s, memory);
    // The board is laid out anew: that die never lands. Much later another one is rolled.
    s.tick += s.config.actionTicks * 10;
    put(s, 4, 4, 6);
    place(s, 4, 4, 'top');
    cuesOfEvent({ type: 'move', kind: 'roll', dir: 'N' }, s, memory);
    s.tick += s.config.actionTicks;
    expect(cuesOfEvent({ type: 'landed' }, s, memory)[0]).toMatchObject({ kind: 'roll', face: 6 });
    expect(memory.moving.length).toBe(0);
  });

  it('leaves a group to its beat, and plays it with as many notes as dice', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    const match = s.events.find((event) => event.type === 'match')!;
    expect(cuesOfEvent(match, s, memory)).toEqual([]);
    const [beat] = beatsOf(s, s.events);
    const cue = cueOfBeat(beat, s.config.size, 0);
    expect(cue).toMatchObject({ kind: 'group', face: 2, count: 2, tier: 0 });
    expect(part(notesFor(cue!, setup()), 'arp').length).toBe(2);
  });

  it('remembers the face of a die until it has gone under', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    for (const event of s.events) cuesOfEvent(event, s, memory);
    const heard: Cue[] = [];
    for (let i = 0; i < s.config.sinkingTicks + 5; i++) {
      step(s, null);
      for (const event of s.events) heard.push(...cuesOfEvent(event, s, memory));
    }
    const sunk = heard.filter((cue) => cue.kind === 'sunk');
    expect(sunk.length).toBe(2);
    expect(sunk.every((cue) => cue.kind === 'sunk' && cue.face === 2)).toBe(true);
    // A group that no chain was added to ends without a word.
    expect(heard.some((cue) => cue.kind === 'chainEnd')).toBe(false);
  });

  /** Plays the second piece of the road by its way and says every die that was heard going under, in order. */
  const stairHeard = (memory: ScoreMemory): Cue[] => {
    const s = createRun({ seed: ROAD[1].seed, config: defaultConfig(), level: ROAD[1] });
    noteLaid(s, memory);
    const heard: Cue[] = [];
    // Up the stair, over to the die beyond it, and the first roll: the stair goes with that move.
    for (const dir of ['N', 'N', 'N'] as const) {
      for (let i = 0; i <= s.config.actionTicks * 2; i++) {
        step(s, i === 0 ? dir : null);
        for (const event of s.events) heard.push(...cuesOfEvent(event, s, memory));
      }
    }
    return heard.filter((cue) => cue.kind === 'sunk');
  };

  it('a die the board was laid with as leaving goes under on the note of its own face, though no group was said', () => {
    const sunk = stairHeard(new ScoreMemory());
    expect(sunk.length).toBe(1);
    // The stair of the second piece shows a six.
    expect(sunk[0]).toMatchObject({ kind: 'sunk', face: 6 });
  });

  it('keeps such a die in mind when its move is taken back: it is not forgotten once it has gone', () => {
    const memory = new ScoreMemory();
    stairHeard(memory);
    const s = createRun({ seed: ROAD[1].seed, config: defaultConfig(), level: ROAD[1] });
    const stair = s.cubes.find((cube) => cube.state === 'sinking')!;
    expect(cuesOfEvent({ type: 'removed', cubeId: stair.id }, s, memory)).toEqual([{ kind: 'sunk', face: 6, pan: 0 }]);
    memory.reset();
    expect(cuesOfEvent({ type: 'removed', cubeId: stair.id }, s, memory)).toEqual([{ kind: 'sunk', face: 1, pan: 0 }]);
  });

  it('a die of a group goes under on the face its group was said with, laid as leaving or not', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    memory.laid.set(7, 6);
    memory.sinking.set(7, 2);
    expect(cuesOfEvent({ type: 'removed', cubeId: 7 }, s, memory)).toEqual([{ kind: 'sunk', face: 2, pan: 0 }]);
    // And a die nothing is known of goes under on the note it always had.
    expect(cuesOfEvent({ type: 'removed', cubeId: 8 }, s, memory)).toEqual([{ kind: 'sunk', face: 1, pan: 0 }]);
  });

  it('keeps nothing in mind of a board with no die laid as leaving, nor of dice that go by their group', () => {
    const memory = new ScoreMemory();
    noteLaid(createRun({ seed: ROAD[0].seed, config: defaultConfig(), level: ROAD[0] }), memory);
    expect(memory.laid.size).toBe(0);
    const s = emptyRun();
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    noteLaid(s, memory);
    expect(memory.laid.size).toBe(0);
  });

  it('lets a chain ring out once, when its last die has gone', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    s.reactions = [{ id: 4, value: 3, chain: 3, total: 9 }];
    const chain: GameEvent = { type: 'chain', reactionId: 4, value: 3, chain: 3, count: 3, points: 81 };
    expect(cuesOfEvent(chain, s, memory)).toEqual([]);
    expect(cuesOfEvent({ type: 'landed' }, s, memory).some((cue) => cue.kind === 'chainEnd')).toBe(false);
    s.reactions = [];
    expect(cuesOfEvent({ type: 'landed' }, s, memory)).toContainEqual({ kind: 'chainEnd', face: 3, chain: 3 });
    expect(cuesOfEvent({ type: 'landed' }, s, memory).some((cue) => cue.kind === 'chainEnd')).toBe(false);
  });

  it('says nothing of a chain that has been taken into another', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    s.reactions = [
      { id: 1, value: 3, chain: 2, total: 6 },
      { id: 2, value: 3, chain: 2, total: 6 },
    ];
    cuesOfEvent({ type: 'chain', reactionId: 1, value: 3, chain: 2, count: 3, points: 1 }, s, memory);
    cuesOfEvent({ type: 'chain', reactionId: 2, value: 3, chain: 2, count: 3, points: 1 }, s, memory);
    s.reactions = [{ id: 1, value: 3, chain: 3, total: 12 }];
    const cues = cuesOfEvent({ type: 'chain', reactionId: 1, value: 3, chain: 3, count: 3, points: 1 }, s, memory);
    expect(cues.some((cue) => cue.kind === 'chainEnd')).toBe(false);
    expect([...memory.open.keys()]).toEqual([1]);
  });

  it('forgets a run when the next one begins', () => {
    const memory = new ScoreMemory();
    memory.open.set(1, { face: 2, chain: 4 });
    memory.sinking.set(7, 2);
    memory.sent.add(2);
    memory.reset();
    expect(memory.open.size + memory.sinking.size + memory.sent.size).toBe(0);
  });

  it('ends a session, and rings a task that is solved with the faces it took', () => {
    const s = emptyRun();
    const memory = new ScoreMemory();
    expect(cuesOfEvent({ type: 'gameOver' }, s, memory)).toEqual([{ kind: 'end' }]);
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    for (const event of s.events) cuesOfEvent(event, s, memory);
    expect(cuesOfEvent({ type: 'cleared' }, s, memory)).toEqual([{ kind: 'cleared', faces: [2] }]);
  });

  it('turns the beats that are not groups into their sounds', () => {
    expect(cueOfBeat(stepBeat(), 7, 0.5)).toEqual({ kind: 'contact', stage: CONTACT_STEPS.length / 2 });
    expect(cueOfBeat(peakBeat(), 7, 1)).toEqual({ kind: 'peak' });
    expect(cueOfBeat({ kind: 'level', value: 0, tier: 0, cells: [], points: 0, chain: 0 }, 7, 0)).toEqual({ kind: 'level' });
    const ones = cueOfBeat({ kind: 'one', value: 1, tier: 2, cells: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 3, z: 3 }], points: 3, chain: 0 }, 7, 0);
    expect(ones).toMatchObject({ kind: 'ones', count: 3 });
    const chain = cueOfBeat({ kind: 'chain', value: 4, tier: 2, cells: [{ x: 6, z: 3 }], points: 48, chain: 3 }, 7, 0);
    expect(chain).toMatchObject({ kind: 'chain', face: 4, chain: 3, tier: 2 });
    expect(chain && 'pan' in chain && chain.pan).toBeGreaterThan(0);
  });
});

describe('the notes that are made once, unheard, when the sound opens', () => {
  it('are one of every voice, a knock on each of its attacks and the muffled ones, off to a side and into the echo', async () => {
    const { warmNotes } = await import('./voices');
    const notes = warmNotes();
    expect(new Set(notes.map((note) => note.voice))).toEqual(new Set(['bell', 'knock', 'click', 'low', 'other']));
    expect(notes.filter((note) => note.voice === 'knock' && !note.dull).map((note) => note.variant)).toEqual([0, 1, 2, 3]);
    expect(notes.some((note) => note.voice === 'knock' && note.dull)).toBe(true);
    expect(notes.some((note) => note.voice === 'click' && note.dull)).toBe(true);
    for (const note of notes) {
      expect(Math.abs(note.pan)).toBeGreaterThan(0.001);
      expect(note.echo).toBeGreaterThan(0);
      expect(note.at).toBe(0);
    }
  });
});
