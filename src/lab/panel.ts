import GUI, { type Controller } from 'lil-gui';
import { LOOK_PARAMS, type ParamSpec } from '../signal/scene';
import { SCENES } from '../signal/scenes';
import type { Lab } from './lab';

/** Narrower than this, the panel starts folded: on a phone it would cover the picture. */
const NARROW_PX = 600;
const COPY_LABEL = 'Скопировать параметры';

/** The controls of the lab: scene, variant, seed, every parameter of the scene, the caption. */
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
    const head = {
      scene: lab.def.id,
      variant: lab.variant,
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
      .add(head, 'scene', SCENES.map((scene) => scene.id))
      .name('сцена')
      .onChange((id: string) => {
        lab.setScene(id);
        // Another scene has other parameters. Not from inside the callback of a control that is about to go.
        window.setTimeout(() => {
          const closed = this.gui._closed;
          this.gui.destroy();
          this.build();
          if (closed) this.gui.close();
        }, 0);
      });
    gui
      .add(head, 'variant', Object.keys(lab.def.variants))
      .name('вариант')
      .onChange((variant: string) => {
        lab.setVariant(variant);
        this.refresh();
      });
    const seed: Controller = gui
      .add(head, 'seed', undefined, undefined, 1)
      .name('сид')
      .onChange((value: number) => lab.setSeed(value));
    gui.add(head, 'next').name('Следующий сид');

    const look = gui.addFolder('Вид');
    const scene = gui.addFolder('Сцена');
    for (const [name, spec] of Object.entries(lab.def.params)) {
      this.control(name in LOOK_PARAMS ? look : scene, name, spec);
    }

    gui
      .add(head, 'caption')
      .name('подпись')
      .onChange((text: string) => lab.setCaption(text));
    const copy = gui.add(head, 'copy').name(COPY_LABEL);
    gui.add(head, 'reset').name('Сбросить');
  }

  private control(folder: GUI, name: string, spec: ParamSpec): void {
    const { values } = this.lab;
    const control =
      spec.kind === 'number'
        ? folder.add(values, name, spec.min, spec.max, spec.step)
        : spec.kind === 'color'
          ? folder.addColor(values, name)
          : folder.add(values, name);
    control.onChange(() => this.lab.touch());
  }

  /** Shows the values again after the lab has changed them itself. */
  private refresh(): void {
    for (const control of this.gui.controllersRecursive()) control.updateDisplay();
  }
}
