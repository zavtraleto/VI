# Боты уровней — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Инструменты, которыми строят и отбирают уровни: партитура и маршрут решения, граф доски, запреты кусков маршрута, обходчик, редактор в одну кость, блуждатель и персоны, знающие правило пола; один скрипт, печатающий отчёт по доске.

**Architecture:** Все боты уровней ходят ходами на настоящих правилах через `scan` и `playMove`; ни один файл семейства не ссылается на игрока Endless. Решатель остаётся как есть и получает три добавки: два новых запрета, ход с рассказом о том, что он вызвал, и обход всех положений доски.

**Tech Stack:** TypeScript, vitest, node-скрипты через `runnerImport` из vite.

**Spec:** [docs/superpowers/specs/2026-10-07-vi-bots-design.md](../specs/2026-10-07-vi-bots-design.md), разделы 3, 4 и 6. Правила пола — [docs/VI_Levels_Rules.md](../../VI_Levels_Rules.md), разделы 2, 5, 7.

Исполняет этот план автор спеки в том же разговоре, поэтому код шагов здесь не выписан: у каждой задачи названы файлы, интерфейсы и тесты, которые её принимают. Исполнителю со стороны нужна спека: все сигнатуры в ней.

## Global Constraints

- Правила игры не меняются: `RULES_VERSION` остаётся `0.9`; уровни в `src/levels/levels.ts` не трогаются; `LevelSpec.climb` по умолчанию оставляет подъём включённым.
- `floorStuck` и `floorLost` — чистые проверки; `endBeat` их не зовёт.
- Файлы `src/rules/bot.ts`, `src/rules/paceBot.ts`, `scripts/pace.mjs` не трогать: их правит план 2.
- Имена, которыми пользуются `src/levels/select.ts`, `src/levels/table.ts`, `scripts/ladder.mjs`, `scripts/stars.mjs`, остаются: `PERSONAS`, `PERSONA_NAMES`, `PersonaName`, `personaPlay`, `personaRates`, `randomPlay`, `randomRate`, `randomMoves`, `trapRate`, `witnessWay`, `neededBy`, `measure`, `Measures`. Четыре персоны и их порядок прежние; жадный — отдельная пятая.
- На уровнях с закрытым полом персоны и случайный играют те же прогоны, что до правки: ходов, требующих пола, там нет.
- Проверка после каждой задачи: `npm test`, `npm run typecheck`; в конце `npm run build`.

## Карта файлов

| Файл | Что |
|---|---|
| `src/rules/goalBot.ts`, `goalBot.test.ts` (новые) | прежние игроки уровней с целью: переезд без изменений |
| `src/rules/types.ts`, `src/rules/level.ts` | `LevelSpec.climb`; `floorStuck`, `floorLost` |
| `src/rules/reach.ts` | `Ban`, запреты `push` и `up` |
| `src/rules/levelSolver.ts` | `ban: readonly Ban[]`; `tellMove`; `explore` |
| `src/rules/levelScore.ts` (новый) | `Beat`, `Score`, `scoreOf` |
| `src/rules/levelGraph.ts` (новый) | `LevelGraph`, `graphOf`, `GraphFacts`, `factsOf` |
| `src/rules/levelProof.ts` (новый) | `neededBy`, `ROUTE_PARTS`, `partsOf`, `bypassesOf` |
| `src/rules/levelBot.ts` | игроки: персоны, жадный, случайный, блуждатель; исходы; `measure` |
| `src/rules/levelReport.ts` (новый) | `LevelReport`, `report` |
| `src/levels/edits.ts` (новый) | `editsOf`, `probeEdits` |
| `scripts/bots.mjs` (новый) | отчёты |
| `src/rules/families.test.ts` (новый) | семейства не ссылаются друг на друга |

---

### Task 1: Переезд прежних игроков

**Files:** Create `src/rules/goalBot.ts`, `src/rules/goalBot.test.ts`. Modify `src/rules/levelBot.ts`, `src/rules/levelBot.test.ts`, `src/rules/index.ts` (если отдаёт эти имена).

- [x] В `goalBot.ts` переезжают без изменений: `LevelPlay`, `goalBot`, `playWith`, `playLevel`, `skillRates`, `movesOf`, `percentile`, `SeedTrial`, `trySeed`, `pickSeed`, `limitFor`, `levelTable` и их константы. Тесты этих имён — в `goalBot.test.ts`.
- [x] Проверка: `npm test`, `npm run typecheck`. `levelBot.ts` пока ещё берёт у `bot.ts` жадного и свидетеля — это снимает Task 6.

### Task 2: Переключатель подъёма и проверки пола

**Files:** Modify `src/rules/types.ts`, `src/rules/level.ts`, `src/rules/index.ts`. Test `src/rules/ladderRules.test.ts`.

- [x] Тесты: с `climb: false` шаг с пола в кость у края не делается (`resolveMove` → `blocked`), без поля делается; `floorStuck` — игрок на полу, кости стоят у стен, толкнуть нечего; `floorLost` — на полу одна тройка и две кости другими гранями при рабочей тройке; обе проверки отвечают «нет» при включённом подъёме, при уходящей кости на доске и когда троек хватает.
- [x] Код: `climb?: boolean` в `LevelSpec`; `floorClimb: spec.climb !== false` в `levelConfig`; `floorStuck`, `floorLost` по спеке 4.1.

### Task 3: Запреты `push` и `up`, ход с рассказом

**Files:** Modify `src/rules/reach.ts`, `src/rules/levelSolver.ts`. Test `src/rules/levelSolver.test.ts`.

- [x] Тесты: доска, решаемая только толчком, не решается при `ban: ['push']`; доска «вниз и обратно» не решается при `ban: ['up']` и решается без него; `tellMove` говорит о комбо, звене и единицах.
- [x] Код: `export type Ban = Technique | 'push' | 'up'`; `scan` пропускает толчки и шаги с пола наверх; `movesAt`, `SolveOptions.ban` принимают `Ban`; `export function tellMove(state, move): { state: RunState; outcome: Outcome }`, `Outcome` экспортируется.

### Task 4: Партитура и маршрут

**Files:** Create `src/rules/levelScore.ts`, `src/rules/levelScore.test.ts`.

- [x] Тесты: по доске, собранной руками, на каждый вид маршрута (`top`, `bridge`, `downLast`, `downAndUp`); знаки маршрута; `spare` звена, сделанного последним возможным ходом, равен 0; на всех `LEVELS` `pause` равен `depth` решателя, `tail` равен `tailOf`.
- [x] Код: `Beat`, `Score`, `scoreOf(spec, way, config?)` по спеке 4.3.

### Task 5: Граф доски

**Files:** Modify `src/rules/levelSolver.ts` (`explore`). Create `src/rules/levelGraph.ts`, `src/rules/levelGraph.test.ts`.

- [x] Тесты: на малой доске `toClear` старта равен `par`; `alive`, `ways`, `lostIn`; доска сверх предела — `complete: false`, `factsOf` — `null`.
- [x] Код: `explore(root, { maxStates, ban })` обходит все положения и отдаёт переходы и исходы; `graphOf`, `factsOf` по спеке 4.4. У положения есть исход: `passed`, `count`, `floor` или его нет.

### Task 6: Игроки

**Files:** Modify `src/rules/levelBot.ts`, `src/rules/levelBot.test.ts`.

- [x] Тесты: `endingOf`; жадный попадает в ловушку, которую планирующий обходит; на строгом поле персона не сходит на пол там, где внизу нечего делать, и сходит, когда толчок очищает доску; ход наугад не требует пола, пока есть другой; случайный без `floor` сам не сходит; свидетель — путь, который проигрывает решатель; `personaFacts` — доли исходов в сумме 1, `match` равен 1 на доске с одним путём; прогоны на уровне с закрытым полом те же, что до правки (записать до правки).
- [x] Код: по спеке 4.6. `GREEDY: Persona`; `levelBot.ts` больше не ссылается на `bot.ts`.

### Task 7: Блуждатель

**Files:** Modify `src/rules/levelBot.ts`. Test `src/rules/levelBot.test.ts`.

- [x] Тесты: один прогон на один сид; при `bonus: 0` ходов больше, чем при 25; осторожный не перезапускается на доске без тупиков; на недосчитанном графе — `null`.
- [x] Код: `Walker`, `WALKERS`, `walkFacts` по спеке 4.6.

### Task 8: Запретчик и обходчик

**Files:** Create `src/rules/levelProof.ts`, `src/rules/levelProof.test.ts`. Modify `src/rules/levelBot.ts` (отдаёт `neededBy` дальше).

- [x] Тесты: `partsOf` по партитуре; доска, где толчок обязателен, — обхода нет и `settled`; доска, где звено выгодно, но не нужно, — обход найден и он длиннее не больше чем на ход.
- [x] Код: по спеке 4.5.

### Task 9: Отчёт и скрипт

**Files:** Create `src/rules/levelReport.ts`, `src/rules/levelReport.test.ts`, `scripts/bots.mjs`. Modify `src/rules/index.ts`.

- [x] Тесты: отчёт малой доски содержит все поля; отчёт доски без пути — `par: null`, `score: null`.
- [x] Код: `report` по спеке 4.7; скрипт по спеке 4.10.
- [x] Руками: `node scripts/bots.mjs`, `node scripts/bots.mjs level=B13`, `node scripts/bots.mjs climb=off`, `node scripts/ladder.mjs levels`, `node scripts/stars.mjs` печатают таблицы.

### Task 10: Редактор

**Files:** Create `src/levels/edits.ts`, `src/levels/edits.test.ts`. Modify `scripts/bots.mjs` (слово `edits`).

- [x] Тесты: число правок доски из двух костей на поле 3×3; правка не меняет исходный уровень и не несёт его пути; `probeEdits` отдаёт правки по убыванию оценки и отбрасывает те, что оценка не взяла.
- [x] Код: по спеке 4.8.

### Task 11: Развод семейств, документы, числа

**Files:** Create `src/rules/families.test.ts`. Modify `README.md`, `CLAUDE.md`, `docs/VI_Levels_First20_Build.md`, `docs/VI_Levels_Routes_Brief.md`, `docs/ROADMAP.md`.

- [x] Тест читает импорты: `levelBot`, `levelScore`, `levelGraph`, `levelProof`, `levelReport` не ссылаются на `bot`, `paceBot`, `goalBot`; `bot`, `paceBot` не ссылаются на файлы уровней.
- [x] `npm test`, `npm run typecheck`, `npm run build`.
- [x] Числа: `node scripts/bots.mjs` и `node scripts/bots.mjs climb=off` на всех уровнях; раздел 3.4 страницы решений переснят; сводка владельцу.
