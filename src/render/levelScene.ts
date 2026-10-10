import type { Display } from '../display/display';
import type { Layer } from '../display/layer';
import type { RunState } from '../rules';
import { frameDef, thingParam, type Recipe } from '../signal/compose';
import { mixColor, sceneValues, signalLook, type ParamValues, type SceneInstance } from '../signal/scene';
import { boardPalette, type BoardLook } from './params';

/**
 * The places that stand behind the board of a level, one after another: each is one of the
 * open places transmissions are made of, with the thing that is set aside of the board, and
 * the red sun over it. A probe: which places there are, and in what order, is not decided.
 */
const PLACES: readonly { recipe: Recipe; values: Partial<ParamValues> }[] = [
  { recipe: { id: 'level_sea', place: 'sea', things: ['pole', 'sun'] }, values: {} },
  { recipe: { id: 'level_field', place: 'field', things: ['tree', 'sun'] }, values: {} },
  { recipe: { id: 'level_glare', place: 'glare', things: ['pole', 'sun'] }, values: { [thingParam('pole', 'count')]: 3 } },
];
/** How much further off than in its transmission the thing stands, in metres: small, with all of it in the picture. */
const THING_AWAY = 16;
/** How many times a second the place is drawn anew. */
const DRAWS_A_SECOND = 30;
/** A frame that comes later than this after the one before is the page having been away: the place does not jump on. */
const AWAY_MS = 100;
/** A place that has just come is brought up out of the dark over this long, in milliseconds. */
const COME_MS = 1800;

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

/**
 * A place of the other side behind the board, while a level is played: far off, dim, and never
 * still. Its water moves, the wires of its pole sway, the camera drifts a little, and its sun
 * goes down too slowly to be seen going. It is one of the scenes transmissions are made of,
 * drawn small as they are, with its colours taken part of the way to the dark of the board: it
 * gives the board a space to stand in and is not something to look at.
 *
 * It answers the board - see `STIR` and the rest above - and it is another place every few
 * levels. It never gets darker: nothing here counts down.
 *
 * The time of the place is its own: it runs only while the place is shown, so a sun that has
 * gone some way down is found there again on the next level.
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
  /** What the board has told the place and it has not yet let go of, and what of that it shows now. */
  private readonly told = { stir: 0, swell: 0, flare: 0, gust: 0 };
  private readonly shown = { stir: 0, swell: 0, flare: 0 };
  /** The board as the last frame had it: whether the figure was on a move, how many dice were going, whether it was passed. */
  private moving = false;
  private going = -1;
  private passed = false;

  constructor(
    private readonly display: Display,
    private readonly look: BoardLook,
    /** The layer of the board: the place lies under it. */
    under: Layer,
  ) {
    this.layer = display.addLayer({ name: 'level-scene', lines: 240, look: { opacity: 0 } }, under);
  }

  /**
   * Draws the place for this frame, or puts it away where `state` is null. `place` is which of
   * the places it is, counted round. `still` holds everything in it where it is: for whoever
   * has asked for less motion.
   */
  frame(timeMs: number, state: RunState | null, place: number, still: boolean): void {
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

    const dark = boardPalette(this.look).bg;
    const index = ((Math.round(place) % PLACES.length) + PLACES.length) % PLACES.length;
    const key = [index, dark, n('backMute'), n('backDrift'), n('backSunset'), n('backPitch'), n('backAside')].join('|');
    if (key !== this.built) this.build(key, index, dark);
    const { instance, values, layer, display } = this;
    if (!instance || !values || !this.ready) {
      layer.look.opacity = 0;
      return;
    }
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

  private build(key: string, index: number, dark: string): void {
    const n = (name: string): number => Number(this.look.board[name] ?? 0);
    const { recipe, values: own } = PLACES[index];
    const def = frameDef(recipe);
    const values = sceneValues(def, 'a', 'dream');
    // Every colour of the place goes part of the way to the dark of the board.
    const mute = n('backMute');
    for (const [name, spec] of Object.entries(def.params)) {
      if (spec.kind === 'color') values[name] = mixColor(String(values[name]), dark, mute);
    }
    for (const [name, value] of Object.entries(own)) if (name in values && value !== undefined) values[name] = value;
    values.drift = n('backDrift');
    // The board stands in the middle of the screen: the horizon is put over it, and the thing beside it.
    values.camPitch = n('backPitch');
    const thing = recipe.things[0];
    values[thingParam(thing, 'x')] = n('backAside');
    values[thingParam(thing, 'z')] = -THING_AWAY;
    values[thingParam('sun', 'fall')] = n('backSunset');
    const before = this.instance;
    const instance = def.build(values, 1);
    this.built = key;
    this.values = values;
    this.instance = instance;
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
