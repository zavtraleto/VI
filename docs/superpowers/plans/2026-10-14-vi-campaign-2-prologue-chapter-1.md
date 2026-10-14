# Кампания, вторая редакция, шаг 1: пролог из семи, глава «Дорога», грамматика как тест

> Вид: план. Статус: не выполнен. Дата: 2026-10-14.
> Что заменило: —. Что живёт в коде: после выполнения — src/levels/road.ts, src/levels/levels.ts, src/levels/campaign.ts, src/levels/grammar.ts, src/levels/campaignRecipes.ts, src/platform/settings.ts, boards/.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ряд становится первыми четырнадцатью местами второй редакции: пролог из семи кусков дороги по заметкам владельца и глава 1 «Дорога» из семи досок на двойках и тройках; грамматика ряда проверяется тестом; всё остальное уходит в запас; владелец играет первые десять минут.

**Architecture:** Дорога (`ROAD`) сжимается до пролога — семи кусков в порядке ряда; девять прежних кусков переезжают в `ROAD_SPARES` и остаются досками-кандидатами глав. Список (`LEVELS`) собирается из глав: `CHAPTERS` в `campaign.ts` называет главы, их грани и коды досок, доска наследует грани главы при сборке. Грамматика — чистые функции над `CAMPAIGN` и партитурами (`scoreOf`) в `src/levels/grammar.ts`: быстрые правила в vitest, дорогие (обход, персоны) — внизу таблицы `ladder campaign`. Сохранения прежних редакций не переносятся: редакция 7 начинает прогресс заново (слово владельца: «переносить сейчас можно всё»).

**Tech Stack:** TypeScript, Vite, vitest; `node scripts/level.mjs` (`check`, `moves`, `fit`, `gen`, `source`, `regress`), `node scripts/ladder.mjs campaign`; страница `?lab=levels`, адрес `?board=`; документы с `node scripts/docs-check.mjs`.

**Spec:** [2026-10-14-vi-campaign-2-design.md](../specs/2026-10-14-vi-campaign-2-design.md) — разделы 2 (решения), 3 (грамматика), 4.1 (пролог и глава 1 по местам), 5 (правки пролога), 6 (что куда уходит), 7 (механизм); первая редакция — [2026-10-12-vi-campaign-design.md](../specs/2026-10-12-vi-campaign-design.md), разделы 5.3–5.4 (паспорт, полосы) и 9 (механизм ряда). Процедура новой доски — [план акта I](2026-10-13-vi-campaign-act-1.md), раздел «Процедура доски». Исполнитель читает это, спеки по ссылкам и названные файлы.

## Global Constraints

- Свой worktree от `origin/main`; в основную папку `GAMES\VI` не писать. Публикация: `git fetch`, rebase на `origin/main`, проверки, `git push origin HEAD:main` — после «ок» владельца.
- `src/rules` не трогать (правила заморожены). Доски — в рамках правил как есть.
- Интерфейс не меняется: ни новых элементов, ни новых строк, кроме перестановки существующих. Список «Уровни» показывает столько клеток, сколько в ряду.
- Пол на всех досках главы 1 открыт (`floor` не задан); у кусков пролога — как было.
- Каждая новая доска — файл в `boards/`, перенос в код через `node scripts/level.mjs source`; `node scripts/level.mjs regress` после каждого переноса.
- Коммит после каждой задачи; заголовок до 70 знаков, тело до пяти строк. Проверки: `npm test`, `npm run typecheck`; перед публикацией — `npm run build`, `node scripts/docs-check.mjs`, `node scripts/level.mjs regress`.
- Ключ (что каждая новая доска задумана показать) — в `docs/VI_Levels_Probe_Key.md`, владельцу не пересказывать.

## Review Focus

1. **`ROAD_END` не должен совпадать с кодом куска.** С прологом из семи `pieceAfter(6)` по старому `codeAt(7)` дал бы `R08` — код реального куска. → Задача 1, тест `ROAD_END` не входит в `ROAD.map(id)`.
2. **Сохранение шестой редакции с `road: 'R12'`** (игрок стоял посреди старой дороги) после редакции 7 открывает `START` на `R01`, звёзды пусты, `fixedSaid` сохранён. → Задача 1, тест `toRoadEdition`.
3. **Грани главы меняют решение доски.** `P02` ([2]) и `K22` ([3]) получают [2, 3]: у `P02` могут появиться комбо троек, у `K22` — пар двоек, и `par` или путь изменятся. → Задача 2, `regress` после наследования граней; расхождение — в «Что вышло иначе» и, если доска стала хуже, замена кандидатом.
4. **`R05` со сдвинутым стартом**: путь другой, `par` может вырасти; на экране 360×640 игрок должен видеть, что стоит не на крайней кости. → Задача 1, `check` и preview.
5. **Правило 1 грамматики на стыке пролога и главы 1.** `R07` учит звену; из трёх следующих досок звено нужно `R08` и `P02`, поэтому `P02` стоит девятым, `R15` десятым (спека 4.1 с поправкой). Тест грамматики должен быть зелёным на собранном ряду, а не ослабленным под него. → Задача 3.

---

### Task 1: Пролог из семи кусков, запас дороги, седьмая редакция сохранений

**Files:**
- Modify: `src/levels/road.ts` (`ROAD`, новый `ROAD_SPARES`, `R05`, `ROAD_BLOCKS`, `ROAD_HINTS`, `codeAt`/`pieceAfter`/`ROAD_END`/`FIRST_PASSED`, `ROAD_EDITION`, `toRoadEdition`)
- Modify: `src/levels/roadRecipes.ts` (места `R06`, `R09`–`R16` остаются рецептами запаса; `R05` получает `walk: true`)
- Modify: `src/platform/settings.ts:150-165` (загрузка с переносом)
- Test: `src/levels/road.test.ts`, `src/platform/settings.test.ts:60-110`

**Interfaces:**
- Produces: `ROAD: readonly LevelSpec[]` из семи (`R01`, `R02`, `R03`, `R04`, `R05`, `R07`, `R08`); `ROAD_SPARES: readonly LevelSpec[]` из девяти (`R06`, `R09`, `R10`, `R11`, `R12`, `R13`, `R14`, `R15`, `R16`, те же объекты); `ROAD_END = 'R00'`; `FIRST_PASSED = ROAD[ROAD_BLOCKS[0].to + 1].id`; `ROAD_EDITION = 7`; `toRoadEdition(kept)` для редакций < 7 возвращает `{ ...kept, passed: {}, stats: {}, road: undefined, roadEdition: 7 }` (поле `fixedSaid` не трогается).

- [ ] **Step 1: Тесты**

В `src/levels/road.test.ts`:
- Состав: `ROAD.map(id)` равно `['R01','R02','R03','R04','R05','R07','R08']`; `ROAD_SPARES.map(id)` равно `['R06','R09','R10','R11','R12','R13','R14','R15','R16']`; никакая доска не в обоих.
- Блоки: `ROAD_BLOCKS` равно `[{ from: 0, to: 4, oneScale: true }, { from: 5, to: 6, oneScale: false }]`; `FIRST_PASSED === 'R07'`; `ROAD_END === 'R00'` и `ROAD.every((spec) => spec.id !== ROAD_END)`; `pieceAfter(6) === ROAD_END`; `roadPlace('R07', false) === 5`; `roadPlace('R12', false) === 0` (код не из пролога ведёт на первый кусок).
- Строки: `ROAD_HINTS` равно `{ R07: { key: 'roadHintChain', until: 'chain' } }` (строки спуска и толчка уходят из дороги — они вернутся с главой 4 по кодам её досок).
- `R05`: старт `{ x: 2, z: 2 }`; решатель даёт путь; `KEYS.R05` переписать по новому пути (сначала `check file=game:R05`, потом ключи); первый ход — с кости, к которой надо шагнуть, или перекат своей (записать, что вышло).
- Редакция: `toRoadEdition({ passed: { R01: true, P13: true }, stats: { R01: { bestMoves: 4 } }, road: 'R12', roadEdition: 6, fixedSaid: true })` → `{ passed: {}, stats: {}, road: undefined, roadEdition: 7, fixedSaid: true }`; с `roadEdition: 7` — объект возвращается как есть.
- Тесты, пинявшие шестнадцать кусков и четыре блока (210–220, 255, 262–286, 304, 357–365), переписать на пролог; проверки отдельных досок `R06`, `R09`–`R16` (их `KEYS`, `clearedWithout`, `lostOf`) оставить, беря доску из `ROAD_SPARES` через `spareOf(id)`: доски никуда не делись и позже встанут в главы.

В `src/platform/settings.test.ts`: строки 69–104 — ожидания `roadEdition: 6` и перенесённых записей заменить на сброс до редакции 7 (`passed: {}`, `stats: {}`, без `road`, `fixedSaid` как был).

- [ ] **Step 2: Запустить — падают.** `npx vitest run src/levels/road.test.ts src/platform/settings.test.ts`.

- [ ] **Step 3: `road.ts`**

- `ROAD` — семь объектов в порядке `R01 R02 R03 R04 R05 R07 R08`; остальные девять — в `export const ROAD_SPARES` (объекты не менять; картинки-комментарии переезжают с ними). Шапку модуля переписать: дорога — пролог кампании второй редакции, семь кусков по заметкам владельца 14 октября (ссылка на спеку, раздел 5); запас — кандидаты глав.
- `R05`: `start: { x: 2, z: 2 }`; `par` и `solution` — из `node scripts/level.mjs check file=game:R05` после правки (ожидание: 3 или 4 хода; путь начинается шагом на восточную кость или перекатом своей). Комментарий-картинка: `A` на (2,2).
- `ROAD_BLOCKS = [{ from: 0, to: 4, oneScale: true }, { from: 5, to: 6, oneScale: false }]`.
- `ROAD_HINTS = { R07: { key: 'roadHintChain', until: 'chain' } }`; тип `RoadHintKey` оставить со всеми четырьмя ключами (строки живут в текстах и вернутся).
- `codeAt` убрать; `export const ROAD_END = 'R00'`; `pieceAfter(index) = ROAD[index + 1]?.id ?? ROAD_END`; `FIRST_PASSED = ROAD[ROAD_BLOCKS[0].to + 1].id`.
- `ROAD_EDITION = 7`; `toRoadEdition`: если `kept.roadEdition === 7` — вернуть как есть; иначе `{ ...kept, passed: {}, stats: {}, road: undefined, roadEdition: 7 }`. Таблицы прежних редакций (`SECOND_EDITION_*`, `THIRD_EDITION_*`, `FOURTH_EDITION_BOARDS`, `FIFTH_EDITION_RESET`) удалить; комментарий: с седьмой редакции прогресс начинается заново по слову владельца 14 октября, следующие редакции решают перенос сами.
- `ROAD_IDLE`, `ROAD_LESSONS` (`R01`, `R02`), `ROAD_SIGNS` — без изменений по смыслу (считаются от нового `ROAD`).

`roadRecipes.ts`: рецепт `R05` получает `walk: true` (первый ход — с кости, к которой шагают) — если новый путь так и идёт; иначе не трогать и записать.

- [ ] **Step 4: Прогнать, preview, коммит**

```bash
npx vitest run src/levels/road.test.ts src/platform/settings.test.ts && npm run typecheck
node scripts/level.mjs check file=game:R05
```

Preview (`vi-dev`, 360×640, чистые настройки, `?first`): `R01`→`R02`→…→`R05` (игрок стоит на второй кости справа), `R07` со строкой цепочки, `R08`; после `R08` — переход на первую доску списка. Коммит:

```bash
git add src/levels/road.ts src/levels/roadRecipes.ts src/levels/road.test.ts src/platform/settings.ts src/platform/settings.test.ts
git commit -m "Дорога — пролог из семи кусков; запас дороги; седьмая редакция без переноса"
```

---

### Task 2: Главы в ряду: `CHAPTERS`, грани главой, список из главы 1

**Files:**
- Modify: `src/levels/campaign.ts` (`Role`, `Stop`, `CHAPTERS`, `STOPS`, `CAMPAIGN`, `HINTS`)
- Modify: `src/levels/levels.ts` (`CHAPTER_1`, `LEVELS`, `PARKED`)
- Modify: `src/app/game.ts` (ссылки на `act` → `chapter`, если есть), `src/levels/table.ts` (роль в таблице `ladder campaign`: `1:meet`)
- Test: `src/levels/campaign.test.ts`, `src/levels/levels.test.ts`, `src/shell/levelPanels.test.ts` (число клеток)

**Interfaces:**
- Produces:

```ts
export type Role = 'meet' | 'learn' | 'apply' | 'event' | 'twist' | 'peak' | 'rest';
export type Technique = 'link' | 'walk' | 'glass' | 'lift' | 'push' | 'ones' | 'twoFaces' | 'seven' | 'time';
export interface Chapter { id: number; title: string; faces: readonly number[] | null; stops: readonly string[] }  // faces null — у пролога грани свои на каждой доске
export const CHAPTERS: readonly Chapter[];   // глава 0 (пролог): R01 R02 R03 R04 R05 R07 R08; глава 1 «Дорога», faces [2, 3]: R11 P02 R15 C1-04 C1-05 C1-06 K22
export interface StopMeta { chapter: number; role: Role; teaches?: Technique; archetype: string; event?: string }
export const STOPS: Readonly<Record<string, StopMeta>>;
export interface Stop { spec: LevelSpec; number: number; board: Board; chapter: number; role: Role; teaches?: Technique; archetype: string; event?: string }
export function withChapterFaces(spec: LevelSpec, faces: readonly number[]): LevelSpec;  // { ...spec, faces, values: faces }
// levels.ts
export const CHAPTER_1: readonly LevelSpec[];   // доски главы 1 с гранями главы, в порядке CHAPTERS[1].stops
export const LEVELS: readonly LevelSpec[] = [...CHAPTER_1];
```

- [ ] **Step 1: Тесты**

`src/levels/campaign.test.ts` (переписать тесты актов):

```ts
it('is the prologue and the chapters, in the order of CHAPTERS, numbered from one', () => {
  expect(CAMPAIGN.map((stop) => stop.spec.id)).toEqual(CHAPTERS.flatMap((chapter) => chapter.stops));
  expect(CAMPAIGN.length).toBe(14);
  expect(CAMPAIGN[0]).toMatchObject({ chapter: 0, role: 'meet' });
  expect(CAMPAIGN[7]).toMatchObject({ chapter: 1, role: 'meet', teaches: 'walk' });
});

it('gives every board of a chapter the faces of the chapter, and leaves the prologue its own', () => {
  for (const stop of CAMPAIGN.slice(7)) expect(stop.spec.faces, stop.spec.id).toEqual([2, 3]);
  expect(CAMPAIGN[0].spec.faces).toEqual([2]);
  expect(CAMPAIGN[1].spec.faces).toEqual([3]);
});

it('knows what every stop teaches and what it is about', () => {
  expect(STOPS.R07).toMatchObject({ chapter: 0, role: 'meet', teaches: 'link' });
  expect(STOPS['C1-04']).toMatchObject({ chapter: 1, role: 'meet', teaches: 'glass' });
  for (const stop of CAMPAIGN) expect(stop.archetype, stop.spec.id).toBeTruthy();
});

it('carries the line of the chain on R07 and no other line yet', () => {
  expect(HINTS).toEqual({ R07: { key: 'roadHintChain', until: 'chain' } });
});
```

Тесты клеток и фокуса остаются; `campaignFocus` с `road: ROAD_END` → `ROAD.length + nextLevel` (7 + …). `levels.test.ts`: «are the acts…» → «are the chapters after the prologue, in order» (`LEVELS` равно `CHAPTER_1`); «each a level of a place» — место ищется в `PLACES`, `ROAD_PLACES` и `CAMPAIGN_PLACES`; «let only the faces of their places work» — грани доски равны граням её главы, а грани места — подмножество (`R11` [3,2] ⊆ [2,3]; `P02` [2] ⊆ [2,3]); тест парковки — `PARKED` содержит все доски актов I–II (`K17`, `P03`, `P16`, `P09`, `K21`, `K23`, `P20`, `K25`, `P06`, `P05`, `K28`) и прежние. `levelPanels.test.ts`: клеток 14.

До задачи 4 в `CHAPTERS[1].stops` стоят только существующие доски (`R11`, `P02`, `R15`, `K22`), и тест длины ждёт 11; задача 4 доводит до 14. Записать это в тесте комментарием, чтобы не забыть поправить.

- [ ] **Step 2: Запустить — падают.**

- [ ] **Step 3: `campaign.ts`**

```ts
export const CHAPTERS: readonly Chapter[] = [
  { id: 0, title: 'prologue', faces: null, stops: ['R01', 'R02', 'R03', 'R04', 'R05', 'R07', 'R08'] },
  { id: 1, title: 'road', faces: [2, 3], stops: ['R11', 'P02', 'R15', 'C1-04', 'C1-05', 'C1-06', 'K22'] },
];

export const STOPS: Readonly<Record<string, StopMeta>> = {
  R01: { chapter: 0, role: 'meet', archetype: 'roll' },
  R02: { chapter: 0, role: 'learn', archetype: 'ride', event: 'stair and floor' },
  R03: { chapter: 0, role: 'apply', archetype: 'first free board' },
  R04: { chapter: 0, role: 'apply', archetype: 'free to fail', event: 'first dead end' },
  R05: { chapter: 0, role: 'apply', archetype: 'choose the first die', event: 'choice of the first die' },
  R07: { chapter: 0, role: 'meet', teaches: 'link', archetype: 'chain' },
  R08: { chapter: 0, role: 'rest', archetype: 'domino', event: 'domino' },
  R11: { chapter: 1, role: 'meet', teaches: 'walk', archetype: 'bridge', event: 'first walk over leaving dice' },
  P02: { chapter: 1, role: 'apply', archetype: 'bridge' },
  R15: { chapter: 1, role: 'apply', archetype: 'bridge' },
  'C1-04': { chapter: 1, role: 'meet', teaches: 'glass', archetype: 'roll onto leaving', event: 'a leaving die is a cell' },
  'C1-05': { chapter: 1, role: 'apply', archetype: 'roll onto leaving' },
  'C1-06': { chapter: 1, role: 'twist', archetype: 'bridge both ways', event: 'the road goes both ways, briefly' },
  K22: { chapter: 1, role: 'rest', archetype: 'collapse', event: 'first big clearing' },
};
```

`CAMPAIGN`: пролог — `ROAD` как есть (`board: { road }`); главы ≥ 1 — `LEVELS` (`board: { level }`); у каждой остановки `...STOPS[spec.id]`; остановка без записи в `STOPS` — ошибка сборки (`throw`), чтобы доска не попала в ряд без мысли. `withChapterFaces(spec, faces)` возвращает `{ ...spec, faces, values: faces }`. `HINTS = { ...ROAD_HINTS }` (ключи `hintSeven`, `hintLinkMove` остаются в типе и текстах, в ряду пока не звучат).

`levels.ts`: `CHAPTER_1` собирается из `CHAPTERS[1].stops` по пулу `{ ...Object.fromEntries(ROAD_SPARES.map(...)), ...Object.fromEntries(POOL.map(...)) }`, где `POOL` — все доски-кандидаты файла (прежние `ACT_1`, `ACT_2`, `PARKED`, новые доски); каждая через `withChapterFaces(spec, [2, 3])`. `PARKED` — всё из пула, что не в ряду. Константы `ACT_1`, `ACT_2` убрать; импорты в `game.ts`/тестах поправить. `table.ts`: роль печатается `${chapter}:${role}`.

- [ ] **Step 4: Грани главы и решатель (Review Focus 3)**

```bash
node scripts/level.mjs check file=game:P02
node scripts/level.mjs check file=game:K22
node scripts/level.mjs regress
```

Если у `P02` или `K22` с гранями [2, 3] путь стал короче или появилось готовое комбо на старте (`checkLayout` откажет) — доску заменить ближайшим кандидатом места (`SPARES` того же места) или поправить одну кость в лаборатории (`near`), записать в «Что вышло иначе». `par` и `solution` в `levels.ts` — те, что даёт `check` с гранями главы.

- [ ] **Step 5: Прогнать и закоммитить**

```bash
npm test && npm run typecheck
git add src/levels/campaign.ts src/levels/campaign.test.ts src/levels/levels.ts src/levels/levels.test.ts src/levels/table.ts src/app/game.ts src/shell/levelPanels.test.ts
git commit -m "Ряд второй редакции: главы, грани главой, список из главы «Дорога»"
```

---

### Task 3: Грамматика ряда как тест

**Files:**
- Create: `src/levels/grammar.ts`, `src/levels/grammar.test.ts`
- Modify: `scripts/ladder.mjs` (ветка `campaign`: нарушения внизу), `src/levels/table.ts`

**Interfaces:**
- Produces:

```ts
export function needsOf(spec: LevelSpec): ReadonlySet<Technique>;   // из scoreOf(spec, parseWay(spec.solution)): L→link, ~→walk, v/^→lift, how 'glass'→glass, P/Q→push, O/U→ones; два разных face у событий combo→twoFaces
export interface Violation { rule: 1 | 2 | 3 | 4 | 5; at: number; text: string }   // at — номер места, text — словами
export function fastGrammar(row: readonly Stop[]): Violation[];      // правила 1, 3, 4: без обхода и ботов
export function slowGrammar(row: readonly Stop[], facts: (stop: Stop) => { lost: boolean; planner: number }): Violation[];  // правила 2, 5
```

Правила — спека, раздел 3, с уточнениями, принятыми при постройке (записать их в спеку, раздел 3, одной строкой каждое):

1. Доска с `teaches: T` на месте N: `T` входит в `needsOf` не менее двух из досок N+1…N+3; следующая доска с `teaches` — не раньше N+2. Пролог: `R07` учит `link`, `R08` и `P02` его требуют.
3. Одного `archetype` подряд — не больше трёх; две доски ряда не равны с точностью до поворота, зеркала и грани (`sameBoard` из `variety.ts` на досках с одинаковыми гранями).
4. У главы с `faces` все доски несут эти грани; у пролога (`faces: null`) — свои.
5. Доска после `meet`: `par` ≤ `par(meet) + 1`; планирующий бот на ней не ниже, чем на `meet` (медленная часть); самая низкая доля планирующего в главе — не раньше четвёртого места главы.
2. (медленная) У доски с `teaches` обход находит проигранное положение (`lost`) и приём — короткий путь: без него (`clearedWithout` в `par + 1`) решения нет. Первые три места ряда исключены.

- [ ] **Step 1: Тесты**

`grammar.test.ts`: `needsOf` на `R08` содержит `link`; на `R11` — `walk` и не `link`; на `K23` (из `PARKED`) — `glass` и `link`; на `P06` — `lift` и `push`. `fastGrammar(CAMPAIGN)` — пустой список на собранном ряду (после задачи 4; до неё — тест с `it.todo`). Отрицательные: ряд, где после `R07` стоят `R11`, `R15`, `R03` → одно нарушение правила 1 с текстом `место 6 (R07) учит link, а из мест 7–9 его требует 0 досок`; ряд с четырьмя `bridge` подряд → правило 3; доска главы 1 с гранями [3] → правило 4.

- [ ] **Step 2: Реализация** — `needsOf` через `scoreOf` (путь — `spec.solution`, разбор как в `levelScore.test.ts`); `fastGrammar` — три функции, каждая возвращает `Violation[]`; тексты по-русски, с номерами мест и кодами. `slowGrammar` — чистая функция, факты ей даёт `ladder.mjs` (обход `walk` и персоны уже считаются в `roadRow`).

- [ ] **Step 3: `ladder campaign`** печатает после таблицы блок `grammar:` — все нарушения быстрых и медленных правил или `grammar: clean`. `src/levels/table.ts` экспортирует `grammarText(violations)`.

- [ ] **Step 4: Прогнать, коммит**

```bash
npm test && npm run typecheck
git add src/levels/grammar.ts src/levels/grammar.test.ts scripts/ladder.mjs src/levels/table.ts docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md
git commit -m "Грамматика ряда: needsOf, пять правил, нарушения в тесте и в ladder campaign"
```

---

### Task 4: Три новые доски главы 1: накат дважды и мост туда и обратно

**Files:**
- Modify: `src/levels/campaignRecipes.ts` (места `C1-04`, `C1-05`, `C1-06`; прежние `K..` остаются рецептами запаса), `src/levels/levels.ts`, `src/levels/campaign.ts` (длина ряда 14), `docs/VI_Levels_Probe_Key.md`
- Create: `boards/C1-04.txt`, `boards/C1-05.txt`, `boards/C1-06.txt`

Процедура — план акта I, раздел «Процедура доски»; кладка — назад от конца, как у `K23`/`K25` (их журналы в планах актов), генератор места спросить первым (`gen place=`), не надеясь на него. Грани у всех трёх — [2, 3].

- [ ] **Step 1: `C1-04`, встреча наката (`teaches: glass`)**

Кандидат первый — `K23` как есть (3×4, четыре двойки, путь `K L L`, прокат по уходящей на третьем ходу): `check file=game:K23` — убедиться, что без `glass` решения нет (`clearedWithout(spec, 2, 'glass')` ложно). Если на `K23` накат читается как часть счёта времени (две цепочки подряд), а не как мысль доски, — строить новую: `size 4, holes LONG (3×4), dice 3–4, faces [2, 3], standing [{ value: 2, count: 1 }], needs ['glass'], par [3, 4], firsts [1, 99]`; бриф: пара двоек уходит, своя кость доходит до нужной клетки только накатом на уходящую (уходящая исчезает, своя встаёт на её место), обход без наката — на два хода длиннее или никак. Строки над полем нет (спека, раздел 10, пункт 2 — решение владельца после игры).

- [ ] **Step 2: `C1-05`, накат второй раз** — на тройках: `dice 5, faces [2, 3], standing [{ value: 3, count: 2 }], needs ['glass'], par [3, 5]`; другая фигура (накат не на кость пары, а на звено).

- [ ] **Step 3: `C1-06`, мост туда и обратно (twist)** — `dice 6, faces [2, 3], needs ['walk'], shows ['glass'], par [4, 6]`; бриф: комбо уходит (два хода), по нему игрок проходит к кости за ним, делает ход и возвращается по тому же уходящему комбо (или накатом на его последнюю кость) к третьей кучке; опоздание на ход оставляет его отрезанным — тупик объявляется сразу или путь длиннее на три. Правило 1: `C1-04` учит `glass`, `C1-05` и `C1-06` его требуют (у `C1-06` — через `shows` на кратчайшем пути; проверить `needsOf`).

- [ ] **Step 4: В ряд**

`CHAPTERS[1].stops` — все семь; тест длины 14; `fastGrammar(CAMPAIGN)` пустой; `node scripts/level.mjs regress` чист; `node scripts/ladder.mjs campaign` — `grammar: clean` или список медленных нарушений с объяснением в «Что вышло иначе». Ключ: три записи «Ключ главы 1» в `docs/VI_Levels_Probe_Key.md` (роль, задумка, паспорт, кандидаты).

```bash
git add boards src/levels/campaignRecipes.ts src/levels/levels.ts src/levels/campaign.ts src/levels/campaign.test.ts src/levels/grammar.test.ts docs/VI_Levels_Probe_Key.md
git commit -m "Глава «Дорога»: накат дважды и мост туда и обратно; ряд из 14 мест"
```

---

### Task 5: Проход, документы, версия, «ок»

- [ ] **Step 1: Проход исполнителя** на 360×640 и 1920×1080 с чистыми настройками: четырнадцать мест подряд; по каждому — первый напрашивающийся ход, читается ли мысль, стык пролога и главы 1 (`R08` → `R11`), стык внутри главы (`R15` → `C1-04`). Записать в «Что вышло иначе».
- [ ] **Step 2: Документы.** [ROADMAP.md](../../ROADMAP.md) «Кампания» — состояние второй редакции (ряд 14, версия); [VI_Levels_Probe_Key.md](../../VI_Levels_Probe_Key.md) — шапка (где стоят доски; акты I–II в парковке); [art/VI_Interface_Layer.md](../../art/VI_Interface_Layer.md) — список на 14 клеток; [VI_Campaign_Language_Research.md](../../VI_Campaign_Language_Research.md), раздел 7 — что решено; спека второй редакции — уточнения правил грамматики (задача 3) и всё, что вышло иначе, в новый раздел 12; этот план — статус, «Что вышло иначе», «Что не хватало». Индекс: строка плана.
- [ ] **Step 3: Проверки и версия.**

```bash
npm test && npm run typecheck && npm run build && node scripts/docs-check.mjs && node scripts/level.mjs regress
npm version 0.2.57 --no-git-tag-version
git add package.json package-lock.json docs
git commit -m "Версия 0.2.57: кампания второй редакции, пролог и глава «Дорога»"
```

- [ ] **Step 4: «Ок» владельца.** Показать: что изменилось для игрока (ряд из 14 мест: пролог из семи и глава «Дорога»; `R05` старт сдвинут; `R06`, `R09`–`R16` и доски актов в запасе; грани главы одни; прогресс начинается заново), как играть (с первой доски до 14-й, слова по строчке на место), чего не говорить (ключ). После «ок»: rebase, проверки, `git push origin HEAD:main`.

---

## Что вышло иначе

Заполняется исполнителем.

## Что не хватало

Журнал процесса по трём новым доскам: зёрна, кладка, что считалось руками; что грамматике не хватило как мерила.
