/**
 * What the game says in the language of the player. The program's own words are in
 * `src/shell/text.ts`; the words of the development tools are in `devText.ts`, which a
 * production build does not carry.
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
  levelStuck: 'Тупик: костей не хватит на группу',
  levelShort: 'Ходы кончились. Не хватило: {short}',
  // The rules of the levels, said in the window a level opens with: a thought to a line. Drafts:
  // they go into the game through the log of approvals.
  lessonThrees: 'Собирай только тройки: три тройки рядом уходят.\nДругие комбинации не работают: их грани перечёркнуты.',
  lessonStep: 'По костям ходи свободно: шаг — не ход.\nХод — это перекат кости.',
  lessonLink: 'Группа уходит за два хода.\nПока она уходит, докати к ней ещё тройку: это цепочка.\nКаждая новая кость держит цепочку на месте ещё один ход.',
  lessonSeven: 'Напротив всегда семь: под четвёркой лежит тройка.\nДва переката в одну сторону — и нижняя грань наверху.',
  lessonTwos: 'Теперь работают двойки и тройки.\nДвойке нужны две кости, тройке — три.',
  lessonGlass: 'По уходящей кости можно прокатиться.\nСовпала грань — кость встала в цепочку.',
  lessonFloor: 'С уходящей кости можно сойти на пол.\nС пола кость толкают: она едет, не поворачиваясь.',
  lessonFives: 'Собирай только пятёрки: пять пятёрок рядом уходят.\nДругие комбинации не работают.',
  shellProtocol: 'СЕАНС БЕЗ СРОКА',
  shellLimited: 'СЕАНС ДНЯ {time}',
  shellLevels: 'ОЧИСТКА ПОЛЯ',
  shellExercise: 'ПРОВЕРКА НАВЫКА',
  shellTasks: 'ОЧИСТКА КАНАЛА',
  shellRecords: 'ЖУРНАЛ СЕАНСОВ',
  shellSystem: 'ПАРАМЕТРЫ',
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
  levelStuck: 'Dead end: too few dice for a group',
  levelShort: 'Out of moves. Short by: {short}',
  lessonThrees: 'Make only 3s: three 3s side by side leave.\nOther combinations do not work: their faces are crossed out.',
  lessonStep: 'Walk over the dice freely: a step is not a move.\nA move is a roll of a die.',
  lessonLink: 'A group leaves in two moves.\nWhile it is leaving, roll one more 3 up to it: that is a chain.\nEvery new die holds the chain in place for one more move.',
  lessonSeven: 'Opposite faces make seven: under a 4 lies a 3.\nTwo rolls the same way, and the bottom face is on top.',
  lessonTwos: 'Now 2s and 3s work.\nA 2 needs two dice, a 3 needs three.',
  lessonGlass: 'You can roll over a leaving die.\nIf the face matches, the die joins the chain.',
  lessonFloor: 'From a leaving die you can step down to the floor.\nFrom the floor a die is pushed: it slides and does not turn.',
  lessonFives: 'Make only 5s: five 5s side by side leave.\nOther combinations do not work.',
  shellProtocol: 'SESSION WITHOUT LIMIT',
  shellLimited: 'SESSION OF THE DAY {time}',
  shellLevels: 'CLEAR THE BOARD',
  shellExercise: 'BASIC OPERATION TEST',
  shellTasks: 'CLEAR THE CHANNEL',
  shellRecords: 'SESSION LOG',
  shellSystem: 'PARAMETERS',
  shareScore: 'VI — sent to the other side: {score}',
};

export type TextKey = keyof typeof RU;

let lang = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ru') ? RU : EN;

/** The language the platform names for the player takes the place of the browser's. Set before anything is said. */
export function setLanguage(code: string): void {
  lang = code.toLowerCase().startsWith('ru') ? RU : EN;
}

export function t(key: TextKey): string {
  return lang[key];
}
