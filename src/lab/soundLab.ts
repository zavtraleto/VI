import GUI from 'lil-gui';
import { chainTier, matchTier } from '../app/juice';
import { CONTACT_STEPS } from '../app/ritual';
import { AudioEngine } from '../audio/engine';
import { SOUND_GROUPS, SOUND_PARAMS, soundChanged } from '../audio/params';
import type { Cue } from '../audio/score';
import type { ParamSpec, ParamValues } from '../signal/scene';
import { copyText } from './clipboard';

/** Narrower than this, the panel starts folded. */
const NARROW_PX = 600;
const COPY_LABEL = 'Скопировать параметры';
/** How far apart the links of a chain played here are, in milliseconds: about as a player adds them. */
const LINK_MS = 650;
/** How often the readings of the panel are taken, and how long the loudest peak stays shown. */
const READ_MS = 100;
const PEAK_HOLD_MS = 1500;

const FOLDERS: Record<keyof typeof SOUND_GROUPS, string> = {
  tuning: 'Строй',
  volume: 'Громкости',
  space: 'Пространство',
  bell: 'Колокол',
  knock: 'Стук',
  low: 'Низ',
  program: 'Щелчок программы',
  other: 'Голос той стороны',
  limits: 'Пределы',
};

/** What the parameters are called on the panel; one without a name here shows its own. */
const LABELS: Record<string, string> = {
  mode: 'лад',
  root: 'основной тон',
  octave: 'октава основного тона',
  fine: 'подстройка, центы (21.3 — от тона 1 кГц)',
  drift: 'неточность с контактом, центы',
  volMaster: 'общая',
  volBoard: 'поле: стук и низ',
  volBell: 'колокол: сбор и цепочка',
  volProgram: 'программа',
  volOther: 'та сторона',
  verbTail: 'длина хвоста эха, с',
  verbLevel: 'сколько эха',
  verbContact: 'прибавка эха с контактом',
  stereo: 'ширина стерео',
  bellOctave: 'октава колокола',
  bellRatio: 'отношение модулятора',
  bellBright: 'яркость удара',
  bellTail: 'длина звона, с',
  bellDetune: 'расстройка второго тона, центы',
  bellBody: 'тело: октава под нотой',
  bellVerb: 'доля эха',
  arpGap: 'между нотами перебора, с',
  chainGrow: 'рост на звено цепочки',
  knockOctave: 'октава стука',
  knockLen: 'длина, с',
  knockClick: 'доля щелчка в атаке',
  knockWood: 'дерево: верхний тон',
  knockVerb: 'доля эха',
  rollGain: 'громкость переката',
  lowGain: 'громкость',
  lowLen: 'длина, с',
  lowDrop: 'с какой высоты падает, ×',
  clickOctave: 'октава щелчка',
  clickLen: 'длина, с',
  otherAttack: 'атака, с',
  otherTail: 'длина, с',
  otherVerb: 'доля эха',
  otherDetune: 'расстройка второго тона, центы',
  replyChance: 'ответ: как часто при полном контакте',
  replyGain: 'ответ: громкость',
  replyFrom: 'ответ: с какого контакта',
  maxVoices: 'голосов одновременно, не больше',
};

/** The modes by the names they are known by. */
const MODE_LABELS: Record<string, string> = {
  'ин (мияко-буси)': 'in',
  'хирадзёси': 'hirajoshi',
  'минорная пентатоника': 'pentatonic',
  'натуральный минор': 'minor',
};

/**
 * The page where the sound is listened to and tuned: `?lab=sound`. There is no game on it: a
 * button for everything that can be heard in a session, a chain of as many links as asked for,
 * a short session played by itself, and every parameter of the sound.
 */
export function startSoundLab(): void {
  const engine = new AudioEngine();
  // For looking at it from the console.
  (window as unknown as { viSound: AudioEngine }).viSound = engine;
  const unlock = (): void => void engine.unlock();
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  const head = {
    face: 3,
    count: 3,
    link: 2,
    links: 6,
    ones: 3,
    around: 3,
    place: 0,
    points: 48,
    contact: 0,
    figure: 1,
    words: 'мы тебя не услышим, пока канал закрыт',
  };
  const fire = (cue: Cue): void => engine.play(cue);
  const timers: number[] = [];
  const later = (ms: number, act: () => void): void => {
    timers.push(window.setTimeout(act, ms));
  };
  const halt = (): void => {
    for (const timer of timers) window.clearTimeout(timer);
    timers.length = 0;
  };

  const group = (face: number, count: number, pan = head.place): Cue => ({ kind: 'group', face, count, tier: matchTier(count), pan });
  const link = (face: number, chain: number, count: number, pan = head.place): Cue => ({ kind: 'chain', face, chain, count, tier: chainTier(chain), pan });
  const roll = (face: number, pan: number): void => fire({ kind: 'roll', face, crowd: head.around / 8, pan });
  /** Points reach the score, and the counter runs up for a moment. */
  const score = (points: number, tier: number): void => {
    fire({ kind: 'points', points, tier });
    for (let i = 1; i <= 10; i++) later(i * 55, () => fire({ kind: 'count' }));
  };
  /** A group, then a link added every so often, and the chain rings out. */
  const chainOf = (face: number, links: number): void => {
    fire(group(face, face));
    for (let chain = 2; chain <= links; chain++) later((chain - 1) * LINK_MS, () => fire(link(face, chain, face + chain - 1)));
    later(links * LINK_MS + 900, () => fire({ kind: 'chainEnd', face, chain: links }));
  };

  /** A short session, so that the sounds are heard together and not one by one. Times are in milliseconds. */
  const session = (): void => {
    const script: [number, Cue | (() => void)][] = [
      [0, { kind: 'begin' }],
      [900, () => roll(2, -0.4)],
      [1300, () => roll(4, -0.2)],
      [1750, () => roll(5, 0)],
      [2050, { kind: 'warned', cell: 0.3, pan: 0.6 }],
      [2300, { kind: 'step', pan: 0.1 }],
      [2600, () => roll(3, 0.2)],
      [2790, group(3, 3, 0.2)],
      [3650, () => score(9, 0)],
      [3900, { kind: 'risen', face: 6, pan: 0.6 }],
      [4200, () => roll(1, 0.3)],
      [4650, () => roll(3, 0.1)],
      [4840, link(3, 2, 3, 0.1)],
      [5700, () => score(36, 1)],
      [5900, { kind: 'push', pan: -0.5 }],
      [6300, () => roll(6, -0.3)],
      [6750, () => roll(3, -0.1)],
      [6940, link(3, 3, 7, -0.1)],
      [7800, () => score(81, 2)],
      [8000, { kind: 'warned', cell: 0.8, pan: -0.7 }],
      [8300, { kind: 'sunk', face: 3, pan: 0 }],
      [8600, () => roll(2, 0)],
      [9050, () => roll(3, 0.3)],
      [9240, link(3, 4, 10, 0.3)],
      [10100, () => score(144, 3)],
      [10500, { kind: 'level' }],
      [11000, { kind: 'sunk', face: 3, pan: 0 }],
      [11400, { kind: 'blocked', pan: 0.3 }],
      [12200, { kind: 'chainEnd', face: 3, chain: 4 }],
      [13600, () => roll(1, -0.2)],
      [13800, { kind: 'ones', count: 3, pan: -0.2 }],
      [15400, { kind: 'contact', stage: 3 }],
      [18200, { kind: 'danger', secondsLeft: 3 }],
      [19200, { kind: 'danger', secondsLeft: 2 }],
      [20200, { kind: 'danger', secondsLeft: 1 }],
      [21200, { kind: 'end' }],
    ];
    halt();
    for (const [ms, what] of script) later(ms, typeof what === 'function' ? what : () => fire(what));
  };

  const actions = {
    roll: () => roll(head.face, head.place),
    rolls: () => {
      // Ten rolls as a player makes them: whatever face comes up, wherever they are.
      for (let i = 0; i < 10; i++) later(i * 230, () => roll(1 + Math.floor(Math.random() * 6), Math.random() * 2 - 1));
    },
    sameRolls: () => {
      // The same face ten times: what there is to tell two knocks on one note apart.
      for (let i = 0; i < 10; i++) later(i * 230, () => roll(head.face, head.place));
    },
    sixes: () => fire(group(6, 6)),
    chainOf: () => {
      halt();
      chainOf(head.face === 1 ? 2 : head.face, head.links);
    },
    session,
    silence: () => {
      halt();
      engine.silence();
    },
    step: () => fire({ kind: 'step', pan: head.place }),
    push: () => fire({ kind: 'push', pan: head.place }),
    landed: () => fire({ kind: 'landed', crowd: head.around / 8, pan: head.place }),
    blocked: () => fire({ kind: 'blocked', pan: head.place }),
    warned: () => fire({ kind: 'warned', cell: Math.random(), pan: Math.random() * 2 - 1 }),
    risen: () => fire({ kind: 'risen', face: head.face, pan: head.place }),
    group: () => fire(group(head.face, head.count)),
    link: () => fire(link(head.face, head.link, head.count)),
    chainEnd: () => fire({ kind: 'chainEnd', face: head.face, chain: head.link }),
    ones: () => fire({ kind: 'ones', count: head.ones, pan: head.place }),
    sunk: () => fire({ kind: 'sunk', face: head.face, pan: 0 }),
    points: () => score(head.points, 1),
    level: () => fire({ kind: 'level' }),
    contact: () => fire({ kind: 'contact', stage: Math.max(1, Math.round(head.contact * CONTACT_STEPS.length)) }),
    peak: () => fire({ kind: 'peak' }),
    danger: () => {
      for (let i = 0; i < 5; i++) later(i * 1000, () => fire({ kind: 'danger', secondsLeft: 5 - i }));
    },
    clock: () => {
      for (let i = 0; i < 3; i++) later(i * 1000, () => fire({ kind: 'clock' }));
    },
    end: () => {
      halt();
      fire({ kind: 'end' });
    },
    cleared: () => fire({ kind: 'cleared', faces: [2, 3, head.face] }),
    deadEnd: () => fire({ kind: 'deadEnd' }),
    fell: () => fire({ kind: 'fell', pan: head.place }),
    begin: () => fire({ kind: 'begin' }),
    // The program and the other side.
    boot: () => {
      // The check of the first start as the boot has it: a line, its answer, a wait before the device that is not there.
      halt();
      for (let i = 0; i < 5; i++) {
        later(i * 420, () => engine.ui({ kind: 'check' }));
        if (i < 4) later(i * 420 + 190, () => engine.ui({ kind: 'answer', found: true }));
      }
      later(4 * 420 + 1500, () => engine.ui({ kind: 'answer', found: false }));
      later(4 * 420 + 3300, () => engine.ui({ kind: 'logo' }));
    },
    logo: () => engine.ui({ kind: 'logo' }),
    menu: () => {
      // The figure walks the six dice of the menu.
      halt();
      [1, 2, 3, 4, 5, 6, 4, 2, 1].forEach((face, i) => later(i * 330, () => engine.ui({ kind: 'step', face })));
    },
    menuStep: () => engine.ui({ kind: 'step', face: head.face }),
    panelStep: () => engine.ui({ kind: 'step', face: null }),
    run: () => engine.ui({ kind: 'run' }),
    back: () => engine.ui({ kind: 'back' }),
    stuck: () => engine.ui({ kind: 'stuck' }),
    open: () => engine.ui({ kind: 'open' }),
    close: () => engine.ui({ kind: 'close' }),
    words: () => {
      // A line of the other side, sign by sign, as the exercise writes it.
      halt();
      [...head.words].forEach((sign, i) => later(i * 38, () => engine.sign(sign)));
    },
    answerWindow: () => {
      halt();
      engine.signal({ kind: 'open', figure: head.figure, contact: head.contact, seconds: 5, glimpse: false });
      later(5000, () => engine.signal({ kind: 'close' }));
    },
    glimpse: () => {
      halt();
      engine.signal({ kind: 'open', figure: head.figure, contact: 0, seconds: 3, glimpse: true });
      later(3000, () => engine.signal({ kind: 'close' }));
    },
    reply: () => {
      // A group, and what comes back of it: always, whatever the contact is, to hear it.
      const cue = group(head.face === 1 ? 2 : head.face, head.count);
      fire(cue);
      fire({ kind: 'reply', heard: [500, 667, 794].slice(0, head.contact > 0.7 ? 3 : 1) });
    },
    deep: () => {
      // A minute of play at full contact: the answers come by themselves.
      halt();
      engine.setContact(1);
      for (let i = 0; i < 16; i++) later(i * 480, () => roll(1 + Math.floor(Math.random() * 6), Math.random() * 2 - 1));
      later(16 * 480, () => chainOf(4, 4));
      later(16 * 480 + 6000, () => engine.setContact(head.contact));
    },
    copy: () => {
      void copyText(JSON.stringify(soundChanged(engine.values), null, 2)).then((done) => {
        copy.name(done ? 'Скопировано' : 'Не вышло скопировать');
        window.setTimeout(() => copy.name(COPY_LABEL), 1500);
      });
    },
    reset: () => {
      for (const [name, spec] of Object.entries(SOUND_PARAMS)) engine.values[name] = spec.value;
      engine.refresh();
      for (const control of gui.controllersRecursive()) control.updateDisplay();
    },
  };

  const gui = new GUI({ title: 'VI · звук', width: 340 });

  // What goes out, as numbers: silence between the sounds can be seen as well as heard.
  const reading = { voices: 0, nodes: 0, peak: '—' };
  gui.add(reading, 'voices').name('голосов сейчас').listen().disable();
  gui.add(reading, 'nodes').name('узлов сейчас').listen().disable();
  gui.add(reading, 'peak').name('пик на выходе, дБ').listen().disable();
  let meter: AnalyserNode | null = null;
  let samples: Float32Array<ArrayBuffer> | null = null;
  let held = 0;
  let heldAt = 0;
  window.setInterval(() => {
    const probe = engine.probe();
    reading.voices = probe.voices + probe.leaving;
    reading.nodes = probe.nodes;
    meter ??= engine.meter();
    if (!meter) return;
    samples ??= new Float32Array(meter.fftSize);
    meter.getFloatTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    const now = performance.now();
    if (peak >= held || now - heldAt > PEAK_HOLD_MS) {
      held = peak;
      heldAt = now;
    }
    reading.peak = held < 0.00001 ? 'тишина' : (20 * Math.log10(held)).toFixed(1);
  }, READ_MS);

  const first = gui.addFolder('С чего начать');
  first.add(actions, 'rolls').name('Десять перекатов подряд');
  first.add(actions, 'sixes').name('Сбор шестёрок');
  first.add(head, 'links', 2, 10, 1).name('звеньев');
  first.add(actions, 'chainOf').name('Цепочка из N звеньев');
  first.add(actions, 'session').name('Сыграть партию');
  first.add(actions, 'silence').name('Тишина');

  const events = gui.addFolder('События партии');
  events.add(head, 'face', [1, 2, 3, 4, 5, 6]).name('грань').onChange((value: number) => (head.face = Number(value)));
  events.add(head, 'count', 2, 9, 1).name('костей в группе');
  events.add(head, 'place', -1, 1, 0.05).name('где на поле: слева — справа');
  events.add(head, 'around', 0, 8, 1).name('костей вокруг');
  events.add(actions, 'roll').name('Перекат');
  events.add(actions, 'sameRolls').name('Перекат: одна грань десять раз');
  events.add(actions, 'step').name('Шаг по костям, переход');
  events.add(actions, 'push').name('Толчок с пола');
  events.add(actions, 'landed').name('Приземление кости');
  events.add(actions, 'blocked').name('Упор, хода нет');
  events.add(actions, 'warned').name('Объявление прихода');
  events.add(actions, 'risen').name('Кость встала');
  events.add(actions, 'group').name('Сбор группы');
  events.add(head, 'link', 2, 10, 1).name('звено цепочки');
  events.add(actions, 'link').name('Цепочка: одно звено');
  events.add(actions, 'chainEnd').name('Конец цепочки');
  events.add(head, 'ones', 1, 8, 1).name('единиц');
  events.add(actions, 'ones').name('Единицы уходят');
  events.add(actions, 'sunk').name('Кость ушла под поверхность');
  events.add(head, 'points', 4, 2000, 1).name('очков');
  events.add(actions, 'points').name('Очки долетели до счёта');
  events.add(actions, 'level').name('Новый уровень, новая фаза');
  events.add(actions, 'contact').name('Порог контакта');
  events.add(actions, 'peak').name('За последним порогом');
  events.add(actions, 'danger').name('Опасность: поле заполнено');
  events.add(actions, 'clock').name('Последние секунды сеанса дня');
  events.add(actions, 'end').name('Конец сессии');
  events.add(actions, 'cleared').name('Задача решена');
  events.add(actions, 'deadEnd').name('Задача: тупик');
  events.add(actions, 'fell').name('Упал на пол');
  events.add(actions, 'begin').name('Поле после обучения');

  const contact = gui.addFolder('Контакт');
  contact
    .add(head, 'contact', 0, 1, 1 / CONTACT_STEPS.length)
    .name('контакт, 0–1')
    .onChange((value: number) => engine.setContact(value));
  contact.add(actions, 'reply').name('Сбор и ответ той стороны');
  contact.add(actions, 'deep').name('Игра при полном контакте');

  const program = gui.addFolder('Программа и та сторона');
  program.add(actions, 'boot').name('Первая загрузка: проверка и логотип');
  program.add(actions, 'logo').name('Логотип: шесть граней');
  program.add(actions, 'menu').name('Меню: фигура идёт по костям');
  program.add(actions, 'menuStep').name('Меню: шаг на кость (грань выше)');
  program.add(actions, 'panelStep').name('Панель: шаг по строкам');
  program.add(actions, 'run').name('Выполнить');
  program.add(actions, 'back').name('Назад');
  program.add(actions, 'stuck').name('Нельзя');
  program.add(actions, 'open').name('Панель открылась');
  program.add(actions, 'close').name('Панель закрылась');
  program.add(head, 'words').name('слова');
  program.add(actions, 'words').name('Та сторона печатает слова');
  program.add(head, 'figure', 1, 9, 1).name('номер снимка');
  program.add(actions, 'answerWindow').name('Окно передачи: ответ');
  program.add(actions, 'glimpse').name('Окно передачи: проблеск');

  const control = (folder: GUI, values: ParamValues, name: string, spec: ParamSpec): void => {
    const added =
      spec.kind === 'number'
        ? folder.add(values, name, spec.min, spec.max, spec.step)
        : spec.kind === 'color'
          ? folder.addColor(values, name)
          : spec.kind === 'choice'
            ? folder.add(values, name, name === 'mode' ? MODE_LABELS : spec.options)
            : folder.add(values, name);
    added.name(LABELS[name] ?? name);
    // The echo is made anew for a new length: once the slider is let go, not at every step of it.
    if (name === 'verbTail') added.onFinishChange(() => engine.refresh());
    else added.onChange(() => engine.refresh());
  };
  for (const [groupName, params] of Object.entries(SOUND_GROUPS)) {
    const folder = gui.addFolder(FOLDERS[groupName as keyof typeof SOUND_GROUPS]);
    for (const [name, spec] of Object.entries(params)) control(folder, engine.values, name, spec);
    // The tuning is what is changed first: it stays open.
    if (groupName !== 'tuning') folder.close();
  }

  const copy = gui.add(actions, 'copy').name(COPY_LABEL);
  gui.add(actions, 'reset').name('Сбросить');
  if (window.innerWidth < NARROW_PX) gui.close();
}
