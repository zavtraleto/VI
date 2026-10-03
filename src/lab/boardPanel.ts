import GUI from 'lil-gui';
import { BOARD_GROUPS } from '../render/params';
import type { ParamSpec, ParamValues } from '../signal/scene';
import { SHELL_GROUPS } from '../shell/theme';
import type { BoardLab } from './boardLab';

/** Narrower than this, the panel starts folded: on a phone it would cover the picture. */
const NARROW_PX = 600;
const COPY_LABEL = 'Скопировать параметры';

const FOLDERS: Record<keyof typeof BOARD_GROUPS, string> = {
  die: 'Кость',
  glass: 'Стекло',
  light: 'Свет',
  surface: 'Поверхность',
  figure: 'Фигура',
  signs: 'Знаки',
  screen: 'Экран',
  view: 'Вид',
};

/** What the parameters are called on the panel; one without a name here shows its own. */
const LABELS: Record<string, string> = {
  dieRound: 'скругление',
  pipSize: 'размер точек',
  pipOne: 'точка единицы, ×',
  faceMute: 'грани 2–6: приглушить',
  faceFall: 'и темнее к шестёрке',
  pipLightFrom: 'светлые точки с грани',
  pipDark: 'тёмные точки',
  pipLight: 'светлые точки',
  faceEdge: 'тёмные рёбра',
  faceShade: 'затенение к краям',
  pressDepth: 'кость под игроком ниже',
  glassBody: 'сколько кости видно',
  glassFrost: 'матовость',
  glassSolid: 'плотная с высоты',
  glassEdge: 'яркость рёбер',
  glassLow: 'низкая кость, доля',
  lightKey: 'основной свет',
  lightAmbient: 'рассеянный свет',
  gridLine: 'линии клеток',
  gridEdge: 'линия вокруг поля',
  gridBright: 'яркость линий',
  gridFill: 'заливка клеток',
  mannequin: 'цвет манекена',
  figureRed: 'манекен → красный',
  figureGhost: 'видна сквозь кости',
  dockBright: 'стыки',
  dockStep: 'стык-ступень: ярче, ×',
  dockTop: 'стык на высоте кости',
  pillarHeight: 'столбы: высота',
  pillarBright: 'столбы: яркость',
  pillarWidth: 'столбы: толщина',
  warnBright: 'предупреждение',
  scanlines: 'строки развёртки',
  vignette: 'виньетка',
  view: 'вид: авто, вся доска, слежение',
  focus: 'доля доски в экране, не меньше',
  minCell: 'клетка при слежении, px',
  followMs: 'догон вида, мс',
  edge: 'игрок от края экрана, доля',
  lens: 'линза поверх кадра (проба)',
  sharp: 'линза: плотность слоя, доля',
  bgNight: 'фон ночью',
  bgDay: 'фон днём',
  toneNight: 'тон ночью',
  toneDay: 'тон днём',
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
};

/** The controls of the board's lab: what is on the board, how deep the contact is, every parameter of the look. */
export class BoardPanel {
  constructor(private readonly lab: BoardLab) {
    const gui = new GUI({ title: 'VI · поле' });

    // The panel edits this copy and tells the lab; the lab stays the owner of the state.
    const head = {
      full: lab.full,
      grey: lab.grey,
      depth: lab.depth,
      channel: lab.channel,
      group: () => lab.pulse(1),
      chain: () => lab.pulse(3),
      turnOver: () => lab.turnOver(),
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

    gui
      .add(head, 'full')
      .name('полное поле')
      .onChange((full: boolean) => lab.setFull(full));
    gui
      .add(head, 'grey')
      .name('оттенки серого')
      .onChange((grey: boolean) => lab.setGrey(grey));
    gui.add(lab, 'cost').name('мс на кадр').listen().disable();

    const camera = gui.addFolder('Камера');
    camera.add(lab.camera, 'yaw', 0, 45, 1).name('поворот, °').onChange(() => lab.setCamera());
    camera.add(lab.camera, 'pitch', 20, 85, 1).name('взгляд сверху, °').onChange(() => lab.setCamera());
    // Where the figure stands: the followed view goes after it.
    camera.add(lab.stand, 'x', 0, lab.cells - 1, 1).name('игрок: x').onChange(() => lab.place());
    camera.add(lab.stand, 'z', 0, lab.cells - 1, 1).name('игрок: z').onChange(() => lab.place());
    camera.add(lab, 'viewNow').name('вид сейчас').listen().disable();
    camera.close();

    const contact = gui.addFolder('Пороги');
    contact
      .add(head, 'depth', 0, lab.deepest, 0.1)
      .name('глубина, шагов')
      .onChange((depth: number) => {
        lab.depth = depth;
      });
    contact
      .add(head, 'channel', [0, 1, 2, 3, 4, 5, 6])
      .name('канал чаще всех')
      .onChange((channel: number) => {
        lab.channel = Number(channel);
      });
    contact.add(head, 'group').name('Группа отправлена');
    contact.add(head, 'chain').name('Цепочка ×3');
    contact.add(head, 'turnOver').name('За последним порогом');
    contact.close();

    for (const [group, params] of Object.entries(BOARD_GROUPS)) {
      const folder = gui.addFolder(FOLDERS[group as keyof typeof BOARD_GROUPS]);
      for (const [name, spec] of Object.entries(params)) this.control(folder, lab.look.board, name, spec);
      folder.close();
    }
    // The colours are the program's: changed here, they are changed for the menu as well.
    const colors = gui.addFolder('Цвета программы');
    for (const [name, spec] of Object.entries(SHELL_GROUPS.colors)) this.control(colors, lab.look.shell, name, spec);
    colors.close();

    const copy = gui.add(head, 'copy').name(COPY_LABEL);
    gui.add(head, 'reset').name('Сбросить');
    if (window.innerWidth < NARROW_PX) gui.close();
  }

  private control(folder: GUI, values: ParamValues, name: string, spec: ParamSpec): void {
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
