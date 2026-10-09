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
  levelStranded: 'Тупик: с этой кости некуда идти',
  // On the floor a die is pushed and never turned, and the one way up is a die that is leaving.
  levelFloorStuck: 'Тупик: с пола нечего толкнуть и не на что подняться',
  levelFloorFaces: 'Тупик: с пола кость не повернуть, а граней на комбо не хватает',
  levelShort: 'Ходы кончились. Не хватило: {short}',
  // What is said in the window a level opens with, a message at a time; a blank line parts two
  // messages. A combo is as many dice side by side as their face has pips; a chain is a combo
  // with dice rolled up to it while it leaves.
  //
  // The one who speaks is the assistant of the laboratory: a person, never named, who greets the
  // player and teaches the table as it was taught there, with Rhine's dice for a start. The whole
  // of the first chapter is his. From the second chapter on a word or two in a message are not
  // his: they stand between square brackets, which are not shown, and are heard as the other
  // side is heard. What is under the surface is "there" for him and "here" for them; the last
  // window says of a combo what the first one said, and to whom it leaves.
  // Every line is in the log of approvals, with what it gives away.
  lessonThrees:
    'Привет! Добро пожаловать в Visual Interconnection. Я здешний лаборант, и сегодня я учу тебя работать со столом.\n\n' +
    'В тридцатые годы доктор Райн просил людей бросать кости и изо всех сил хотеть нужную грань. Мы кости не бросаем. Мы их ведём.\n\n' +
    'Ты стоишь на кости. Веди её: она перекатится, и наверх ляжет другая грань.\n\n' +
    'Сегодня открыт третий канал: работаем с тройками. Поставь три тройки рядом — это комбо, и оно уйдёт. Другие комбинации не работают: их грани помечены крестом.',
  // The level this was said on gives its place to `lessonWalk` on the ladder of lessons: it stays while the boards of the old ladder do.
  lessonStep:
    'Получилось! У Райна кости только падали. Тебя они уже слушаются.\n\n' +
    'Теперь про шаги. По костям можно ходить, с одной на соседнюю. Шаг ходом не считается: ходи сколько хочешь.\n\n' +
    'Ход — это перекат. Катится только та кость, на которой стоишь, и только на свободное место. Дойди до нужной кости и собери тройки.',
  lessonWalk:
    'Теперь про шаги. По костям можно ходить, с одной на соседнюю. Шаг ходом не считается: ходи сколько хочешь.\n\n' +
    'Ход — это перекат. Катится только та кость, на которой стоишь, и только на свободное место.\n\n' +
    'Комбо уходит не сразу, и по уходящим костям тоже можно ходить. Пройди по ним к остальным и собери второе комбо.',
  lessonLink:
    'Комбо уходит не сразу. У него есть два хода: за первый кости тонут наполовину, за второй — совсем.\n\n' +
    'Костей здесь четыре, а тройке нужны три. Лишняя останется одна, и это тупик. Значит, её надо успеть докатить к уходящим.\n\n' +
    'По уходящим костям можно ходить, как по обычным. Дойди по ним до четвёртой и подкати её к комбо тройкой вверх. Это называется цепочкой.\n\n' +
    'И подарок от стола: каждая кость, вставшая в цепочку, даёт уходящим ещё один ход.',
  lessonHold:
    'У уходящего комбо два хода. Но каждая кость, вставшая в цепочку, даёт ему ещё один ход.\n\n' +
    'Докатил на первом ходу — у комбо снова два хода. На втором — один. Докатывай по кости за ход, и оно будет ждать.',
  lessonFloor:
    'Если кость под тобой уйдёт, ты окажешься на полу. Это не страшно: [мы подождём]. Сойти на пол с уходящей кости можно и самому.\n\n' +
    'С пола кости толкают. Толкнул — кость проехала на клетку, не поворачиваясь. Толчок — это ход.\n\n' +
    'Обратно наверх — по уходящей кости, пока она не ушла. Или по той, которую некуда толкнуть: за ней край стола или другая кость.',
  lessonClimb:
    'С пола можно вернуться наверх. Шагни на уходящую кость, пока она не ушла.\n\n' +
    'Или на кость, которую некуда толкнуть: за ней край стола или другая кость. А с клетки рядом с уходящим комбо поднимешься на любую соседнюю.',
  lessonSeven:
    'Секрет, который знает каждый игрок в кости: напротив всегда семь. Напротив единицы шестёрка, напротив двойки пятёрка, напротив тройки четвёрка.\n\n' +
    'Видишь сверху четвёрку — значит, тройка внизу. Ты её не видишь, но она там.\n\n' +
    'Два переката в одну сторону — и нижняя грань наверху.',
  lessonTwos:
    'Вводный курс окончен. Поздравляю: стол тебя слушается.\n\n' +
    'Дальше открыт ещё один канал. Теперь [принимаются] двойки и тройки: двойке нужны две кости, тройке — три.\n\n' +
    'Считай кости заранее: на какие комбо их хватит?',
  lessonGlass:
    'Уходящая кость [уже наполовину здесь]. Поэтому по ней можно прокатиться: твоя кость встанет на её место.\n\n' +
    'Совпала грань — твоя кость войдёт в цепочку. Не совпала — просто займёт место.',
  lessonFives:
    'Открыт пятый канал. Работаем только с пятёрками.\n\n' +
    'Поставь пять пятёрок рядом — это комбо, и оно уйдёт [к нам].',
  // The rules as they are read again from the pause of a level: the rule alone, in a line, with no one speaking.
  // What a level with a lesson says: one message of the assistant of the laboratory, a word of his own and the
  // rule in it, some fifteen words. The owner asked for the voice and the story to be kept, and cut short.
  // The course and the chapter after it are his alone; in the lines after them a word or two are the other side's,
  // between square brackets, as in the windows these lines have taken the place of.
  lineCombo: 'Привет! Я здешний лаборант. Сегодня открыт третий канал: поставь три тройки рядом — это комбо, и оно уйдёт.',
  lineStep: 'Получилось! У Райна кости только падали, а тебя слушаются. По ним можно ходить: шаг — не ход.',
  lineWalk: 'Комбо уходит не сразу — туда, под поверхность. Пока оно здесь, пройди по нему к остальным.',
  lineSide: 'Курс окончен: стол тебя слушается. Теперь секрет игроков: грань сбоку едет с тобой. Довези — и поверни.',
  lineSeven: 'Второй секрет: напротив всегда семь. Под четвёркой — тройка. Ты её не видишь, но она там.',
  lineLink: 'Костей больше, чем просит комбо? Лишнюю докати к уходящим, пока они здесь. Это цепочка.',
  lineFloor: 'С уходящей кости можно сойти на пол. Это не страшно: [мы подождём]. С пола кости толкают.',
  lineGlass: 'Уходящая кость [уже наполовину здесь]. По ней можно прокатиться: твоя встанет на её место.',
  lineFaces: 'Открыт ещё один канал: теперь [принимаются] и двойки, и тройки. Считай кости заранее.',
  ruleThrees: 'Комбо — три тройки рядом: оно уходит. Работают только тройки, остальные грани помечены крестом.',
  ruleStep: 'Шаг по костям — не ход. Ход — перекат кости, на которой стоишь, на свободное место.',
  ruleWalk: 'Шаг по костям — не ход, ход — перекат. По уходящему комбо можно ходить и сходить с него на другую кость.',
  ruleLink: 'Комбо уходит два хода. Докати к нему кость с той же гранью — это цепочка. Каждая такая кость даёт уходящим ещё один ход.',
  ruleHold: 'Каждая кость в цепочке даёт уходящему комбо ещё один ход.',
  ruleFloor: 'Кость под тобой ушла — ты на полу. С пола кость толкают: она едет, не поворачиваясь, и это ход. Наверх — по уходящей кости или по той, которую некуда толкнуть.',
  ruleClimb: 'С пола наверх: на уходящую кость или на кость, которую некуда толкнуть.',
  ruleSeven: 'Напротив всегда семь: 1 и 6, 2 и 5, 3 и 4. Два переката в одну сторону — и нижняя грань наверху.',
  ruleTwos: 'Работают двойки и тройки. Двойке нужны две кости, тройке — три.',
  ruleGlass: 'По уходящей кости можно прокатиться. Совпала грань — кость вошла в цепочку.',
  ruleFives: 'Работают только пятёрки. Комбо — пять пятёрок рядом.',
  // The three lines a piece of the road carries over its board when it teaches a move (`ROAD_HINTS`): a hint and not an
  // instruction, eight words at most, in the voice of the lab assistant but short. THE TEXTS ARE A PROPOSAL OF THE
  // IMPLEMENTER; the owner corrects them. The other six languages say the same in the same length and have not been
  // read by a native speaker either.
  roadHintChain: 'Пока комбо уходит, докати к нему ещё одну.',
  roadHintWalk: 'По уходящей кости можно пройти.',
  roadHintPush: 'С пола кость можно толкнуть.',
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
  howLevels: 'УРОВНИ: убери с поля все кости.\nРаботают только грани уровня, остальные помечены крестом.\nХоды ограничены: чем их меньше, тем больше звёзд.\nПравила пола здесь свои: наверх — только по уходящей кости.',
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
  levelStranded: 'Dead end: there is nowhere to go from this die',
  levelFloorStuck: 'Dead end: nothing to push from the floor and nothing to go up by',
  levelFloorFaces: 'Dead end: a push turns no die, and too few faces show for a combo',
  levelShort: 'Out of moves. Short by: {short}',
  lessonThrees:
    'Hello! Welcome to Visual Interconnection. I am the lab assistant here, and today I am teaching you to work the table.\n\n' +
    'In the thirties Dr. Rhine asked people to throw dice and to wish with all their might for the face they wanted. We do not throw the dice. We lead them.\n\n' +
    'You are standing on a die. Lead it: it rolls, and another face comes up on top.\n\n' +
    'Today the third channel is open: we work with 3s. Put three 3s side by side: that is a combo, and it will leave. Other combinations do not work: their faces are marked with a cross.',
  lessonStep:
    'You did it! Rhine’s dice only fell. Yours already listen to you.\n\n' +
    'Now, steps. You can walk over the dice, from one to the next. A step is not counted as a move: walk as much as you like.\n\n' +
    'A move is a roll. Only the die you stand on rolls, and only into an empty place. Walk to the die you need and gather the 3s.',
  lessonWalk:
    'Now, steps. You can walk over the dice, from one to the next. A step is not counted as a move: walk as much as you like.\n\n' +
    'A move is a roll. Only the die you stand on rolls, and only into an empty place.\n\n' +
    'A combo does not leave at once, and you can walk over leaving dice too. Walk over them to the others and gather the second combo.',
  lessonLink:
    'A combo does not leave at once. It has two moves: on the first the dice sink halfway, on the second all the way.\n\n' +
    'There are four dice here, and a 3 takes three. The odd one will be left alone, and that is a dead end. So it has to be rolled up to the leaving ones in time.\n\n' +
    'You can walk over leaving dice as over any others. Walk over them to the fourth and roll it up to the combo with a 3 on top. This is called a chain.\n\n' +
    'And a gift from the table: every die that joins the chain gives the leaving ones one more move.',
  lessonHold:
    'A leaving combo has two moves. But every die that joins the chain gives it one more move.\n\n' +
    'Rolled up on the first move: the combo has two moves again. On the second: one. Roll a die up every move, and it will wait.',
  lessonFloor:
    'If the die under you leaves, you will find yourself on the floor. Nothing to fear: [we will wait]. You can step down from a leaving die yourself, too.\n\n' +
    'From the floor, dice are pushed. A pushed die slides one cell and does not turn. A push is a move.\n\n' +
    'Back up: over a leaving die, while it is still there. Or over one that cannot be pushed: the edge of the table or another die is behind it.',
  lessonClimb:
    'From the floor you can come back up. Step onto a leaving die while it is still there.\n\n' +
    'Or onto a die that cannot be pushed: the edge of the table or another die is behind it. And from a cell next to a leaving combo you can step up onto any die beside it.',
  lessonSeven:
    'A secret every dice player knows: opposite faces make seven. Opposite the 1 is the 6, opposite the 2 the 5, opposite the 3 the 4.\n\n' +
    'You see a 4 on top, so the 3 is underneath. You do not see it, but it is there.\n\n' +
    'Two rolls the same way, and the bottom face is on top.',
  lessonTwos:
    'The introductory course is over. Congratulations: the table listens to you.\n\n' +
    'From here one more channel is open. Now 2s and 3s [are accepted]: a 2 takes two dice, a 3 takes three.\n\n' +
    'Count the dice beforehand: what combos are there enough of them for?',
  lessonGlass:
    'A leaving die is [already half here]. That is why you can roll over it: your die takes its place.\n\n' +
    'If the face matches, your die joins the chain. If not, it simply takes the place.',
  lessonFives:
    'The fifth channel is open. We work with 5s only.\n\n' +
    'Put five 5s side by side: that is a combo, and it will leave [to us].',
  lineCombo: 'Hello! I am the lab assistant here. Today the third channel is open: put three 3s side by side: that is a combo, and it will leave.',
  lineStep: 'You did it! Rhine’s dice only fell, and yours listen to you. You can walk over them: a step is not a move.',
  lineWalk: 'A combo does not leave at once: it goes there, under the surface. While it is here, walk over it to the rest.',
  lineSide: 'The course is over: the table listens to you. Now a dice player’s secret: a face on the side rides with you. Bring it over, then turn.',
  lineSeven: 'The second secret: opposite faces make seven. Under the 4 is the 3. You do not see it, but it is there.',
  lineLink: 'More dice than the combo takes? Roll the odd one up to the leaving ones while they are here. That is a chain.',
  lineFloor: 'You can step down from a leaving die to the floor. Nothing to fear: [we will wait]. From the floor, dice are pushed.',
  lineGlass: 'A leaving die is [already half here]. You can roll over it: yours takes its place.',
  lineFaces: 'One more channel is open: now 2s and 3s [are accepted]. Count the dice beforehand.',
  ruleThrees: 'A combo is three 3s side by side: it leaves. Only 3s work, the other faces are marked with a cross.',
  ruleStep: 'A step over the dice is not a move. A move is a roll of the die you stand on into an empty place.',
  ruleWalk: 'A step over the dice is not a move, a move is a roll. You can walk over a leaving combo and step off it onto another die.',
  ruleLink: 'A combo leaves in two moves. Roll a die of the same face up to it: that is a chain. Every such die gives the leaving ones one more move.',
  ruleHold: 'Every die in a chain gives the leaving combo one more move.',
  ruleFloor: 'The die under you is gone: you are on the floor. From the floor a die is pushed: it slides, does not turn, and that is a move. Back up: over a leaving die, or one that cannot be pushed.',
  ruleClimb: 'From the floor, up: onto a leaving die, or onto a die that cannot be pushed.',
  ruleSeven: 'Opposite faces make seven: 1 and 6, 2 and 5, 3 and 4. Two rolls the same way, and the bottom face is on top.',
  ruleTwos: '2s and 3s work. A 2 takes two dice, a 3 takes three.',
  ruleGlass: 'You can roll over a leaving die. If the face matches, the die joins the chain.',
  ruleFives: 'Only 5s work. A combo is five 5s side by side.',
  roadHintChain: 'Roll another die to the leaving combo.',
  roadHintWalk: 'You can walk over a leaving die.',
  roadHintPush: 'From the floor, you can push a die.',
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
  howLevels: 'LEVELS: clear every die off the board.\nOnly the faces of the level work, the others are marked with a cross.\nMoves are limited: the fewer you make, the more stars.\nThe floor has rules of its own here: the only way up is a leaving die.',
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
