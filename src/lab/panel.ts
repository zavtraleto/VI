import GUI, { type Controller } from 'lil-gui';
import { PLACES } from '../signal/places';
import { RECIPES } from '../signal/recipes';
import { LOOK_PARAMS, MOODS, type Mood, type ParamSpec } from '../signal/scene';
import { THINGS } from '../signal/things';
import type { Lab } from './lab';

/** Narrower than this, the panel starts folded: on a phone it would cover the picture. */
const NARROW_PX = 600;
const COPY_LABEL = 'Скопировать параметры';
/** No thing in this place of the frame, and a frame that has no name. */
const NONE = '—';
/** How many things a frame can be given by hand. */
const SLOTS = 4;

/**
 * The controls of the lab: a named scene, or a place and the things in it; variant, mood and
 * contact; the seed; every parameter of the place and of each thing; the caption.
 */
export class Panel {
  private gui!: GUI;

  constructor(private readonly lab: Lab) {
    this.build();
    if (window.innerWidth < NARROW_PX) this.gui.close();
  }

  private build(): void {
    const { lab } = this;
    const gui = new GUI({ title: 'VI · лаборатория' });
    this.gui = gui;

    // The panel edits this copy and tells the lab; the lab stays the owner of the state.
    const named = RECIPES.includes(lab.recipe);
    const head: Record<string, unknown> & { seed: number; caption: string; contact: number } = {
      scene: named ? lab.recipe.id : NONE,
      place: lab.recipe.place,
      variant: lab.variant,
      mood: lab.mood,
      contact: lab.contact,
      random: () => {
        lab.random();
        this.rebuild();
      },
      seed: lab.seed,
      next: () => seed.setValue(head.seed + 1),
      caption: lab.caption,
      copy: () => {
        void lab.copy().then((done) => {
          copy.name(done ? 'Скопировано' : 'Не вышло скопировать');
          window.setTimeout(() => copy.name(COPY_LABEL), 1500);
        });
      },
      reset: () => {
        lab.reset();
        this.refresh();
      },
    };

    gui
      .add(head, 'scene', [NONE, ...RECIPES.map((recipe) => recipe.id)])
      .name('сцена')
      .onChange((id: string) => {
        if (id === NONE) return;
        lab.setScene(id);
        this.rebuild();
      });

    // A frame by hand: a place and up to four things in it. The first is the one the camera is set for.
    const frame = gui.addFolder('Кадр');
    const things = (): string[] => Array.from({ length: SLOTS }, (_, i) => String(head[`thing${i}`])).filter((id) => id !== NONE);
    const compose = (): void => {
      lab.setFrame(String(head.place), things());
      this.rebuild();
    };
    frame.add(head, 'place', PLACES.map((place) => place.id)).name('место').onChange(compose);
    for (let i = 0; i < SLOTS; i++) {
      head[`thing${i}`] = lab.recipe.things[i] ?? NONE;
      frame.add(head, `thing${i}`, [NONE, ...THINGS.map((thing) => thing.id)]).name(`предмет ${i + 1}`).onChange(compose);
    }
    frame.add(head, 'random').name('Случайный кадр');
    gui
      .add(head, 'variant', Object.keys(lab.def.variants))
      .name('вариант')
      .onChange((variant: string) => {
        lab.setVariant(variant);
        this.refresh();
      });
    const mood = gui
      .add(head, 'mood', [...MOODS])
      .name('настроение')
      .onChange((value: Mood) => {
        lab.setMood(value);
        head.contact = lab.contact;
        this.refresh();
      });
    gui
      .add(head, 'contact', 0, 1, 0.01)
      .name('контакт')
      .onChange((value: number) => {
        lab.setContact(value);
        head.mood = lab.mood;
        mood.updateDisplay();
        this.refresh();
      });
    const seed: Controller = gui
      .add(head, 'seed', undefined, undefined, 1)
      .name('сид')
      .onChange((value: number) => lab.setSeed(value));
    gui.add(head, 'next').name('Следующий сид');

    // The parameters of the place, then a folder for each thing: its own and how it stands.
    const look = gui.addFolder('Вид');
    const place = gui.addFolder(`Место: ${lab.recipe.place}`);
    const folders = new Map<string, GUI>();
    for (const [name, spec] of Object.entries(lab.def.params)) {
      const dot = name.indexOf('.');
      if (dot === -1) {
        this.control(name in LOOK_PARAMS ? look : place, name, spec);
        continue;
      }
      const thing = name.slice(0, dot);
      let folder = folders.get(thing);
      if (!folder) {
        folder = gui.addFolder(`Предмет: ${thing}`);
        folders.set(thing, folder);
      }
      this.control(folder, name, spec).name(name.slice(dot + 1));
    }
    look.close();

    gui
      .add(head, 'caption')
      .name('подпись')
      .onChange((text: string) => lab.setCaption(text));
    const copy = gui.add(head, 'copy').name(COPY_LABEL);
    gui.add(head, 'reset').name('Сбросить');
  }

  private control(folder: GUI, name: string, spec: ParamSpec): Controller {
    const { values } = this.lab;
    const control =
      spec.kind === 'number'
        ? folder.add(values, name, spec.min, spec.max, spec.step)
        : spec.kind === 'color'
          ? folder.addColor(values, name)
          : folder.add(values, name);
    return control.onChange(() => this.lab.touch());
  }

  /** Another frame has other parameters: the panel is made anew. Not from inside the callback of a control that is about to go. */
  private rebuild(): void {
    window.setTimeout(() => {
      const closed = this.gui._closed;
      this.gui.destroy();
      this.build();
      if (closed) this.gui.close();
    }, 0);
  }

  /** Shows the values again after the lab has changed them itself. */
  private refresh(): void {
    for (const control of this.gui.controllersRecursive()) control.updateDisplay();
  }
}
