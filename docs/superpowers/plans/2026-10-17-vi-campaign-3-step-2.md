# Кампания, третья редакция, шаг 2: приёмы слоя «Кость», правило 10, слой 1 заново и слой «Уходящая кость» — план

> Вид: план. Статус: не выполнен. Дата: 2026-10-17.
> Что заменило: —. Что живёт в коде: src/levels/measures.ts, src/levels/grammar.ts, src/levels/table.ts, src/levels/row.ts, boards/row.json, boards/*.txt.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Уроки слоя «Кость» (обход, семь, очерёдность) становятся приёмами, которые грамматика требует после урока; пик и поворот соединяют два приёма (правило 10); слой 1 пересобирается на 12 мест по разделу 13 спеки, слой «Уходящая кость» встаёт на места 13–22 с двумя новыми досками.

**Architecture:** Два новых приёма в `TECHNIQUES`: `loop` читается с пути (`loopOf` в `measures.ts`, быстрая часть `needsOf`), `order` — поиском ловушки порядка (`trapOf`) в медленной части (`SlowFacts.order`); правило 10 — быстрая часть по `needsOf` и медленная по `order`. Три новые доски и одна с полки; ряд правится в `boards/row.json` и собирается `node scripts/row.mjs`. Правило 10 на этом шаге — предупреждение (не в `HELD`).

**Tech Stack:** TypeScript, vitest, `scripts/*.mjs` (Node 24), дев-сервер Vite (preview `vi-dev`).

**Spec:** [docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md](../specs/2026-10-16-vi-campaign-3-design.md) — раздел 13 (приёмы, правило 10, слой 1 заново, слой 2 по местам, бриф `which-first`), раздел 6 (брифы `bridge-first`, `roll-in`), раздел 7 (правила), раздел 12 (слова владельца 17 октября: пол не закрывается, правила 9 нет). Рядом: [VI_Levels_Rules.md](../../VI_Levels_Rules.md), [VI_Levels_Lab.md](../../VI_Levels_Lab.md) разделы 1 и 16, код `src/levels/grammar.ts` и `src/levels/measures.ts` как они есть после шага 1 (0.2.71).

## Global Constraints

- Worktree, исполнитель Opus, субагенты с явной моделью; в основную папку `GAMES\VI` не писать. Перед каждым коммитом `git fetch && git rebase origin/main` (чат уровней правит доски в `main`); конфликт в `row.json` или файле доски — взять `origin/main` и наложить свою правку заново.
- Коммит после каждой задачи: заголовок до 70 знаков, тело до пяти строк, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Пуш в `main` — после «ок» владельца.
- `src/rules` не трогается. Все грани работают; `faces` доски равны граням цели по пути (правило 4, предупреждение). Пол у досок — как в их файлах: закрывать не надо, правила 9 нет.
- Имена новых досок — по замыслу по-английски с номером: `which-first-1`, `bridge-first-1`, `roll-in-1`; в ряду имя — код навсегда.
- `HELD` остаётся `[1, 2, 3, 5, 7]`: правила 4, 8, 10 — предупреждения.
- Проверки перед каждым коммитом: `npx vitest run src/levels`, `npm run typecheck`; перед последним — `npm test`, `npm run build`, `node scripts/docs-check.mjs`, `node scripts/level.mjs regress`, `node scripts/ladder.mjs campaign` (в фоне, долго: с шага 1 там и обычный бот).

## Review Focus

1. Путь, где одна и та же кость делает «вбок, поперёк, назад» не подряд (между ними ход другой кости): `loop` не читается — задача 1, тест на `R05` (N, W, W — не петля) и на путь из двух костей.
2. Доска с `teaches: order`, у которой `trapOf` не находит ловушку (поиск исчерпан или ловушки нет): правило 1 для `order` называет место словами, а не молчит — задача 2, тест с фактами `order: false`.
3. Пик, которому нужен приём, введённый позже по ряду или не введённый вовсе (`twoFaces` до `R09`): правило 10 называет приём и место — задача 2, тест.
4. `two-pairs-2` с полки может не быть ловушкой порядка: тогда она не отвечает правилу 1 для `order` — задача 3, шаг с `check`, запасной вариант `which-first-2`.
5. Переименование глав ряда (`prologue` → `die`): `campaignFocus` смотрит на индекс главы 0, не на название — задача 4, тест `campaign.test.ts` остаётся зелёным; `library.ts` печатает название как есть.

---

### Task 1: Приёмы `loop` и `order`

**Files:**
- Modify: `src/levels/measures.ts` (новая `loopOf`)
- Modify: `src/levels/row.ts:16` (`TECHNIQUES`)
- Modify: `src/levels/grammar.ts` (`needsOf`, `SlowFacts.order`, правило 1 для `order` в `slowGrammar`)
- Modify: `src/levels/table.ts:132-141` (`slowFactsOf` считает `order`)
- Test: `src/levels/measures.test.ts`, `src/levels/grammar.test.ts`

**Interfaces:**
- Produces: `export function loopOf(spec: LevelSpec, way: readonly SolverMove[]): boolean` в `measures.ts` — true, когда одна кость делает три переката подряд (три соседних хода пути, каждый начинается там, где кончился прошлый, и все три — перекаты, не толчки) с направлениями `d1`, `d2`, `d3`, где `d2` поперёк `d1` (`across`) и `d3` противоположно `d1` (`OPPOSITE`); `TECHNIQUES = ['link', 'walk', 'glass', 'lift', 'push', 'ones', 'twoFaces', 'seven', 'time', 'loop', 'order']`; `needsOf` добавляет `'loop'` по `loopOf`; `SlowFacts.order: boolean` — `trapOf(spec) !== null` и на пути не меньше двух событий `combo` (`scoreOf(...).beats`); в `slowGrammar` правило 1 для места с `teaches: 'order'`: из трёх следующих не меньше двух с `facts.order`, текст как у быстрого правила 1 (`… учит order, а из мест N–M его требует K досок`).

- [ ] **Step 1: Тесты `loopOf`** (`measures.test.ts`):

```ts
it('reads a loop off a way: aside, across and back by one die', () => {
  expect(loopOf(boardOf('B01_s290'), wayOf('B01_s290'))).toBe(true);   // N E S
  expect(loopOf(boardOf('H07'), wayOf('H07'))).toBe(true);             // N W S …
  expect(loopOf(boardOf('R05'), wayOf('R05'))).toBe(false);            // N W W
  expect(loopOf(boardOf('R04'), wayOf('R04'))).toBe(false);            // N W
});
```
`boardOf` — из `boardSets`, `wayOf(id) = (boardOf(id).solution ?? []).map(moveOf)`.

- [ ] **Step 2: Запустить** — `npx vitest run src/levels/measures.test.ts -t loop`: FAIL.

- [ ] **Step 3: Реализовать `loopOf`** рядом с `turnsOf`: идти по пути через `tellMove`, запоминая для каждого хода кость, которой ходили (`cubeAt(state, move.x, move.z)` до хода) и была ли это перекат (кость стоит под игроком, `player.level === 'top'`); три соседних хода одной кости с нужными направлениями — true.

- [ ] **Step 4: Тесты грамматики** (`grammar.test.ts`):

```ts
it('reads the loop into what a board asks for', () => {
  expect(needsOf(boardOf('B01_s290')).has('loop')).toBe(true);
  expect(needsOf(boardOf('R05')).has('loop')).toBe(false);
});
it('asks of a board that teaches the order that two of the next three are traps of order, by what the search found: rule 1', () => {
  const row = rowOf([['R05', { role: 'meet', teaches: 'order' }], 'two-pairs-2', 'R03', 'R04']);
  const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: 1, order: stop.spec.id === 'two-pairs-2' });
  expect(slowGrammar(row, facts).filter((one) => one.rule === 1).map((one) => one.text)).toEqual(['место 1 (R05) учит order, а из мест 2–4 его требует 1 досок']);
  expect(slowGrammar(row, (stop) => ({ ...facts(stop), order: stop.spec.id !== 'R04' })).filter((one) => one.rule === 1)).toEqual([]);
});
```
Во всех прочих тестах `slowGrammar` поле `order` в фактах необязательное (`order?: boolean`, нет — false).

- [ ] **Step 5: Реализовать** `TECHNIQUES`, `needsOf`, `SlowFacts.order`, правило 1 для `order` в `slowGrammar` (быстрое правило 1 пропускает `teaches === 'order'` в части «двумя из трёх», как `seven`; часть «учит сразу после» остаётся), `slowFactsOf` в `table.ts` считает `order` (`trapOf` из `measures.ts`, `beats` из `scoreOf`). `SAVES` не трогать: к `loop` и `order` правило 2 не применяется.

- [ ] **Step 6: Проверить** — `npx vitest run src/levels && npm run typecheck`: PASS.

- [ ] **Step 7: Коммит** — `Приёмы loop и order: петля с пути, ловушка порядка из фактов`.

### Task 2: Правило 10 — пик и поворот соединяют

**Files:**
- Modify: `src/levels/grammar.ts` (`Violation.rule` += 10, `joinsTwo`, `fastGrammar`, `slowGrammar`)
- Test: `src/levels/grammar.test.ts`

**Interfaces:**
- Produces: `Violation.rule: 1 | 2 | 3 | 4 | 5 | 7 | 8 | 10`; быстрая часть `joinsTwo(row)`: у места с `role` `peak` или `twist` множество `needsOf(spec)` (без `seven`: его требуют везде молча) не меньше двух, и каждый приём в нём введён `teaches` на месте с меньшим номером; медленная часть в `slowGrammar`: `order` из фактов добавляется к множеству перед теми же проверками, а нарушение «меньше двух» быстрой части снимается, если с `order` их два (быстрая часть печатает его только когда без `order` приёмов меньше двух и место не ловушка по фактам — проще: быстрая часть проверяет только «каждый приём введён раньше», счёт «не меньше двух» — медленная часть с `order`).

- [ ] **Step 1: Тесты:**

```ts
it('asks of a peak and a twist that their way joins two moves taught before: rule 10', () => {
  const row = rowOf([['R07', { role: 'meet', teaches: 'link' }], ['R11', { role: 'meet', teaches: 'walk' }], ['P12', { role: 'peak' }], ['R09', { role: 'twist', teaches: undefined }]]);
  const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: 1, order: false });
  expect(fastGrammar(row).filter((one) => one.rule === 10).map((one) => one.text)).toEqual([
    'место 3 (P12): пик требует lift, а его не вводили раньше',
    'место 3 (P12): пик требует push, а его не вводили раньше',
    'место 3 (P12): пик требует twoFaces, а его не вводили раньше',
    'место 4 (R09): поворот требует twoFaces, а его не вводили раньше',
  ]);
  expect(slowGrammar(row, facts).filter((one) => one.rule === 10).map((one) => one.text)).toEqual(['место 4 (R09): поворот требует один приём (twoFaces), а соединяет не меньше двух']);
});
```
(`P12` требует `lift`, `push`, `twoFaces` — по партитуре `K v P ^ L` с двумя гранями; `R09` — только `twoFaces`. Если `needsOf` на этих досках даёт иной набор, подставить в тест то, что печатает `node scripts/level.mjs check`.)

- [ ] **Step 2: Запустить** — FAIL.

- [ ] **Step 3: Реализовать** по Interfaces; тексты как в тесте (`пик`/`поворот` по роли, приёмы по алфавиту).

- [ ] **Step 4: Проверить** — `npx vitest run src/levels/grammar.test.ts && npm run typecheck`: PASS; `fastGrammar(CAMPAIGN).filter(held)` по-прежнему пуст (10 не в `HELD`).

- [ ] **Step 5: Коммит** — `Грамматика: правило 10 — пик и поворот соединяют два приёма`.

### Task 3: Доски: `which-first-1`, `two-pairs-2` с полки, `bridge-first-1`, `roll-in-1`

**Files:**
- Create: `boards/which-first-1.txt`, `boards/bridge-first-1.txt`, `boards/roll-in-1.txt`
- Modify: `boards/two-pairs-2.txt` (статус `R` в задаче 4)

- [ ] **Step 1: `two-pairs-2`** — `node scripts/level.mjs check file=two-pairs-2`; отдельно убедиться, что `trapOf` не null: временно напечатать его из скрипта (`node -e` через `load`, как делает `ladder.mjs`) или добавить строку `trap` в вывод `check`, если её там нет (тогда оставить её: она полезна). Ловушки нет — доска остаётся на полке, а на её место в ряду встаёт `which-first-2` (вторая кладка того же брифа, другая фигура).

- [ ] **Step 2: `which-first-1`** по брифу раздела 13 спеки. Отправная кладка (двойки и тройки, 4×4; ориентации подобрать по `check`):

```
 .   2   .   .
 .   .   .   3
 .   2x* .   3
 .   .   .   .
```
Своя кость — двойка со спрятанной гранью так, что один перекат к верхней двойке собирает пару сразу (напрашивается), но после ухода пары до троек не дойти; верный порядок — сначала к тройкам (две переката), пара двоек потом. `check`: пар 3, два комбо, ловушка первым ходом (`trapOf` не null), обычный бот ≥ 60%, торопливый ≤ 40% (`report` или `ladder place=`). Записать `par`, `exact: yes`, `way`; голова: `status: D`, `origin: третья редакция, слой 1`, `note: напрашивающаяся пара первой бросает вторую`, `faces` по граням пути.

- [ ] **Step 3: `bridge-first-1`** по брифу `bridge-first` (раздел 6). Отправная кладка (двойки, 4×4):

```
 2   .   R   .
 .   .   2   .
 P*  .   .   .
 .   .   .   .
```
`P` в (2,0): на север, потом на восток — встаёт двойкой рядом с (1,2), пара уходит; после первого переката `P` не должна показывать двойку рядом с (0,0) (иначе пара соберётся не та). `R` в (0,2) — двойка на восточном боку: с уходящей (1,2) шаг на неё, перекат на запад ставит двойку рядом с (0,0). `check`: пар 3, в партитуре `~`; без прохода решения нет (`node scripts/level.mjs check` с запретом, как считает `slowFactsOf`, или `ladder`), первый ход один. Голова: `note: мост: по уходящей паре к кости, до которой иначе не дойти`.

- [ ] **Step 4: `roll-in-1`** по брифу `roll-in` (раздел 6). Отправная кладка (двойки, вырезы):

```
 -   -   -   -
 2*  .   2   -
 -   -   T   .
 -   -   .   .
```
`T` — двойка с двойкой на южном боку: единственная клетка рядом с уходящей парой, куда ей можно встать, — клетка самой уходящей кости (1,2): накат на север, грань совпала — звено. `check`: пар 2 или 3, в партитуре `glass` и `L`; без наката решения нет; проиграть можно (увести `T` на восток или юг). Голова: `note: звену негде встать рядом — вкатиться в уходящую кость`.

- [ ] **Step 5: Проверить** — `node scripts/level.mjs regress`: код 0; у трёх новых файлов записаны `par`, `exact`, `way`.

- [ ] **Step 6: Коммит** — `Доски шага 2: which-first-1, bridge-first-1, roll-in-1`.

### Task 4: Ряд после шага 2

**Files:**
- Modify: `boards/row.json`; статусы `R` у четырёх досок задачи 3; `C1-05`, `C1-06`, `C1-07` — `faces` по `goalFaces`
- Generate: `src/levels/row.gen.ts`

- [ ] **Step 1: `row.json`** — главы `die` (0), `leaving` (1), `order` (2), `floor` (3); у глав ключей `faces` нет, `floor: "open"` где было. Места:

| № | board | role | teaches | archetype | emotion | event | help |
|---|---|---|---|---|---|---|---|
| 1 | R01 | meet | — | roll | gift | — | как сейчас |
| 2 | side-up-1 | learn | — | side up | gift | — | как сейчас |
| 3 | R03 | apply | — | first free board | insight | first free board | как сейчас |
| 4 | B01_s290 | meet | loop | the way round keeps the face | surprise | a straight roll turns the face away | как сейчас |
| 5 | H07 | apply | — | the way round keeps the face | recognition | — | как сейчас |
| 6 | H06 | apply | — | как сейчас | flow | — | как сейчас |
| 7 | H08 | apply | — | the way round keeps the face | mastery | — | как сейчас |
| 8 | three-under-1 | meet | seven | the face under | insight | the rule of seven | как сейчас (окно семи) |
| 9 | R04 | event | — | free to fail | trick | first dead end | как сейчас |
| 10 | R05 | meet | order | choose the first die | insight | choice of the first die | как сейчас |
| 11 | two-pairs-2 (или which-first-2) | apply | — | which first | recognition | — | `{ "camera": "hold" }` |
| 12 | which-first-1 | apply | — | which first | trick | — | `{ "camera": "hold" }` |
| 13 | bridge-first-1 | meet | walk | bridge | surprise | first walk over leaving dice | `{ "hint": "roadHintWalk" }` |
| 14 | P02 | apply | — | bridge | recognition | — | как сейчас |
| 15 | R07 | meet | link | chain | insight | first chain | `{ "hint": "roadHintChain", "camera": "cells" }` |
| 16 | R11 | apply | — | bridge | recognition | two faces on one board | без `hint` |
| 17 | R08 | rest | — | domino | flow | domino | как сейчас |
| 18 | roll-in-1 | twist | glass | roll into leaving | surprise | the leaving die is a cell | — |
| 19 | C1-05 | apply | — | roll onto leaving | insight | — | без `hint` |
| 20 | C1-06 | twist | — | bridge both ways | tension | the road goes both ways, briefly | — |
| 21 | C1-07 | rest | — | collapse | payoff | first big clearing | — |
| 22 | P07 | peak | — | two combos from one die | fiero | — | — |

Места 23–33 — главы `order` (`R09`, `P08`, `C2-05`, `P24`) и `floor` (`R13`, `R10`, `R14`, `P06`, `P09`, `R16`, `P12`) как в ряду 0.2.71, с их `emotion`, окнами и ролями. `R11` — архетип `bridge` на 16-м после `R07`: правило 3 держит «не больше двух подряд одного архетипа» (13–14 мост, 15 цепочка, 16 мост — чисто).

- [ ] **Step 2: Грани по пути** — у `C1-05`, `C1-06`, `C1-07` поставить `faces` равными `goalFaces` их пути (рецензент 16 октября: `C1-05` — 3, `C1-06` — 2, `C1-07` — 3); `check` каждой: пар и путь те же. Статусы `R` у `two-pairs-2`, `which-first-1`, `bridge-first-1`, `roll-in-1`.

- [ ] **Step 3: Собрать и проверить** — `node scripts/row.mjs`; `npx vitest run src/levels`: PASS по `held`; `node scripts/row.mjs check`: 0. Если правило 1 или 5 красно — переставлять только внутри слоя и записать в «Что вышло иначе» и в раздел 13 спеки.

- [ ] **Step 4: Таблица** — `node scripts/ladder.mjs campaign` в фоне; под таблицей — предупреждения 4, 8, 10 и ничего из `HELD`; правило 1 для `order` (медленное) на местах 11–12 чисто. Таблицу мест 1–22 (пар, обычный бот) — в «Что вышло иначе».

- [ ] **Step 5: Коммит** — `Ряд: слой «Кость» на 12 мест, слой «Уходящая кость» на 13–22`.

### Task 5: Документы, версия, просмотр

**Files:**
- Modify: `docs/VI_Levels_Lab.md` (раздел 16: приёмы `loop`, `order`, правило 10 как предупреждение; главы `die`, `leaving`), `docs/ROADMAP.md` («Кампания»: шаг 2), `docs/art/VI_Interface_Layer.md` (строка списка: тридцать три места, окна по местам), `docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md` (шапка — шаг 2 построен; раздел 12 — что вышло иначе; таблица 5.2 — ссылка на раздел 13), `docs/README.md` (строка спеки; строка этого плана — выполнен, в историю индекса, как у шага 1), `package.json` (версия следующая за `origin/main`)

- [ ] **Step 1: Документы** по списку; план после выполнения убирается из дерева в таблицу «В истории git» индекса с хэшем коммита, где он лежит последним, как сделано для шага 1.

- [ ] **Step 2: Просмотр** — preview `vi-dev`, 360×640: места 1–22 подряд; окна на 8, 13, 15; на 19 окна нет; в углу грани цели у `C1-05`, `C1-06`, `C1-07` — по одной.

- [ ] **Step 3: Проверки** — `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`: чисты.

- [ ] **Step 4: Коммит** — `Документы: третья редакция, шаг 2; версия 0.2.NN`; `git fetch && git rebase origin/main`; доложить владельцу и ждать «ок» на `git push origin HEAD:main`.

## Что вышло иначе

- Задача 3: `two-pairs-2` не ловушка порядка (`trapOf` — null: `K ~ K`, любое первое комбо прощается), остаётся на полке; на место 11 встала `which-first-2`. Обе доски `which-first` взяты из `node scripts/level.mjs order size=4 dice=5 faces=2,3 par=3 events=2 trap=any`, отправные кладки плана не пригодились: `which-first-1` — пар 3, `K K`, ловушка `floor`, торопливый 1/30, обычный 27/30; `which-first-2` — пар 3, `K K`, ловушка `floor`, торопливый 2/30, обычный 28/30. Обе требуют `twoFaces` (двойки и тройки), введённый только на 23-м месте: правило 10 к ним не применяется (не пик и не поворот).
- `check` печатает строку `trap` (`trapOf`), только в тексте: `checkOf` её не считает, чтобы не замедлять `regress` и мастерскую.
- `bridge-first-1` — по брифу (`bridge-first`, раздел 6), не по отправной кладке плана: в кладке плана третья кость вставала рядом с ещё уходящей парой, и выходило звено (`K ~ L`), а не второе комбо. Вышло: пар 3, `K ~ K`, первый ход один, без прохода решения нет в пар + 2, проиграть можно.
- `roll-in-1` — по кладке плана: пар 2, `K ~ L` с накатом (`glass`), без наката решения нет в пар + 2, проиграть можно; путь требует и `link`, и `walk`.
- Слово владельца 17 октября о месте 2 (пришло по ходу работы, дословно — в разделе 12 спеки и в файле доски): `side-up-1` переложена по старому замыслу `R02`: два переката вперёд, один вбок; пар 3.
