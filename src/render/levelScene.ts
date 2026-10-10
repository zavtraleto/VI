import * as THREE from 'three';
import type { Display } from '../display/display';
import type { Layer } from '../display/layer';
import type { RunState } from '../rules';
import { frameDef, thingParam, type Recipe } from '../signal/compose';
import { mixColor, sceneValues, signalLook, type ParamValues, type SceneInstance } from '../signal/scene';
import { boardPalette, type BoardLook } from './params';

/** An hour of the day of a place: what differs from the place as it is built, where its sun stands and what its things keep of their light. */
interface Hour {
  values: Partial<ParamValues>;
  /** Degrees over the horizon, the size of the disc in degrees, and its colour. */
  sun: { at: number; size: number; colour: string };
  /** What the things of the place keep of their light: 1 by day. */
  shade: number;
}

interface Place {
  recipe: Recipe;
  /** What every hour of the place has. */
  values: Partial<ParamValues>;
  /** Day, sunset, night: the place goes from the first to the last while it is there. */
  hours: readonly [Hour, Hour, Hour];
}

const pole = (name: string): string => thingParam('pole', name);
const tree = (name: string): string => thingParam('tree', name);

/**
 * The places that stand behind the board of a level, one after another. Each is one of the
 * open places transmissions are made of, with a thing set beside the board and the red sun
 * over it, and each lives through a day while it is there: a clear day, a sunset, a night.
 * A probe: which places there are, and their colours, are not decided.
 */
const PLACES: readonly Place[] = [
  {
    recipe: { id: 'level_sea', place: 'sea', things: ['pole', 'sun'] },
    // Fewer glints than the sea of the transmission has: under a board they are a noise of their own.
    values: { glint: 0.2 },
    hours: [
      { values: { skyTop: '#5f93c7', skyHorizon: '#cfdde6', ground: '#6f96b8', glintColor: '#ffffff', [pole('color')]: '#39424f' }, sun: { at: 16, size: 2.6, colour: '#e8442a' }, shade: 1 },
      { values: { skyTop: '#4b4c80', skyHorizon: '#ea9a5c', ground: '#86605c', glintColor: '#ffd29a', [pole('color')]: '#2a2430' }, sun: { at: 3.5, size: 4.6, colour: '#ff4a1c' }, shade: 0.55 },
      { values: { skyTop: '#060a20', skyHorizon: '#1f2c66', ground: '#0a1230', glintColor: '#c4d0ff', [pole('color')]: '#04050b' }, sun: { at: -8, size: 4.6, colour: '#6a1a18' }, shade: 0.12 },
    ],
  },
  {
    recipe: { id: 'level_field', place: 'field', things: ['tree', 'sun'] },
    // Nearer the middle of the frame than the light of a field stands: the sun is in the picture.
    values: { lightAngle: 168 },
    hours: [
      { values: { skyTop: '#6fa3c9', skyHorizon: '#e3ead6', ground: '#7fa068', [tree('color')]: '#4a4038' }, sun: { at: 16, size: 2.6, colour: '#e8442a' }, shade: 1 },
      { values: { skyTop: '#4b4c80', skyHorizon: '#ea9a5c', ground: '#86703e', [tree('color')]: '#2b2220' }, sun: { at: 3.5, size: 4.6, colour: '#ff4a1c' }, shade: 0.55 },
      { values: { skyTop: '#060a20', skyHorizon: '#1f2c66', ground: '#0c1a1e', [tree('color')]: '#040508' }, sun: { at: -8, size: 4.6, colour: '#6a1a18' }, shade: 0.12 },
    ],
  },
];
/** The size the sun is built with, in degrees: the hours tell it how many times that it is. */
const SUN_SIZE = 3;
/** How much further off than in its transmission the thing stands, in metres: small, with all of it in the picture. */
const THING_AWAY = 16;
/** A window narrower than this share of its height is a tall one; and where the light of the place stands for it, in degrees. */
const TALL = 0.8;
const TALL_LIGHT = 175;
/** How far the ground goes to the dark of the board on top of the rest, and how many times further off the air takes it. */
const GROUND_DARKER = 0.25;
const AIR_CLEARER = 3;
/** Lines of the picture on a tall screen. */
const TALL_LINES = 400;
/** How many times a second the place is drawn anew. */
const DRAWS_A_SECOND = 30;
/** A frame that comes later than this after the one before is the page having been away: the place does not jump on. */
const AWAY_MS = 100;
/** A place that has just come is brought up out of the dark over this long, in milliseconds. */
const COME_MS = 1800;
/** How long the hour of the place takes to come to where the board has brought it, in milliseconds: a level passed is seen as light changing. */
const HOUR_MS = 2600;

/**
 * What the board does to the place. A step of the figure is a small gust in what hangs or
 * stands loose there, a roll of a die a larger one. Every die a combo takes heaves the ground
 * - water, or grass - and the sun flares once. A board cleared is a gust of the whole time of
 * the place: for a moment everything in it goes faster.
 *
 * Each is how much is told at once, how long it takes to come, and how long to go, in
 * milliseconds: none of it jumps.
 */
const STIR = { step: 0.5, roll: 1, comeMs: 90, goMs: 700 };
const SWELL = { die: 0.7, most: 3, comeMs: 350, goMs: 2600 };
const FLARE = { comeMs: 120, goMs: 900 };
const GUST = { speed: 4, goMs: 1600 };

/** `value` on its way to `to`: fast when it has to rise, slow when it falls. */
function toward(value: number, to: number, dt: number, comeMs: number, goMs: number): number {
  const ms = to > value ? comeMs : goMs;
  return value + (to - value) * (1 - Math.exp(-dt / Math.max(1, ms)));
}

/** A number of a scene that an hour may change: a colour, a number or a vector of one of its materials, or the colours of its sky. */
type Cell =
  | { kind: 'colour'; of: THREE.Color }
  | { kind: 'number'; of: { value: number } }
  | { kind: 'vector'; of: THREE.Vector2 | THREE.Vector3 | THREE.Vector4 }
  | { kind: 'points'; of: THREE.BufferAttribute };

/**
 * Every such number of a scene, in the order the scene was built in: the same place built for
 * another hour has the same ones, in the same order. The time a material is told is left out.
 */
function cellsOf(scene: THREE.Scene): Cell[] {
  const cells: Cell[] = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial | undefined;
    if (!material || Array.isArray(material) || !material.uniforms) return;
    for (const name of Object.keys(material.uniforms).sort()) {
      if (name === 'uTime') continue;
      const holder = material.uniforms[name];
      const value = holder.value as unknown;
      if (value instanceof THREE.Color) cells.push({ kind: 'colour', of: value });
      else if (typeof value === 'number') cells.push({ kind: 'number', of: holder as { value: number } });
      else if (value instanceof THREE.Vector2 || value instanceof THREE.Vector3 || value instanceof THREE.Vector4) cells.push({ kind: 'vector', of: value });
    }
    const colours = mesh.geometry?.getAttribute('color');
    if (colours && material.vertexColors) cells.push({ kind: 'points', of: colours as THREE.BufferAttribute });
  });
  return cells;
}

function sizeOf(cell: Cell): number {
  if (cell.kind === 'colour') return 3;
  if (cell.kind === 'number') return 1;
  if (cell.kind === 'vector') return cell.of.toArray().length;
  return cell.of.array.length;
}

/** The numbers of a scene as they stand, one after another. */
function read(cells: readonly Cell[]): Float32Array {
  const out = new Float32Array(cells.reduce((sum, cell) => sum + sizeOf(cell), 0));
  let at = 0;
  for (const cell of cells) {
    if (cell.kind === 'colour') out.set([cell.of.r, cell.of.g, cell.of.b], at);
    else if (cell.kind === 'number') out[at] = cell.of.value;
    else if (cell.kind === 'vector') out.set(cell.of.toArray(), at);
    else out.set(cell.of.array as Float32Array, at);
    at += sizeOf(cell);
  }
  return out;
}

/** Puts into a scene the numbers that lie `share` of the way from one hour to another. */
function write(cells: readonly Cell[], from: Float32Array, to: Float32Array, share: number): void {
  const mix = (index: number): number => from[index] + (to[index] - from[index]) * share;
  let at = 0;
  for (const cell of cells) {
    const size = sizeOf(cell);
    if (cell.kind === 'colour') cell.of.setRGB(mix(at), mix(at + 1), mix(at + 2));
    else if (cell.kind === 'number') cell.of.value = mix(at);
    else if (cell.kind === 'vector') cell.of.fromArray(Array.from({ length: size }, (_, i) => mix(at + i)));
    else {
      const array = cell.of.array as Float32Array;
      for (let i = 0; i < size; i++) array[i] = mix(at + i);
      cell.of.needsUpdate = true;
    }
    at += size;
  }
}

/** Where the board asks the place to be: which place, and what hour of its day, 0 the day and 1 the night. */
export interface PlaceAt {
  place: number;
  day: number;
}

/**
 * A place of the other side behind the board, while a level is played: far off, dim, and never
 * still. Its water moves, the wires of its pole sway, the camera drifts a little. It is one of
 * the scenes transmissions are made of, drawn small as they are, with its colours taken part
 * of the way to the dark of the board: it gives the board a space to stand in and is not
 * something to look at.
 *
 * It lives through a day. Every level passed, and every die sent on the way, moves its hour
 * on: the sun goes down, the sky turns, the water takes the colour of the sunset, and by the
 * last level of its day it is night. The place after it begins with a day again. Nothing of
 * that is cut: the light changes over a few seconds, and what the place is drawn with is the
 * same from the first hour to the last - only its numbers go from one hour to the next.
 *
 * And it answers the board: see `STIR` and the rest above.
 */
export class LevelScene {
  private readonly layer: Layer;
  private instance: SceneInstance | null = null;
  private values: ParamValues | null = null;
  /** What the place was built from: built again when any of it changes. */
  private built = '';
  private ready = false;
  private clock = 0;
  private last = 0;
  /** When the place was last drawn, and the size of the window it was drawn for. */
  private drawn = 0;
  private drawnAt = '';
  /** How far the place that is there has come up out of the dark, 0 to 1. */
  private come = 0;
  /** The numbers of the place that its hours change, and those numbers at each of the three hours; null where the hours do not fit each other. */
  private cells: Cell[] = [];
  private hours: Float32Array[] | null = null;
  private place: Place = PLACES[0];
  private mute = 0;
  private dark = '#000000';
  /** The hour the place is shown at, on its way to the one the board has brought it to; -1 before the first. */
  private hour = -1;
  /** What the board has told the place and it has not yet let go of, and what of that it shows now. */
  private readonly told = { stir: 0, swell: 0, flare: 0, gust: 0 };
  private readonly shown = { stir: 0, swell: 0, flare: 0 };
  /** The board as the last frame had it: whether the figure was on a move, how many dice were going, whether it was passed. */
  private moving = false;
  private going = -1;
  private passed = false;
  /** The most dice the board in hand has had: how many of them are gone is how far the level has got. */
  private most = 0;
  private level = -1;
  private readonly sun = { at: 0, size: 1, r: 1, g: 0, b: 0 };
  private readonly tone = [new THREE.Color(), new THREE.Color()];

  constructor(
    private readonly display: Display,
    private readonly look: BoardLook,
    /** The layer of the board: the place lies under it. */
    under: Layer,
  ) {
    this.layer = display.addLayer({ name: 'level-scene', lines: 240, look: { opacity: 0 } }, under);
  }

  /**
   * Draws the place for this frame, or puts it away where `state` is null. `at` is the level
   * that is played, counted from nought - the place and its hour follow from it and from how
   * much of its board is cleared - or the place and the hour themselves, for whoever tunes
   * them. `still` holds everything in it where it is: for whoever has asked for less motion.
   */
  frame(timeMs: number, state: RunState | null, at: number | PlaceAt, still: boolean): void {
    const n = (name: string): number => Number(this.look.board[name] ?? 0);
    const strength = n('backScene');
    if (!state || strength <= 0) {
      this.layer.look.opacity = 0;
      this.last = 0;
      this.drawn = 0;
      this.going = -1;
      return;
    }
    const dt = this.last === 0 ? 0 : Math.min(AWAY_MS, Math.max(0, timeMs - this.last));
    this.last = timeMs;
    this.listen(state, still ? 0 : n('backReact'), dt);
    if (!still) this.clock += dt * n('backMotion') * (1 + GUST.speed * this.told.gust);

    const asked = typeof at === 'number' ? this.follow(state, at, Math.max(1, Math.round(n('backEvery')))) : at;
    const dark = boardPalette(this.look).bg;
    const index = ((Math.round(asked.place) % PLACES.length) + PLACES.length) % PLACES.length;
    // A tall window shows a narrow strip of the place: it is framed anew for it.
    const tall = this.display.width < this.display.height * TALL;
    const pitch = n(tall ? 'backPitchTall' : 'backPitch');
    const aside = n(tall ? 'backAsideTall' : 'backAside');
    const key = [index, dark, n('backMute'), n('backDrift'), pitch, aside, tall].join('|');
    if (key !== this.built) {
      this.build(key, index, dark, pitch, aside, tall);
      // Another place begins at the hour it is asked for: only the hours of one place run into each other.
      this.hour = -1;
    }
    const { instance, values, layer, display } = this;
    if (!instance || !values || !this.ready) {
      layer.look.opacity = 0;
      return;
    }
    const day = Math.min(1, Math.max(0, asked.day));
    this.hour = this.hour < 0 || still ? day : this.hour + (day - this.hour) * (1 - Math.exp(-dt / HOUR_MS));
    this.come = Math.min(1, this.come + dt / COME_MS);
    layer.setLines(Number(values.lines));
    Object.assign(layer.look, signalLook(values), { opacity: Math.min(1, strength) * this.come * this.come });
    // Nothing in the place moves fast: it is drawn anew a few times a second, and between
    // those the picture of it that is there is shown again. On a screen of 120 frames that is
    // one drawing of the place in four frames of the board.
    const size = `${display.width}x${display.height}`;
    if (this.drawn !== 0 && size === this.drawnAt && timeMs - this.drawn < 1000 / DRAWS_A_SECOND - 1) return;
    this.drawn = timeMs;
    this.drawnAt = size;
    this.light(instance, this.hour);
    instance.live.stir = this.shown.stir;
    instance.live.swell = this.shown.swell;
    instance.live.flare = this.shown.flare;
    instance.update(this.clock, display.width / Math.max(1, display.height));
    layer.render(instance.scene, instance.camera);
  }

  dispose(): void {
    this.instance?.dispose();
    this.instance = null;
    this.display.removeLayer(this.layer);
  }

  /**
   * Which place the level has, and what hour of its day: a place stays for `lasts` levels, and
   * its day runs from the first of them to the end of the last. Within a level the hour moves
   * with the dice that are gone from its board.
   */
  private follow(state: RunState, level: number, lasts: number): PlaceAt {
    if (level !== this.level) {
      this.level = level;
      this.most = 0;
    }
    this.most = Math.max(this.most, state.cubes.length);
    const cleared = this.most > 0 ? 1 - state.cubes.length / this.most : 0;
    return { place: Math.floor(level / lasts), day: ((level % lasts) + cleared) / lasts };
  }

  /** Puts the place at an hour of its day, 0 the day and 1 the night: its colours, its air, its sun and the light of its things. */
  private light(instance: SceneInstance, hour: number): void {
    const { hours } = this.place;
    const span = Math.min(1, hour * 2 > 1 ? hour * 2 - 1 : hour * 2);
    const first = hour * 2 > 1 ? 1 : 0;
    // The sunset is passed through, not stopped at: slow out of an hour and slow into the next.
    const share = span * span * (3 - 2 * span);
    if (this.hours) write(this.cells, this.hours[first], this.hours[first + 1], share);
    const from = hours[first];
    const to = hours[first + 1];
    const mix = (a: number, b: number): number => a + (b - a) * share;
    const [one, two] = this.tone;
    one.set(mixColor(from.sun.colour, this.dark, this.mute * 0.5));
    two.set(mixColor(to.sun.colour, this.dark, this.mute * 0.5));
    one.lerp(two, share);
    const { sun } = this;
    sun.at = mix(from.sun.at, to.sun.at);
    sun.size = mix(from.sun.size, to.sun.size) / SUN_SIZE;
    sun.r = one.r;
    sun.g = one.g;
    sun.b = one.b;
    instance.live.sun = sun;
    instance.live.shade = mix(from.shade, to.shade);
  }

  /** Hears what the board has done since the frame before, `much` times as loud, and lets what it heard before go. */
  private listen(state: RunState, much: number, dt: number): void {
    const { told, shown } = this;
    const action = state.player.action;
    if (action && !this.moving) told.stir = Math.max(told.stir, (action.kind === 'roll' || action.kind === 'push' ? STIR.roll : STIR.step) * much);
    this.moving = Boolean(action);
    let going = 0;
    for (const cube of state.cubes) if (cube.state === 'sinking') going++;
    // The dice a board starts with are not news; nor is a board that is put on in place of another.
    if (this.going >= 0 && going > this.going) {
      told.swell = Math.min(SWELL.most * much, told.swell + (going - this.going) * SWELL.die * much);
      told.flare = Math.min(1, much);
    }
    this.going = going;
    const passed = state.over && state.endReason === 'passed';
    if (passed && !this.passed) {
      told.gust = Math.min(1, much);
      told.swell = Math.max(told.swell, SWELL.most * 0.6 * much);
      told.stir = Math.max(told.stir, STIR.roll * much);
    }
    this.passed = passed;

    shown.stir = toward(shown.stir, told.stir, dt, STIR.comeMs, STIR.goMs);
    shown.swell = toward(shown.swell, told.swell, dt, SWELL.comeMs, SWELL.goMs);
    shown.flare = toward(shown.flare, told.flare, dt, FLARE.comeMs, FLARE.goMs);
    // What was told is let go once it has been shown: it comes up, and then goes by itself.
    if (shown.stir > told.stir * 0.8) told.stir = 0;
    if (shown.swell > told.swell * 0.8) told.swell = 0;
    if (shown.flare > told.flare * 0.8) told.flare = 0;
    told.gust = toward(told.gust, 0, dt, GUST.goMs, GUST.goMs);
  }

  /** The values a place is built from for one of its hours. */
  private valuesFor(place: Place, hour: Hour, dark: string, pitch: number, aside: number, tall: boolean): ParamValues {
    const n = (name: string): number => Number(this.look.board[name] ?? 0);
    const def = frameDef(place.recipe);
    const values = sceneValues(def, 'a', 'dream');
    for (const own of [place.values, hour.values]) {
      for (const [name, value] of Object.entries(own)) if (name in values && value !== undefined) values[name] = value;
    }
    // Every colour of the place goes part of the way to the dark of the board.
    const mute = n('backMute');
    for (const [name, spec] of Object.entries(def.params)) {
      if (spec.kind === 'color') values[name] = mixColor(String(values[name]), dark, mute);
    }
    // A transmission lets its ground go into the air long before the horizon. Behind a board
    // the horizon is what says there is a place at all: the ground is darker than the air over
    // it, and keeps its own tone further out.
    if ('ground' in values) values.ground = mixColor(String(values.ground), dark, GROUND_DARKER);
    if ('fogNear' in values) values.fogNear = Number(values.fogNear) * AIR_CLEARER;
    if ('fogFar' in values) values.fogFar = Number(values.fogFar) * AIR_CLEARER;
    // A narrow strip of 240 lines is some hundred points wide, and soft at that: it gets more of them, and less blur.
    if (tall) {
      values.lines = TALL_LINES;
      values.blur = Number(values.blur) * 0.5;
      values.smear = Number(values.smear) * 0.5;
    }
    values.drift = n('backDrift');
    // The board stands in the middle of the screen: the horizon is put over it, and the thing beside it.
    values.camPitch = pitch;
    const thing = place.recipe.things[0];
    values[thingParam(thing, 'x')] = aside;
    values[thingParam(thing, 'z')] = -THING_AWAY;
    values[thingParam('sun', 'size')] = SUN_SIZE;
    // The strip is some twenty degrees wide: the light, and the sun with it, is brought into it.
    if (tall) values.lightAngle = TALL_LIGHT;
    return values;
  }

  private build(key: string, index: number, dark: string, pitch: number, aside: number, tall: boolean): void {
    const place = PLACES[index];
    const def = frameDef(place.recipe);
    // The place is built once for each of its hours, and only the first is kept to be drawn:
    // of the others their numbers are taken, which the first is given as its day goes.
    const made = place.hours.map((hour) => {
      const values = this.valuesFor(place, hour, dark, pitch, aside, tall);
      const instance = def.build(values, 1);
      const cells = cellsOf(instance.scene);
      return { values, instance, cells, numbers: read(cells) };
    });
    for (const other of made.slice(1)) other.instance.dispose();
    const [day] = made;
    const fits = made.every((one) => one.numbers.length === day.numbers.length);
    if (!fits && import.meta.env.DEV) console.warn(`level scene: the hours of "${place.recipe.id}" do not fit each other`);
    const before = this.instance;
    const { instance } = day;
    this.built = key;
    this.place = place;
    this.mute = Number(this.look.board.backMute ?? 0);
    this.dark = dark;
    this.values = day.values;
    this.instance = instance;
    this.cells = day.cells;
    this.hours = fits ? made.map((one) => one.numbers) : null;
    this.ready = false;
    // What the place is drawn with is made ready before it is shown: built on the frame it
    // first appears, it would hold that frame up.
    void this.layer.warm(instance.scene, instance.camera).then(() => {
      if (this.instance !== instance) return;
      this.ready = true;
      this.drawn = 0;
      this.come = 0;
      before?.dispose();
    });
  }
}
