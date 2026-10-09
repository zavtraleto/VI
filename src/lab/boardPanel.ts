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
  edge: 'Рёбра',
  glass: 'Стекло',
  surface: 'Поверхность',
  figure: 'Фигура',
  signs: 'Знаки',
  screen: 'Экран',
  view: 'Вид',
  road: 'Дорога',
};

/** What the parameters are called on the panel; one without a name here shows its own. */
const LABELS: Record<string, string> = {
  dieRound: 'скругление',
  faceMute: 'все грани: приглушить',
  faceShade: 'грань темнее к краям',
  faceSide: 'боковые грани, доля верхней',
  sideTilt: 'разница двух боковых',
  sideFall: 'боковые темнее к полу',
  faceOff: 'нерабочая грань, доля',
  pipSize: 'размер точек',
  pipOne: 'точка единицы, ×',
  pipDark: 'цвет точек',
  pipDusk: 'сумрак у точки: ширина',
  pipDuskDark: 'сумрак у точки: сила',
  pressDepth: 'кость под игроком ниже',
  edgeWidth: 'ребро: толщина линии',
  edgeBright: 'ребро: яркость',
  edgeSide: 'рёбра не у верхней грани, доля',
  edgePale: 'ребро: тон → белый',
  edgeSpread: 'свет ребра: ширина',
  edgeGlow: 'свет ребра: яркость',
  glassBody: 'сколько кости видно',
  glassFrost: 'матовость',
  glassSolid: 'плотная с высоты',
  glassEdge: 'яркость рёбер',
  glassLow: 'низкая кость, доля',
  sinkMelt: 'уходящая: сколько растворяется',
  riseMelt: 'приходящая: сколько не хватает',
  meshDot: 'решётка: размер точки',
  settleMs: 'встала: переход рёбер, мс',
  gridLine: 'линии клеток',
  gridEdge: 'линия вокруг поля',
  gridBright: 'яркость линий',
  gridFill: 'заливка клеток',
  mannequin: 'цвет манекена',
  figureRed: 'манекен → красный',
  figureGhost: 'видна сквозь кости',
  dockBright: 'зона комбо: уголки на полу',
  dockTop: 'зона комбо: полка, сила',
  shelfDots: 'полка: доля точек',
  warnBright: 'предупреждение',
  scanlines: 'строки развёртки',
  vignette: 'виньетка',
  glow: 'ореол: сила',
  glowReach: 'ореол: дальность, строк',
  glowOver: 'ореол поверх костей, доля',
  glowEdge: 'ореол от рёбер, доля',
  fringe: 'расхождение цветов, строк',
  fringeBeat: 'расхождение на цепочке ×3, строк',
  grain: 'зерно',
  view: 'вид: авто, вся доска, слежение',
  focus: 'доля доски в экране, не меньше',
  minCell: 'клетка при слежении, px',
  followMs: 'догон вида, мс',
  edge: 'игрок от края экрана, доля',
  lens: 'линза поверх кадра (проба)',
  sharp: 'линза: плотность слоя, доля',
  comboStepMs: 'комбо: шаг между костями, мс',
  comboHoldMs: 'комбо: пауза, мс',
  sinkMs: 'комбо: уход под пол, мс',
  eraseMs: 'линии: стирание, мс',
  cameraMs: 'камера: переезд, мс',
  drawMs: 'линии: отрисовка, мс',
  headGlow: 'линии: яркая точка',
  headSize: 'линии: ядро точки, толщин линии',
  headHalo: 'линии: свет вокруг точки, клеток',
  headCore: 'линии: ядро точки добела',
  afterglowMs: 'линии: послесвечение, мс',
  riseMs: 'кости: подъём, мс',
  riseStepMs: 'кости: шаг подъёма, мс',
  fixedTone: 'фиксированная: свет граней',
  fixedEdge: 'фиксированная: свет рёбер',
  signStar: 'знак свайпа: лучи звезды, px',
  signTrail: 'знак свайпа: длина следа, доля',
  signRunMs: 'знак свайпа: пробег, мс',
  signRestMs: 'знак свайпа: пауза, мс',
  signGlow: 'знак свайпа: свечение',
  signLength: 'знак свайпа: длина пробега, клеток',
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
      playGrid: () => lab.playGrid(),
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
      if (group === 'road') {
        // Only here: the lines of the sample board erased and drawn, by hand or as a passage does it.
        folder.add(lab.grid, 'share', 0, 1, 0.005).name('линии: прогресс').listen().onChange(() => lab.holdGrid());
        folder.add(lab.grid, 'erasing').name('ползунок стирает').listen();
        folder.add(head, 'playGrid').name('Сыграть: стереть и нарисовать');
        // Only here: no board of the game has a fixed die yet.
        folder.add(lab, 'fixed').name('две кости фиксированные').onChange((fixed: boolean) => lab.setFixed(fixed));
      }
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
