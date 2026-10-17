# Кампания, третья редакция, шаг 3: шаг семь, блок из семи, слой «Пол» и ряд первого часа — план

> Вид: план. Статус: не выполнен. Дата: 2026-10-17.
> Что заменило: —. Что живёт в коде: src/levels/grammar.ts, src/levels/table.ts, src/levels/row.ts, boards/row.json, boards/*.txt.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать ряд первого часа по таблице раздела 14 спеки (места 1–38, хвост 39–43): правки слоя «Кость» по фидбэку, два блока по семь в слое «Уходящая кость», блок пола с восемью новыми досками; правило 11 (шаг семь) в тест, правило 10 с ответами владельца, `order` со звеном.

**Architecture:** Грамматика — чистые функции в `src/levels/grammar.ts`; правило 11 — быстрая часть по `help.hint` мест; правило 10 — `teaches` места включительно; `SlowFacts.order` — комбо и звенья. Доски — файлы `boards/*.txt` (новые по брифам раздела 6 и 14 спеки, правки `C1-05` и `C1-06` на месте), ряд — `boards/row.json`, сборка `node scripts/row.mjs`. `HELD` = `[1, 2, 3, 5, 7, 11]`; правила 4, 8, 10 — предупреждения.

**Tech Stack:** TypeScript, vitest, `scripts/*.mjs` (Node 24), Vite.

**Spec:** [docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md](../specs/2026-10-16-vi-campaign-3-design.md) — раздел 14 (ряд, брифы `which-first-3` и пика моста, ответы), раздел 6 (брифы пола: `floor-first`, `carry`, `roll-or-push`, `lift-first`, `push-then-link`, `three-at-once`, `link-from-below`, `corridor-push`), раздел 7 (правила), раздел 12 (пол не закрывается). Рядом: `src/levels/grammar.ts`, `src/levels/table.ts`, `src/levels/measures.ts` как после шага 2 (0.2.72), [VI_Levels_Lab.md](../../VI_Levels_Lab.md) разделы 1 и 16.

## Global Constraints

- Worktree; в основную папку `GAMES\VI` не писать. Перед каждым коммитом `git fetch && git rebase origin/main`; конфликт в `row.json` или файле доски — взять `origin/main` и наложить правку заново.
- Коммит после каждой задачи: заголовок до 70 знаков, тело до пяти строк, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Пуш в `main` делает чат планирования после проверки ветки; исполнитель не пушит.
- `src/rules` не трогается. Все грани работают; пол у досок как в файлах, насильно не закрывается. `faces` доски равны граням цели по пути.
- Имена новых досок по замыслу с номером `-1`; в ряду имя — код навсегда. Коды `R04`, `which-first-1`, `R10`, `R13` остаются файлами со статусом `RC` и словами.
- Проверки перед каждым коммитом: `npx vitest run src/levels`, `npm run typecheck`; перед последним — `npm test`, `npm run build`, `node scripts/docs-check.mjs`, `node scripts/level.mjs regress`, `node scripts/ladder.mjs campaign` (в фоне).
- Дев-сервер для просмотра — `npx vite --port 5191` в worktree (preview `vi-dev` поднимает основную папку), остановить после.

## Review Focus

1. Доска с окном `roadHintClimb` раньше чем через одно место после `roadHintPush`, или два окна `roadHintWalk`/`roadHintChain`/`roadHintPush` ближе семи: правило 11 называет оба места — задача 1, тест.
2. Поворот с `teaches` (`roll-in-1`): правило 10 не требует, чтобы его приём вводили раньше — задача 1, тест.
3. Доска порядка, где второе событие — звено, а не комбо (`R05`): `SlowFacts.order` true — задача 1, тест на `R05`.
4. `C1-06` после вырезов: путь через пол (спуск и подъём на последнюю кость) исчезает, путь накатом остаётся той же длины — задача 2, `check` с запретом `floor` и обход `walk`.
5. `which-first-3`: ловушка `any`, не `floor`; после жадной пары игрок на костях — задача 2, строка `trap` в `check`.

---

### Task 1: Правила 10, 11 и `order` со звеном

**Files:**
- Modify: `src/levels/grammar.ts` (`Violation.rule` += 11, `joinsTwo`, новая `lessonsSevenApart`, `HELD`, `fastGrammar`)
- Modify: `src/levels/table.ts` (`slowFactsOf`: `order` считает комбо и звенья)
- Test: `src/levels/grammar.test.ts`

**Interfaces:**
- Produces: `HELD = new Set([1, 2, 3, 5, 7, 11])`; `lessonsSevenApart(row)`: места с `help.hint` из `{roadHintWalk, roadHintChain, roadHintPush}` в порядке ряда — расстояние между соседними не меньше семи (текст: «места 13 (bridge-first-1) и 18 (R07): уроки ближе семи мест»); место с `roadHintClimb` — не раньше чем через одно место после ближайшего предыдущего `roadHintPush` (текст: «место 29 (lift-first-1): подъём сразу после толчка на месте 28»); `hintSeven`, `hintLinkMove` вне правила. `joinsTwo`: приём считается введённым, если `teaches` стоит на месте с номером не больше номера проверяемого места (включительно). `SlowFacts.order` = `trapOf(spec) !== null` и число событий `combo` плюс `link` на пути (`scoreOf(...).beats`, поле `event`; имя события звена смотреть в `src/rules/levelScore.ts`) не меньше двух.

- [ ] **Step 1: Тесты** (`grammar.test.ts`):

```ts
it('asks the lessons with a window to stand seven places apart, and the climb one place after the push: rule 11', () => {
  const row = rowOf([['R11', { help: { hint: 'roadHintWalk' } }], 'R03', 'R04', ['R07', { help: { hint: 'roadHintChain' } }], ['R13', { help: { hint: 'roadHintPush' }, teaches: 'push' }], ['R10', { help: { hint: 'roadHintClimb' }, teaches: 'lift' }]]);
  expect(fastGrammar(row).filter((one) => one.rule === 11).map((one) => one.text)).toEqual([
    'места 1 (R11) и 4 (R07): уроки ближе семи мест',
    'места 4 (R07) и 5 (R13): уроки ближе семи мест',
    'место 6 (R10): подъём сразу после толчка на месте 5',
  ]);
});
it('lets a twist that teaches count its own move as brought in: rule 10', () => {
  const row = rowOf([['R07', { role: 'meet', teaches: 'link' }], ['roll-in-1', { role: 'twist', teaches: 'glass' }]]);
  expect(fastGrammar(row).filter((one) => one.rule === 10 && one.text.includes('glass'))).toEqual([]);
});
```
И в тесте `slowFactsOf`/`order` (где он есть после шага 2, иначе новый в `table.test.ts`): `slowFactsOf(boardOf('R05'), 'order').order` равно `true` (путь `R05` — комбо и звено, ловушка есть).

- [ ] **Step 2: Запустить** — FAIL.

- [ ] **Step 3: Реализовать** по Interfaces; `HELD` расширить; `fastGrammar` включает `lessonsSevenApart`.

- [ ] **Step 4: Проверить** — `npx vitest run src/levels && npm run typecheck`: PASS (на ряду 0.2.72 правило 11 красно между 13 и 15 — чинит задача 3; до неё тест «holds on the row» временно красный, выполнить задачи 2–3 до коммита или закоммитить с пометкой и починить в задаче 3).

- [ ] **Step 5: Коммит** — `Грамматика: правило 11 — уроки через семь мест; правило 10 и order уточнены`.

### Task 2: Доски

**Files:**
- Create: `boards/which-first-3.txt`, `boards/floor-first-1.txt`, `boards/carry-1.txt`, `boards/roll-or-push-1.txt`, `boards/lift-first-1.txt`, `boards/push-then-link-1.txt`, `boards/three-at-once-1.txt`, `boards/link-from-below-1.txt`, `boards/corridor-push-1.txt`
- Modify: `boards/C1-05.txt`, `boards/C1-06.txt` (на месте), статусы (задача 3)

- [ ] **Step 1: `which-first-3`** по брифу раздела 14: генератор `node scripts/level.mjs order size=4 dice=5 faces=2,3 par=3 events=2 trap=any out=boards/out/` и выбрать доску, у которой строка `trap` в `check` — `any`, не `floor`, обычный бот ≥ 60%, торопливый ≤ 40%; переименовать в `which-first-3`, голова: `origin: третья редакция, слой 1`, `note: напрашивающаяся пара первой бросает вторую; игрок остаётся на костях`.

- [ ] **Step 2: `C1-06`** — вырезать клетки пола, по которым игрок с уходящей группы спускается и поднимается на её последнюю кость (обход `walk`/`report` покажет путь `v … ^`); после правки `check`: пар 5, путь прежний (накат обратно), решения через `floor` нет (`solveLevel` с `ban: ['floor']` даёт тот же пар — как считает `slowFactsOf` для `lift`). Слово владельца — в `words`: «хорошо, но я решаю через запрыгивание на последнюю кость, а мы этому ещё не учили».

- [ ] **Step 3: `C1-05`** — поле чуть свободнее: открыть одну-две клетки (сейчас 4×4 без вырезов — тогда поле 4×5 или сдвиг костей от края), `check`: пар 3, путь той же мысли (накат к звену, тройка снизу). Слово владельца в `words`: «хорошо, но поле можно чуть свободнее».

- [ ] **Step 4: Восемь досок пола** по брифам раздела 6 спеки (`floor-first`, `carry`, `roll-or-push`, `lift-first`, `push-then-link`, `three-at-once`, `link-from-below`, `corridor-push`), имена с `-1`; у каждой `check` по проверке брифа (пар, партитура, «без приёма решения нет» — `solveLevel` с запретом, обычный бот), `origin: третья редакция, слой «Пол»`. Отправные кладки — брифы; где бриф даёт только мысль, класть генератором (`order`/`gen`) и править руками.

- [ ] **Step 5: Проверить** — `node scripts/level.mjs regress`: код 0.

- [ ] **Step 6: Коммит** — `Доски шага 3: which-first-3, восемь досок пола; C1-05 и C1-06 правлены`.

### Task 3: Ряд первого часа

**Files:**
- Modify: `boards/row.json`; статусы: `R` у `which-first-3`, `act-k17`, `two-pairs-2`, `two-pairs-1`, `domino-3`, `collapse-3`, восьми досок пола и пика моста; `RC` у `R04`, `which-first-1`, `R10`, `R13`
- Generate: `src/levels/row.gen.ts`

- [ ] **Step 1: `row.json`** — главы `die`, `leaving`, `floor`, `order`, `more`; места по таблице раздела 14 спеки с ролями, `teaches`, эмоциями и окнами из неё; `R11` — `role: meet`, `teaches: twoFaces`; `roll-in-1` — `twist`, `teaches: glass`; архетипы — словами по замыслу (у соседей не повторять трёх подряд; `R11` — `bridge`, `two-pairs-2` — `bridge two faces`). `help` у новых мест слоя `die` — как у соседей (`wait: free, camera: hold`), в `leaving` и `floor` — только окна.

- [ ] **Step 2: Пик блока моста (18-е)** — `P08`: `needsOf` даёт `walk` и `twoFaces`? (`node scripts/level.mjs check file=P08`, партитура с `~` и двумя гранями). Да — `P08`. Нет — `tight-room-4` той же проверкой. Нет — новая `bridge-peak-1` по брифу раздела 14.

- [ ] **Step 3: Собрать и проверить** — `node scripts/row.mjs`; `npx vitest run src/levels`: PASS по `held` (1, 2, 3, 5, 7, 11); `node scripts/row.mjs check`: 0. Красное правило 1, 5 или 11 — переставлять внутри блока, записать в «Что вышло иначе» и в раздел 14 спеки.

- [ ] **Step 4: Таблица** — `node scripts/ladder.mjs campaign` в фоне; под таблицей — только предупреждения 4, 8, 10; медленные 1 (`order` на 11–12) и 2 (`lift`, `push`, `glass`, `walk`, `link` на встречах) чисты. Таблицу мест 1–38 — в «Что вышло иначе».

- [ ] **Step 5: Коммит** — `Ряд первого часа: шаг семь, блоки моста и цепочки, слой «Пол» на 28–38`.

### Task 4: Документы, версия, просмотр

**Files:**
- Modify: `docs/VI_Levels_Lab.md` (раздел 16: правило 11, главы `die`/`leaving`/`floor`/`order`/`more`), `docs/ROADMAP.md` («Кампания»: шаг 3), `docs/art/VI_Interface_Layer.md` (строка списка: сорок три места, окна на 8, 13, 20, 28, 30), спека (шапка — шаг 3 построен; раздел 12 — что вышло иначе; таблицы 5.2–5.3 — ссылка на раздел 14), `docs/README.md` (строка спеки; этот план — выполнен, в историю индекса), `package.json` (версия следующая за `origin/main`)

- [ ] **Step 1: Документы** по списку; план после выполнения — в таблицу «В истории git» индекса с хэшем, как шаги 1–2.

- [ ] **Step 2: Просмотр** на 360×640: места 1–38 подряд записанными путями; окна на 8, 13, 20, 28, 30; на `C1-06` путь через пол не находится (сыграть руками: спуститься с группы некуда).

- [ ] **Step 3: Проверки** — `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`: чисты.

- [ ] **Step 4: Коммит** — `Документы: третья редакция, шаг 3; версия 0.2.NN`; `git fetch && git rebase origin/main`; доложить: ветка, коммиты, таблица, что вышло иначе, вопросы.

## Что вышло иначе

Заполняется при выполнении.
