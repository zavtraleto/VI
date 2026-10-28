# VI — инструменты прогрессии: план постройки

> Вид: план. Статус: не выполнен. Дата: 2026-10-28.
> Что заменило: —. Что живёт в коде: src/rules/levelBot.ts, src/levels/depth.ts, src/levels/measures.ts, src/levels/needs.ts, src/levels/signature.ts, src/levels/scale.ts, src/levels/calibration.ts, src/levels/measureCache.ts, src/levels/grammar.ts, src/levels/table.ts, scripts/ladder.mjs, scripts/row.mjs, scripts/measureCache.mjs, src/lab/labFacts.ts, src/lab/checkLines.ts.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** мерила глубины доски, персоны `deep` и `reader`, режим `explorer`, подпись и похожесть досок, шкала трудности `D`, правила ряда 16–18 и кэш медленных мерил — по спеке инструментов прогрессии, раздел 11, шаги 0–3.

**Architecture:** персоны — в `src/rules/levelBot.ts` (единственное, что трогаем в `src/rules`). Граф положений доски до пара + 3 и всё, что из него читается (развилки, пути, потеря), — новый `src/levels/depth.ts`; чтение граней, `rank` и `explorer` — в `src/levels/measures.ts`; подпись и похожесть — `src/levels/signature.ts`; шкала и полосы — `src/levels/scale.ts`; правила — в `src/levels/grammar.ts`. Медленное считается один раз на доску и лежит в `boards/.measures/`; `ladder campaign` и `row.mjs report` читают кэш, `npm test` — нет.

**Tech Stack:** TypeScript, vitest, Vite (`runnerImport` в скриптах), Node.

**Spec:** [docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md](../specs/2026-10-28-vi-progression-tools-design.md) — исполнитель читает её целиком; здесь — решения, которых в ней нет.

## Global Constraints

- Правила уровня в `src/rules` не трогаем; правится только `src/rules/levelBot.ts` (персоны). `levelSolver.ts`, `levelScore.ts`, `reach.ts`, `sim.ts` — только читать и звать.
- Раскладки и пути стоящих досок (`boards/*.txt`) не правятся. `boards/row.json` не правится.
- Ряд для калибровки — ряд как в `main` после коммита `0f57abf` (правки владельца 28 октября, сто мест). Номера мест в калибровке — этого ряда; в коде калибровка держится по кодам досок (задача 0), потому что после пересборки номера сдвинутся.
- Доля персоны — из 30 партий (`PERSONA_FLOOR_RUNS` в `src/levels/select.ts`), зёрна 1…30.
- `D` округляется до половины, лежит в 1…10.
- Пороги похожести: правило 16 — `layoutSim` ≥ 0,9 или равное ядро; правило 17 — к любому прежнему месту < 0,7, к любому из пяти прежних < 0,5. Веса `coreSim`: путь 0,4, приёмы 0,3, грани 0,2, `kind` 0,1 (отправная точка, задача 3 подбирает).
- Правила 16–17 говорят о местах с 31-го (сравнение — со всеми прежними, и с 1–30 тоже): места 1–30 остаются как есть по решению 1 владельца. Правило 18, медленные части 5 и 8 на `D` — с 31-го, предупреждения.
- `npm test` не читает `boards/.measures/` и не зовёт `deep`; новые тесты вместе — не дольше 20 с.
- Каждая задача кончается коммитом: заголовок до 70 знаков, тело до пяти строк, последняя строка `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. В коммит — только свои файлы, без `git add -A`.
- Проверки перед коммитом задачи: `npx vitest run <файлы задачи>` и `npm run typecheck`; перед пушем — `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`.
- Дев-сервер и preview не поднимать; мастерскую проверять тестами `src/lab/*.test.ts`.
- Стиль кода — как в соседних файлах: комментарии полными английскими фразами о том, что вещь значит в игре; строки для человека (таблица, нарушения, мастерская) — по-русски.
- Тест раздела 11, который на настоящей доске не сходится с мерилом, как оно определено, не подгоняется: исполнитель проверяет мерило, и если мерило верно по спеке — тест держит то, что вышло, а доска, число и почему идут в отчёт задачи (потом — в раздел 12 спеки).

## Review Focus

1. Доска, на которой граф не досчитан до конца (`finale-1`, `three-moves-2`, девять костей, пар 7–8): `depthOf` не бросает и не висит — возвращает `complete: false` за предел состояний, а таблица ставит у таких чисел `+`. Тест — в задаче 2 (предел состояний 2 000 на `finale-1`).
2. Доска без записанного пути (черновик в мастерской) и доска с путём из одного хода: `coreOf`, `hiddenOf`, `signatureOf` не падают — путь берётся у решателя или пустой. Тест — в задаче 3.
3. Доска с фиксированными костями (`fixed-wall-1`) и со стартом на полу: фиксированная кость не уходит и в `hidden` не считается; в рисунке раскладки она — кость. Тест — в задачах 2 и 3.
4. Кэш: доска поправлена в файле — ключ другой, мерила считаются заново; доска переименована — ключ тот же; `MEASURES_VERSION` поднят — всё считается заново. Тест — в задаче 6.
5. Доска, которую проиграть нельзя (`R03`): `lossAt` — `null`, `lostShare` — 0, в таблице `-`. Тест — в задаче 2.

---

### Task 0: Калибровочный набор

**Files:**
- Create: `src/levels/calibration.ts`
- Test: `src/levels/calibration.test.ts`

**Interfaces:**
- Produces:
  - `SIMILAR_PAIRS: readonly { a: string; b: readonly string[] }[]` — пары раздела 5, которые должны быть ≥ 0,7 (у `b` несколько кодов — «к одной из»).
  - `UNLIKE_PAIRS: readonly [string, string][]` — пары ≤ 0,5.
  - `D_ROWS: readonly { words: string; codes: readonly string[]; lo: number; hi: number }[]` — строки раздела 6.
  - `OWNER_REPEATS: readonly string[]` — коды мест, которые владелец назвал повторами 28 октября: места 48, 49, 51–53, 56, 57, 60, 61, 64, 65, 68, 71–76, 79, 84, 92, 98, 99.

- [ ] **Step 1: Тест** `calibration.test.ts`: каждый код всех четырёх списков есть в `CAMPAIGN` (`src/levels/campaign.ts`); `OWNER_REPEATS` — 24 кода; `D_ROWS` — шесть строк, у строки «первые тридцать» коды мест 1–30 и полоса 1–4; `SIMILAR_PAIRS` — восемь пар, `UNLIKE_PAIRS` — шесть.
- [ ] **Step 2:** `npx vitest run src/levels/calibration.test.ts` — FAIL, модуля нет.
- [ ] **Step 3: Модуль.** Коды берутся из ряда по номерам (таблица мест — `CAMPAIGN`, сейчас: 29 `floor-first-1`, 50 `two-combos-3`, 51 `two-combos-5`, 54 `bridge-5`, 55 `hidden-face-1`, 56 `dd-09-push-link`, 57 `collapse-5`, 58 `pair-and-fours-1`, 61 `fixed-wall-1`, 67 `dd-25-pocket`, 68 `probe-25`, 74 `act-k25`, 75 `dd-12-ice-corridor`, 76 `roll-in-transfer-1`, 78 `far-faces-1`, 80 `dd-15-no-way-down`, 82 `dd-21-wood-fives`, 86 `ones-over-leaving-1`, 87 `act-k21`, 88 `tight-room-5`, 89 `three-moves-1`, 90 `dd-20-chain-on-the-run`, 91 `tight-room-1`, 96 `dd-19-three-threes-apart`, 97 `three-moves-2`, 98 `tight-room-4`), остальные — по `CAMPAIGN` тем же способом, и пишутся литералами. Пары ≥ 0,7: 50–51, 74–76, 56–29, 75–29, 78–29, 98 — к 88 или 91, 61 — к любой доске мест 1–30, у которой грани цели (`goalFaces` без 1) ровно `[3]` (список кодов вычислить один раз и записать литералом), 68 — к 67 (в спеке «68 — к `dd-25-pocket` или `probe-25`»: `probe-25` и есть 68-е, значит пара одна — 68–67; записать это комментарием). Пары ≤ 0,5: 54–55, 58–57, 80–82, 86–87, 89–90, 96–97. Строки `D` — таблица раздела 6: ≤ 3 (полоса 1–3), 3–4, 5–6, 7–8, 8–9 (место 100), первые тридцать 1–4.
- [ ] **Step 4:** тест PASS.
- [ ] **Step 5: Коммит** `Калибровочный набор: пары похожести и полосы D по его словам`.

### Task 1: Персоны `deep` и `reader`, режим `explorer`

**Files:**
- Modify: `src/rules/levelBot.ts`
- Test: `src/rules/levelBot.test.ts` (дописать; если файла нет — создать)

**Interfaces:**
- Produces (все — из `src/rules/levelBot.ts`):
  - `interface Persona` получает `misread?: number` — доля невидимых граней, прочитанных не так; нет ключа — персона знает все грани.
  - `DEEP: Persona = { depth: 8, budget: 40_000, slip: 0.01, counts: true }`
  - `READER: Persona = { depth: 3, budget: 1200, slip: 0.04, counts: true, misread: 0.25 }`
  - `EXPLORER_SLIP = 0.15`; `explorerOf(name: 'careful' | 'planner'): Persona` — та же персона со `slip` 0,15.
  - `type RankName = PersonaName | 'deep'`; `RANK_PERSONAS: readonly { name: RankName; depth: number; persona: Persona }[]` — hasty 1, casual 2, careful 3, planner 5, deep 8, в этом порядке.
  - `beliefOf(ori: Orientation, misread: number, rng: { rng: number }): Orientation`.
  - `personaRun(spec, persona, seed, maxMoves?)` — прежняя подпись; у персоны с `misread` играет по убеждениям.
- `PERSONAS` и `PERSONA_NAMES` не меняются: по ним ходят `personaRates`, `measure`, `select.ts`, `levelReport.ts`, мастерская, и `deep` там сделал бы всё в разы медленнее. Это отступление от раздела 4 спеки («добавляются к `PERSONAS`») — в отчёт задачи.

- [ ] **Step 1: Тесты.**
  - `beliefOf` с `misread` 0 возвращает ту же ориентацию; с `misread` 1 — другую, с тем же верхом (`top`), и это одна из `ALL_ORIENTATIONS`.
  - `personaRun(spec, { ...READER, misread: 0 }, seed)` и `personaRun(spec, PERSONAS.careful, seed)` дают один и тот же `way` на `hidden-face-1` и `P07` для зёрен 1–5 (доски — `boardOf` из `src/levels/boardSets.ts`).
  - `personaRun(spec, READER, seed)` детерминирован: два вызова с одним зерном — один `way`.
  - `explorerOf('planner')` равен `{ ...PERSONAS.planner, slip: 0.15 }`.
  - `RANK_PERSONAS.map((one) => one.depth)` — `[1, 2, 3, 5, 8]`.
- [ ] **Step 2:** `npx vitest run src/rules/levelBot.test.ts` — FAIL.
- [ ] **Step 3: Реализация.**
  - Модель ошибки чтения. Три видимые грани (верх, юг, восток) по правилу семи задают все шесть, поэтому «невидимая грань не та» при верных видимых — не настоящая кость, и сим её не сыграет. Решение: прочитанная с ошибкой кость видится повёрнутой на четверть вокруг вертикали (верх тот же, бока на шаг по кругу; сторона поворота — из `rng`): готовые комбо и верх видны верно, ошибается персона в том, что встанет наверх после переката. Это моё; в отчёт задачи и в раздел 12 спеки, рядом с открытым вопросом 1 раздела 10. `beliefOf`: с вероятностью `misread` — `ALL_ORIENTATIONS.find((o) => o.top === ori.top && o.north === (left ? ori.east : ori.west))`, иначе `ori`.
  - `personaRun` для персоны с `misread`: свой поток случайностей для чтения (`(seed ^ 0x1b873593) | 0`), чтобы ходы с `misread` 0 совпадали с той же персоной без чтения. Убеждения — карта по `cube.id`: на старте каждая кость читается `beliefOf`; после хода перечитываются кости, чья ориентация изменилась (покатилась сама или её толкнули), прочие держат прежнее убеждение. Ход ищется `personaMove` на копии положения (`structuredClone`) с ориентациями из убеждений; делается на настоящем положении, если он есть среди `scan(state).moves`, иначе — случайный из настоящих.
- [ ] **Step 4:** тесты PASS; `npm run typecheck` чист.
- [ ] **Step 5: Коммит** `Персоны: глубокая, читающая и пробующий режим`.

### Task 2: Граф положений и мерила глубины

**Files:**
- Create: `src/levels/depth.ts`, `src/levels/depth.test.ts`
- Modify: `src/levels/measures.ts` (дописать в конец), `src/levels/measures.test.ts` (дописать; нет — создать)

**Interfaces:**
- Consumes: `DEEP`, `READER`, `RANK_PERSONAS`, `explorerOf`, `personaRun` (задача 1); `movesAt`, `playMove`, `tellMove`, `solveFrom`, `solveLevel`, `moveOf`, `SolverMove` из `src/rules/levelSolver.ts`; `levelDeadEnd`, `floorLost`, `levelStuck` из `src/rules/level.ts`; `scan` из `src/rules/reach.ts`.
- Produces, `src/levels/depth.ts`:
  - константы `DEPTH_SLACK = 3`, `DEPTH_MAX_STATES = 150_000`, `WAYS_CAP = 200`, `LONG_PATHS_CAP = 300`, `LOSS_SOLVES = 400`, `LOSS_SOLVE_STATES = 50_000`.
  - `interface Depth { par: number; forks: number; ways: number; waysLong: number; slack: number; lossAt: number | null; lostShare: number; complete: boolean; waysCapped: boolean; lossSampled: boolean }`
  - `depthOf(spec: LevelSpec, opts?: { par?: number; maxStates?: number }): Depth` — `par` по умолчанию `spec.par`, а без него — решателем.
  - `canonicalWay(spec: LevelSpec, way: readonly SolverMove[]): string` — ключ пути с точностью до перестановки независимых ходов и симметрии доски.
  - `symmetriesOf(spec: LevelSpec): number[]` — номера преобразований из восьми (порядок `turns` в `src/levels/variety.ts`), при которых клетки костей, их верхи, старт и вырезы переходят в себя; 0 (тождество) всегда в списке.
- Produces, `src/levels/measures.ts`:
  - `hiddenOf(spec: LevelSpec, way?: readonly SolverMove[]): number` — путь по умолчанию `spec.solution`, без него — решателя (`solveLevel`), без решения — 0.
  - `type Shares = Partial<Record<RankName, number>>`; `rankShares(spec: LevelSpec, runs = 30): Shares` — доли hasty, casual, careful, planner всегда, `deep` — только если planner < 0,5.
  - `RANK_SHARE = 0.5`; `rankOf(shares: Shares): number | null` — наименьшая `depth` из `RANK_PERSONAS` с долей ≥ 0,5; `null` — ни одна.
  - `shareOf(spec: LevelSpec, persona: Persona, runs = 30): number`.
  - `interface ExplorerFacts { offPar: number; waysSeen: number }`; `explorerFacts(spec: LevelSpec, name: 'careful' | 'planner', runs = 30): ExplorerFacts` — `offPar` — доля прошедших партий длиннее пара среди прошедших (0 без прошедших), `waysSeen` — число разных `canonicalWay` среди прошедших.

- [ ] **Step 1: Тесты `depth.test.ts`** (доски — `boardOf` из `src/levels/boardSets.ts`), раздел 11 спеки и Review Focus:
  - `R03`: `ways` 1, `forks` ≤ 1, `lossAt` `null`, `lostShare` 0.
  - `P07`: `lossAt` 1 или 2.
  - `tight-room-4`: `ways` 1, `forks` < 6 (его пар); `canonicalWay` пути файла равен `canonicalWay` того же пути с первыми двумя ходами местами.
  - `depthOf(boardOf('finale-1'), { maxStates: 2000 })` — `complete: false`, не бросает, меньше 20 с.
  - `symmetriesOf(boardOf('R03'))` содержит 0 и ещё одно преобразование (зеркало по вертикали); у `tight-room-4` — только `[0]`.
  - `slack` в 0…3 и `waysLong ≥ ways` у `R03`, `P07`, `tight-room-4`.
- [ ] **Step 2: Тесты `measures.test.ts`:** `hiddenOf(boardOf('hidden-face-1'))` — 1; `hiddenOf` у `fixed-wall-1` не считает фиксированную кость (равен счёту по нефиксированным, ушедшим на пути); `hiddenOf` у доски без `solution` (та же `hidden-face-1` без `solution`, `par`, `exact`) — 1; `rankOf({ hasty: 0.2, casual: 0.6 })` — 2; `rankOf({ hasty: 0, casual: 0, careful: 0, planner: 0.4, deep: 0.3 })` — `null`; `rankOf({ hasty: 0, casual: 0, careful: 0.1, planner: 0.2, deep: 0.5 })` — 8; `explorerFacts(boardOf('R03'), 'careful', 5).waysSeen` ≥ 1.
- [ ] **Step 3:** `npx vitest run src/levels/depth.test.ts src/levels/measures.test.ts` — FAIL.
- [ ] **Step 4: `depth.ts`.** Порядок, которого спека не задаёт:
  1. **Граф.** Обход в ширину от старта до глубины `par + DEPTH_SLACK`, не больше `maxStates` положений; держится только фронт положений (`RunState`), у каждого положения — `far`, рёбра `{ move, to }` (`to` = −1 — ход очищает доску), конец `end`: `count`/`floor`, если после хода `over` (как в `explore` из `levelSolver.ts`), или `floorLost`, или `levelDeadEnd(state) !== null`, или ходов нет. Имя положения — как `nameOf` решателя: кости по клеткам (верх, север, `state`, `t`, `hold`, `fixed`, метка группы по порядку встречи) и места игрока `scan(state).places` (шаги бесплатны). Положение снова получается проигрыванием пути от старта по родителям (`playMove`), не хранится. Достигнут предел — `complete: false`, мерила — по увиденному.
  2. **`toClear`** — обратный обход от очищающих рёбер. `par` графа = `toClear[0]`; если он не равен переданному `par` (граф неполон), мерила путей считаются по `toClear[0]`, а `complete` — `false`.
  3. **`ways`.** Пути по рёбрам с `toClear[to] = toClear[from] − 1` от старта к −1; перечисление в глубину до `WAYS_CAP` путей (`waysCapped`, если оборвано); `ways` — число разных `canonicalWay`.
  4. **`waysLong`, `slack`.** Простые пути (положение не повторяется) длины ≤ `par + DEPTH_SLACK`: из `u` на глубине `m` идти в `v`, если `v` не на пути и `m + 1 + toClear[v] ≤ par + DEPTH_SLACK` (`toClear[v] ≥ 0`); перечисление до `LONG_PATHS_CAP`; `waysLong` — разных ключей (не больше `WAYS_CAP`). `slack` — наименьшее `k` в 0…3, при котором пути длины ≤ `par + k` — больше половины разных путей.
  5. **Потеря.** Положение потеряно, если у него `end`, или оно раскрыто, очищающего ребра нет и все рёбра ведут в потерянные (неподвижная точка снизу вверх). Положения на глубине ≤ `par` с `toClear` −1, о которых граф не сказал, решаются `solveFrom(state, { maxStates: LOSS_SOLVE_STATES })`: потеряно, если `exhausted` и решения нет; сдавшийся решатель — не потеряно. Решений не больше `LOSS_SOLVES` на доску, по глубинам от меньшей; кандидатов больше — берётся каждый n-й по порядку обхода, `lossSampled: true`, доля — по взятым. `lossAt` — наименьшая глубина потерянного положения (1…`par`), `null` — нет. `lostShare` — доля потерянных среди положений глубины 1…`par`.
  6. **`forks`.** Положения на кратчайших путях (`far + toClear = par`); у каждого ходы-хранители (ведут в `toClear − 1` или очищают при `toClear` 1) и правдоподобные: ход правдоподобен, если доска после него не потеряна в пределах двух ходов — `lostWithin(v, 2)`, где `lostWithin(v, 0) = end(v) ≠ null`, `lostWithin(v, k) = end(v) ≠ null || (у v нет очищающего хода и все ходы из v ведут в w с lostWithin(w, k − 1))`. Развилка — правдоподобных ≥ 2 и хранитель ровно один. Каждое положение — один раз.
  7. **`canonicalWay`.** Сначала перестановки: ходы разных костей на соседних местах переставимы, если из положения перед ними оба порядка можно сыграть, после обоих порядков одно имя положения и ни один из двух ходов в обоих порядках ничего не запустил иначе (`tellMove(...).outcome`). Форма Фоаты жадно: первый шаг — все ходы, которые проходят перестановками в начало; шаг — множество; дальше — с положения после шага. Потом симметрия: ключ — наименьшая из записей `T(шаги)` по `T` из `symmetriesOf`, ход записывается `moveText` с клеткой и стороной, повёрнутыми `T`, внутри шага — по алфавиту, шаги через `|`.
- [ ] **Step 5: `measures.ts`.** `hiddenOf`: играет путь `tellMove`, для каждой кости запоминает верх в миг, когда она стала `sinking` (как `decoyOf`); кость пропускается, если `fixed`; грань не видна, если её нет среди `top`, `south`, `east` начальной ориентации этой кости (кости `createRun` — в порядке `layout.dice`, сверять по клетке старта). Заслонение не считается (раздел 10, пункт 4). `explorerFacts` — `personaRun(spec, explorerOf(name), seed)` для зёрен 1…runs.
- [ ] **Step 6:** тесты PASS; `npm run typecheck` чист. Время: `npx vitest run src/levels/depth.test.ts` — не больше 15 с; иначе — снизить пределы в тестах, не в константах.
- [ ] **Step 7:** временным скриптом (в `scripts/_probe.mjs`, удалить до коммита) напечатать `depthOf` и `hiddenOf` для мест 50, 55, 74, 76, 89, 100 и время каждого; числа и время — в отчёт задачи (нужны задаче 7).
- [ ] **Step 8: Коммит** `Мерила глубины: развилки, пути, потеря, чтение, rank`.

### Task 3: Подпись и похожесть

**Files:**
- Create: `src/levels/needs.ts`, `src/levels/signature.ts`, `src/levels/signature.test.ts`
- Modify: `src/levels/grammar.ts` (`needsOf` переезжает в `needs.ts`; `grammar.ts` делает `export { needsOf } from './needs'`, прочие импорты не меняются)

**Interfaces:**
- Consumes: `needsOf` (теперь `src/levels/needs.ts`), `scoreOf`, `goalFaces` (`src/levels/goalFaces.ts`), `hiddenOf` (задача 2), `SIMILAR_PAIRS`, `UNLIKE_PAIRS` (задача 0).
- Produces, `src/levels/signature.ts`:
  - `interface Core { kind: Score['kind']; route: string; needs: string[]; faces: number[] }` — `needs` и `faces` отсортированы, `faces` — `goalFaces` без 1.
  - `coreOf(spec: LevelSpec): Core` — путь из `spec.solution`, без него — решателя, без решения — пустой путь (`kind` `top`, `route` `''`).
  - `coreKey(core: Core): string` — шесть шестнадцатеричных знаков (FNV-1a 32 от `JSON.stringify(core)`), столбец `sig`.
  - `type ShapeClass = 'rect' | 'L' | 'corridor' | 'pocket' | 'cross' | 'other'`; `shapeClassOf(spec: LevelSpec): ShapeClass` — по клеткам без вырезов; правило отнесения — исполнителю, записать комментарием.
  - `interface Signature extends Core { dice: number; shape: ShapeClass; holes: number; hidden: number; forks: number | null; pattern: string }`; `signatureOf(spec: LevelSpec, forks: number | null = null): Signature` — `pattern` — наименьшая запись клеток костей и старта по восьми поворотам и сдвигу (как `shapeOf` в `variety.ts`, старт помечен, без граней и вырезов).
  - `CORE_WEIGHTS = { route: 0.4, needs: 0.3, faces: 0.2, kind: 0.1 }`; `coreSim(a: Core, b: Core): number` — путь: 1 − расстояние Левенштейна по знакам `route` / наибольшая длина (оба пустые — 1); приёмы и грани — Жаккар (оба пустые — 1); `kind` — 1 или 0.
  - `layoutSim(a: LevelSpec, b: LevelSpec): number` — лучшее наложение по восьми преобразованиям `b` и всем сдвигам: (совпавшие клетки костей + 1, если совпал старт) / (наибольшее число костей + 1). `sameBoard(a, b)` → 1.
  - `similarity(a: LevelSpec, b: LevelSpec): number` = `max(coreSim(coreOf(a), coreOf(b)), layoutSim(a, b))`.
  - `SAME_LAYOUT = 0.9`, `SIMILAR_ROW = 0.7`, `SIMILAR_NEAR = 0.5`.

- [ ] **Step 1: Тесты.** `coreOf` у `act-k25` и `roll-in-transfer-1` (пример правила 16 спеки) — печатать в сообщении `expect`, сравнить друг с другом; `layoutSim(x, x)` — 1 для `R03`, `finale-1`; `layoutSim` симметричен на пяти парах ряда; `coreOf` у `hidden-face-1` без `solution` не бросает; `signatureOf(boardOf('fixed-wall-1')).dice` — число всех костей с фиксированными. **Калибровка раздела 5:** для каждой пары `SIMILAR_PAIRS` максимум `similarity` по кодам `b` ≥ `SIMILAR_ROW`, для `UNLIKE_PAIRS` — ≤ `SIMILAR_NEAR`; тест собирает промахи списком и требует `misses.length < 3` (спека: «не сходится по трём и более парам — состав ядра и веса меняются»); сами промахи — в `KNOWN_SIMILARITY_MISSES` (литерал в тесте) и проверяются равенством, чтобы список не устарел.
- [ ] **Step 2:** `npx vitest run src/levels/signature.test.ts src/levels/grammar.test.ts` — FAIL (нет модуля).
- [ ] **Step 3: Реализация** по интерфейсам выше.
- [ ] **Step 4: Подбор.** Если промахов калибровки три и больше — менять состав ядра (например, сжимать в `route` повторы одного знака, брать в `faces` и 1, сравнивать путь по множеству знаков) и веса `CORE_WEIGHTS`, пока не сойдётся. Каждую попытку и её промахи — в отчёт задачи; что принято — комментарием у `CORE_WEIGHTS`.
- [ ] **Step 5:** тесты PASS (`grammar.test.ts` тоже — переезд `needsOf` ничего не меняет); `npm run typecheck`.
- [ ] **Step 6: Коммит** `Подпись доски и похожесть: ядро мысли и рисунок раскладки`.

### Task 4: Правила 16 и 17

**Files:**
- Modify: `src/levels/grammar.ts`, `src/levels/grammar.test.ts`, `src/levels/table.ts` (`grammarText`)

**Interfaces:**
- Consumes: `coreOf`, `layoutSim`, `similarity`, `SAME_LAYOUT`, `SIMILAR_ROW`, `SIMILAR_NEAR` (задача 3).
- Produces:
  - `Violation['rule']` получает 16, 17, 18; `HELD` — `[1, 2, 3, 5, 7, 12, 16]`.
  - `REPEAT_FROM = 31`.
  - `repeatsOf(row: readonly Stop[]): Violation[]` — правило 16 (держит) и 17 (`warning: true`), входит в `fastGrammar`.
  - `KNOWN_REPEATS: readonly string[]` — тексты нарушений правила 16 на ряду 0.2.88, литералом; `knownRepeat(one: Violation): boolean`.
  - `grammarText` печатает известный повтор с хвостом ` (известный повтор)`.

- [ ] **Step 1: Тесты.**
  - На ряде из `rowOf` (как в `grammar.test.ts`) из 31 места, где 31-е — та же доска, что 29-е, повёрнутая (`turnedBoard` из `src/levels/edits.ts`): одно нарушение правила 16 на месте 31 с текстом `места 29 (<код>) и 31 (<код>): одна раскладка`. Место ниже 31 правило не судит.
  - Правило 16 по ядру — текст вида `места 74 (act-k25) и 76 (roll-in-transfer-1): одна мысль — K L, glass link, грани 2 3` (знаки `route`, приёмы через пробел, грани через пробел; у реального ряда — каков выйдет).
  - Правило 17 — одна строка на место (худшая из двух частей), `warning: true`.
  - `fastGrammar(CAMPAIGN).filter(held).filter((one) => !knownRepeat(one))` — `[]`; каждый текст `KNOWN_REPEATS` есть среди `fastGrammar(CAMPAIGN)`.
  - `[...HELD]` — `[1, 2, 3, 5, 7, 12, 16]` (прежний тест «prints what it does not hold yet» поправить).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реализация.** `repeatsOf`: для каждого места с номером ≥ `REPEAT_FROM` — каждое прежнее место: равное ядро (`JSON.stringify(coreOf)`) или `layoutSim ≥ SAME_LAYOUT` → правило 16, одна строка на пару; правило 17 — наибольшая `similarity` к прежним ≥ `SIMILAR_ROW` или к пяти прежним ≥ `SIMILAR_NEAR`, одна строка на место с номером и кодом ближайшего и числом с двумя знаками. Ядра и подписи считать один раз на место.
- [ ] **Step 4:** запустить тест, собрать фактические нарушения правила 16 на `CAMPAIGN` в `KNOWN_REPEATS` (комментарий: «ряд 0.2.88 до пересборки, спека инструментов прогрессии, раздел 11, шаг 2: не чинить»). Сверить с `OWNER_REPEATS` (задача 0): сколько его мест названо правилами 16–17, сколько нет, сколько названо сверх — в отчёт задачи.
- [ ] **Step 5:** тесты PASS; `npm test` — PASS целиком (правило 16 держит ряд — мастерская видит его строки через `fastGrammar`, `src/lab/workshopRow.ts` не правится).
- [ ] **Step 6: Коммит** `Правила 16–17: повтор мысли и раскладки, известные повторы`.

### Task 5: Шкала `D`, правило 18, медленные части 5 и 8, правило 1

**Files:**
- Create: `src/levels/scale.ts`, `src/levels/scale.test.ts`
- Modify: `src/levels/grammar.ts`, `src/levels/grammar.test.ts`

**Interfaces:**
- Produces, `src/levels/scale.ts`:
  - `interface DFacts { rank: number | null; forks: number; hidden: number; lossAt: number | null; par: number }`
  - `RANK_BASE: Readonly<Record<1 | 2 | 3 | 5 | 8, number>> = { 1: 1.5, 2: 3.5, 3: 5.5, 5: 7.5, 8: 9.5 }`, `rank` `null` → 10.
  - `difficulty(facts: DFacts): number` — база по `rank` + `forks`: +0,5 за развилку сверх двух, до +2; `hidden`: +0,5 за кость сверх одной, до +1; `lossAt` ≤ 2: +1, > 5: −0,5; `par` > 8: +0,5 за каждые два хода сверх восьми (`Math.floor((par − 8) / 2) * 0.5`); в 1…10, до половины.
  - `interface Band { from: number; to: number; lo: number; hi: number; peak: readonly [number, number] }`; `BANDS: readonly Band[]` — таблица раздела 7: 31–40 3–4 пик 5–5; 41–50 4–5, 6–6; 51–60 5–6, 7–7; 61–70 6–7, 8–8; 71–80 7–8, 8–9; 81–90 7–9, 9–9; 91–100 8–9, 10–10.
  - `bandOf(number: number): Band | null` (до 31-го — `null`).
- Produces, `src/levels/grammar.ts`: `SlowFacts` получает `d?: number`; `slowGrammar` добавляет (все `warning: true`, только для мест ≥ 31 и только где у места и соседа есть `d`):
  - правило 18: обычное место вне `lo…hi` своего десятка; пик (`role: 'peak'`) вне `peak`; передышка (`role: 'rest'`) не на 2 ниже обоих соседей или ниже 4 после 50-го; больше одной передышки в десятке; «подарок из начала» — `D` ≤ 2 после 40-го, ≤ 3 после 50-го; рост к соседу больше 2, если сосед не пик; средний `D` десятка ниже среднего предыдущего десятка (с 41–50);
  - правило 5, часть на `D`: место после встречи выше `D` встречи + 1;
  - правило 8, часть на `D`: место после пика не ниже `D` пика.
  - правило 1 (быстрая и медленная части): после 30-го места достаточно одного применения из трёх, после 60-го первая часть не проверяется; вторая часть (две встречи рядом) — как была.

- [ ] **Step 1: Тесты `scale.test.ts`:** `difficulty({ rank: 1, forks: 0, hidden: 0, lossAt: null, par: 3 })` — 1,5; `{ rank: 5, forks: 6, hidden: 3, lossAt: 1, par: 12 }` — 10 (7,5 + 2 + 1 + 1 + 1 = 12,5 → 10); `{ rank: 3, forks: 3, hidden: 1, lossAt: 7, par: 9 }` — 5,5; `{ rank: null, … }` — 10 при прочих нулях; `bandOf(30)` — `null`, `bandOf(55)` — `{ from: 51, to: 60, lo: 5, hi: 6, peak: [7, 7] }`.
- [ ] **Step 2: Тесты `grammar.test.ts`:** на `rowOf` из сорока мест с заданными `d` в фактах — нарушение полосы на 35-м при `d` 6; передышка на 38-м при `d` 3 и соседях 4 — нарушение («не на 2 ниже»); после встречи на 33-м (`d` 3) место 34 с `d` 5 — правило 5; после пика — правило 8; все — `warning: true`, `held` — `false`; места до 31-го без строк. Правило 1: доска с `teaches` на 45-м и одним применением в трёх следующих — без нарушения; на 25-м — нарушение, как было; на 65-м и ноль применений — без нарушения.
- [ ] **Step 3:** FAIL.
- [ ] **Step 4:** реализация.
- [ ] **Step 5:** тесты PASS; `npm test` PASS (тест «holds on the row of step 1 with the facts ladder campaign measured on 14 October 2026» — фактов `d` там нет, значит новых строк нет).
- [ ] **Step 6: Коммит** `Шкала D и полосы по десяткам: правило 18, части 5 и 8 на D`.

### Task 6: Кэш медленных мерил, таблица `ladder campaign`, `row.mjs report`

**Files:**
- Create: `src/levels/measureCache.ts`, `src/levels/measureCache.test.ts`, `scripts/measureCache.mjs`, `boards/.measures/` (файлы — после холодного прогона, задача 7)
- Modify: `src/levels/table.ts`, `src/levels/table.test.ts` (если есть; нет — тесты в `measureCache.test.ts`), `scripts/ladder.mjs` (ветка `road`/`campaign`), `scripts/row.mjs` (`report`)

**Interfaces:**
- Consumes: всё из задач 1–5.
- Produces, `src/levels/measureCache.ts`:
  - `MEASURES_VERSION = 1` (поднимать при правке персон, решателя, мерил).
  - `cacheKey(spec: LevelSpec, teaches?: Technique): string` — `<16 шестнадцатеричных знаков>-<MEASURES_VERSION>`: FNV-1a 64 (`BigInt`) от `JSON.stringify(normalSpec({ ...spec, id: '' }))` (`normalSpec` из `src/levels/boardFile.ts`) и `teaches`.
  - `interface SlowMeasures { road: { firsts: number; worst: number; lost: number; boards: number; capped: boolean }; facts: SlowFacts; shares: Shares; reader: number; explorer: { careful: ExplorerFacts; planner: ExplorerFacts }; depth: Depth; hidden: number; states: number }` — только JSON-значения (`SlowFacts` без `d`).
- Produces, `src/levels/table.ts`:
  - `slowMeasuresOf(spec: LevelSpec, teaches: Technique | undefined, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS): SlowMeasures` — `slowFactsOf` (без своих persona-прогонов planner и casual: доли берутся из `rankShares`), `walkBoards`, `firstsOf`, `rankShares`, `shareOf(spec, READER)`, `explorerFacts`, `depthOf`, `hiddenOf`, `solveLevel(...).states`.
  - `dOf(spec: LevelSpec, m: SlowMeasures): number` — `difficulty({ rank: rankOf(m.shares), forks: m.depth.forks, hidden: m.hidden, lossAt: m.depth.lossAt, par: spec.par ?? 0 })`.
  - `CAMPAIGN_HEAD = [...ROAD_HEAD, 'D', 'rank', 'forks', 'loss', 'hid', 'ways', 'reader', 'sig']`; `campaignRow(number: number, spec: LevelSpec, role: string, m: SlowMeasures): string[]` — столбцы `ROAD_HEAD` из `m` (как `roadRow`, без пересчёта), `D` — `dOf`, `rank` — число или `>8`, `forks`, `loss` — `${lossAt ?? '-'} ${Math.round(lostShare * 100)}%` (`~` у выборки), `hid`, `ways` — `${ways}/${waysLong}` (`+` у оборванного или неполного графа), `reader` — процент, `sig` — `coreKey(coreOf(spec))`.
  - `campaignNotes(stops: readonly Stop[], measures: readonly SlowMeasures[]): string` — под таблицей: строки «одна дорога» (места после 50-го с `waysLong` 1), сводка калибровки раздела 6 (по `D_ROWS`: на строку — коды, `D`, сколько вне полосы и среднее отклонение; строка расходится, если среднее отклонение от полосы больше 1; итог «сходится» или «не сходится: N строк») и раздела 5 (промахи пар), и сколько мест вне полосы `D` по десяткам.
- Produces, `scripts/measureCache.mjs`: `readMeasures(root, key)` → объект или `null`; `writeMeasures(root, key, measures)` — `boards/.measures/<key>.json`, JSON с отступом два пробела и `\n` в конце.

- [ ] **Step 1: Тесты** (`measureCache.test.ts`): `cacheKey` одной доски с другим `id` — тот же; с повёрнутой одной костью (`top`) — другой; с другим `teaches` — другой; кончается на `-1`. `campaignRow` на доске `R03` с собранными руками `SlowMeasures` даёт строку длины `CAMPAIGN_HEAD.length`, `rank` 1 → `'1'`, `rank` `null` → `'>8'`. `dOf` совпадает с `difficulty` на тех же фактах.
- [ ] **Step 2:** FAIL; реализация; PASS.
- [ ] **Step 3: `ladder.mjs campaign`.** Мастер: для каждого места `cacheKey(stop.spec, stop.teaches)`; есть файл — берёт; нет — место идёт воркерам (`shareOut`), воркер печатает `{ index, measures: slowMeasuresOf(...) }`, мастер пишет файл. Затем `campaignTable` (= `layOutRows([CAMPAIGN_HEAD, ...rows])`), `campaignNotes`, и `grammarText` от `fastGrammar` + `slowGrammar` с фактами `{ ...m.facts, d: dOf(...) }`. Ключ `fresh` (флаг) — считать заново, не читая кэш. `road` — как был. Комментарий в голове файла дописать.
- [ ] **Step 4: `row.mjs report`.** `placeRow` дополняется столбцами `CAMPAIGN_HEAD` сверх `ROAD_HEAD` из кэша того же ключа; нет файла — считает и пишет. `PLACE_HEAD` — `[...CAMPAIGN_HEAD, 'near', 'whole']`.
- [ ] **Step 5:** проверка на трёх местах: `node scripts/row.mjs report place=3`, затем то же — второй раз быстрее чем за 5 с (кэш тёплый); удалить три файла кэша, если задача 7 ещё не шла (задача 7 кладёт все сто).
- [ ] **Step 6:** `npm run typecheck`, `npx vitest run src/levels`.
- [ ] **Step 7: Коммит** `Кэш медленных мерил; ladder campaign и row report — D, rank, ways`.

### Task 7: Холодный прогон, калибровка `D`, таблица ста

**Files:**
- Create: `boards/.measures/*.json` (сто файлов)
- Modify: `src/levels/scale.ts` (если калибровка требует), `docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md` (раздел 12)

- [ ] **Step 1:** холодный прогон в фоне: `node scripts/ladder.mjs campaign fresh > <scratchpad>/campaign-cold.txt` (`run_in_background`; ожидаемо 1,5–3 часа на шести процессах). Пока идёт — задача 8.
- [ ] **Step 2:** тёплый прогон: `node scripts/ladder.mjs campaign`, время — не больше 15 минут (ожидаемо меньше минуты). Время записать.
- [ ] **Step 3: Калибровка раздела 6.** По сводке `campaignNotes`: если расходятся три строки и больше — править `RANK_BASE` (в пределах полос спеки: rank 1 → 1–2, 2 → 3–4, 3 → 5–6, 5 → 7–8, 8 → 9–10) и поправки (`forks`, `hidden`, `lossAt`, `par`), повторять тёплый прогон (кэш мерил формулы не держит), пока не сойдётся или пока ясно, что мерила не различают строки (например, `rank` один у всех мест 48–100). Править тест `scale.test.ts` вместе с формулой. Каждая попытка — в отчёт.
- [ ] **Step 4: Раздел 12 спеки** «Что вышло иначе»: таблица ста мест (номер, код, `D`, `rank`, `forks`, `loss`, `hid`, `ways`, `reader`, `sig`); что напечатали правила 16–18 (число строк каждого правила, список правила 16); совпадение правил 16–17 со списком владельца (`OWNER_REPEATS`): названы, не названы, сверх; калибровка 5 и 6 — сошлась или что не сошлось; число мест вне полос `D` по десяткам; отступления плана (персоны вне `PERSONAS`, модель ошибки чтения, правила 16–17 с 31-го, `depth.ts` и прочие новые файлы, что ещё вышло); время холодного и тёплого прогона.
- [ ] **Step 5:** `node scripts/docs-check.mjs`, `npm test`.
- [ ] **Step 6: Коммит** `Таблица ста по мерилам: кэш мерил, калибровка D, раздел 12`.

### Task 8: Строка мерил в мастерской

**Files:**
- Modify: `src/lab/labFacts.ts` (`Later`, `laterOf`), `src/lab/checkLines.ts`, `src/lab/checkLines.test.ts`, место, где мастерская знает ряд и доску ряда (`src/lab/workshopFacts.ts`, `src/lab/workshopCampaign.ts` — найти, откуда `checkLines` зовётся и где доступен `CAMPAIGN`/ряд страницы)

**Interfaces:**
- Consumes: `depthOf`, `rankShares` (`runs = LATER_RUNS`), `rankOf`, `hiddenOf`, `difficulty`, `similarity`.
- Produces: `Later` получает `measures: { d: number; rank: number | null; forks: number; hidden: number; ways: number; waysLong: number; complete: boolean }`; `checkLines(instant, seconds, later, near?: readonly { number: number; code: string; sim: number }[])` — строка `мерила: D 5.5, rank 3, развилок 2, скрыто 1, путей 2/5` (с `+` у неполного графа) после строки ботов; при `near` — строка `похожесть: 54 bridge-5 0.31, 53 … ; ближе всех — 29 floor-first-1 0.82` (пять прежних мест ряда и самое похожее из всех прежних).

- [ ] **Step 1: Тесты `checkLines.test.ts`:** строка мерил печатается из `Later` с `measures`; `rank` `null` — `rank >8`; строка похожести — только когда `near` дан.
- [ ] **Step 2:** FAIL; реализация; похожесть считает страница (быстро) по ряду, который она собрала, только для доски ряда; PASS.
- [ ] **Step 3:** `npx vitest run src/lab`, `npm run typecheck`, `npm run build`.
- [ ] **Step 4: Коммит** `Мастерская: строка D, rank, развилок и похожесть к соседям`.

### Task 9: Документы, план в историю, пуш

**Files:**
- Modify: `docs/VI_Levels_Lab.md` (шапка «Что живёт в коде» — новые файлы; раздел 2 — абзац о мерилах глубины и кэше `boards/.measures/` с `MEASURES_VERSION` и флагом `fresh`; раздел 4 — строки «мерила» и «похожесть» мастерской; раздел 16 — правила 16–18, части 5 и 8 на `D`, правило 1 после 30-го и 60-го, столбцы `ladder campaign` и `row.mjs report`), `docs/VI_Puzzle_Principles.md` (раздел 4, «Чем мерить»: вместо «моё, не подтверждено» — мерила раздела 3 спеки инструментов и шкала `D`, со ссылкой), `docs/VI_Devil_Dice_Puzzles_Research.md` (только шапка: решение владельца 28 октября — камень → фиксированная кость, лёд не берётся, ссылка на спеку инструментов, раздел 2; тело исследования по правилам CLAUDE.md не правится — сказать это в разделе 12 спеки), `docs/ROADMAP.md` (строка «Кампания»: инструменты построены, дальше — таблица владельцу и спека пересборки 31–100), `docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md` (шапка: «построено 28 октября 2026, v0.2.88»; «Что живёт в коде» — фактические файлы), `docs/README.md` (строка спеки — статус; строка плана убирается из таблицы уровней и уходит в «В истории git» с коммитом, где план лежит последним)
- Delete: `docs/superpowers/plans/2026-10-28-vi-progression-tools.md`

- [ ] **Step 1:** правки документов; `node scripts/docs-check.mjs` — «расхождений нет».
- [ ] **Step 2:** коммит документов **с планом ещё в дереве** (`Документы инструментов прогрессии: лаборатория, принципы, ROADMAP`); его хеш — последний, где план лежит.
- [ ] **Step 3:** `git rm` плана, строка в «В истории git» индекса: `docs/superpowers/plans/2026-10-28-vi-progression-tools.md | план инструментов прогрессии, выполнен (v0.2.88); что вышло иначе — раздел 12 спеки; достать — git show <хеш шага 2>:<путь> | спека progression-tools-design`; `node scripts/docs-check.mjs`; коммит `План инструментов прогрессии — в историю`.
- [ ] **Step 4:** `git fetch`, `git rebase origin/main`, `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs` — все чисты; `git push origin HEAD:main`.

Версия: игра этой работой не меняется (персоны, мерила, правила ряда, мастерская — инструменты; сборка для игрока та же), `package.json` уже 0.2.88 — не поднимать.
