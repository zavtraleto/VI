import GUI from 'lil-gui';
import type { ParamSpec } from '../signal/scene';
import { SHELL_GROUPS } from '../shell/theme';
import { SHELL_SCREENS, type ShellLab, type ShellScreenName } from './shellLab';

/** Narrower than this, the panel starts folded: on a phone it would cover the picture. */
const NARROW_PX = 600;
const COPY_LABEL = 'Скопировать параметры';

const FOLDERS: Record<keyof typeof SHELL_GROUPS, string> = {
  screen: 'Экран',
  colors: 'Цвета',
  space: 'Кости',
  logo: 'Логотип',
  motion: 'Движение',
  boot: 'Boot',
};

/** What the parameters are called on the panel; one without a name here shows its own. */
const LABELS: Record<string, string> = {
  pixelsTall: 'пикселей по ширине (портрет)',
  pixelsWide: 'пикселей по высоте (широкий)',
  smooth: 'мягкий пиксель',
  blur: 'размытие',
  smear: 'смаз по строкам',
  chroma: 'расхождение цветов',
  glow: 'свечение',
  noise: 'шум',
  scanlines: 'строки развёртки',
  vignette: 'виньетка',
  bgNight: 'фон ночью',
  bgDay: 'фон днём',
  toneNight: 'свечение ночью',
  toneDay: 'свечение днём',
  hour: 'час (−1 — по часам игрока)',
  signal: 'красный: седьмой',
  ch1: 'канал 1',
  ch2: 'канал 2',
  ch3: 'канал 3',
  ch4: 'канал 4',
  ch5: 'канал 5',
  ch6: 'канал 6',
  dim: 'вторичный текст',
  faint: 'тонкие линии',
  spaceYaw: 'поворот, °',
  spacePitch: 'взгляд сверху, °',
  spaceGap: 'расстояние между костями',
  spaceFill: 'размер развёртки',
  spaceBob: 'подъём и спуск',
  spaceBobSec: 'период, с',
  spaceTurn: 'покачивание, °',
  spaceGlass: 'яркость стекла',
  spaceEdge: 'яркость рёбер',
  spaceLit: 'кость под фигурой, ×',
  spaceRings: 'кольца (0 — нет)',
  spaceDepth: 'глубина цвета, бит',
  spaceDither: 'дизеринг',
  hopMs: 'шаг фигуры, мс',
  logoNodes: 'число узлов',
  logoArrange: 'расположение узлов',
  bootLogoScale: 'размер логотипа в boot, ×',
  pressMs: 'отклик на нажатие, мс',
  idleHz: 'частота шума каналов, Гц',
  bootMs: 'первый запуск, мс',
  bootShortMs: 'повторный запуск, мс',
  bootDarkMs: 'тёмный экран, мс',
  bootLinkMs: 'задержка LINK DEVICE, мс',
  bootLogoMs: 'логотип, мс',
};

/** The controls of the shell's lab: the screen, its sample state, every parameter of the look by folders. */
export class ShellPanel {
  constructor(private readonly lab: ShellLab) {
    const gui = new GUI({ title: 'VI · оболочка' });

    // The panel edits this copy and tells the lab; the lab stays the owner of the state.
    const head = {
      screen: lab.screen,
      first: lab.first,
      tutorialFirst: lab.tutorialFirst,
      replay: () => {
        lab.show('boot');
        shown();
      },
      copy: () => {
        void lab.copy().then((done) => {
          copy.name(done ? 'Скопировано' : 'Не вышло скопировать');
          window.setTimeout(() => copy.name(COPY_LABEL), 1500);
        });
      },
      reset: () => {
        lab.reset();
        for (const control of gui.controllersRecursive()) control.updateDisplay();
      },
    };

    const screen = gui
      .add(head, 'screen', [...SHELL_SCREENS])
      .name('экран')
      .onChange((name: ShellScreenName) => lab.show(name));
    gui
      .add(head, 'tutorialFirst')
      .name('меню: обучение не пройдено')
      .onChange((value: boolean) => {
        lab.setTutorialFirst(value);
        shown();
      });
    gui
      .add(head, 'first')
      .name('boot: первый запуск')
      .onChange((value: boolean) => {
        lab.setFirst(value);
        shown();
      });
    gui.add(head, 'replay').name('boot: повторить');
    // The way up the log: the score of the session that goes up it, and the way once more.
    gui.add(lab, 'climbScore', 0, 250000, 10).name('подъём: счёт сессии');
    gui.add({ climb: () => (lab.show('climb'), shown()) }, 'climb').name('подъём: показать');
    // The lab has changed the screen itself: the list follows without asking for it again.
    const shown = (): void => {
      head.screen = lab.screen;
      screen.updateDisplay();
    };

    for (const [group, params] of Object.entries(SHELL_GROUPS)) {
      const folder = gui.addFolder(FOLDERS[group as keyof typeof SHELL_GROUPS]);
      for (const [name, spec] of Object.entries(params)) this.control(folder, name, spec);
      folder.close();
    }

    const copy = gui.add(head, 'copy').name(COPY_LABEL);
    gui.add(head, 'reset').name('Сбросить');
    if (window.innerWidth < NARROW_PX) gui.close();
  }

  private control(folder: GUI, name: string, spec: ParamSpec): void {
    const { values } = this.lab;
    const control =
      spec.kind === 'number'
        ? folder.add(values, name, spec.min, spec.max, spec.step)
        : spec.kind === 'color'
          ? folder.addColor(values, name)
          : spec.kind === 'choice'
            ? folder.add(values, name, spec.options)
            : folder.add(values, name);
    control.name(LABELS[name] ?? name).onChange(() => this.lab.touch());
  }
}
