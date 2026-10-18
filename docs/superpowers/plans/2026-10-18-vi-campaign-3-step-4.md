# Кампания, третья редакция, шаг 4: правила 12 и 13, окно наката, порядок первых тридцати — план

> Вид: план. Статус: не выполнен. Дата: 2026-10-18.
> Что заменило: —. Что живёт в коде: src/levels/grammar.ts, src/levels/table.ts, src/levels/measures.ts, src/levels/row.ts, src/ui/i18n.ts, src/ui/lang/*.ts, boards/row.json, boards/*.txt.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Довести первые тридцать мест по разделу 15 спеки: правило 12 (ничего не требуется раньше урока) красным, правило 13 (видимые грани) предупреждением, окно наката, развороты шести досок на 180°, порядок мест 1–27 по кандидату спеки; доски владельца не меняются.

**Architecture:** Правило 12 — медленная часть по `solveLevel` с запретами (как `neededBy`) в `slowFactsOf`, быстрая — по `needsOf`; правило 13 — новое мерило `visibleFaces` в `measures.ts`; окно — ключ в `HINT_KEYS`, текст в `i18n.ts` и `lang/*.ts`, `HINT_TECHNIQUE`; развороты — функция `turnedBoard` (поворот поля на 180°) в `src/levels/edits.ts` или командой `level.mjs`, путь пересчитывается и проверяется; ряд — `boards/row.json`. `HELD` = `[1, 2, 3, 5, 7, 12]`; правила 4, 8, 10, 11, 13 — предупреждения.

**Tech Stack:** TypeScript, vitest, `scripts/*.mjs` (Node 24), Vite.

**Spec:** [docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md](../specs/2026-10-16-vi-campaign-3-design.md) — раздел 15 (слова владельца, решения, кандидат порядка, окно наката), раздел 7 (правила), раздел 12. Исходный ряд — `main` после коммита владельца с правками мастерской (его доски и `row.json`; если коммита ещё нет, worktree `.claude/worktrees/workshop-save` — только читать). Рядом: `src/levels/grammar.ts`, `src/levels/table.ts`, `src/rules/levelProof.ts` (`neededBy`, `ROUTE_PARTS`), `src/levels/measures.ts`, [VI_Levels_Lab.md](../../VI_Levels_Lab.md) разделы 1 и 16, [VI_Puzzle_Principles.md](../../VI_Puzzle_Principles.md) раздел 3.

## Global Constraints

- Worktree; в основную папку `GAMES\VI` и в `workshop-save` не писать. `git fetch && git rebase origin/main` перед каждым коммитом; конфликт в доске или `row.json` — взять `origin/main` (там доски владельца) и наложить правку заново.
- Коммит после каждой задачи: заголовок до 70 знаков, тело до пяти строк, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Пуш в `main` делает чат планирования.
- `src/rules` не трогается. **Доски не меняются**, кроме шести разворотов на 180° (раздел 15 спеки, решение 3) и статуса `tight-room-4` → `RC`. Правки владельца в досках — как есть.
- Проверки перед каждым коммитом: `npx vitest run src/levels`, `npm run typecheck`; перед последним — `npm test`, `npm run build`, `node scripts/docs-check.mjs`, `node scripts/level.mjs regress`, `node scripts/ladder.mjs campaign` (в фоне).
- Дев-сервер для просмотра — `npx vite --port 5197` в worktree, остановить после.

## Review Focus

1. Доска, чей записанный путь использует приём, но без него решается в тот же пар (`R05` и звено): правило 12 не красно, только предупреждение быстрой части — задача 1, тест на фактах `without`.
2. Доска до урока наката, которая накатом решается короче, а без наката — в пар плюс один: правило 12 (медленное) красно только если без приёма решения в пар нет; «короче на ход» — не нарушение — задача 1, тест.
3. Разворот на 180° доски со стартом на полу (`f`) или с уходящими костями (`~k`): поворот переносит пометки — задача 3, тест `turnedBoard` на доске из образцов с `f` и `~`.
4. Окно наката на месте, где доска накатом не решается (`teaches: glass` не стоит): правило 7 красно — задача 2, тест.
5. `visibleFaces`: грань цели, видная только на кости, которую закрывает соседняя (камера с юго-востока): мерило не учитывает заслонение — записать как границу в комментарии, не чинить (задача 1).

---

### Task 1: Правила 12 и 13; `twoFaces` без урока

**Files:**
- Modify: `src/levels/grammar.ts` (`Violation.rule` += 12, 13; `beforeLesson` быстрая и медленная части; `visibleGoal`; `HELD`; `twoFaces` вне правила 1)
- Modify: `src/levels/table.ts` (`slowFactsOf`: `without` для каждого приёма с запретом — `SlowFacts.cleared: Partial<Record<Technique, number | null>>`)
- Modify: `src/levels/measures.ts` (`visibleFaces`)
- Test: `src/levels/grammar.test.ts`, `src/levels/measures.test.ts`

**Interfaces:**
- Produces: `export function visibleFaces(spec: LevelSpec): Set<number>` — грани, видимые в начале: у каждой кости раскладки верх, южный и восточный бок (как их даёт `src/rules/orientation.ts` по `top` и `north`); `SlowFacts.cleared?: Partial<Record<'walk' | 'link' | 'glass' | 'lift' | 'push', number | null>>` — пар без приёма (запреты `BAN_OF`), `null` где решения в `par + 3` нет; `lessonOf(row, technique)` — номер места с `teaches` этого приёма или `Infinity`; быстрое правило 12: место `n` до `lessonOf` с приёмом в `needsOf` — предупреждение «место 13 (act-k17) по записанному пути требует link, а звену учат на месте 16»; медленное правило 12: `cleared[t] === null || cleared[t] > par` до урока — нарушение «место 13 (act-k17) без link не проходится в 3 хода, а звену учат на месте 16» (красное); правило 13: `goalFaces(spec)` не подмножество `visibleFaces(spec)` — предупреждение «место 9 (which-first-2): грань 3 не видна в начале».
- `HELD = new Set([1, 2, 3, 5, 7, 12])`; в `taughtAndUsed` часть «двумя из трёх» пропускает `twoFaces`, как `seven` и `order`.

- [ ] **Step 1: Тесты** (`measures.test.ts`, `grammar.test.ts`):

```ts
it('names the faces the camera sees at the start: top, south and east of every die', () => {
  // side-up-1: 21* (top 2, north 1): south 6, east 4 (западная кость); 32, 31 — верх 3; south/east по orientation.ts
  const seen = visibleFaces(boardOf('side-up-1'));
  expect(seen.has(3)).toBe(true);
  expect(seen.has(5)).toBe(false);   // ни у одной кости пятёрка не сверху, не на юге и не на востоке — проверить по раскладке и поправить число
});
it('does not let a board stand before the lesson of a move it cannot do without: rule 12', () => {
  const row = rowOf([['act-k17', { role: 'apply' }], ['R07', { role: 'meet', teaches: 'link' }]]);
  const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: 1, order: false, cleared: stop.spec.id === 'act-k17' ? { link: null } : {} });
  expect(slowGrammar(row, facts).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(['место 1 (act-k17) без link не проходится в 3 хода, а звену учат на месте 2']);
  // Short by one without the move: not a breach.
  expect(slowGrammar(row, (stop) => ({ ...facts(stop), cleared: { link: 4 } })).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(['место 1 (act-k17) без link не проходится в 3 хода, а звену учат на месте 2']);
  expect(slowGrammar(row, (stop) => ({ ...facts(stop), cleared: { link: 3 } })).filter((one) => one.rule === 12)).toEqual([]);
  expect(fastGrammar(row).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(['место 1 (act-k17) по записанному пути требует link, а звену учат на месте 2']);
});
it('warns where a goal face is not to be seen at the start: rule 13', () => {
  const row = rowOf(['which-first-2']);
  expect(fastGrammar(row).filter((one) => one.rule === 13).length).toBeGreaterThanOrEqual(0);   // число по раскладке: записать точный текст после первого прогона
});
```
(Второй случай правила 12 — «без приёма длиннее на ход» — тоже нарушение: доска до урока должна решаться в свой пар без приёма; «не длиннее» — чисто.)

- [ ] **Step 2: Запустить** — FAIL.

- [ ] **Step 3: Реализовать** по Interfaces. Слова приёмов в текстах: `link` → «звену учат», `walk` → «проходу учат», `glass` → «накату учат», `lift` → «подъёму учат», `push` → «толчку учат».

- [ ] **Step 4: Проверить** — `npx vitest run src/levels && npm run typecheck`: PASS (на ряду `main` правило 12 красно — чинит задача 4; до неё тест ряда временно красный, выполнить задачи 2–4 до первого коммита или закоммитить с пометкой).

- [ ] **Step 5: Коммит** — `Грамматика: правило 12 — ничего раньше урока; правило 13 — видимые грани`.

### Task 2: Окно наката

**Files:**
- Modify: `src/levels/row.ts:19` (`HINT_KEYS` += `hintRollIn`), `src/levels/grammar.ts` (`HINT_TECHNIQUE.hintRollIn = 'glass'`), `src/app/hint.ts` (`PROBE.rollin`), `src/ui/i18n.ts` (ru: «В уходящую кость тоже можно вкатиться.», en: «You can roll into a leaving die, too.»), `src/ui/lang/de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `tr.ts` (перевод в духе соседних строк)
- Test: `src/levels/row.test.ts` («names hints that have words» — проходит с новым ключом), `src/levels/grammar.test.ts` (правило 7 с `hintRollIn`)

- [ ] **Step 1: Тест** — в `grammar.test.ts`: место с `help.hint: 'hintRollIn'` и `teaches: 'glass'` на `roll-in-1` — правило 7 чисто; без `teaches` — «место 1 (roll-in-1): окно hintRollIn, а доска учит ничему».
- [ ] **Step 2: Реализовать**; `npx vitest run src/levels src/app && npm run typecheck`: PASS.
- [ ] **Step 3: Коммит** — `Окно наката hintRollIn: «В уходящую кость тоже можно вкатиться.»`.

### Task 3: Развороты на 180°

**Files:**
- Modify: `src/levels/edits.ts` (`turnedBoard(spec): LevelSpec` — поле целиком: x → size−1−x, z → size−1−z, у кости `north` → противоположная грань (7 − north), верх тот же; старт, вырезы, `onFloor`, `leaving` переносятся; путь: клетки так же, направления N↔S, E↔W)
- Modify: `boards/which-first-2.txt`, `which-first-3.txt`, `R11.txt`, `two-pairs-2.txt`, `C1-07.txt`, `C1-05.txt`
- Test: `src/levels/edits.test.ts`

- [ ] **Step 1: Тест** — `turnedBoard` дважды даёт исходную доску (`normalSpec` равны); на доске с `f` и `~2` пометки на своих местах; путь повёрнутой доски проходит её за тот же пар (`tryWay`).
- [ ] **Step 2: Реализовать**; развернуть шесть досок командой (добавить `node scripts/level.mjs turn file=R11` — пишет файл с повёрнутой доской и путём) и `check` каждой: пар и партитура те же; у каждой `words: 2026-10-18: развернуть на 180 градусов` (слово владельца, раздел 15 спеки). Если западная кость после поворота показывает нужную грань не на юге/востоке, а на севере/западе (мерило `visibleFaces` до и после) — сказать владельцу в отчёте, не отражать зеркально самому.
- [ ] **Step 3: Проверить** — `node scripts/level.mjs regress`: 0; `npx vitest run src/levels`: PASS.
- [ ] **Step 4: Коммит** — `Шесть досок развёрнуты на 180° по слову владельца`.

### Task 4: Порядок мест 1–27 и полка

**Files:**
- Modify: `boards/row.json`, `boards/tight-room-4.txt` (статус `RC`, `words`)
- Generate: `src/levels/row.gen.ts`

- [ ] **Step 1: `row.json`** — по кандидату раздела 15 спеки (таблица), остальное с 28-го как в `main`; `R11` без `teaches`; `roll-in-1` — `meet`, `teaches: glass`, `help.hint: hintRollIn`; `tight-room-4` снята; эмоции и архетипы переносятся со старых мест, у новых мест — как у соседей. Роли по таблице.
- [ ] **Step 2: Собрать** — `node scripts/row.mjs`; `npx vitest run src/levels` по `held` (1, 2, 3, 5, 7, 12). `R05` требует звено (правило 12 медленное, считается `ladder campaign`): если без звена в 3 хода не решается — `R05` переезжает за `R07`, на его место 13 встаёт `C1-07` или `P07`; записать.
- [ ] **Step 3: Таблица** — `node scripts/ladder.mjs campaign` в фоне: под таблицей нет нарушений 1, 2, 3, 5, 7, 12; предупреждения 4, 8, 10, 11, 13 — перечислить в «Что вышло иначе». Переставлять внутри блоков, пока красные не чисты; каждое перемещение — строкой в «Что вышло иначе».
- [ ] **Step 4: Коммит** — `Ряд: порядок первых тридцати, накат на 20-м, tight-room-4 на полке`.

### Task 5: Документы, версия, просмотр

**Files:**
- Modify: `docs/VI_Puzzle_Principles.md` (раздел 3: принцип «видимые грани направляют» словами владельца из раздела 15 спеки, дата 18 октября), `docs/VI_Levels_Lab.md` (раздел 16: правила 12, 13, окно `hintRollIn`, команда `turn`), `docs/ROADMAP.md` («Кампания»: шаг 4; цель релиза — пятьдесят уровней, слово владельца 18 октября), `docs/art/VI_Interface_Layer.md` (окна по местам, в том числе накат), спека (шапка — шаг 4 построен; раздел 12 — что вышло иначе), `docs/README.md` (строки спеки и плана; план — в историю индекса после выполнения), `package.json` (версия следующая за `origin/main`)

- [ ] **Step 1: Документы** по списку.
- [ ] **Step 2: Просмотр** на 360×640: места 1–27 записанными путями; окна на 8, 10, 16, 20, 27; у развёрнутых досок нужные грани смотрят на камеру (снимок каждой — в отчёт).
- [ ] **Step 3: Проверки** — `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`: чисты.
- [ ] **Step 4: Коммит** — `Документы: третья редакция, шаг 4; версия 0.2.NN`; `git fetch && git rebase origin/main`; доложить: ветка, коммиты, таблица, что вышло иначе, вопросы.

## Что вышло иначе

Заполняется при выполнении.
