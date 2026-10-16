# VI — ряд уровней из файлов: `row.json` и файлы досок

> Вид: решение. Статус: построено. Дата: 2026-10-15. Принято владельцем 15 октября 2026 («продолжи работу» после спеки), устно по частям в тот же день (чат уровней), раздел 2. Построено 16 октября 2026, v0.2.63; что вышло иначе — раздел 11.
> Что заменит: доски-литералы в `src/levels/road.ts` (`ROAD`, `ROAD_SPARES`) и `src/levels/levels.ts` (`CHAPTER_BOARDS`, `PARKED`, `SPARES`), `CHAPTERS` и `STOPS` в `src/levels/chapters.ts`, `ROAD_BLOCKS`, `ROAD_SIGNS`, `ROAD_IDLE`, `ROAD_LESSONS`, `ROAD_HINTS`, `HINTS`, `PIECES_COUNTED`, `COUNTERS_UNTIL`, деление «кусок дороги / уровень списка» в игре и сохранении. Что будет жить в коде: boards/row.json, src/levels/row.ts, src/levels/row.gen.ts, scripts/row.mjs, vite.boards.ts, src/levels/campaign.ts, src/app/game.ts, src/app/passage.ts, src/app/signWay.ts, src/app/hint.ts, src/platform/settings.ts, src/levels/library.ts, src/levels/grammar.ts.

Исполнитель читает эту спеку и файлы, названные в разделе 10. Весь проект заново не изучается.

## 1. Зачем

Слова владельца 15 октября 2026: «как будто довольно сложно вставить уровень в игру сейчас»; «мы же можем сделать "пролог" набором уровней, только у некоторых уровней будут свои правила, стартовая расстановка + иногда нужно показывать подсказки»; «давай починим архитектуру уровней, чтобы уровни было проще вставлять в нужное место и не приходилось много менять при вставке уровня. нужно убрать хардкод итд. в будущем я хочу чтобы можно было собрать уровень в редакторе, отправить его тебе в чате и ты бы легко поставил его в нужное место».

Что сейчас. Вставка доски `B01_s290` пятым местом (коммит `ffcfaee`) тронула 10 файлов и около 40 чисел в 5 тестах. Причины:

1. Доска живёт в двух-трёх местах: литерал в коде (`road.ts` или `levels.ts`), копия раскладки в рецепте (`sketch` в `roadRecipes.ts`), файл `boards/<код>.txt`; тест держит их равными.
2. Ряд — два ряда: куски дороги (`ROAD`, индекс `piece`) и уровни списка (`LEVELS`, индекс `levelIndex`); игра, сохранение, переходы и адреса ведут оба.
3. Помощь игроку привязана к кодам и номерам в шести файлах: знак свайпа `R01`, ожидание у восьми кодов пролога, плашки «первые два куска» и «номер до 10», строки подсказок у пяти кодов, камера «первый блок».
4. Тесты записывают ряд снимком по местам: длина 25, `CAMPAIGN[18]`, упорядоченные списки граней, размеров и ходов всех досок, замеры ботов по кодам.

Цель: доска из редактора вставляется так — файл лежит в `boards/`, в `boards/row.json` добавлена строка с её кодом, `node scripts/row.mjs` собрал ряд; тесты и сборка зелёные, больше ничего не меняется.

## 2. Решения владельца (15 октября 2026, ответы на вопросы)

1. Порядок ряда — файл `row.json`: «давай row.json лучше, этот формат лучше подходит для хранения списка уровней».
2. Помощь игроку (окно подсказки, знак свайпа, плашки, ожидание, камера) — у места в `row.json`, а не в файле доски: доска из редактора ставится как есть, переставленная доска помощь за собой не тащит.
3. Игра читает ряд из собранного файла (`row.gen.ts`) только с досками ряда; черновики и слова владельца в сборку не попадают.
4. Плашки: «оставь как сейчас — первые 10 уровней. я позже вернусь к этим подсказкам, логику их появления нужно будет обсудить и изменить».
5. Разделы 3–8 приняты по частям («да, дальше»), включая два видимых изменения раздела 6.4.

## 3. Данные

### 3.1. Файл доски

`boards/<код>.txt` — формат лаборатории без изменений ([VI_Levels_Lab.md](../../VI_Levels_Lab.md), раздел 1). Файл держит только доску: клетки и вырезы, кости, старт, правила доски (фиксированные и уходящие кости, игрок на полу, `floor: shut`, `climb`), рабочие грани, `sink`, `lift`, `undos`, `seed`, `par`, `exact`, `way`. Голова библиотеки (`status`, `origin`, `mark`, `words`, `tags`, `note`) в уровень не входит, как и сейчас. Доска ряда — файл со статусом `R`.

### 3.2. `boards/row.json`

Тип (живёт в `src/levels/row.ts`):

```ts
export type Role = 'meet' | 'learn' | 'apply' | 'event' | 'twist' | 'peak' | 'rest';
export type Technique = 'link' | 'walk' | 'glass' | 'lift' | 'push' | 'ones' | 'twoFaces' | 'seven' | 'time';
export type HintKey = 'roadHintChain' | 'roadHintWalk' | 'roadHintPush' | 'roadHintClimb' | 'hintSeven' | 'hintLinkMove';

export interface RowFile {
  chapters: RowChapterFile[];
}
export interface RowChapterFile {
  title: string;
  /** Faces every board of the chapter plays on (and counts on); absent: each board keeps its own. */
  faces?: number[];
  /** 'open': the floor of every board of the chapter is open, whatever its file says; absent: as the file says. */
  floor?: 'open';
  places: RowPlaceFile[];
}
export interface RowPlaceFile {
  board: string;
  role: Role;
  teaches?: Technique;
  archetype: string;
  event?: string;
  /** A note for people, not read by the game. */
  note?: string;
  help?: Help;
}
export interface Help {
  /** The window of a hint before the board, once for a player. */
  hint?: HintKey;
  /** The sign of the swipe from the first frame, its direction. */
  sign?: 'N' | 'E' | 'S' | 'W';
  /** Plaques over dice: 'all' over every die and heap of a working face from the start (roadCounters), 'near' over a heap whose combo is two moves away. Absent: none. */
  plaques?: 'all' | 'near';
  /** What the board does while the player waits; absent: nothing, and no sign after dead ends. */
  wait?: 'first' | 'lesson' | 'free';
  /** 'cells': the camera framed by the board's cells; 'hold': so, and one scale with the neighbouring 'hold' places. Absent: as a chapter board is framed now. */
  camera?: 'cells' | 'hold';
}
```

Номер места и глава в файле не пишутся: глава — порядковый номер в `chapters` от 0, номер места — сквозной от 1. Код доски в ряду один раз.

`wait` — нынешние ожидания из `road.ts`: `first` — `{ blinkMs: null, signMs: 6000, wasted: 3 }`, `lesson` — `{ blinkMs: 4000, signMs: 8000, wasted: 3 }`, `free` — `{ blinkMs: 4000, signMs: 8000, wasted: null }`. Место с `wait` показывает знак пути сразу после второго тупика (`DEAD_ENDS_FOR_SIGN`), и плашки на нём мигают при ожидании — как сейчас у кусков дороги.

### 3.3. Содержимое `row.json` на старте

Ровно нынешний ряд v `ffcfaee` с помощью на тех же местах. Порядок ключей и отступ два пробела, как ниже:

```json
{
  "chapters": [
    {
      "title": "prologue",
      "places": [
        { "board": "R01", "role": "meet", "archetype": "roll", "help": { "sign": "N", "plaques": "all", "wait": "first", "camera": "hold" } },
        { "board": "R02", "role": "learn", "archetype": "ride", "event": "stair and floor", "help": { "plaques": "all", "wait": "lesson", "camera": "hold" } },
        { "board": "R03", "role": "apply", "archetype": "first free board", "help": { "plaques": "near", "wait": "free", "camera": "hold" } },
        { "board": "R04", "role": "apply", "archetype": "free to fail", "event": "first dead end", "help": { "plaques": "near", "wait": "free", "camera": "hold" } },
        { "board": "B01_s290", "role": "apply", "archetype": "the way round keeps the face", "event": "a straight roll turns the face away", "help": { "plaques": "near", "wait": "free", "camera": "hold" } },
        { "board": "R05", "role": "apply", "archetype": "choose the first die", "event": "choice of the first die", "help": { "plaques": "near", "wait": "free", "camera": "hold" } },
        { "board": "R07", "role": "meet", "teaches": "link", "archetype": "chain", "help": { "hint": "roadHintChain", "plaques": "near", "wait": "free", "camera": "cells" } },
        { "board": "R08", "role": "rest", "archetype": "domino", "event": "domino", "help": { "plaques": "near", "wait": "free", "camera": "cells" } }
      ]
    },
    {
      "title": "road",
      "faces": [2, 3],
      "floor": "open",
      "places": [
        { "board": "R11", "role": "meet", "teaches": "walk", "archetype": "bridge", "event": "first walk over leaving dice", "help": { "hint": "roadHintWalk", "plaques": "near" } },
        { "board": "P02", "role": "apply", "archetype": "bridge", "help": { "plaques": "near" } },
        { "board": "C1-05", "role": "apply", "archetype": "roll onto leaving", "event": "the rule of seven", "help": { "hint": "hintSeven" } },
        { "board": "C1-06", "role": "twist", "archetype": "bridge both ways", "event": "the road goes both ways, briefly" },
        { "board": "C1-07", "role": "rest", "archetype": "collapse", "event": "first big clearing, with a way to it" }
      ]
    },
    {
      "title": "order",
      "faces": [2, 3],
      "floor": "open",
      "places": [
        { "board": "R09", "role": "meet", "teaches": "twoFaces", "archetype": "two heaps at once", "event": "heaps of both faces on one board" },
        { "board": "P07", "role": "apply", "archetype": "two combos from one die" },
        { "board": "P08", "role": "apply", "archetype": "two combos in any order" },
        { "board": "C2-05", "role": "twist", "archetype": "decoy of the wrong channel", "event": "first trap" },
        { "board": "P24", "role": "rest", "archetype": "domino", "event": "first corridor" }
      ]
    },
    {
      "title": "floor",
      "faces": [2, 3],
      "floor": "open",
      "places": [
        { "board": "R13", "role": "meet", "teaches": "push", "archetype": "push to a waiting die", "event": "first push", "help": { "hint": "roadHintPush" } },
        { "board": "R10", "role": "meet", "teaches": "lift", "archetype": "lift by a laid stair", "event": "first step down and up", "help": { "hint": "roadHintClimb" } },
        { "board": "R14", "role": "apply", "archetype": "down and back" },
        { "board": "P06", "role": "apply", "archetype": "down and back" },
        { "board": "P09", "role": "apply", "archetype": "bridge with a link", "note": "its kept way is a bridge with a link (K ~ L), no floor and no push: the name of its probe place said otherwise" },
        { "board": "R16", "role": "twist", "archetype": "everything at once" },
        { "board": "P12", "role": "peak", "archetype": "down and back with two faces" }
      ]
    }
  ]
}
```

Откуда значения: плашки `all` — `PIECES_COUNTED = 2` (места 1–2), `near` — места 3–10 (`COUNTERS_UNTIL = 10`, слово владельца, раздел 2.4); ожидание — `ROAD_IDLE` (`R01` — `first`, `ROAD_LESSONS` `R01`, `R02` — `lesson`, прочие куски — `free`); `hold` — `ROAD_BLOCKS[0]` (`oneScale: true`, места 1–6), `cells` — второй блок (места 7–8, `frameOfPiece` без общего масштаба); подсказки — `ROAD_HINTS` и `HINTS`; знак — `ROAD_SIGNS`.

## 4. Сборка ряда

### 4.1. `buildRow` — `src/levels/row.ts`

```ts
export interface Place {
  /** From 1, through the whole row. */
  number: number;
  /** From 0: the index of its chapter in row.json. */
  chapter: number;
  code: string;
  /** The board as it is played: the file, with the faces and the floor of its chapter put over it. */
  spec: LevelSpec;
  role: Role;
  teaches?: Technique;
  archetype: string;
  event?: string;
  help: Help;
}
export interface Row {
  chapters: { title: string; faces: number[] | null; first: number; last: number }[];
  places: Place[];
}
export function buildRow(file: RowFile, boards: ReadonlyMap<string, string>): Row;
```

`boards` — тексты файлов по коду. Чистая функция: только `parseBoard` из `src/levels/boardFile.ts` и правила, без Node. Глава с `faces` даёт доске `faces` и `values` (как `withChapterFaces` сейчас), с `floor: 'open'` — удаляет у доски `floor` (как `chapterBoard` в `levels.ts` сейчас).

Отказ — исключение, строка начинается с `row: `:

- `row: R99 is in the row, and there is no file boards/R99.txt`;
- `row: R05 is in the row twice (places 6 and 12)`;
- `row: R05: the file says status D; a board of the row is R`;
- `row: place 7 (R07): "plaques: some" is none of all near`; так же для `wait`, `camera`, `sign`, `role`, `teaches`, `hint`; неизвестный ключ места или `help` — `row: place 7 (R07): unknown key "hlep"`;
- отказ `parseBoard` и правил (`levelConfig`) — как он есть, с кодом доски.

Проверку пути (`way` чистит за `par` ходов) делает тест (раздел 7.1), не `buildRow`: решатель дорог для каждого запуска игры.

### 4.2. `src/levels/row.gen.ts`

Собранный ряд: `export const ROW: Row = {...}` одним литералом, доски уже разобраны. Шапка: `// Generated by node scripts/row.mjs from boards/row.json and boards/*.txt. Do not edit.` Порядок ключей стабильный (как `JSON.stringify` от результата `buildRow`), отступ два пробела — чтобы git показывал разницу по строкам. Игра, тесты и скрипты берут ряд только отсюда.

### 4.3. `scripts/row.mjs`

- `node scripts/row.mjs` — читает `boards/row.json` и файлы ряда, зовёт `buildRow` (через `runnerImport` из `vite`, как `library.mjs`), пишет `src/levels/row.gen.ts`; печатает `row: 25 places, 4 chapters`. Отказ — строка отказа и код выхода `1`, файл не трогается.
- `node scripts/row.mjs check` — то же без записи; код выхода `1` и строка `row.gen.ts is stale: run node scripts/row.mjs`, если собранное не равно файлу.
- `node scripts/row.mjs report [place=7]` — паспорт мест (раздел 7.3).

### 4.4. Дев-сервер

`vite.boards.ts` (плагин `viBoards`, только `serve`): при записи `boards/row.json` или файла доски, чей код есть в ряду, — пересобрать `row.gen.ts` тем же кодом, что `scripts/row.mjs`; отказ — в консоль сервера и в оверлей Vite, файл не трогается. Vite перезагружает игру сам: `row.gen.ts` — модуль графа.

### 4.5. Библиотека

`statusFor`, `placeOf`, `checkLibrary` (`src/levels/library.ts`) и `scripts/library.mjs` берут ряд из `ROW` вместо `CHAPTERS`/`CAMPAIGN`. Правило то же: `R` ⇔ код в `row.json`. Страница `?lab=library` показывает место и главу по `ROW`. Сравнение «файл ⇔ доска кода» (`sameDice`) для досок ряда уходит: доска ряда и есть файл. Для досок кода, которых не станет (раздел 6), сравнивать нечего.

## 5. Игра

### 5.1. Одно место

`src/app/game.ts`: поля `piece` и `levelIndex` заменяет `place: number | null` — индекс в `ROW.places` (`null` у доски лаборатории, `labSpec`). Уходят `startPiece`, `startLevel` (их общая часть — `startPlace(index, intro, said)`), `boardNumber` считает `ROW.places[place].number`. `levelSpec()` — `ROW.places[place].spec` или `labSpec`. `src/levels/campaign.ts`: `CAMPAIGN` строится из `ROW.places`; `Board { road?, level? }`, `stopOf`, `numberOf` по веткам уходят — место это индекс.

`src/app/passage.ts`: `boardAfter(place, count)` — следующее место или `null` после последнего; `startBoard(at, passed)` — раздел 5.2. Окно итога приходит, когда переход ведёт в никуда (после последнего места), как сейчас после последнего уровня; кнопка «дальше» в нём ведёт на следующее место.

### 5.2. Прогресс

`src/platform/settings.ts`, `LevelProgress`: поле `road` и `roadEdition` заменяют `at?: string` — код места, на котором игрок стоит, — и `rowEdition: 1`. `passed`, `stats`, `told` — по кодам, без изменений.

- Новый игрок — `at` нет, игра открывается на месте 1.
- Пройдено место, на котором игрок стоит, — `at` становится кодом следующего места; после последнего — кодом последнего (игра откроется на нём, как сейчас на последнем уровне). Пройдено другое место (выбранное в списке или по адресу) — `at` не двигается.
- Открытие игры: место кода `at`; код, которого в ряду нет, — первое непройденное место, а если пройдены все — место 1.
- Перенос при загрузке (`toRoadEdition` → `toRowEdition`): сохранение седьмой редакции дороги (`roadEdition: 7`) — `at = road`, если это код места ряда; `road === 'R00'` (за дорогой) или кода нет при пройденных местах пролога — первое непройденное место за прологом (глава 1 и дальше), а если пройдены все — первое место главы 1. Это то место, на котором игра открывается сейчас. Редакции до седьмой сбрасываются, как сейчас. `F1` и `FIRST_PASSED` уходят: седьмая редакция стёрла их.

### 5.3. Помощь из `help`

| Было | Стало |
|---|---|
| `this.piece < PIECES_COUNTED` → `roadCounters` | `help.plaques === 'all'` → `roadCounters(state)` |
| `number > COUNTERS_UNTIL` → нет плашек; иначе `hintedGroups` | `help.plaques === 'near'` → `hintedGroups(state)`; нет `plaques` → нет плашек |
| `roadWait(id)` по `ROAD_IDLE` | `roadWait(place)` по `help.wait` (значения раздела 3.2) и `help.sign` |
| `deadEnds.forget/reach` и мигание плашек только у кусков | у места с `help.wait` |
| `HINTS[id]` (`ROAD_HINTS` + коды глав) | `help.hint` |
| `HINT_PROBE` (`?hint=`) только у кусков | у любого места |
| `boardFrame`: куски — `frameOfPiece`, `oneScale` блока — все доски блока | `camera: 'cells'` — `frameOfPiece(shape, [])`; `'hold'` — `frameOfPiece(shape, specs)`, где `specs` — доски непрерывного отрезка мест с `hold`, в который входит место; нет `camera` — `null`, как у уровня главы |

`ROAD_LESSONS` (подсчёт впустую потраченных ходов) — это `wasted` у `first` и `lesson`.

### 5.4. Адрес и прочее

- `?place=<код>` открывает место ряда по коду, `?first` — место 1; `?road=<код>` остаётся тем же, что `?place=`.
- `LEVEL_OF_COMMIT` сейчас всегда `1` (ни у одной доски нет урока ходьбы): условие уходит, стороны коммита считаются у любого места ряда. Окно урока по `spec.lesson` остаётся, как есть.
- Телеметрия: `step_id` `level_<код>` и `step_index` = номер места — как сейчас.
- `starScore` — по всем местам ряда (сейчас `ROAD` + `LEVELS`, то же).

### 5.5. Что увидит игрок иначе (принято владельцем)

1. Отчёт «поделиться» (`shareLevels`) теперь о всём ряде, вместе с прологом; был только о главах.
2. Фон за доской (`backdrop`, по умолчанию выключен) выбирается по номеру места, а не по номеру уровня в списке: при включённом фоне картинки сдвинутся.

Всё остальное играется ровно как в `ffcfaee`.

## 6. Что уходит

- `src/levels/road.ts`: доски `ROAD`, `ROAD_SPARES`, `COMMON`, `ROAD_BLOCKS`, `blockOf`, `ROAD_SIGNS`, `ROAD_HINTS`, `ROAD_LESSONS`, `ROAD_IDLE`, `ROAD_END`, `pieceAfter`, `FIRST_PASSED`, `roadPlace`, `placeAfter`, `ROAD_EDITION`, `toRoadEdition`. Остаётся то, что нужно без досок (`pieceMiddle`, если его зовёт код; иначе и он); файл удаляется, если пуст.
- `src/levels/levels.ts`: `CHAPTER_BOARDS`, `POOL`, `chapterBoard`, `CHAPTER_1..3`, `LEVELS`, `PARKED`, `SPARES`. Все эти доски уже лежат файлами в `boards/` (тест библиотеки держит это сейчас); перед удалением — проверка, что файл каждой есть (раздел 8, шаг 3).
- `src/levels/chapters.ts`: `CHAPTERS`, `STOPS`, `withChapterFaces` → `row.ts`.
- `sketch` в `src/levels/roadRecipes.ts` и `src/levels/campaignRecipes.ts` (копии досок ряда). Рецепты остаются инструментом генерации (`ladder place=`); места, у которых была только `sketch`, судятся по файлу доски в отчёте.
- `src/lab/labText.ts` `boardFrom`: ищет в `ROW` и в файлах вместо `LEVELS`, `ROAD`, `PARKED`, `ROAD_SPARES`. `src/lab/leavingScenes.ts` берёт `R10` из файла `boards/R10.txt` (`?raw`).
- Скрипты `bots.mjs`, `stars.mjs`, `teach.mjs`, `ladder.mjs`, `level.mjs regress`, `library.mjs` — читают ряд из `ROW`; их таблицы включают пролог. `level.mjs regress` берёт доски не из кода, а из файлов.

## 7. Тесты и отчёт

### 7.1. Ряд — свойства, не места (`src/levels/row.test.ts`)

- Собранный ряд свежий: `buildRow(row.json, файлы через import.meta.glob '../../boards/*.txt' ?raw)` равен `ROW`.
- `buildRow` на отказах раздела 4.1 даёт свою строку (по примеру на каждый отказ, на маленьком `RowFile`, не на настоящем).
- Каждое место: путь файла (`way`) проходит доску за `par` ходов, решатель (`solveLevel`) не находит короче; на старте нет готового комбо; `help.hint` есть ключом в словаре `src/ui/i18n.ts`.
- Грамматика ряда (`src/levels/grammar.ts`, `fastGrammar(CAMPAIGN)` пуст) остаётся тестом: доска, которая ломает правила своей главы, должна краснеть. Замеры грамматики по кодам (`grammar.test.ts`, факты по `id`) — в отчёт.

### 7.2. Игра — на выдуманном ряде

Переходы (`passage.test.ts`), прогресс и перенос сохранений (`settings.test.ts`), помощь по `help` (`hint.test.ts`, `signWay.test.ts`, `roadCounters.test.ts`), список (`levelPanels.test.ts`), фокус списка (`campaign.test.ts`) проверяются на маленьком ряде из трёх мест, собранном `buildRow` из досок-строк в самом тесте. Ни один тест не называет длину настоящего ряда, номер места или порядок кодов в нём.

Тесты, которым нужна просто доска (`ROAD[2]` как пример в `lab/*.test.ts`, `render/*.test.ts`, `audio/score.test.ts`, `runner.test.ts`, `walk.test.ts`, `boardSvg.test.ts`, `snapshot.test.ts`, `table.test.ts` и др.), берут её из файла по коду (`boards/R03.txt` через `?raw`) — код доски, а не место в ряду.

### 7.3. Отчёт — `node scripts/row.mjs report`

Таблица в терминал по местам: номер, глава, код, грани, кости, `par`, маршрут, `turns`, `away`, первые ходы, доли торопливого и случайного ботов из тридцати, доски в двух ходах (`nearOf`: всего, тупики сразу, потерянные молча, худший путь), и для досок не больше 9 клеток — обход целиком (`lostOf`). `place=7` — одно место подробно. Числа, которые сейчас приколоты в `road.test.ts` (`KEYS`, `MISSES`, `runs`, `firsts`, `nearOf`, `lostOf`, рассказы уроков `R01`–`R13`), уходят из тестов: отчёт их показывает, исполнитель смотрит его перед тем, как сдать доску владельцу. Код замеров (`nearOf`, `lostOf`) переезжает из `road.test.ts` в `src/levels/measures.ts`.

## 8. Порядок работ

Работа идёт в отдельном worktree от `main`, когда соседний чат закоммитит удаление мёртвого кода (он правит `src/app/game.ts`, `progress.ts`, `recipes.ts`). Каждый шаг — отдельный коммит, `npm test`, `npm run typecheck`, `npm run build` зелёные.

1. **Ряд из файлов рядом со старым.** `boards/row.json` (раздел 3.3), `src/levels/row.ts`, `scripts/row.mjs`, `src/levels/row.gen.ts`, плагин дев-сервера, `row.test.ts` (7.1). Переходный тест: для каждого места `ROW` равен `CAMPAIGN` — тот же код, та же доска (`normalSpec` и `faces`, `values`, `floor`, `par`, `solution`, `sinkMoves`, `liftMoves`, `exact`), та же помощь, что сейчас дают `ROAD_*`, `HINTS`, `PIECES_COUNTED`, `COUNTERS_UNTIL`. Где файл расходится с кодом в поле, которое играется, — правится файл под код (играется код), и это пишется в разделе «Что вышло иначе».
2. **Игра читает ряд.** Раздел 5: `place`, прогресс и перенос, помощь из `help`, адрес. Тесты 7.2 на выдуманном ряде.
3. **Старое уходит.** Раздел 6. Перед удалением досок-литералов — тест-разовая проверка, что у каждой есть файл с той же доской (`checkLibrary` сейчас); после — удаление переходного теста шага 1, тестов по местам, `sketch`. Скрипты — на `ROW`; `row.mjs report`.
4. **Документы.** `docs/VI_Levels_Lab.md` — новый раздел «Ряд: `row.json`» (формат, команды, как вставить доску) и правка раздела 15; `docs/art/VI_Interface_Layer.md` — строки «Список уровней», «Окно подсказки доски», «Переход между досками», «Счётчик неполной группы» (плашки по `help.plaques`); `README.md` — таблица структуры; `boards/README.md`; индекс `docs/README.md` — шапка этой спеки «построено».

Проверка в конце, в preview (`vi-dev`): новый игрок проходит пролог и входит в главу 1 переходом (места 1 → 9), знак свайпа на месте 1, окно цепочки на месте 7, плашки на местах 1–10 и нет на 11; сохранение седьмой редакции (игрок на `R05`; игрок за дорогой с пройденными `R11`, `P02`) открывается там же, что до правки; `?place=B01_s290`. Размер сборки до и после (`npm run build`, строка `index-*.js`).

## 9. Как вставить доску после работы

1. Файл доски — в `boards/<код>.txt` (из лаборатории или из чата), `status: R`.
2. Строка места — в `boards/row.json`, в нужную главу на нужное место, с `role`, `archetype` и, если надо, `help`.
3. `node scripts/row.mjs`, затем `npm test`; `node scripts/row.mjs report place=<номер>` — паспорт места для владельца.
4. Убрать доску из ряда — удалить строку, файлу поставить `RC` или `X`.

## 10. Файлы, которые читает исполнитель

`src/levels/road.ts`, `src/levels/levels.ts`, `src/levels/chapters.ts`, `src/levels/campaign.ts`, `src/levels/boardFile.ts`, `src/levels/library.ts`, `src/levels/grammar.ts`, `src/app/game.ts` (поиск по `piece`, `levelIndex`, `ROAD`, `LEVELS`, `PIECES_COUNTED`, `COUNTERS_UNTIL`, `startPassage`, `boardFrame`, `countLevel`, `showLevels`, `showStart`), `src/app/passage.ts`, `src/app/signWay.ts`, `src/app/hint.ts`, `src/app/roadCounters.ts`, `src/platform/settings.ts`, `vite.boards.ts`, `scripts/library.mjs`, `docs/VI_Levels_Lab.md` (разделы 1 и 15). Тесты, которые меняются, — раздел 7.

## 11. Что вышло иначе

- Файлы досок ряда исправлять не пришлось: переходный тест (ряд из файлов против ряда кода, доска в доску и помощь в помощь) прошёл с первого раза.
- Проверка «какой записанный файл трогает ряд» вынесена из плагина дев-сервера в чистую `touchesRow` (`src/levels/row.ts`) с тестом: плагин вне `tsc` и `vitest`. Плагин проверен запуском Vite из worktree: правка пересобирает `row.gen.ts`, отказ оставляет прежний и говорит строку, возврат возвращает.
- Отчёт (7.3) живёт не в отдельном `scripts/rowReport.mjs`, а в `scripts/row.mjs` и `placeRow`/`PLACE_HEAD` в `src/levels/table.ts` — там уже складывается таблица дороги; колонки `near` и `whole` (обход доски не больше девяти клеток). `report place=5` дал для `B01_s290` те же числа, что держал `road.test.ts`: торопливый 67 %, случайный 77 %, `near` 9 0 0 5, `whole` 8592 0 12.
- Доски, что были в коде вне ряда (парковка, резерв проб), тесты и скрипты берут по кодам из `src/levels/boardSets.ts` (через `boardFiles.ts`); `import.meta.glob` работает и под `runnerImport` скриптов. Свойства ряда из удалённого `levels.test.ts` (комбо только рабочих граней, нет доски дважды и повёрнутой, нет предела ходов) перенесены в `row.test.ts`; тесты мест пробы (`P…`) по рецептам ушли вместе с ним.
- `scripts/library.mjs`: самым новым источником истории стал коммит `66b1d22` (последний с досками в коде) с пометкой `newest` и псевдонимом `HEAD` для `scripts/library-words.json`. На чистом кэше всплыла старая ошибка: `tar` читал обратную косую перед цифрой в пути кэша как экранирование — путь отдаётся с прямыми косыми. После этого `import` кладёт новый файл `B01_s290e0` — доску курса, чьё имя владелец отдал новой доске; в коммит он не взят, решение за владельцем.
- Размер сборки не изменился (`index` 565,75 кБ против 565,12 кБ, gzip 203,95 против 204,50): доски-литералы выпали из сборки, как только игра перестала их импортировать (шаг 2), а `row.gen.ts` — только 25 досок.
- `grammar.test.ts` строит место ряда (`Place`), а не `Stop` с `board`; `Board` ушёл.

