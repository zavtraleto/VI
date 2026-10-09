# VI — боты: два семейства

> Вид: решение. Статус: построено (v0.2.21, 0777bb1; 6da35b5). Дата: 2026-10-07. Проверено: 2026-10-08.
> Что заменило: —. Что живёт в коде: src/rules/levelBot.ts, src/rules/paceBot.ts, scripts/bots.mjs, scripts/pace.mjs.
> Верен раздел 12: команды `climb=on`, `level=P06` (в тексте остались `climb=off`, `level=B13`).

Дата: 7 октября 2026 · Статус: принята владельцем 7 октября («годится! делай ботов») и собрана в тот же день. Что при сборке вышло иначе, чем здесь написано, — раздел 12; где раздел 12 расходится с остальным текстом, верен он. Исполнитель: Opus. Область: `src/rules`, `src/levels`, `scripts`, `docs`.

Откуда: [VI_Levels_Routes_Brief.md](../../VI_Levels_Routes_Brief.md) — решения владельца по уровням, новые правила пола, формы и маршруты, замеры. Эта спека делает инструменты; сами уровни собирают следующие чаты по разделу 11 той страницы.

Рабочее дерево: `.claude/worktrees/bots`, ветка `worktree-bots` от `origin/main` (`4451cc5`, версия 0.2.21).

## 1. Что решено

Слова владельца, 7 октября:

- «Раздели ботов для endless и для levels. У каждого получаются свои правила, поэтому они должны играть по-разному и совершенно по-разному относиться к прохождению.»
- «Endless — реалтайм, быстрые решения. Levels — головоломка, планирование на несколько ходов вперёд и общий темп без давления времени (давят ходы).»
- «Боты для levels должны помогать с генерацией уровней, иначе мерить прогоны, иначе подходить к игре. Боты для endless — быстрые, решительные, реалтаймовые.»
- «Пиши сразу несколько типов ботов для того и для другого. Сам пойми, какие лучше подходят.»
- Боты уровней играют по новым правилам пола: полочки нет, подъёма на кость нет. «Подъём с пола на кость у края — только в endless режиме.»

Что из этого следует:

| | Боты уровней | Боты Endless |
|---|---|---|
| Единица действия | ход (перекат или толчок); шаги бесплатны | шаг в реальном времени, тик за тиком |
| Чем отличаются между собой | знанием и глубиной плана | тем, как далеко видят, как быстро двигаются и чего хотят |
| Зачем нужны | строить и отбирать уровни | настраивать темп и счёт |
| Что меряют | проходимость, обязательность приёма, обходы, трудность, места тупиков | сколько живёт игрок, как набирает счёт, когда теряет поле |
| Файлы | `levelSolver`, `levelScore`, `levelGraph`, `levelProof`, `levelBot` | `bot`, `paceBot` |

Ни один файл одного семейства не ссылается на файл другого.

Не меняется: правила Endless, сеанса дня, упражнения и задач; `RULES_VERSION` остаётся `0.9`; уровни в [src/levels/levels.ts](../../../src/levels/levels.ts); пять нынешних игроков Endless играют как играли (раздел 5.1).

## 2. Что есть сейчас

**Endless.** [src/rules/bot.ts](../../../src/rules/bot.ts): один игрок. Смотрит на стоящую доску (`findPlans`), находит путь к комбо, идёт по нему теми же командами, что человек, и смотрит снова. Пять ступеней `SKILLS` от `newbie` до `esports`; ступень задаёт всё сразу: глубину взгляда, паузы, промахи, оплошности. [src/rules/paceBot.ts](../../../src/rules/paceBot.ts): прогон и мерила темпа; `node scripts/pace.mjs`.

**Уровни.** [src/rules/levelBot.ts](../../../src/rules/levelBot.ts) смешивает три вещи:

- игрока Endless на уровнях с целью и приходом (`goalBot`, `playLevel`, `levelTable`, `trySeed`, `pickSeed`, `limitFor`) — уровни такого вида отложены;
- мерила досок на очистку, часть которых тоже играет игрок Endless: «жадный» (`GREEDY`, `trapRate`) и «свидетель» (`witnessWay`);
- игроков, думающих ходами: случайного (`randomPlay`) и четыре персоны (`PERSONAS`).

Чего не хватает под новые правила (замер — раздел 3.4 страницы решений): все игроки считают спуск на пол бесплатным. Случайный берёт любой ход, включая те, что требуют сойти. Персоны оценивают доску числом стоящих костей; пол в оценку не входит. Пошаговый игрок Endless рассчитывает на лифт, которого на уровнях нет.

## 3. Боты уровней: состав

| Бот | Что делает | На какой вопрос отвечает | Опора |
|---|---|---|---|
| **Решатель** (есть) | перебирает все пути на настоящих правилах | проходится ли; наименьшее число ходов | — |
| **Партитура** | записывает путь по ходам: что ушло, чем, где стоял игрок | какой формы и какого маршрута уровень | раздел 4 страницы решений |
| **Граф доски** | все положения доски и переходы между ними | сколько разных кратчайших путей; из какой доли положений доска ещё очищается; как рано можно ошибиться | [Sturtevant, Fling!](https://webdocs.cs.ualberta.ca/~nathanst/papers/BFS-design.pdf) |
| **Запретчик** (есть частично) | решает доску с отнятым приёмом или куском маршрута | обязателен ли спуск, толчок, подъём, звено | [Khalifa и др., 2019](https://arxiv.org/pdf/1904.08972) |
| **Обходчик** | ищет путь без куска маршрута, не длиннее задуманного на ход | получит ли игрок задуманное или пройдёт мимо | [Sturtevant, Snakebird](https://webdocs.cs.ualberta.ca/~nathanst/papers/sturtevant2020incremental.pdf) |
| **Редактор** | пробует каждую правку в одну кость и решает заново | какая правка закрывает обход или убирает хвост | [Anhinga](https://webdocs.cs.ualberta.ca/~nathanst/papers/sturtevant2020anhinga.pdf) |
| **Блуждатель** | бродит по графу с уклоном к цели, сотни прогонов | трудность для человека: ходы и перезапуски | [Jarušek и Pelánek](https://cdn.aaai.org/ocs/2518/2518-11200-1-PB.pdf): связь с временем людей 0,76 на Sokoban |
| **Персоны** (переписать) | думают ходами на свою глубину, знают правило пола | где ловушки; чем кончаются прогоны; идут ли задуманным маршрутом | [Holmgård и др.](https://arxiv.org/pdf/1802.06881); жадный на шаг вперёд ловится на местную выгоду — [Isaksen и др., 2017](https://gfx.cs.princeton.edu/pubs/Isaksen_2017_SSA/isaksen-cig17.pdf) |
| **Случайный наверху** | вертит кости, на пол сам не сходит | проходится ли доска наугад | — |

Источники открывал помощник-поисковик; исполнитель их не перечитывал. Мерила «совпадение маршрута» и «доля живых положений» в литературе не найдены: это свои догадки, сверяются с игрой владельца.

## 4. Боты уровней: устройство

### 4.1. Правила, на которые опираются боты

```ts
// src/rules/types.ts, LevelSpec
/** False where a die that cannot be pushed is not climbed from the floor: the only way up is a die that is leaving. Left out, it is climbed. */
climb?: boolean;
```

`levelConfig` в [src/rules/level.ts](../../../src/rules/level.ts): `floorClimb: spec.climb !== false`. Само правило — подъёма на уровнях нет — принято владельцем 7 октября и записано в [VI_Levels_Rules.md](../../VI_Levels_Rules.md), разделы 2, 5 и 7. В игру его вносит задача «Правила пола»: она ставит строгий пол всем уровням и пересчитывает их. Здесь это переключатель с прежним поведением по умолчанию, чтобы ботов можно было проверить на строгом поле, не трогая уровни.

Две чистые проверки в `src/rules/level.ts`, в правила уровня не включённые (`endBeat` их не зовёт):

```ts
/** The player is on the floor with no move to make and dice still standing: nothing to push and nothing to go up by. */
export function floorStuck(state: RunState): boolean;
/**
 * The player is on the floor, nothing is leaving, no step leads up onto a standing die, and for
 * no working face do as many dice show it as its combo takes. A push turns no die, so the board
 * cannot be cleared.
 */
export function floorLost(state: RunState): boolean;
```

Обе читают доску через `scan` из [src/rules/reach.ts](../../../src/rules/reach.ts), поэтому при включённом подъёме сами отвечают «нет». `levelStranded` остаётся как есть.

### 4.2. Запреты решателя

Решатель умеет запрещать приём: `ban` в `SolveOptions` принимает `Technique` (`link`, `glass`, `floor`, `ones`). Добавляются два куска маршрута; в `Technique` они не входят, чтобы `uses` и `needs` прежних уровней не изменились.

```ts
// src/rules/reach.ts
/** What a way can be made to do without: a technique, a push, or the way back up from the floor. */
export type Ban = Technique | 'push' | 'up';
```

- `push` — `scan` не берёт толчки; ходить по полу можно.
- `up` — `scan` не делает шагов с пола наверх (`mount`, `climb`).

`scan`, `movesAt`, `solveLevel`, `solveFrom` принимают `readonly Ban[]`.

### 4.3. Партитура

Новый файл `src/rules/levelScore.ts`.

```ts
/** One move of a way, as a level is told by: what it set off, what it was made with and where the player stood. */
export interface Beat {
  move: SolverMove;
  how: 'roll' | 'push' | 'glass';
  /** Where the player stood once the move before had landed, before any free step. */
  from: 'standing' | 'leaving' | 'floor';
  /** How the player came to the floor since the move before: stepped off, or the die went from under them. */
  down: 'stepped' | 'fell' | null;
  /** The player came up from the floor since the move before. */
  up: boolean;
  /** Made with a die the player stepped to from a leaving one. */
  bridged: boolean;
  event: 'none' | 'combo' | 'link' | 'ones';
  /** The face of what went, 0 with no event; the dice that began to leave. */
  face: number;
  took: number;
  /** Dice standing and dice leaving once the move has landed. */
  standing: number;
  leaving: number;
  /** Moves the leaving dice still had when the link joined: 0 is the last move it could be made on. Null where the move is no link. */
  spare: number | null;
}

export interface Score {
  beats: Beat[];
  /** Moves before the first event, and from it on. */
  quiet: number;
  counted: number;
  /** Dice the biggest event took, and the last one. */
  biggest: number;
  last: number;
  /** Longest run of moves with no event; moves between the last two events. */
  pause: number;
  tail: number;
  /** Links of the longest chain. */
  chain: number;
  /** The events and the changes of floor in order, quiet moves left out: `K v P ^ K`. */
  route: string;
  kind: 'top' | 'bridge' | 'downLast' | 'downAndUp' | 'other';
}

export function scoreOf(spec: LevelSpec, way: readonly SolverMove[], config?: RulesConfig): Score;
```

Знаки маршрута: `K` — комбо перекатом, `L` — звено, `O` — единицы; `P` — комбо толчком, `Q` — звено толчком, `U` — единицы толчком; `v` — сошёл, `!` — упал, `^` — поднялся, `~` — сошёл с уходящего комбо на другую кость.

Вид маршрута: `top` — пола нет и `~` нет; `bridge` — пола нет, есть `~`; `downLast` — всё, что сделано с пола, идёт после последнего хода сверху; `downAndUp` — есть `^` после хода с пола; `other` — остальное.

`pause` и `tail` считаются так же, как `depth` решателя и `tailOf` из [src/levels/measures.ts](../../../src/levels/measures.ts); тест сверяет их на нынешних уровнях.

### 4.4. Граф доски

Новый файл `src/rules/levelGraph.ts`. Положения именуются так же, как в поиске решателя: нужные для этого `nameOf`, `runOf`, `placeOf` из [src/rules/levelSolver.ts](../../../src/rules/levelSolver.ts) становятся видны соседнему файлу.

```ts
export interface LevelGraph {
  /** Boards seen; false where the search gave up before it had seen them all. */
  states: number;
  complete: boolean;
  /** For every board: the boards its moves lead to, and the fewest moves from it to a cleared board, -1 where there is no way. */
  next: readonly (readonly number[])[];
  toClear: Int32Array;
}

export function graphOf(spec: LevelSpec, opts?: { maxStates?: number; config?: RulesConfig }): LevelGraph;

export interface GraphFacts {
  states: number;
  /** Share of the boards the level is still cleared from. */
  alive: number;
  /** Shortest ways, counted as paths over boards, and no more than a thousand. */
  ways: number;
  /** First moves, and those the board is still cleared after. */
  firsts: number;
  firstsAlive: number;
  /** Fewest moves from the start to a board with no way on: how soon a mistake can be made. -1 where there is none. */
  lostIn: number;
}

/** Null for a graph that is not complete. */
export function factsOf(graph: LevelGraph): GraphFacts | null;
```

Предел по умолчанию — 200 тысяч положений. Доска, чей граф не досчитан, получает `complete: false`: блуждателя и фактов у неё нет, остальные боты работают.

### 4.5. Запретчик и обходчик

Новый файл `src/rules/levelProof.ts`. Сюда переезжает `neededBy`; `levelBot.ts` отдаёт его дальше под прежним именем.

```ts
/** A part of a route a way may lean on. */
export const ROUTE_PARTS: readonly Ban[] = ['link', 'glass', 'ones', 'floor', 'push', 'up'];

export interface Bypass {
  part: Ban;
  /** A way that does without the part and is no more than `slack` moves longer than the fewest; null where there is none. */
  way: SolverMove[] | null;
  /** The search saw every board within its bounds: a null is then a proof. */
  settled: boolean;
}

/** For every part the way leans on, the way round it. `slack` is 1 unless given: within it a pass still takes three stars. */
export function bypassesOf(spec: LevelSpec, way: readonly SolverMove[], opts?: { slack?: number; maxStates?: number }): Bypass[];
```

Какие куски опирает путь, говорит партитура: `link` — есть событие `link`; `glass` — есть ход `glass`; `ones` — событие `ones`; `floor` — есть `v` или `!`; `push` — ход `push`; `up` — есть `^`.

### 4.6. Игроки

`src/rules/levelBot.ts` переписывается. Все игроки ходят ходами через `scan` и `playMove` и останавливают прогон на `floorStuck` и `floorLost`, даже пока правила уровня этого не делают.

```ts
/** How a run ends: the board cleared, a dead end by the count of dice, a dead end on the floor, or still rolling when the moves ran out. */
export type Ending = 'passed' | 'count' | 'floor' | 'limit';
export function endingOf(state: RunState): Ending;
```

**Персоны.** Поля прежние (`depth`, `budget`, `slip`, `counts`); добавляется пятая:

| Персона | Глубина | Позиций | Наугад | Считает кости |
|---|---|---|---|---|
| жадный (`greedy`) | 1 | 40 | 0% | нет |
| спешащий (`hasty`) | 1 | 40 | 12% | нет |
| обычный (`casual`) | 2 | 200 | 8% | нет |
| внимательный (`careful`) | 3 | 1200 | 4% | да |
| планирующий (`planner`) | 5 | 6000 | 2% | да |

Что меняется в игре персон:

- **Правило пола знают все.** В оценке доски: `floorLost` и `floorStuck` — проигрыш, как тупик по счёту. Игрок на полу без шага наверх — минус за каждую стоящую кость с нерабочей гранью: повернуть её нельзя, пока он не поднимется.
- **Ход наугад делается наверху.** Из ходов, не требующих пола, если такие есть. Человек не спрыгивает случайно; упасть он может, собрав комбо, с которого некуда шагнуть.
- **Жадный не оступается** и берёт ход, который прямо сейчас что-то уводит. `trapRate` считает долю его прогонов с исходом `count` или `floor`.
- **Свидетель** для досок, которые решатель не досчитал, — кратчайший из проходов планирующего. Игрок Endless уровням больше не нужен.

```ts
export interface PersonaFacts {
  /** Share of the runs by how they end. */
  endings: Record<Ending, number>;
  /** Of the runs that pass: the middle number of moves over the fewest, and the share that go the route of the level's own way. */
  over: number | null;
  match: number | null;
}
export function personaFacts(spec: LevelSpec, name: PersonaName, runs?: number): PersonaFacts;
```

`match` сравнивает `Score.route` прогона с маршрутом записанного решения уровня; у уровня без решения — `null`.

**Случайный.** `randomPlay(spec, seed, maxMoves, opts?: { floor?: boolean })`: без `floor` берёт только ходы, не требующие пола, пока они есть. `randomRate` считает по нему.

**Блуждатель.**

```ts
export interface Walker {
  /** How much likelier a move that brings the board a move nearer to cleared is than any other. 0 walks at random. */
  bonus: number;
  /** Takes no move onto a board the level is not cleared from while another is there. */
  wary: boolean;
  /** Moves made on a lost board before the run is begun again. */
  patience: number;
}
export const WALKERS = {
  walker: { bonus: 25, wary: false, patience: 6 },
  wary: { bonus: 25, wary: true, patience: 6 },
} as const;

export interface WalkFacts {
  /** Moves to a cleared board, those of the runs begun again counted in; times a run was begun again. Means over the runs. */
  moves: number;
  restarts: number;
  /** Share of the runs cleared at the first go within the moves the level gives. */
  first: number;
}
/** Null for a graph that is not complete. */
export function walkFacts(graph: LevelGraph, walker: Walker, opts?: { runs?: number; limit?: number; seed?: number }): WalkFacts | null;
```

Перезапуск — когда доска стала тупиком по правилам или проверкам пола, либо когда блуждатель сделал `patience` ходов по доске, которая уже не очищается. `bonus: 25` — значение, лучше всего совпавшее с людьми у авторов модели на трёх других головоломках; для VI это стартовое число, а не замер.

### 4.7. Отчёт о доске

```ts
export interface LevelReport {
  par: number | null;
  exact: boolean;
  way: SolverMove[] | null;
  score: Score | null;
  uses: Technique[];
  needs: Technique[];
  bypasses: Bypass[];
  graph: GraphFacts | null;
  walk: Record<keyof typeof WALKERS, WalkFacts> | null;
  traps: number;
  random: number;
  personas: Record<PersonaName, PersonaFacts>;
}
export function report(spec: LevelSpec, opts?: { maxStates?: number; runs?: number }): LevelReport;
```

`measure` и `Measures` остаются с прежними полями, чтобы [src/levels/select.ts](../../../src/levels/select.ts) и [src/levels/table.ts](../../../src/levels/table.ts) работали без правок; считаются они новыми игроками.

### 4.8. Редактор

Новый файл `src/levels/edits.ts`.

```ts
export interface Edit {
  /** What was changed, in words a table can print: `die 2,1 turned to 3`, `die 0,0 moved east`, `start at 1,2`. */
  what: string;
  spec: LevelSpec;
}
/** Every board one change away: a die turned to show another face, a die moved to a free cell beside it, the player started on another die. The way kept and the fewest moves are left out of the copies. */
export function editsOf(spec: LevelSpec): Edit[];
/** The edits a rating takes, the best first. `rate` is given the report of an edited board and says how good it is, or null to turn it away. */
export function probeEdits(spec: LevelSpec, rate: (report: LevelReport, edit: Edit) => number | null, opts?: { maxStates?: number; runs?: number }): { edit: Edit; report: LevelReport; rating: number }[];
```

Оценку задаёт тот, кто зовёт: строителю пробы она нужна своя на каждую форму.

### 4.9. Прежние игроки уровней с целью

`goalBot`, `playLevel`, `skillRates`, `levelTable`, `trySeed`, `pickSeed`, `limitFor`, `percentile`, `LevelPlay`, `SeedTrial` переезжают без изменений в `src/rules/goalBot.ts`, их тесты — в `goalBot.test.ts`. Это игрок Endless на уровнях с приходом; такие уровни отложены. После переезда `levelBot.ts` не ссылается на `bot.ts`.

### 4.10. Скрипт

`node scripts/bots.mjs`:

| Вызов | Что печатает |
|---|---|
| без слов | таблица всех уровней: ходы, маршрут, вид маршрута, хвост, доля живых положений, кратчайших путей, обходы, ловушки жадного, исходы персон, блуждатель |
| `level=B13` | полный отчёт уровня; партитура по ходам |
| `climb=off` | то же на строгом поле: уровням ставится `climb: false` |
| `edits level=B13` | правки в одну кость, меняющие число ходов, маршрут или обходы |
| `runs=40`, `states=400000` | прогонов на персону; предел графа и решателя |

`scripts/ladder.mjs` и `scripts/stars.mjs` работают как прежде.

## 5. Боты Endless

### 5.1. Голова и руки

Ступень игрока сейчас задаёт всё сразу. Ручки разводятся; прежние пять ступеней остаются теми же числами — диагональю сетки.

```ts
// src/rules/bot.ts
/** What a player sees and wants. */
export interface Head { depth: number; rolls: number; budget: number; miss: number; missPerRoll: number; greed: number; tidy: boolean }
/** How fast and how surely a player moves. */
export interface Hands {
  think: readonly [number, number]; thinkPerMove: number; thinkPerCube: number;
  pause: readonly [number, number]; idle: readonly [number, number];
  lapse: number; lapseTicks: readonly [number, number]; slip: number;
  /** How many times likelier a slip and an oversight are with the board at the danger mark than with it calm. 0 keeps them as they are. */
  rush: number;
}
export type Skill = Head & Hands;
export const HEADS: Record<SkillName, Head>;
export const HANDS: Record<SkillName | 'instant', Hands>;
export function skillOf(head: SkillName, hands: SkillName | 'instant'): Skill;
```

- `SKILLS[name]` равен `skillOf(name, name)` с `rush: 0`: пять нынешних игроков играют как играли, тесты и прежние таблицы темпа не меняются.
- `instant` — руки без пауз, промахов и оплошностей: потолок того, что даёт голова.
- **Давление.** `pressure(state)` — от 0 при числе костей не выше нормы поля до 1 на отметке опасности. Доля оплошностей — `slip × (1 + rush × pressure)`, доля проглядов — `miss × (1 + rush × pressure)`, не выше 0,95. В `HANDS` у всех `rush: 0`. Таблица `RUSH: Record<SkillName, number>` держит рекомендованные значения по рукам: 1,5 / 1,2 / 0,8 / 0,4 / 0,2; прогон со словом `rush` берёт их вместо нуля.

Опора: стратегию и исполнение разводят [Isaksen и др., 2017](https://gfx.cs.princeton.edu/pubs/Isaksen_2017_SSA/isaksen-cig17.pdf); там же замер на Tetris — при запасе времени промахов нет, при 0,67 секунды на фигуру разброс больше двух клеток (пять игроков). Значения `RUSH` — прикидка, не замер.

Для кого это: двое опорных игроков владельца. Он сам — видит далеко и двигается быстро; его жена — думает медленно и любит головоломки. Лестница из пяти ступеней второго случая не знает.

### 5.2. Стили

Чего игрок хочет. Крючки `prefer` и `wants` у `Bot` уже есть.

```ts
/** What a player is after, laid over its head. */
export interface Style {
  /** Takes the place of the greed of the head. */
  greed?: number;
  prefer?: Bot['prefer'];
  wants?: Bot['wants'];
}
export type StyleName = 'plain' | 'survivor' | 'builder';
export const STYLES: Record<StyleName, Style>;
/** The bot with the style laid over it: the same bot, changed. */
export function styled(bot: Bot, style: StyleName): Bot;
```

| Стиль | `greed` | `prefer` | `wants` |
|---|---|---|---|
| `plain` | как у головы | нет | нет |
| `survivor` — держит поле низким | 0 | вес пути — число костей, которые уводит комбо (`plan.dice`) | нет |
| `builder` — играет на цепочки | 1 | пока цепочка идёт: звено — вес по номеру звена, отдельное комбо — 0,1. Когда не идёт: 1 и ещё по единице за каждую стоящую кость той же грани вне комбо | грань идущей цепочки |

`Plan` получает поле `dice` — сколько костей уводит комбо; его считает `worth`.

Свидетельств, что живые игроки таких игр делятся на эти стили, не найдено. Стили нужны для одного вопроса: платит ли счёт за цепочки. Если строитель набирает не больше выживальщика, счёт за риск не платит.

### 5.3. Края

- **Никто:** прогон без игрока — что делает с полем сам темп.
- **Потолок:** `skillOf('esports', 'instant')`.

### 5.4. Мерила

`PaceOptions` получает `head`, `hands`, `style`, `rush`, `nobody`; `skill` остаётся и значит диагональ.

| Что | Функция | Вызов скрипта |
|---|---|---|
| Сетка «голова × руки»: секунды и счёт в клетке | `paceGrid` | `node scripts/pace.mjs grid` |
| Стили по ступеням: секунды, счёт, звенья, отношение счёта строителя к счёту выживальщика | `paceStyles` | `node scripts/pace.mjs styles` |
| Выживание: доля прогонов, доживших до каждой минуты, и доля погибших за минуту | `survival` | `node scripts/pace.mjs survival` |
| Края | строки «никто» и «потолок» в обычной таблице | `node scripts/pace.mjs edges` |

Опора для выживания: [Isaksen и Nealen, 2015](https://cdn.aaai.org/ojs/12846/12846-52-16362-1-2-20201228.pdf) — темп меряют кривой гибели по времени; у слабого игрока самый вероятный итог — ноль. Модель того же автора, сверенная с 20 игроками, угадала порядок трудности в 78% случаев.

Не строим сейчас: оценщик доски со взвешенными признаками (нужен, только если упрёмся в скорость прогонов) и игрок, повторяющий ритм ввода людей (нужны записи людей).

## 6. Тесты

Правила и боты проверяются `vitest`, рядом с кодом.

- **Правила:** `climb: false` — с пола в кость у края шаг не делается, с `climb` по умолчанию делается; `floorStuck` и `floorLost` на досках, собранных руками, и «нет» при включённом подъёме.
- **Запреты:** путь с толчком не находится при `ban: ['push']`; путь «вниз и обратно» не находится при `ban: ['up']`.
- **Партитура:** доска на каждый вид маршрута, собранная руками; `pause` и `tail` совпадают с `depth` и `tailOf` на всех уровнях `LEVELS`.
- **Граф:** на малой доске число положений, `toClear` старта равно `par`, `alive`, `lostIn`; доска сверх предела — `complete: false`.
- **Обходчик:** доска, где толчок обязателен, — обхода нет и это доказано; доска, где толчок выгоден, но не нужен, — обход найден.
- **Игроки:** один прогон на один сид; жадный попадает в ловушку, которую планирующий обходит; персона со строгим полом не сходит на пол там, где внизу нечего делать; случайный без `floor` не сходит сам; `match` равен 1 на доске с единственным путём.
- **Блуждатель:** при `bonus: 0` ходов больше, чем при 25; осторожный не перезапускается на доске без тупиков.
- **Редактор:** число правок малой доски; правка не меняет исходный уровень.
- **Endless:** `SKILLS` равны прежним числам; прогон прежнего игрока даёт прежний `PaceRun` (тест «один прогон на один сид» с записанным итогом до правки); `instant` набирает не меньше тех же рук; под давлением оплошностей больше; строитель делает больше звеньев, чем выживальщик; без игрока поле заполняется.
- **Развод семейств:** тест читает импорты и проверяет, что `levelBot`, `levelScore`, `levelGraph`, `levelProof` не ссылаются на `bot` и `paceBot`, и наоборот.

## 7. Документы, в той же правке

- [README.md](../../../README.md): строки о новых файлах в таблице структуры.
- [CLAUDE.md](../../../CLAUDE.md): ссылки на эту спеку и на страницу решений; `node scripts/bots.mjs`.
- VI_Levels_First20_Build.md (в истории git, коммит `7780049`), разделы 5 и 8: пометка, что персоны и мерила описаны здесь.
- [VI_Levels_Routes_Brief.md](../../VI_Levels_Routes_Brief.md): числа раздела 3.4 пересняты `scripts/bots.mjs`.
- [ROADMAP.md](../../ROADMAP.md): строка о ботах.

## 8. Порядок работ

Два плана; второй от первого не зависит и может идти раньше.

**План 1 — боты уровней.**

1. Переезд прежних игроков в `goalBot.ts`; `levelBot.ts` без ссылок на `bot.ts` (свидетель и жадный — персоны).
2. Переключатель `climb`, проверки `floorStuck` и `floorLost`.
3. Запреты `push` и `up`.
4. Партитура и маршрут.
5. Граф и его факты.
6. Игроки: персоны с правилом пола, случайный наверху, исходы, совпадение маршрута.
7. Блуждатель.
8. Запретчик и обходчик.
9. Отчёт о доске и `scripts/bots.mjs`.
10. Редактор.
11. Числа: таблица всех уровней с подъёмом и без; сводка владельцу.

**План 2 — боты Endless.**

1. Голова и руки; `SKILLS` — диагональ с прежними числами.
2. Давление.
3. Стили и поле `dice`.
4. Края, сетка, стили, выживание в `paceBot.ts` и `scripts/pace.mjs`.
5. Числа: сетка, стили и выживание на нынешнем темпе; сводка владельцу.

После каждого плана — `npm test`, `npm run typecheck`, `npm run build`.

## 9. Готово, когда

- Файлы ботов уровней не ссылаются на файлы ботов Endless и наоборот; это проверяет тест.
- `node scripts/bots.mjs` печатает отчёт по каждому уровню `LEVELS` с подъёмом и без него; у каждого уровня есть маршрут и его вид.
- Доля прогонов, кончившихся на полу, у спешащего, обычного и внимательного на 14 нынешних уровнях со строгим полом снята заново и стоит в сводке рядом с прежней (24% / 22% / 17%).
- Обходчик на нынешних уровнях называет, какие куски маршрута обязательны, а какие обходятся в пределах хода.
- Блуждатель даёт число для каждого уровня, чей граф досчитан; сколько уровней не досчитано — сказано.
- Пять прежних игроков Endless дают прежние прогоны; `node scripts/pace.mjs` без слов печатает прежнюю таблицу.
- `node scripts/pace.mjs grid`, `styles`, `survival`, `edges` печатают свои таблицы.
- `npm test`, `npm run typecheck`, `npm run build` проходят.

## 10. Вне этой задачи

- Правило строгого пола в игре, тупики на полу в окне проигрыша, пересчёт уровней — задача «Правила пола».
- Строитель от маршрута, формы как рецепты, проба и её ключ — задача «Проба».
- Необычные поля (клетки, вырезанные из прямоугольника).
- Правка темпа и счёта по числам ботов Endless: боты дают числа, решения принимает владелец.
- Оценщик доски и игрок с ритмом ввода.

## 11. Открыто

1. **Числа блуждателя и давления** (`bonus: 25`, `patience: 6`, `RUSH`) — стартовые. Блуждателя сверяем с записями владельца после пробы; давление — с его игрой и игрой его жены.
2. **Мерило ловушек меняется:** жадный теперь персона, а не игрок Endless. Границы `traps` в рецептах подобраны под прежнего; на 18 учебных уровнях пол закрыт и тупика нет, так что они не затронуты, но рецепты следующих глав надо сверить заново.
3. **Соседний чат** правит `src/levels` и `scripts/ladder.mjs`. Эта задача трогает там только `select.ts` (импорты) и добавляет `edits.ts`; порядок слияния согласовать с владельцем.
4. **Граф на больших досках:** `B08`, `B15`, `B16` при поиске пути видят 80–200 тысяч положений; полный граф у них может не уложиться в предел. Тогда у них нет блуждателя, и это сказано в таблице.
5. **Людей боты не предсказывают:** числа сравнивают доски и темпы между собой. Первая сверка с людьми — слепая проба владельца.

## 12. Что при сборке вышло иначе

| Что | В спеке | Собрано и почему |
|---|---|---|
| Граф доски | все положения доски | положения **не дальше стольких-то ходов от старта**: `graphOf(spec, { depth })`. Всех положений слишком много: перекат без события — уже новое положение, и доска из четырёх костей на поле 5×5 не уложилась в 200 тысяч. Отчёт берёт глубину «наименьшее число ходов и ещё два». У графа есть `depth`, `far` (ходов от старта до положения) и `end` (исход положения) |
| Факты графа | `alive` — доля положений, из которых доска очищается; `lostIn` — ходов до положения без пути | `alive` считается по положениям не на краю графа и значит «очищается по положениям графа»; `lostIn` — ходов до ближайшего **тупика** (по счёту или на полу), а не до любого положения без пути |
| Блуждатель | ходит по графу доски | ходит по тому же ограниченному графу; выход на край считается новым заходом, как тупик. Число поэтому меряет, насколько трудно найти путь, бродя рядом с ним, и сравнимо между досками |
| Жадный | пятая персона в `PERSONAS` | отдельная `GREEDY: Persona`. `PERSONAS` и `PERSONA_NAMES` остались вчетвером: на них стоят таблицы `scripts/ladder.mjs` и рецепты |
| Совпадение маршрута | одно число `match` | два: `match` — маршрут совпал знак в знак, `sameKind` — совпал вид маршрута. На досках с несколькими кратчайшими путями первое мало, второе говорит о главном |
| Знак «упал» (`!`) | встречается в партитуре | в путях решателя и ботов не встречается: в их счёте игрок между ходами стоит везде, куда ведут шаги, и на пол сходит сам. Знак оставлен для записей живой игры |
| Мост (`~`) | «сошёл с уходящего комбо на другую кость» | «дошёл до кости по **другой** уходящей кости»: шаг с кости, которой игрок сам собрал комбо, на соседнюю мостом не считается, иначе мостом была бы любая цепочка |
| Отчёт о доске | в `levelBot.ts` | в своём файле `src/rules/levelReport.ts`, вместе со строкой таблицы (`reportRow`) и записью партитуры (`scoreText`) |
| Ход одного игрока | внутри прогона | `personaMove` и `randomMove` видны снаружи: ход из заданного положения можно спросить отдельно |
| Поиск персоны | до своей глубины | обрывается раньше, когда найдена очищенная доска: глубже лучшего нет. Выбор хода тот же, прогоны быстрее |
| `Plan.dice` | обязательное поле | необязательное: планы, выписанные руками в прежних тестах, его не несут; у каждого плана из `findPlans` оно есть |
| Тесты, играющие целые прогоны | — | получили запас времени: на загруженной машине тест «чем лучше игрок, тем больше счёт» не укладывался в пять секунд ещё до правок |
| Запреты решателя (после сборки первой партии уровней, 7 октября) | `push` и `up` | добавлен `bridge` — шаг с уходящей кости на уходящую. Им доказывается форма «Мост»: без такого шага пути в пределах хода нет. `partsOf` называет его по знаку `~` партитуры |
| Правило пола (там же) | переключатель `climb`, без него подъём есть | на доске без прихода подъёма нет без всяких слов; `climb: true` возвращает его для замера. Скрипт: `node scripts/bots.mjs climb=on` вместо `climb=off` |
| Оценка доски персоной (там же) | проигранная доска — худшая | уровень теперь кончается тупиком пола сразу, даже когда игрок ещё стоит на уходящей кости. Такой конец персона сверху не видит: доска стоит для неё столько же, сколько стояла до правила, — по числу костей. Иначе жадный и спешащий перестали бы попадать в ловушку «комбо, с которого некуда шагнуть», а мерило ловушек — именно о ней |

Чего не проверить ботами и что осталось открытым — раздел 11; числа первой съёмки — [VI_Levels_Routes_Brief.md](../../VI_Levels_Routes_Brief.md), раздел 3.5.
