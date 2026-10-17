# Кампания, третья редакция, шаг 1: слой «Кость» и правила ряда — план

> Вид: план. Статус: не выполнен. Дата: 2026-10-17.
> Что заменило: —. Что живёт в коде: src/levels/row.ts, src/levels/grammar.ts, src/levels/table.ts, src/lab/workshopRow.ts, boards/row.json, boards/*.txt.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать места 1–10 ряда по таблице 5.1 спеки (две новые доски, `R01` без фиксированной кости, окно семи на 7-м) и поставить в тест правила 4, 7–9 грамматики с полем `emotion` у места; ряд после шага играбелен и публикуется.

**Architecture:** Правила ряда — чистые функции над `CAMPAIGN` в `src/levels/grammar.ts`, быстрые в тесте, медленные под таблицей `ladder campaign`; `row.json` получает ключ `emotion` у места (словарь в `row.ts`, форма мастерской — поле); доски — файлы `boards/*.txt`, ряд собирается `node scripts/row.mjs`. Правила 4, 8, 9 на этом шаге печатаются как предупреждения и тест не держат (`HELD`), правило 7 держит.

**Tech Stack:** TypeScript, vitest, скрипты `scripts/*.mjs` (Node 24), дев-сервер Vite (preview `vi-dev`).

**Spec:** [docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md](../specs/2026-10-16-vi-campaign-3-design.md) — разделы 2 (решения), 5.1 (места 1–10), 6 (брифы `side-up`, `three-under`), 7 (правила), 10 (шаг 1). Рядом читать: [VI_Levels_Rules.md](../../VI_Levels_Rules.md) (раздел 4 — все грани работают), [VI_Levels_Lab.md](../../VI_Levels_Lab.md) (разделы 1 и 16: формат доски, `row.json`), [спека мастерской](../specs/2026-10-15-vi-level-workshop-design.md) (раздел 5.3: имена досок, раздел 11: ряд на странице).

## Global Constraints

- Работа в worktree, модель исполнителя — Opus; в основную папку ничего не писать. Чат уровней правит доски в `main` параллельно: перед каждым коммитом `git fetch` и `git rebase origin/main`; конфликт в `boards/row.json` или файле доски решать в пользу `origin/main` и накладывать свою правку заново.
- Коммит — после каждой задачи, в ветке worktree; заголовок до 70 знаков, тело до пяти строк, в конце `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Пуш в `main` — только после «ок» владельца.
- Правила уровня (`src/rules`) не трогаются. Все грани от двойки до шестёрки работают (0.2.66): `faces` доски — о каких гранях она, и должны совпадать с гранями цели по пути (`goalFaces`).
- Имена новых досок — по замыслу по-английски с номером: `side-up-1`, `three-under-1`; в ряду имя — код навсегда.
- Коды и слова мест, окон и ролей — только из списков `row.ts` (`ROLES`, `TECHNIQUES`, `HINT_KEYS`); новый список `EMOTIONS` — одиннадцать слов раздела 4.4 спеки.
- Проверки перед каждым коммитом задачи: `npm test`, `npm run typecheck`; перед последним — ещё `npm run build`, `node scripts/docs-check.mjs`, `node scripts/level.mjs regress`, `node scripts/ladder.mjs campaign` (долгая, в фоне).
- Тексты окон не меняются (`src/ui/i18n.ts`); текст окна семи — открытый вопрос владельца, спека раздел 11.

## Review Focus

1. Доска ряда без `emotion` в `row.json` (старые записи, доска, поставленная со страницы без выбора эмоции): ряд собирается, а правило 8 называет место словами — задача 4, тест «место без эмоции».
2. Доска с окном, у которой `teaches` не совпадает с приёмом окна или путь его не требует: правило 7 называет место, тест красный — задача 3.
3. `faces` доски называет единицу (`faces: 1 3`, доски единиц на полке): правило 4 сравнивает только грани от двойки, единица не считается лишней — задача 2, тест.
4. Доска после пика с тем же паром, что у пика (не легче): правило 8 называет место — задача 4, тест.
5. `R01` без фиксированной кости: решатель может найти путь короче четырёх (по-новому работают все грани) — задача 6, проверка `check` с ожиданием `par 4`; при ином паре фиксированная кость остаётся и это пишется в «Что вышло иначе».

---

### Task 1: Поле `emotion` у места ряда

**Files:**
- Modify: `src/levels/row.ts` (списки, `RowPlaceFile`, `Place`, `PLACE_KEYS`, `buildRow`)
- Modify: `src/levels/rowFixture.ts` (эмоции у трёх мест)
- Modify: `src/lab/workshopLists.ts` (`EMOTION_TITLES` рядом с `ROLE_TITLES`)
- Modify: `src/lab/workshopRow.ts:281-345` (поле формы)
- Test: `src/levels/row.test.ts`, `src/levels/rowEdit.test.ts`

**Interfaces:**
- Produces: `export const EMOTIONS = ['gift', 'recognition', 'insight', 'flow', 'trick', 'surprise', 'tension', 'payoff', 'fiero', 'relief', 'mastery'] as const; export type Emotion = (typeof EMOTIONS)[number];` в `row.ts`; `RowPlaceFile.emotion?: Emotion`, `Place.emotion?: Emotion`; `PLACE_KEYS = ['board', 'role', 'teaches', 'archetype', 'emotion', 'event', 'note', 'help']`; `EMOTION_TITLES: Record<Emotion, string>` в `workshopLists.ts` — подарок, узнавание, догадка, поток, ложная простота, удивление следствию, напряжение счёта, развязка, фиеро, облегчение, мастерство.

- [ ] **Step 1: Тест — `buildRow` держит эмоцию и отказывает слову не из списка** (`row.test.ts`, в `describe('buildRow')`):

```ts
it('keeps the emotion of a place, and refuses a word that is none of EMOTIONS', () => {
  const file = { chapters: [{ title: 'one', places: [{ board: 'F1', role: 'meet', archetype: 'a', emotion: 'gift' }] }] };
  expect(buildRow(file as RowFile, boards).places[0].emotion).toBe('gift');
  const wrong = { chapters: [{ title: 'one', places: [{ board: 'F1', role: 'meet', archetype: 'a', emotion: 'joy' }] }] };
  expect(() => buildRow(wrong as RowFile, boards)).toThrow('row: place 1 (F1): "emotion: joy" is none of gift, recognition, insight, flow, trick, surprise, tension, payoff, fiero, relief, mastery');
});
```
(`boards` — карта из одной доски `F1`, как в соседних тестах файла.)

- [ ] **Step 2: Запустить, убедиться, что падает** — `npx vitest run src/levels/row.test.ts`: FAIL, `emotion` неизвестный ключ.

- [ ] **Step 3: Внести `EMOTIONS`, `Emotion`, поля и проверку `oneOf(where, 'emotion', …)` в `row.ts`; `emotion` переносится в `Place` как `teaches`.** `PLACE_KEYS` — в порядке выше (так `rowFileText` пишет ключ на месте без правок `rowEdit.ts`).

- [ ] **Step 4: Тест `rowEdit.test.ts` — `rowFileText` пишет `emotion` между `archetype` и `event`:** добавить в существующий тест текста файла место с `emotion: 'gift'` и ожидать строку `{ "board": "A1", "role": "meet", "archetype": "a", "emotion": "gift", "event": "e" }` (точные соседние ключи — как в тесте уже есть).

- [ ] **Step 5: Фикстура** — в `rowFixture.ts` местам `F1`, `F2`, `G1` дать `emotion: 'gift'`, `'recognition'`, `'surprise'`; тесты фикстуры (`campaign.test.ts`) не меняются.

- [ ] **Step 6: Форма мастерской** — в `workshopRow.ts` после `teachesField` поле `emotionField = select(palette, [none, ...EMOTIONS.map((one) => [one, EMOTION_TITLES[one]])])`, значение из `was.emotion`, в `place` — `...(emotionField.value ? { emotion: emotionField.value as Emotion } : {})`, в `this.form.replaceChildren` — `labelled('эмоция', emotionField)` после `teaches`. `EMOTION_TITLES` — в `workshopLists.ts` рядом с `ROLE_TITLES`.

- [ ] **Step 7: Проверить** — `npx vitest run src/levels && npm run typecheck`: PASS. `node scripts/row.mjs check`: код 0 (ряд без эмоций собирается — ключ необязателен).

- [ ] **Step 8: Коммит** — `Ряд: поле emotion у места, словарь из одиннадцати слов`.

### Task 2: Правило 4 — грани цели по пути; правила, которые держат тест

**Files:**
- Modify: `src/levels/grammar.ts` (`Violation.rule`, `facesOfChapter` → `facesByWay`, `fastGrammar`, `HELD`)
- Modify: `src/lab/workshopRow.ts:126` (вызов без `chapters`)
- Test: `src/levels/grammar.test.ts`

**Interfaces:**
- Produces: `Violation.rule: 1 | 2 | 3 | 4 | 5 | 7 | 8 | 9`; `export function fastGrammar(row: readonly Stop[]): Violation[]` (без второго параметра); `export const HELD: ReadonlySet<Violation['rule']> = new Set([1, 2, 3, 5, 7])` — правила, которые держат публикацию на шаге 1 (4, 8, 9 — с шага 3 спеки); `export const held = (one: Violation): boolean => HELD.has(one.rule)`.

- [ ] **Step 1: Тесты правила 4** — в `grammar.test.ts` заменить два теста `rule 4` (строки 101–113) на:

```ts
it('says where the faces a board names are not those of its way: rule 4', () => {
  const row = rowOf([['R11', { teaches: undefined }], 'act-k22']);
  row[1] = { ...row[1], spec: { ...row[1].spec, faces: [2, 3], values: [2, 3] } };
  expect(fastGrammar(row).filter((one) => one.rule === 4)).toEqual([{ rule: 4, at: 2, text: 'место 2 (act-k22) называет грани 2 3, а на пути — 3' }]);
});
it('lets a board name the 1s besides the faces of its way, and refuses `only`: rule 4', () => {
  const row = rowOf([['R11', { teaches: undefined }], 'act-k22']);
  row[1] = { ...row[1], spec: { ...row[1].spec, faces: [1, 3], values: [1, 3] } };
  expect(fastGrammar(row).filter((one) => one.rule === 4)).toEqual([]);
  row[1] = { ...row[1], spec: { ...row[1].spec, only: [3] } };
  expect(fastGrammar(row).filter((one) => one.rule === 4).map((one) => one.text)).toEqual(['место 2 (act-k22) ставит only, а доска ряда его не ставит']);
});
```

- [ ] **Step 2: Запустить** — `npx vitest run src/levels/grammar.test.ts -t 'rule 4'`: FAIL (старый текст о главе).

- [ ] **Step 3: Реализовать `facesByWay(row: readonly Stop[]): Violation[]`** в `grammar.ts`: `named = (stop.spec.faces ?? []).filter((f) => f >= 2).sort()`, `way = goalFaces(stop.spec)` (`import { goalFaces } from './goalFaces'`); не равны — нарушение с текстом как в тесте (`named.join(' ')`, `way.join(' ')`); `stop.spec.only` задан — второе нарушение. Удалить `facesOfChapter` и параметр `chapters` из `fastGrammar`; в `workshopRow.ts:126` — `fastGrammar(row.places)`. Расширить `Violation.rule`. Добавить `HELD` и `held`.

- [ ] **Step 4: Тест ряда** — в `grammar.test.ts` тест `holds on the row as it is built` заменить на `expect(fastGrammar(CAMPAIGN).filter(held)).toEqual([])` и добавить рядом `it('prints what it does not hold yet as warnings: rules 4, 8, 9', () => expect([...HELD]).toEqual([1, 2, 3, 5, 7]))`.

- [ ] **Step 5: Проверить** — `npx vitest run src/levels/grammar.test.ts && npm run typecheck`: PASS (на нынешнем ряду правило 4 красно у глав с `faces` — это не держится тестом).

- [ ] **Step 6: Коммит** — `Грамматика: правило 4 — грани цели по пути; HELD`.

### Task 3: Правило 7 — окно о доске; чтение «семи»

**Files:**
- Modify: `src/levels/grammar.ts` (`needsOf`, `taughtAndUsed`, новая `windowTeaches`, `fastGrammar`)
- Test: `src/levels/grammar.test.ts`

**Interfaces:**
- Produces: `export const HINT_TECHNIQUE: Readonly<Record<HintKey, Technique>> = { roadHintChain: 'link', roadHintWalk: 'walk', roadHintPush: 'push', roadHintClimb: 'lift', hintSeven: 'seven', hintLinkMove: 'link' }`; `needsOf` добавляет `'seven'`, когда `startsUnder(spec, way) && turnsOf(spec, way) >= 1` (`import { startsUnder, turnsOf } from './measures'`, `way = (spec.solution ?? []).map(moveOf)`).

- [ ] **Step 1: Тесты:**

```ts
it('reads the seven off a way that starts on a die with a working face under and turns it up', () => {
  expect(needsOf(boardOf('act-k17')).has('seven')).toBe(true);   // акт I, открытие семи: тройка снизу у старта
  expect(needsOf(boardOf('R08')).has('seven')).toBe(false);
});
it('asks of a place with a window that its board teaches the move of the window and needs it: rule 7', () => {
  const row = rowOf([['R11', { teaches: undefined, help: { hint: 'roadHintWalk' } }], ['R08', { help: { hint: 'roadHintChain' }, teaches: 'walk' }]]);
  expect(fastGrammar(row).filter((one) => one.rule === 7).map((one) => one.text)).toEqual([
    'место 1 (R11): окно roadHintWalk, а доска учит ничему',
    'место 2 (R08): окно roadHintChain, а доска учит walk',
    'место 2 (R08): окно roadHintChain, а путь доски не требует walk',
  ]);
  const right = rowOf([['R11', { help: { hint: 'roadHintWalk' } }]]);   // teaches: walk из ряда
  expect(fastGrammar(right).filter((one) => one.rule === 7)).toEqual([]);
});
it('does not hold a board that teaches the seven to rule 1 — the seven is needed everywhere unsaid', () => {
  const row = rowOf([['R03', { teaches: 'seven', role: 'meet' }], 'R04', 'R05', 'R07']);
  expect(fastGrammar(row).filter((one) => one.rule === 1 && one.text.includes('seven'))).toEqual([]);
});
```
Если `act-k17` на полке не читается как `seven` (проверить `node scripts/level.mjs check file=act-k17`: у старта тройка снизу), взять любую доску полки, у которой `check` печатает `under` и `turns ≥ 1`, и назвать её в тесте.

- [ ] **Step 2: Запустить** — FAIL.

- [ ] **Step 3: Реализовать:** в `needsOf` — чтение `seven`; `windowTeaches(row)` — для места с `help.hint`: `want = HINT_TECHNIQUE[hint]`; `stop.teaches !== want` → текст «окно X, а доска учит Y» (`Y` = `stop.teaches ?? 'ничему'`); `!needsOf(stop.spec).has(stop.teaches ?? want)` → «окно X, а путь доски не требует Z» (Z = `stop.teaches ?? want`); в `taughtAndUsed` пропускать `stop.teaches === 'seven'` в части «двумя из трёх» (часть «учит сразу после» остаётся). `fastGrammar` включает `windowTeaches`.

- [ ] **Step 4: Проверить** — `npx vitest run src/levels/grammar.test.ts`: PASS; на ряду правило 7 может быть красно у `C1-05` (окно семи, `teaches` нет) — это чинит задача 7, до неё тест `filter(held)` упадёт: временно оставить красным и сказать об этом в коммите, либо (лучше) выполнить задачу 7, шаг 3 (снять окно с `C1-05`) здесь же и пересобрать ряд `node scripts/row.mjs`.

- [ ] **Step 5: Коммит** — `Грамматика: правило 7 — окно о доске; семь читается по under и turns`.

### Task 4: Правило 8 — эмоция и кривая после пика

**Files:**
- Modify: `src/levels/grammar.ts` (`emotionRhythm`, `SlowFacts.casual`, `slowGrammar`)
- Modify: `src/levels/table.ts:132-141` (`slowFactsOf` считает `casual`)
- Test: `src/levels/grammar.test.ts`

**Interfaces:**
- Produces: `SlowFacts.casual: number` (доля обычного бота из `runs`, как `planner`); `emotionRhythm(row)` в `fastGrammar`; медленная часть правила 8 в `slowGrammar`.

- [ ] **Step 1: Тесты:**

```ts
it('names a place with no emotion, three alike in a row, and a board after a peak that is not lighter: rule 8', () => {
  const row = rowOf([['R03', { emotion: 'gift' }], ['R04', { emotion: 'gift' }], ['B01_s290', { emotion: 'gift' }], ['R05', { emotion: undefined, role: 'peak' }], ['R07', { emotion: 'insight', teaches: undefined }]]);
  expect(fastGrammar(row).filter((one) => one.rule === 8).map((one) => one.text)).toEqual([
    'места 1–3 — три доски с эмоцией gift подряд',
    'место 4 (R05) без эмоции',
    'место 5 (R07) после пика на месте 4: 4 ходов, а пик — 3; после пика легче хотя бы на ход',
  ]);
});
it('asks the casual persona to do as well after a peak as on it: rule 8', () => {
  const row = rowOf([['R05', { role: 'peak', emotion: 'insight' }], ['R03', { emotion: 'gift' }]]);
  const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: stop.spec.id === 'R03' ? 0.5 : 0.9 });
  expect(slowGrammar(row, facts).filter((one) => one.rule === 8).map((one) => one.text)).toEqual(['место 2 (R03) после пика на месте 1: обычный 50%, а на пике — 90%']);
});
```
Во всех прочих `rowOf(...)` тестах `casual` в фактах не нужен: сделать поле `casual?: number` необязательным и пропускать проверку, где его нет.

- [ ] **Step 2: Запустить** — FAIL.

- [ ] **Step 3: Реализовать** `emotionRhythm`: место без `emotion` — нарушение; три подряд одной — текст как в тесте (считать от начала серии, как `oneThought` считает архетипы); после `role === 'peak'` следующая доска: `next.par > peak.par - 1` — нарушение. В `slowGrammar`: после пика `casual` следующей ниже `casual` пика (без допуска) — нарушение. В `table.ts` `slowFactsOf` считает `casual` тем же циклом, что `planner` (`personaPlay(spec, 'casual', run)`).

- [ ] **Step 4: Проверить** — `npx vitest run src/levels && npm run typecheck`: PASS.

- [ ] **Step 5: Коммит** — `Грамматика: правило 8 — эмоция места и кривая после пика`.

### Task 5: Правило 9 — пол до толчка; предупреждения под таблицей и в мастерской

**Files:**
- Modify: `src/levels/grammar.ts` (`floorBeforePush`, `noPushBeforeLesson` → правило 9)
- Modify: `src/levels/table.ts:145` (`grammarText` помечает незадержанные)
- Modify: `src/lab/workshopRow.ts:127` (строки с пометкой)
- Test: `src/levels/grammar.test.ts`, `src/levels/table.test.ts`

- [ ] **Step 1: Тесты:** в двух тестах «no push before its lesson» ожидать `rule === 9` вместо `1` (тексты те же). Новый:

```ts
it('asks the floor to be shut before the meeting of the push, and open from it on: rule 9', () => {
  const row = rowOf([['R01', { spec: { ...boardOf('R01'), floor: undefined } }], ['R13', { role: 'meet', teaches: 'push', spec: { ...boardOf('R13'), floor: false } }]]);
  expect(fastGrammar(row).filter((one) => one.rule === 9).map((one) => one.text)).toEqual([
    'место 1 (R01): пол открыт, а толкать ещё не учили',
    'место 2 (R13): пол закрыт, а здесь учат толчок',
  ]);
});
```
В `table.test.ts`: `grammarText([{ rule: 4, at: 2, text: 'x' }, { rule: 1, at: 1, text: 'y' }])` даёт `'grammar:\n  1  y\n  4  x (предупреждение)'`; пустой список — `'grammar: clean'` как было.

- [ ] **Step 2: Запустить** — FAIL.

- [ ] **Step 3: Реализовать:** `floorBeforePush(row)` — до первого `teaches: 'push'` каждое место с `spec.floor !== false` — нарушение; с него и дальше `spec.floor === false` — нарушение; `noPushBeforeLesson` и его медленная часть (`pushSaves`) пишут `rule: 9`. `grammarText` дописывает ` (предупреждение)` строке с `!held(one)`. В мастерской строка — `правило ${rule}: ${text}` плюс ` (предупреждение)` там же.

- [ ] **Step 4: Проверить** — `npx vitest run src/levels && npm run typecheck`: PASS.

- [ ] **Step 5: Коммит** — `Грамматика: правило 9 — пол до толчка; предупреждения под таблицей`.

### Task 6: Доски: `side-up-1`, `three-under-1`, `R01` без фиксированной кости, `R02` на полку

**Files:**
- Create: `boards/side-up-1.txt`, `boards/three-under-1.txt`
- Modify: `boards/R01.txt` (кость `21+` → `21`), `boards/R02.txt` (голова: `status: RC`, `note`)

- [ ] **Step 1: `side-up-1`** — файл (голова: `id: side-up-1`, `status: D`, `origin: третья редакция, слой 1`, `note: бок, который видишь, станет верхом: вбок, потом вперёд`, `faces: 3`, `floor: shut`):

```
 .   .   .   .
 .  31  31   .
 .   .  14*  .
 .   .   .   .
```
Тройка у `14` на южном боку (западная кость: при 1 сверху и 4 на севере юг — 3). Запустить `node scripts/level.mjs check file=side-up-1`: ожидать `par 2`, путь `2,2,E 2,3,N`. Если решатель находит иное (шаг на пару и перекат её кости, две двойки на боках), сдвинуть старт на `(3,3)` или повернуть кости пары (`north` у `31`), добиваясь `par 2` этим путём; записать `par`, `exact: yes`, `way` в файл (кнопка «записать путь» в мастерской или руками).

- [ ] **Step 2: `three-under-1`** — файл (`faces: 3`, `floor: shut`, `note: три видимые грани — все шесть: тройка снизу, два переката прямо`):

```
 .   .   .   .
 .  31   .   .
 .  31   .   .
 .   .  42*  .
```
Старт `42` (сверху 4, снизу 3) в клетке (3,2); два переката на север ставят тройку в (1,2) рядом с парой (1,1)–(2,1). `check`: ожидать `par 2`, путь `3,2,N 2,2,N`, и в партитуре `under`; `turns 1`. Иначе — сдвинуть пару или старт по той же мысли. Записать путь в файл.

- [ ] **Step 3: `R01`** — в сетке `21+` → `21`; `node scripts/level.mjs check file=R01`: ожидать `par 4`, путь прежний (`2,5,N 2,4,N 2,3,N 2,2,N`). Если короче — вернуть `+`, записать в «Что вышло иначе» (раздел 12 спеки).

- [ ] **Step 4: `R02`** — `status: RC`, `note: 2026-10-17: заменена side-up-1 (третья редакция, место 2); лесенка и пол остались здесь`.

- [ ] **Step 5: Проверить** — `node scripts/level.mjs regress`: код 0 (две новые доски с записанным путём, `R01` тот же); `npx vitest run src/levels/boardFile.test.ts`: PASS.

- [ ] **Step 6: Коммит** — `Доски слоя «Кость»: side-up-1, three-under-1; R01 без фиксированной`.

### Task 7: Ряд после шага 1

**Files:**
- Modify: `boards/row.json`, `boards/side-up-1.txt`, `boards/three-under-1.txt` (статус `R`)
- Generate: `src/levels/row.gen.ts` (`node scripts/row.mjs`)

- [ ] **Step 1: `row.json`** — у глав `road`, `order`, `floor` снять ключ `faces` (все грани работают; `floor: "open"` остаётся как есть). Глава `prologue` — места в этом порядке, с `emotion`:

| № | board | role | teaches | archetype | emotion | event | help |
|---|---|---|---|---|---|---|---|
| 1 | R01 | meet | — | roll | gift | — | как сейчас |
| 2 | side-up-1 | learn | — | side up | gift | — | `{ "plaques": "all", "wait": "lesson", "camera": "hold" }` (как было у `R02`) |
| 3 | R03 | apply | — | first free board | insight | — | как сейчас |
| 4 | B01_s290 | apply | — | the way round keeps the face | surprise | first mistake possible | как сейчас |
| 5 | H06 | apply | — | как сейчас | flow | — | как сейчас |
| 6 | R04 | event | — | free to fail | trick | first dead end | как сейчас |
| 7 | three-under-1 | meet | seven | the face under | insight | the rule of seven | `{ "hint": "hintSeven", "plaques": "near", "wait": "free", "camera": "hold" }` |
| 8 | R05 | apply | — | choose the first die | insight | choice of the first die | как сейчас |
| 9 | H07 | apply | — | как сейчас | recognition | — | как сейчас |
| 10 | H08 | apply | — | как сейчас | mastery | — | как сейчас |
| 11 | R07 | meet | link | chain | insight | — | как сейчас |
| 12 | R08 | rest | — | domino | flow | domino | как сейчас |

Места 13–29 — нынешние `R11`…`P12` в том же порядке и главах, с `emotion`: `R11` recognition, `P02` recognition, `C1-05` insight (и **без** `help.hint`), `C1-06` tension, `C1-07` payoff, `R09` surprise, `P07` fiero, `P08` recognition, `C2-05` trick, `P24` flow, `R13` relief, `R10` surprise, `R14` recognition, `P06` fiero, `P09` recognition, `R16` insight, `P12` fiero.

- [ ] **Step 2: Статусы** — `side-up-1`, `three-under-1`: `status: R`. `node scripts/row.mjs` — собирает без отказа; `node scripts/row.mjs check`: код 0.

- [ ] **Step 3: Тесты ряда** — `npx vitest run src/levels`: PASS, в том числе `grammar.test.ts` «holds on the row as it is built» по `held` (правила 1, 2, 3, 5, 7) и `row.test.ts` «clears every place by the way its file keeps». Правило 5 держит `R05` (пар 3) после встречи семи (пар 2) — поэтому семь стоит седьмым, не девятым (спека, 5.1, поправка 17 октября). Если `three-under-1` выйдет с паром 3, `R05` всё равно проходит (3 ≤ 4); если правило 1 или 5 красно где-то ещё на местах 1–12 — записать в «Что вышло иначе» и не публиковать, пока не зелено.

- [ ] **Step 4: Таблица** — `node scripts/ladder.mjs campaign > ladder-step1.txt` в фоне (10 минут): под таблицей только предупреждения правил 4, 8, 9 и ничего из 1, 2, 3, 5, 7; сохранить таблицу в раздел «Что вышло иначе» плана строкой на место для 1–12 (пар, обычный бот).

- [ ] **Step 5: Коммит** — `Ряд: слой «Кость» на местах 1–10, окно семи на 9-м, эмоции у мест`.

### Task 8: Документы, версия, просмотр

**Files:**
- Modify: `docs/VI_Levels_Lab.md` (раздел 16: ключ `emotion`, слова `EMOTIONS`, пометка «предупреждение»), `docs/ROADMAP.md` (раздел «Кампания»: строка о третьей редакции и шаге 1), `docs/art/VI_Interface_Layer.md` (строка списка уровней: двадцать девять, окно семи на `three-under-1`), `docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md` (раздел 12 «Что вышло иначе», шапка — «шаг 1 построен, vX»), `docs/README.md` (строка спеки и строка этого плана: «выполнен»), `package.json` (версия `0.2.68` или следующая за `origin/main`)
- Этот план: раздел «Что вышло иначе» в конце.

- [ ] **Step 1: Документы** по списку; в `VI_Levels_Lab.md`, раздел 16, таблица ключей места: строка `emotion` — «эмоция места, одно из `EMOTIONS` (`src/levels/row.ts`); правило 8 грамматики»; абзац о грамматике мастерской — «правила 4, 8, 9 печатаются с пометкой „предупреждение“ до шага 3 третьей редакции».

- [ ] **Step 2: Просмотр** — preview `vi-dev`, окно 360×640: сыграть места 1–12 подряд; на 9-м перед доской окно семи, на `C1-05` окна нет; грани цели в углу у `side-up-1` и `three-under-1` — одна тройка. Снимок места 2 и 9 — в «Что вышло иначе».

- [ ] **Step 3: Проверки** — `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`: чисты.

- [ ] **Step 4: Коммит** — `Документы: третья редакция, шаг 1; версия 0.2.68`; `git fetch && git rebase origin/main`; сказать владельцу и ждать «ок» на `git push origin HEAD:main`.

## Что вышло иначе

Выполнено 17 октября 2026 (Opus, worktree), версия 0.2.70. По строке на отступление, с причиной.

- **Версия 0.2.70**, не 0.2.68: пока шла работа, `main` ушёл на 0.2.69 (грани цели съезжают).
- **Задача 1.** Тест `buildRow` об эмоции взял доску `A`, не `F1`: в `row.test.ts` карта досок — `A` и `B`.
- **Задача 3.** `R08` по определению спеки читается как семь (старт `51`, грани 2: двойка снизу, путь её поднимает), поэтому в тесте «не семь» стоит `R07` (старт `45`, снизу тройка — не рабочая грань). На ряду до шага семь читали `R08`, `R11`, `C1-07`, `P07`, `C2-05`, `P06`, `P12`, а `C1-05` — нет: окно семи там было не о доске. Окно с `C1-05` снято в задаче 3, как план разрешал, иначе тест ряда краснел.
- **Задача 5.** Проверка «толчок до урока» на всём ряду сужена до текста « толкает, »: правило 9 о поле тоже говорит «толкать ещё не учили». Правило 9 считает урок толчка по `teaches: push`, как прежняя часть правила 1; спека говорит «до первой доски с `roadHintPush`» — на ряду это одно место (`R13`).
- **Задача 6.** Путь `side-up-1` — `2,2,E 3,2,N` (в плане `2,3,N`: после переката на восток кость стоит в `3,2`); ни один первый ход не тупик, неверный перекат удлиняет путь на 1–2 хода. `three-under-1`: старт в клетке `x=2, z=3` (в плане «(3,2)» — строка и столбец), путь `2,3,N 2,2,N`, первые ходы без тупиков. Решатель печатает вид пути `(top)`, слова «under» в партитуре нет: семь читается мерилом `startsUnder` и `turns ≥ 1` (`needsOf`), и у `three-under-1` читается — правило 7 на ряду зелёное. `R01` без фиксированной: пар 4, путь прежний. Тест картинки доски брал рамку фиксированной кости у `R01` — перенесён на `R13`. `R02` ушёл на полку в задаче 7, не 6: доска ряда обязана быть `R`, и ряд до снятия места не собирался.
- **Задача 7.** У `side-up-1` и `three-under-1` в `help` нет `plaques`: план брал их «как было у `R02`», но плашки скрыты на всех местах с 0.2.64 и у `R02` их не было. У `C1-05` снято и событие «the rule of seven» — оно переехало на 7-е. Два теста поправлены под шаг: `R11` играет на гранях своего файла (3 2), раз у глав нет `faces`; в тесте правила 2 `R02` получил прежние слова пролога, раз его нет в ряду. Текст коммита задачи 7 и шаг 2 задачи 8 в плане говорят «окно семи на 9-м» — по таблице и спеке это 7-е, так и сделано.
- **Пол на слое 1.** У `H06`, `H07`, `H08` (места 5, 9, 10) пол в файлах открыт, а спека (раздел 2, решение 4) хочет закрытым на 1–20. Правило 9 на шаге 1 — предупреждение, план их не трогает, доски — владельца; закрыть пол — его слово или шаг 2. Места 13–22 открыты главой (`floor: "open"`) — их закрывает шаг 2 по спеке.
- **Правило 4** предупреждает только на `C1-05`, `C1-06`, `C1-07` (файлы называют 2 3, на пути одна грань) — их `faces` правит шаг 2 по спеке.

**Таблица `ladder campaign` после шага** (под таблицей — только предупреждения правил 4 и 9; правило 8 на ряду без пика посередине молчит; правил 1, 2, 3, 5, 7 нет):

| № | доска | пар | торопливый | обычный |
|---|---|---|---|---|
| 1 | `R01` | 4 | 100% | 100% |
| 2 | `side-up-1` | 2 | 27% | 93% |
| 3 | `R03` | 2 | 80% | 97% |
| 4 | `B01_s290` | 3 | 67% | 77% |
| 5 | `H06` | 2 | 40% | 97% |
| 6 | `R04` | 2 | 97% | 100% |
| 7 | `three-under-1` | 2 | 63% | 100% |
| 8 | `R05` | 3 | 50% | 93% |
| 9 | `H07` | 4 | 23% | 43% |
| 10 | `H08` | 5 | 27% | 57% |
| 11 | `R07` | 4 | 73% | 87% |
| 12 | `R08` | 5 | 50% | 77% |

**Просмотр.** Preview `vi-dev` из worktree, окно 360×640, панель скрыта — кадры двигались руками (`vi.frame`), ходы — клавишами по записанному пути доски. Места 1–12 пройдены подряд (1–2 и 3–12 двумя заходами) каждое за свой пар; перед 7-м — окно семи («Сумма точек на противоположных гранях всегда равна 7.»), перед 11-м — окно цепочки, перед `C1-05` (теперь 15-е) окна нет. Снимки: место 2 — `LV 02`, в углу одна тройка, у своей кости тройка на переднем боку; место 7 — `LV 07`, в углу одна тройка, у своей кости сверху четвёрка, тройки не видно. Снимки в дерево не легли (отданы владельцу в чате).
