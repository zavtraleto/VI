import { DE } from './lang/de';
import { ES } from './lang/es';
import { FR } from './lang/fr';
import { PT } from './lang/pt';
import { TR } from './lang/tr';
import { WORDS } from './lang/words';

/**
 * What the game says in the language of the player. The program's own words are in
 * `src/shell/text.ts`; the words of the development tools are in `devText.ts`, which a
 * production build does not carry.
 *
 * Russian and English are here; the other languages are a file each in `lang/`.
 */
const RU = {
  // The exercise. It is not the program that explains: these are the words of the other side,
  // in the white serif. One thought to a line, and the rule in it said plainly.
  tut_roll: 'Ты стоишь на кости. Веди её: она перекатывается, и боковая грань ложится наверх',
  tut_pair: 'Подкати двойку к двойке',
  tut_count: 'Две двойки рядом — и они ушли к нам. Сколько точек на грани, столько костей нужно: три тройки, четыре четвёрки',
  tut_three: 'Тройке нужны три. Вкати свою между ними',
  tut_carry: 'Четвёрка сбоку. Пока катишь вдоль неё, она остаётся сбоку. Довези её и опрокинь наверх',
  tut_floor: 'Твоя кость ушла, ты на полу. Отсюда кости толкают. Придвинь пятёрку к остальным',
  tut_mount: 'Молния: здесь поднимается кость. Шагни на неё, пока она низкая',
  tut_seven: 'Сверху единица — значит, снизу шестёрка: напротив всегда семь. Два переката, и она наверху',
  tut_chain: 'Пока группа уходит, канал открыт. Перейди на соседнюю кость и добавь её к группе: счёт умножится',
  tut_ones: 'Единица — отдельная: единицы не складываются. Подведи её к уходящей группе',
  tut_alone: 'Ушли все отдельные. Остался один: тот, на котором стоишь',
  tut_end: 'Дальше кости приходят сами. Не дай полю заполниться, иначе мы тебя не услышим',
  newBest: 'Новый рекорд',
  dailyBest: 'Лучший результат дня. Сеанс дня один на всех, новый придёт в полночь по UTC',
  dailyNote: 'Сеанс дня один на всех. Новый придёт в полночь по UTC',
  practiceNote: 'Тренировочная партия: рекорд не записан',
  notSaved: 'Хранилище недоступно: рекорд не сохранён',
  hintFloor: 'На полу ты толкаешь кубы',
  hintMount: 'Зайди на появляющийся куб',
  hintChain: 'Добавляй такие же, пока они тонут',
  hintOne: 'Подведи единицу к цепочке — исчезнут все остальные единицы',
  hintLow: 'По прозрачному кубу можно прокатиться',
  customNote: 'Переменные изменены: рекорд не записан',
  tier_intro: 'Знакомство',
  tier_path: 'Длинный путь',
  tier_decoy: 'Ложная пара',
  tier_pair: 'Две группы',
  tier_big: 'Большая группа',
  tier_tight: 'Тесно',
  tier_hard: 'Трудные',
  puzzleHeld: 'Группа собрана. Сойди на соседнюю кость — и она исчезнет',
  deadNoExit: 'Тупик: с группы некуда сойти, а кости ещё остались. Отмени ход',
  deadSingle: 'Тупик: останется одна кость, её не с чем собрать. Отмени ход',
  puzzleRule1: 'Шаг на соседнюю кость ничего не стоит. Перекат своей кости в пустую клетку — это ход',
  puzzleRule2: 'Собери рядом столько костей с одним числом сверху, сколько на них точек: две двойки, три тройки. Единицы не собираются',
  puzzleRule3: 'Собранная группа ждёт, пока ты на ней стоишь. Сойди на соседнюю кость — и группа исчезнет',
  puzzleRule4: 'Печать в углу показывает грани кости под тобой: по ней видно, что перекат положит наверх',
  puzzleRule5: 'Убери все кости. Чем меньше ходов, тем больше звёзд',
  // A level ends at a dead end; with moves that are limited, when they are spent.
  levelStuck: 'Тупик: костей осталось {left}, а на комбо нужно {need}',
  levelShort: 'Ходы кончились. Не хватило: {short}',
  // The rules of the levels, said in the window a level opens with: a thought to a line. A combo
  // is as many dice side by side as their face has pips; a chain is a combo with dice rolled up to
  // it while it leaves.
  //
  // Who says them changes, and is never named. The first are the instruction of the laboratory:
  // terms, counts, what is counted as what. Then the one who speaks begins to watch the player
  // ("the die under you", "you do not see it, but it is there"). Then the words are those of
  // whoever receives the dice: they "are accepted", a leaving die is "already half here", and the
  // last combo "leaves to us". A word or two a window and no more: the rule stays plain in each.
  // Every line is in the log of approvals, with what it gives away.
  lessonThrees: 'Собирай только тройки: три тройки рядом — это комбо, и оно уходит.\nДругие комбинации не работают: их грани перечёркнуты.',
  // The level this was said on has given its place to `lessonWalk`: it stays until the boards of the old ladder are gone.
  lessonStep: 'По костям ходи свободно: шаг ходом не считается.\nХод — это перекат кости.',
  lessonWalk: 'По костям ходи свободно: шаг ходом не считается. Ход — это перекат кости.\nКомбо уходит не сразу: по нему можно пройти и сойти с него на другую кость.',
  lessonLink: 'Комбо уходит два хода.\nЗа это время к нему можно докатить ещё тройку: она уйдёт вместе с ним. Это называется цепочкой.',
  lessonHold: 'Каждая кость в цепочке даёт уходящему комбо ещё один ход.\nДокатил на первом ходу — у комбо снова два хода. На втором — один.',
  lessonFloor: 'Кость под тобой ушла — ты на полу. Сойти на пол с уходящей кости можно и самому.\nС пола кость толкают: она едет, не поворачиваясь. Толчок — это ход.',
  lessonClimb: 'С пола наверх: шагни на уходящую кость.\nС клетки рядом с уходящим комбо поднимешься и на стоящую кость по соседству.\nНа кость, которую некуда толкнуть, тоже: за ней край доски или другая кость.',
  lessonSeven: 'Напротив всегда семь: под четвёркой лежит тройка.\nТы её не видишь, но она там.\nДва переката в одну сторону — и нижняя грань наверху.',
  lessonTwos: 'Теперь принимаются двойки и тройки.\nКомбо двоек — две кости, комбо троек — три.',
  lessonGlass: 'Уходящая кость уже наполовину здесь: по ней можно прокатиться.\nСовпала грань — твоя кость встала в цепочку.',
  lessonFives: 'Собирай только пятёрки: пять пятёрок рядом — это комбо, и оно уходит к нам.\nДругие комбинации не работают.',
  shellProtocol: 'СЕАНС БЕЗ СРОКА',
  shellLimited: 'СЕАНС ДНЯ {time}',
  shellLevels: 'ОЧИСТКА ПОЛЯ',
  shellExercise: 'ПРОВЕРКА НАВЫКА',
  shellTasks: 'ОЧИСТКА КАНАЛА',
  shellRecords: 'ЖУРНАЛ СЕАНСОВ',
  shellSystem: 'ПАРАМЕТРЫ',
  shellHowTo: 'ПОРЯДОК РАБОТЫ',
  shellReadme: 'СОПРОВОДИТЕЛЬНАЯ ЗАПИСКА',
  // How the game is played, as the file of the menu says it: the rules that hold wherever dice are
  // rolled, in the plain words of the instruction, then what a level asks for and what a session does.
  howRoll: 'Ты стоишь на кости и катишь её: боковая грань ложится наверх.\nВ пустую клетку кость катится вместе с тобой. На соседнюю кость ты просто переходишь.\nНапротив всегда семь: под единицей лежит шестёрка.',
  howCombo: 'Комбо — столько костей рядом, сколько точек на их верхней грани: две двойки, три тройки, шесть шестёрок.\nСобранное комбо уходит.',
  howChain: 'Комбо уходит не сразу.\nПока оно уходит, докати к нему ещё кость с той же гранью: она уйдёт вместе с ним. Это цепочка.',
  howOnes: 'Единицы в комбо не собираются.\nПодведи единицу к уходящему комбо — и уйдут все остальные единицы на поле.',
  howLevels: 'УРОВНИ: убери с поля все кости.\nРаботают только грани уровня, остальные перечёркнуты.\nХоды ограничены: чем их меньше, тем больше звёзд.',
  howProtocol: 'ПРОТОКОЛ: кости приходят сами.\nЦепочка умножает счёт.\nПоле заполнилось и не освободилось — сеанс окончен.',
  // What a player sends out with a link to the game: the score is what was sent to the other side.
  shareScore: 'VI — передано на ту сторону: {score}',
};

const EN: typeof RU = {
  tut_roll: 'You stand on a die. Lead it: it rolls, and a side face comes up on top',
  tut_pair: 'Roll the 2 next to the 2',
  tut_count: 'Two 2s side by side, and they are gone to us. As many dice as there are pips: three 3s, four 4s',
  tut_three: 'A 3 takes three. Roll yours in between them',
  tut_carry: 'The 4 is on the side. While you roll along it, it stays on the side. Bring it over and tip it up',
  tut_floor: 'Your die is gone, you are on the floor. From here dice are pushed. Push the 5 to the others',
  tut_mount: 'Lightning: a die rises here. Step onto it while it is low',
  tut_seven: 'A 1 on top means a 6 below: opposite faces make seven. Two rolls, and it is on top',
  tut_chain: 'While a group is leaving, the channel is open. Step onto the next die and add it to the group: the score multiplies',
  tut_ones: 'A 1 is separate: ones never join. Bring it to the leaving group',
  tut_alone: 'Every separate one is gone. One is left: the one you stand on',
  tut_end: 'From here the dice come by themselves. Do not let the board fill up, or we will not hear you',
  newBest: 'New best',
  dailyBest: 'Best of the day. The session of the day is the same for everyone, a new one comes at midnight UTC',
  dailyNote: 'The session of the day is the same for everyone. A new one comes at midnight UTC',
  practiceNote: 'Practice run: record not saved',
  notSaved: 'Storage unavailable: record not saved',
  hintFloor: 'On the floor you push cubes',
  hintMount: 'Step onto a rising cube',
  hintChain: 'Add matching cubes while they sink',
  hintOne: 'Bring a 1 to a chain and every other 1 vanishes',
  hintLow: 'You can roll over a see-through cube',
  customNote: 'Variables changed: record not saved',
  tier_intro: 'First steps',
  tier_path: 'The long way',
  tier_decoy: 'False pair',
  tier_pair: 'Two groups',
  tier_big: 'One big group',
  tier_tight: 'Tight',
  tier_hard: 'Hard',
  puzzleHeld: 'The group is made. Step onto a die next to it and it vanishes',
  deadNoExit: 'Dead end: there is no die to step onto and dice remain. Undo the move',
  deadSingle: 'Dead end: one die would be left with nothing to match. Undo the move',
  puzzleRule1: 'A step onto the next die is free. Rolling your die into an empty cell is a move',
  puzzleRule2: 'Bring together as many dice with the same number on top as that number: two 2s, three 3s. Ones never match',
  puzzleRule3: 'A finished group waits while you stand on it. Step onto a die next to it and the group vanishes',
  puzzleRule4: 'The seal in the corner shows the faces of the die under you: it tells what a roll will bring on top',
  puzzleRule5: 'Clear every die. The fewer moves, the more stars',
  levelStuck: 'Dead end: {left} left on the board, and a combo takes {need}',
  levelShort: 'Out of moves. Short by: {short}',
  lessonThrees: 'Make only 3s: three 3s side by side are a combo, and it leaves.\nOther combinations do not work: their faces are crossed out.',
  lessonStep: 'Walk over the dice freely: a step is not counted as a move.\nA move is a roll of a die.',
  lessonWalk: 'Walk over the dice freely: a step is not counted as a move. A move is a roll of a die.\nA combo does not leave at once: you can walk over it and step off it onto another die.',
  lessonLink: 'A combo leaves in two moves.\nIn that time one more 3 can be rolled up to it: it leaves with the combo. This is called a chain.',
  lessonHold: 'Every die in a chain gives the leaving combo one more move.\nRolled up on the first move: the combo has two moves again. On the second: one.',
  lessonFloor: 'The die under you is gone: you are on the floor. You can step down from a leaving die yourself, too.\nFrom the floor a die is pushed: it slides and does not turn. A push is a move.',
  lessonClimb: 'From the floor, up: step onto a leaving die.\nFrom a cell next to a leaving combo you can also step up onto a standing die beside it.\nAnd onto a die that cannot be pushed: the edge of the board or another die is behind it.',
  lessonSeven: 'Opposite faces make seven: under a 4 lies a 3.\nYou do not see it, but it is there.\nTwo rolls the same way, and the bottom face is on top.',
  lessonTwos: 'Now 2s and 3s are accepted.\nA combo of 2s is two dice, a combo of 3s is three.',
  lessonGlass: 'A leaving die is already half here: you can roll over it.\nIf the face matches, your die joins the chain.',
  lessonFives: 'Make only 5s: five 5s side by side are a combo, and it leaves to us.\nOther combinations do not work.',
  shellProtocol: 'SESSION WITHOUT LIMIT',
  shellLimited: 'SESSION OF THE DAY {time}',
  shellLevels: 'CLEAR THE BOARD',
  shellExercise: 'BASIC OPERATION TEST',
  shellTasks: 'CLEAR THE CHANNEL',
  shellRecords: 'SESSION LOG',
  shellSystem: 'PARAMETERS',
  shellHowTo: 'OPERATING PROCEDURE',
  shellReadme: 'ACCOMPANYING NOTE',
  howRoll: 'You stand on a die and roll it: a side face comes up on top.\nInto an empty cell the die rolls with you. Onto a die next to you, you simply step.\nOpposite faces make seven: under a 1 lies a 6.',
  howCombo: 'A combo is as many dice side by side as their top face has pips: two 2s, three 3s, six 6s.\nA finished combo leaves.',
  howChain: 'A combo does not leave at once.\nWhile it is leaving, roll one more die with the same face up to it: it leaves with the combo. This is a chain.',
  howOnes: 'Ones make no combo.\nBring a 1 to a leaving combo, and every other 1 on the board leaves.',
  howLevels: 'LEVELS: clear every die off the board.\nOnly the faces of the level work, the others are crossed out.\nMoves are limited: the fewer you make, the more stars.',
  howProtocol: 'PROTOCOL: the dice come by themselves.\nA chain multiplies the score.\nThe board fills up and stays full: the session is over.',
  shareScore: 'VI — sent to the other side: {score}',
};

/** Every line the game says, in one language. */
export type Texts = typeof RU;
export type TextKey = keyof Texts;

/** French puts a space before a colon, a semicolon, a question and an exclamation mark: no line breaks at it. */
function tied(texts: Texts): Texts {
  const out = { ...texts };
  for (const key of Object.keys(out) as TextKey[]) out[key] = out[key].replace(/ ([:;?!])/g, ' $1');
  return out;
}

/** The languages the game speaks, in the order a player picks from. */
const TEXTS = { en: EN, ru: RU, es: ES, pt: PT, tr: TR, de: DE, fr: tied(FR) } as const satisfies Record<string, Texts>;

export type LanguageCode = keyof typeof TEXTS;
export const LANGUAGES = Object.keys(TEXTS) as readonly LanguageCode[];

/** The language of the game for a language as a browser or a platform names it: `pt-BR`, `ru`, `es_419`. English where the game does not speak it. */
export function languageOf(code: string): LanguageCode {
  const short = code.toLowerCase().split(/[-_]/)[0];
  return (LANGUAGES as readonly string[]).includes(short) ? (short as LanguageCode) : 'en';
}

let current: LanguageCode = languageOf(typeof navigator !== 'undefined' ? navigator.language : 'en');

/**
 * The language the player has picked, or the one the platform names for the player, takes the
 * place of the browser's. What is said after this is said in it; what was put into lines before
 * has to be put into lines again by whoever keeps it.
 */
export function setLanguage(code: string): void {
  current = languageOf(code);
}

export function language(): LanguageCode {
  return current;
}

export function t(key: TextKey): string {
  return TEXTS[current][key];
}

/**
 * A word of the program - a command, the name of a panel or of a setting - in the language of
 * the player. It is asked for by the English word the program has for it and is that word in
 * English; so is a word the table of words does not have.
 */
export function word(name: string): string {
  if (current === 'en') return name;
  return (WORDS as Record<string, Record<string, string> | undefined>)[name]?.[current] ?? name;
}
