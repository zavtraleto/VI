import { Display } from '../display/display';
import type { CanvasLayer, Layer } from '../display/layer';
import {
  MOODS,
  captionLines,
  contactValues,
  isMood,
  sceneRecord,
  sceneValues,
  signalLook,
  type Mood,
  type ParamValues,
  type SceneDef,
  type SceneInstance,
} from '../signal/scene';
import { captionLook, drawCaption, loadCaptionFont } from '../signal/caption';
import { frameDef, type Recipe } from '../signal/compose';
import { randomFrame } from '../signal/director';
import { placeById } from '../signal/places';
import { RECIPES } from '../signal/recipes';
import { thingById } from '../signal/things';
import { Panel } from './panel';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // No permission, or the page is not focused: the old way below still works.
  }
  // The clipboard API is missing on a page opened over plain http, as from a phone on the same network.
  const area = document.createElement('textarea');
  area.value = text;
  area.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

/** The name a frame goes by in the address when it has no name of its own. */
const CUSTOM = 'frame';

/**
 * The page where a transmission is looked at and tuned:
 * `?lab=sea_pole&variant=b&mood=strange&seed=3`, with `&ui=0` to leave the panel out. A frame
 * put together by hand is `?lab=frame&place=sea&things=pole,chair`.
 */
export class Lab {
  readonly display = new Display();
  /** What the frame is made of: a place and the things in it. */
  recipe: Recipe;
  def: SceneDef;
  /** How strong the contact is, 0..1: the moods in their order, with everything between them. */
  contact = 0;
  variant: string;
  mood: Mood;
  seed: number;
  /** The same object for as long as the scene stays: the panel is bound to it. */
  values: ParamValues;
  caption = '';
  /** What the last copy put on the clipboard. */
  copied: string | null = null;
  private readonly signal: Layer;
  private readonly captionLayer: CanvasLayer;
  private instance: SceneInstance | null = null;
  /** The scene has to be built again before the next frame. */
  private stale = true;

  constructor() {
    const query = new URLSearchParams(window.location.search);
    const place = query.get('place');
    this.recipe =
      RECIPES.find((recipe) => recipe.id === query.get('lab')) ??
      (placeById(place) ? custom(place!, (query.get('things') ?? '').split(',')) : RECIPES[0]);
    this.def = frameDef(this.recipe);
    this.variant = this.knownVariant(query.get('variant'));
    const mood = query.get('mood');
    this.mood = isMood(mood) ? mood : MOODS[0];
    const seed = Number.parseInt(query.get('seed') ?? '', 10);
    this.seed = Number.isFinite(seed) ? seed : 1;
    const contact = Number.parseFloat(query.get('contact') ?? '');
    this.contact = Number.isFinite(contact) ? Math.min(1, Math.max(0, contact)) : MOODS.indexOf(this.mood) / (MOODS.length - 1);
    // The contact is the finer of the two: the mood shown is the one nearest to it.
    this.mood = MOODS[Math.round(this.contact * (MOODS.length - 1))];
    this.values = contactValues(this.def, this.variant, this.contact);

    this.caption = query.get('caption') ?? '';

    const lines = Number(this.values.lines);
    this.signal = this.display.addLayer({ name: 'signal', lines });
    this.captionLayer = this.display.addCanvasLayer({ name: 'caption', lines: this.captionLines(lines) });
    this.captionLayer.onResize = () => this.drawCaption();
    this.drawCaption();
    void loadCaptionFont(this.caption).then(() => this.drawCaption());

    if (query.get('ui') !== '0') new Panel(this);
    const loop = (time: number): void => {
      requestAnimationFrame(loop);
      this.frame(time);
    };
    requestAnimationFrame(loop);
  }

  /** Draws one frame. Called from the console where frames have to be stepped by hand. */
  frame(timeMs: number): void {
    this.display.sync();
    if (this.stale || !this.instance) this.rebuild();
    // The window may have turned since the last frame.
    this.captionLayer.setLines(this.captionLines(Number(this.values.lines)));
    const instance = this.instance!;
    instance.update(timeMs, this.display.width / this.display.height);
    this.signal.render(instance.scene, instance.camera);
    this.display.present(timeMs);
  }

  /** A parameter or the seed has changed: the scene is built anew, time goes on. */
  touch(): void {
    this.stale = true;
  }

  /** A frame that has a name. */
  setScene(id: string): void {
    const recipe = RECIPES.find((item) => item.id === id);
    if (recipe) this.setRecipe(recipe);
  }

  /** A frame put together by hand: a place and the things in it. Things that are not there are left out. */
  setFrame(place: string, things: readonly string[]): void {
    if (placeById(place)) this.setRecipe(custom(place, things));
  }

  /** A frame as chance and the contact make it: what the game shows. */
  random(): void {
    const frame = randomFrame(Math.random, this.contact);
    this.setRecipe(frame.recipe, frame.variant);
    for (const [name, value] of Object.entries(frame.values)) {
      if (name in this.values && value !== undefined) this.values[name] = value;
    }
    this.seed = 1 + Math.floor(Math.random() * 9999);
    this.touch();
    this.writeAddress();
  }

  /** The moods in their order, with everything between two of them mixed. */
  setContact(contact: number): void {
    this.contact = Math.min(1, Math.max(0, contact));
    this.mood = MOODS[Math.round(this.contact * (MOODS.length - 1))];
    Object.assign(this.values, contactValues(this.def, this.variant, this.contact));
    this.touch();
    this.writeAddress();
  }

  private setRecipe(recipe: Recipe, variant: string | null = null): void {
    this.recipe = recipe;
    this.def = frameDef(recipe);
    this.variant = this.knownVariant(variant);
    this.values = contactValues(this.def, this.variant, this.contact);
    this.touch();
    this.writeAddress();
  }

  setVariant(variant: string): void {
    this.variant = this.knownVariant(variant);
    this.reset();
    this.writeAddress();
  }

  setMood(mood: Mood): void {
    this.mood = mood;
    this.contact = MOODS.indexOf(mood) / (MOODS.length - 1);
    this.reset();
    this.writeAddress();
  }

  setSeed(seed: number): void {
    this.seed = Math.round(seed) | 0;
    this.touch();
    this.writeAddress();
  }

  /** Back to the variant and the mood as they are defined. The seed stays. */
  reset(): void {
    Object.assign(this.values, sceneValues(this.def, this.variant, this.mood));
    this.touch();
  }

  /** `|` starts a new line; long lines wrap by themselves. */
  setCaption(text: string): void {
    this.caption = text;
    this.drawCaption();
    this.writeAddress();
  }

  /** The tuned scene as JSON: its id, the seed and the values that differ from the defaults. */
  json(): string {
    const record: Record<string, unknown> = { ...sceneRecord(this.def, this.seed, this.values) };
    if (this.caption) record.caption = this.caption;
    return JSON.stringify(record, null, 2);
  }

  async copy(): Promise<boolean> {
    const text = this.json();
    const done = await copyText(text);
    this.copied = done ? text : null;
    return done;
  }

  private knownVariant(name: string | null): string {
    const names = Object.keys(this.def.variants);
    return name !== null && names.includes(name) ? name : (names[0] ?? '');
  }

  private rebuild(): void {
    this.instance?.dispose();
    this.instance = this.def.build(this.values, this.seed);
    this.stale = false;
    const look = signalLook(this.values);
    this.signal.setLines(Number(this.values.lines));
    Object.assign(this.signal.look, look);
    Object.assign(this.captionLayer.look, captionLook(look));
  }

  private captionLines(lines: number): number {
    return captionLines(lines, this.display.width / this.display.height);
  }

  private drawCaption(): void {
    const { ctx, width, height } = this.captionLayer;
    ctx.clearRect(0, 0, width, height);
    drawCaption(ctx, this.caption, 0, 0, width, height);
    this.captionLayer.markDirty();
  }

  /** The address always names what is on screen, so it can be reloaded or sent to a phone. */
  private writeAddress(): void {
    const query = new URLSearchParams(window.location.search);
    const named = RECIPES.includes(this.recipe);
    query.set('lab', named ? this.recipe.id : CUSTOM);
    if (named) {
      query.delete('place');
      query.delete('things');
    } else {
      query.set('place', this.recipe.place);
      query.set('things', this.recipe.things.join(','));
    }
    query.set('variant', this.variant);
    query.set('mood', this.mood);
    query.set('contact', String(Number(this.contact.toFixed(2))));
    query.set('seed', String(this.seed));
    if (this.caption) query.set('caption', this.caption);
    else query.delete('caption');
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
  }
}

/** A frame put together by hand; what is named but is not there is left out. */
function custom(place: string, things: readonly string[]): Recipe {
  const known = [...new Set(things.map((id) => id.trim()).filter((id) => thingById(id)))];
  return { id: `${place}:${known.join('+')}`, place, things: known };
}

export function startLab(): Lab {
  const lab = new Lab();
  // For the console, and for stepping frames where the browser does not run them itself.
  (window as unknown as { lab: Lab }).lab = lab;
  return lab;
}
