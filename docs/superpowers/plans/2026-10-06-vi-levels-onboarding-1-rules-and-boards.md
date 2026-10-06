# Вводный курс, шаг 1: правила уровня и первые доски — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Статус:** исполнен 6 октября; что вышло иначе — раздел 14 спеки.

**Goal:** Правила уровня умеют закрытый пол, тупик «некуда идти» и решение от любого положения; отбор досок знает мерила качества и условия уроков; в игре стоят курс из девяти уровней и глава 1 из девяти, за ними нынешние уровни в новом порядке.

**Architecture:** Всё новое — свойства уровня (`LevelSpec`), остальные режимы не тронуты. Обход свободных шагов выносится из решателя в отдельный модуль, чтобы им пользовались и правила. Доски ищет прежний конвейер: рецепт места → раскладка → `judge` на настоящих правилах; к нему добавляются условия уроков, мерила пути и отбор пакетом.

**Tech Stack:** TypeScript, Vitest, Vite (`runnerImport` в скриптах), Node.

**Spec:** [docs/superpowers/specs/2026-10-06-vi-levels-onboarding-design.md](../specs/2026-10-06-vi-levels-onboarding-design.md) — разделы 2, 3, 6. Исследование: [docs/VI_Levels_Onboarding_Research.md](../../VI_Levels_Onboarding_Research.md).

## Global Constraints

- Рабочее дерево: `.claude/worktrees/levels-onboarding`, ветка `worktree-levels-onboarding`. Основную папку `GAMES\VI` и чужие worktree не трогать. `git stash` не использовать.
- Коммит — только после «ок» владельца; в коммит только свои файлы, без `git add -A`. Пуш в `main` — отдельное «ок».
- Endless, сеанс дня, упражнение и задачи не меняются; их тесты не правятся; `RULES_VERSION` остаётся `0.9`.
- `src/rules` — чистая детерминированная симуляция; решатель и боты ходят только настоящими правилами (`step`).
- Если место не набирает досок, границы рецепта молча не ослабляются: в отчёте называется условие, которое не выполняется.
- Вид не придумывать; в этом шаге новых элементов интерфейса нет.
- Комментарии в коде — по-английски, в тоне соседних файлов. Субагентам указывать `model` явно: `opus` для реализации, `sonnet` для поиска.
- Проверка после каждой задачи: `npm test`, `npm run typecheck`. В конце шага ещё `npm run build` и `node scripts/ladder.mjs`.

## Карта файлов

| Файл | Что в нём после шага |
|---|---|
| `src/rules/types.ts` | поля `LevelSpec`: `chapter`, `floor`, `guard`, `until`, `guide`, `story` |
| `src/rules/movement.ts` | закрытый пол: шаг с уходящей кости вниз не делается |
| `src/rules/reach.ts` (новый) | обход свободных шагов `scan` и `canMove` |
| `src/rules/level.ts` | `levelStranded`; `endBeat` кончает уровень и им |
| `src/rules/levelSolver.ts` | `scan` берётся из `reach.ts`; `solveFrom`; отчёт пути знает `cleared`, `inPlace`, `dice` |
| `src/levels/recipes.ts` | главы (`CHAPTERS`), рецепты курса и главы 1, новые поля `Recipe` |
| `src/levels/measures.ts` (новый) | мерила пути: хвост, первые ходы, «на боку», «грань снизу», даль первого хода |
| `src/levels/variety.ts` (новый) | признаки новизны, одинаковые доски, отбор пакетом |
| `src/levels/generate.ts`, `select.ts`, `table.ts` | имя и свойства уровня из рецепта; новые проверки; новые столбцы |
| `src/levels/progress.ts`, `rules.ts` | главы по `chapter`; уроки по порядку |
| `src/levels/levels.ts` | курс, глава 1, нынешние уровни в новом порядке; запас |
| `src/app/game.ts`, `src/ui/i18n.ts`, `src/ui/lang/*.ts` | причина «некуда идти»; девять строк уроков, пока в прежнем окне |
| `scripts/ladder.mjs` | подбор по имени места, сборка главы, таблица по главам |

---

### Task 1: Поля уровня и закрытый пол

**Files:**
- Modify: `src/rules/types.ts` (интерфейс `LevelSpec`, около строки 395)
- Modify: `src/rules/movement.ts:67-75`
- Test: `src/rules/ladderRules.test.ts`

**Interfaces:**
- Produces: поля `LevelSpec.chapter?: number`, `floor?: boolean`, `guard?: boolean`, `until?: 'move' | 'combo' | 'chain' | 'push' | 'climb' | 'end'`, `guide?: boolean`, `story?: string`. Поле `arrow` остаётся до второго шага.

- [ ] **Step 1: Тест.** В `src/rules/ladderRules.test.ts` добавить блок. Доска: пара двоек собирается перекатом кости (2,0) на запад; рядом с местом, куда она встанет, стоит кость (1,1).

```ts
import { resolveMove } from './movement';

describe('the floor of a level', () => {
  const TWOS: Partial<LevelSpec> = { goal: { kind: 'clear' }, arrival: 'none', faces: [2], sinkMoves: 2, liftMoves: 1, norm: 4 };
  /** The die at (2,0) rolled west makes a pair with the 2 at (0,0); a die stands at (1,1), another far off. */
  function pairBoard(spec: Partial<LevelSpec> = {}): RunState {
    const s = levelRun({ ...TWOS, ...spec });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 1, 1, 5);
    put(s, 4, 4, 5);
    place(s, 2, 0, 'top');
    act(s, 'W');
    return s;
  }

  it('is stepped down to from a die that is leaving, where the level leaves it open', () => {
    const s = pairBoard();
    expect(resolveMove(s, 'E').kind).toBe('descend');
  });

  it('is not stepped down to where the level shuts it; a step onto a die is still a step', () => {
    const s = pairBoard({ floor: false });
    expect(resolveMove(s, 'E').kind).toBe('blocked');
    expect(resolveMove(s, 'S').kind).toBe('hop');
  });
});
```

- [ ] **Step 2: Запустить и увидеть провал.** `npx vitest run src/rules/ladderRules.test.ts` — второй тест падает: `descend` вместо `blocked` (и ошибка типа на `floor`).

- [ ] **Step 3: Поля.** В `LevelSpec` после `lesson` добавить (с комментариями из спеки, раздел 3):

```ts
  /** The chapter of the ladder the level is in, from 0. */
  chapter?: number;
  /** False where the player cannot step from the dice down to the floor. Left out, the floor is open. */
  floor?: boolean;
  /** The level is played with a net: a hint for a player who wanders, and a dead end that takes the board back. */
  guard?: boolean;
  /** What the line of the level waits for: it goes out when this has happened; with `end`, it stays until the level is passed. A move, when left out. */
  until?: 'move' | 'combo' | 'chain' | 'push' | 'climb' | 'end';
  /** The first move of `solution` is shown on the board, with the steps that lead to its die, until a move is made. */
  guide?: boolean;
  /** Key of the window said before the level, once. */
  story?: string;
```

- [ ] **Step 4: Закрытый пол.** В `resolveMove`, ветка `player.level === 'top'`, сразу после `if (!isFree(state, tx, tz)) return blocked;`:

```ts
    // A level may shut its floor: the player stays on the dice until the floor has been taught.
    if (state.levelRun?.spec.floor === false) return blocked;
```

- [ ] **Step 5: Проверка.** `npx vitest run src/rules` — зелёно. `npm run typecheck` — чисто.

---

### Task 2: Тупик «некуда идти»

**Files:**
- Create: `src/rules/reach.ts`
- Modify: `src/rules/levelSolver.ts` (убрать `Reachable`, `Scan`, `scan`, `byPlainness`; импортировать из `reach.ts`)
- Modify: `src/rules/level.ts` (`levelStranded`, `endBeat`)
- Modify: `src/app/game.ts` (строки с `levelStuck`: 854, 1125, 1156, 1162, 1179), `src/ui/i18n.ts`, `src/ui/lang/{de,es,fr,pt,tr}.ts`
- Test: `src/rules/ladderRules.test.ts`

**Interfaces:**
- Produces: `scan(state: RunState, ban?: readonly Technique[]): Scan` и `canMove(state: RunState): boolean` из `src/rules/reach.ts`; `levelStranded(state: RunState): boolean` из `src/rules/level.ts`; текст `levelStranded`.
- Правило: `reach.ts` не импортирует ни `level.ts`, ни `levelSolver.ts`.

- [ ] **Step 1: Тест.**

```ts
import { levelStranded } from './level';

describe('a level with its floor shut', () => {
  const TWOS: Partial<LevelSpec> = { goal: { kind: 'clear' }, arrival: 'none', faces: [2], sinkMoves: 2, liftMoves: 1, norm: 4 };
  /** The pair is made at (0,0) and (1,0); the two dice left stand where no step leads. */
  function cutOff(spec: Partial<LevelSpec> = {}): RunState {
    const s = levelRun({ ...TWOS, ...spec });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 4, 4, 5);
    put(s, 4, 3, 4);
    place(s, 2, 0, 'top');
    act(s, 'W');
    return s;
  }

  it('is lost when the player stands on a leaving die with no die to step to: there is no move left', () => {
    const s = cutOff({ floor: false });
    expect(levelStranded(s)).toBe(true);
    expect(levelStuck(s)).toBe(false);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
  });

  it('goes on where the floor is open: the player steps down and walks', () => {
    const s = cutOff();
    expect(levelStranded(s)).toBe(false);
    expect(s.over).toBe(false);
  });

  it('goes on while a die stands within a step', () => {
    const s = levelRun({ ...TWOS, floor: false });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 1, 1, 5);
    put(s, 4, 4, 5);
    place(s, 2, 0, 'top');
    act(s, 'W');
    expect(levelStranded(s)).toBe(false);
    expect(s.over).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить и увидеть провал** (`levelStranded` нет).

- [ ] **Step 3: `src/rules/reach.ts`.** Перенести из `levelSolver.ts` без изменения логики: интерфейсы `Reachable` и `Scan`, функции `scan` и `byPlainness`. Экспортировать `Reachable`, `Scan`, `scan`. Добавить:

```ts
/** Whether the player has a move left: a roll or a push that free steps lead to. */
export function canMove(state: RunState): boolean {
  return scan(state).moves.length > 0;
}
```

Шапка файла: что это обход свободных шагов тем же `resolveMove`, что у игры; что им пользуются решатель и правила уровня. В `levelSolver.ts` — `import { scan, type Reachable } from './reach';`, остальное как было (`movesAt` остаётся там).

- [ ] **Step 4: `levelStranded` и `endBeat`.** В `src/rules/level.ts`:

```ts
import { canMove } from './reach';

/**
 * A level with its floor shut has come to where nothing can be done: dice stand, and the player
 * has no move, standing on a die that is leaving with no die to step to. The world moves only
 * with a move, so it would stand so for good; the level ends there.
 */
export function levelStranded(state: RunState): boolean {
  const run = state.levelRun;
  if (!run || run.spec.goal.kind !== 'clear' || run.spec.floor !== false) return false;
  if (state.cubes.some((cube) => cube.state === 'moving')) return false;
  return standing(state) > 0 && !canMove(state);
}
```

В `endBeat` условие проигрыша: `if (levelStuck(state) || levelStranded(state) || (spec.moves > 0 && run.moves >= spec.moves))`. В шапку файла дописать фразу о закрытом поле.

- [ ] **Step 5: Приложение.** В `src/app/game.ts` всюду, где тупик узнаётся по `levelStuck(state)` (пауза перед окном, счёт попытки, окно итога, доступность отмены), подставить `levelStuck(state) || levelStranded(state)`; в `showLevelResult` причина для «некуда идти» — `t('levelStranded')`. Ключ `levelStranded` рядом с `levelStuck` во всех семи языках:

| Язык | Текст |
|---|---|
| ru | Тупик: с этой кости некуда идти |
| en | Dead end: there is nowhere to go from this die |
| es | Sin salida: desde este dado no hay adónde ir |
| pt | Beco sem saída: deste dado não há para onde ir |
| tr | Çıkmaz: bu zardan gidecek yer yok |
| de | Sackgasse: Von diesem Würfel geht es nicht weiter |
| fr | Impasse : depuis ce dé, on ne peut aller nulle part |

- [ ] **Step 6: Проверка.** `npm test`, `npm run typecheck`. Тесты решателя и ботов зелёные без правок: `scan` тот же.

---

### Task 3: Решение от положения

**Files:**
- Modify: `src/rules/levelSolver.ts`
- Test: `src/rules/levelSolver.test.ts`

**Interfaces:**
- Produces: `solveFrom(state: RunState, opts?: Pick<SolveOptions, 'maxStates' | 'maxMoves' | 'ban'>): Solved`. Положение должно стоять: `worldRuns(state)` ложно и у игрока нет действия; иначе ошибка.
- Produces: `WayReport.cleared: boolean[]`, `WayReport.inPlace: boolean[]`, `WayReport.dice: number[]` — по одному значению на ход: ход запустил комбо, звено или единицы; ход сделан костью, на которой игрок стоял; номер кости, которой сделан ход.

- [ ] **Step 1: Тесты.**

```ts
/** Four dice where only 3s work: the fewest moves are three, and the last is a link. (The board of level B03.) */
const LINK: LevelSpec = { id: 'link', seed: 368, size: 3, values: [3], norm: 4, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [3], sinkMoves: 2, liftMoves: 1, layout: { start: { x: 2, z: 0 }, dice: [{ x: 1, z: 0, top: 6, north: 5 }, { x: 0, z: 0, top: 2, north: 3 }, { x: 1, z: 1, top: 3, north: 1 }, { x: 2, z: 0, top: 2, north: 3 }] } };
const WAY = ['0,0,S', '2,0,S', '1,0,W'].map(moveOf);
const startOf = (spec: LevelSpec) => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

describe('the fewest moves from where a run stands', () => {
  it('are those of the level at its start', () => {
    expect(solveFrom(startOf(LINK)).solution?.par).toBe(solveLevel(LINK).solution?.par);
  });

  it('are one fewer after every move of a shortest way', () => {
    let state = startOf(LINK);
    WAY.forEach((move, made) => {
      expect(solveFrom(state).solution?.par, `after ${made} moves`).toBe(WAY.length - made);
      state = playMove(state, move);
    });
  });

  it('give a way that clears the board when played from there', () => {
    let state = playMove(startOf(LINK), WAY[0]);
    for (const move of solveFrom(state).solution!.moves) state = playMove(state, move);
    expect(state.endReason).toBe('passed');
  });

  it('are none within fewer moves than the board takes, and the search says it saw everything', () => {
    const { solution, exhausted } = solveFrom(startOf(LINK), { maxMoves: 2 });
    expect(solution).toBeNull();
    expect(exhausted).toBe(true);
  });

  it('do not count the moves the run has made against a limit of the level', () => {
    const state = playMove(startOf({ ...LINK, moves: 3 }), WAY[0]);
    expect(solveFrom(state).solution?.par).toBe(2);
  });
});

describe('a way played again', () => {
  it('says of every move whether it cleared, whether it was made in place, and with which die', () => {
    const report = tryWay(LINK, WAY);
    expect(report.cleared).toEqual([false, true, true]);
    expect(report.inPlace).toEqual([false, false, false]);
    expect(new Set(report.dice).size).toBe(3);
  });
});
```

Про `inPlace`: игрок стартует на (2,0); первый ход — кость (0,0), до неё надо дойти; второй — кость (2,0), но игрок уже ушёл; третий — кость (1,0). Все три — не «на месте».

- [ ] **Step 2: Запустить и увидеть провал.**

- [ ] **Step 3: Реализация.** В `levelSolver.ts`:
  - Тело `tryWay` вынести во внутреннюю `follow(state: RunState, id: string, moves): WayReport`, которая играет ходы на данном положении (оно ей отдано и меняется). `tryWay(spec, moves, config)` = `follow(startOf(spec, config), spec.id, moves)`. В цикле перед `make` записать `inPlace.push(!move.push && state.player.level === 'top' && state.player.x === move.x && state.player.z === move.z)` и `dice.push(cubeAt(state, move.x, move.z)!.id)`; после — `cleared.push(outcome.cleared)`.
  - Тело `solveLevel` вынести во внутреннюю `search(root: RunState, opts, own: (move) => boolean, check: (moves) => WayReport)`. `solveLevel` зовёт её с `startOf(spec, config)` и `check = (moves) => tryWay(spec, moves, config)`.
  - `solveFrom`:

```ts
/**
 * The fewest moves the board of a run is cleared in from where it stands, and a way to do it:
 * the search of `solveLevel`, begun at a board that is not the start of its level. The run is
 * left as it was. What the level limits its moves to is not counted: only the board is asked.
 */
export function solveFrom(state: RunState, opts: Pick<SolveOptions, 'maxStates' | 'maxMoves' | 'ban'> = {}): Solved {
  const run = state.levelRun;
  if (!run) throw new Error('solveFrom: not a level');
  if (worldRuns(state) || state.player.action) throw new Error('solveFrom: the world has to stand');
  const root = copyRun(state);
  root.levelRun = { ...root.levelRun!, spec: { ...run.spec, moves: 0 }, moves: 0 };
  return search(root, opts, () => true, (moves) => follow(copyRun(root), run.spec.id, moves));
}
```

- [ ] **Step 4: Проверка.** `npx vitest run src/rules/levelSolver.test.ts src/rules/levelBot.test.ts` — зелёно; `npm run typecheck`.

---

### Task 4: Главы названы прямо

**Files:**
- Modify: `src/levels/recipes.ts` (`CHAPTERS`), `src/levels/progress.ts`, `src/levels/levels.ts` (поле `chapter` у всех уровней и запасных), `src/levels/generate.ts` (`levelOf`)
- Test: `src/levels/progress.test.ts`, `src/levels/levels.test.ts`

**Interfaces:**
- Produces: в `recipes.ts`

```ts
/** A chapter of the ladder: how generous its limit of moves is, whether stars open it, whether its floor is open, and which of its levels are played with a net. */
export interface ChapterRule {
  key: string;
  /** Times the fewest moves of a level its limit gives, before the moves to spare. */
  times: number;
  gate: boolean;
  floor: boolean;
  guard: 'all' | 'lessons' | 'none';
}
export const CHAPTERS: readonly ChapterRule[];
```

- Produces: `chaptersOf(levels: readonly Pick<LevelSpec, 'chapter'>[]): Chapter[]` — подряд идущие уровни с одним `chapter`; `Chapter` получает поле `chapter: number`. `moveLimit(par, chapter)` берёт множитель из `CHAPTERS[chapter].times`. `gateOf(chapter)` — 0, если `CHAPTERS[chapter.chapter].gate` ложно.
- На этой задаче глав три, как сейчас: `threes` (5, без ворот), `twosThrees` (4, ворота), `fives` (3, ворота); `floor: true`, `guard: 'none'`. Номера 0, 1, 2. Рецепты нынешних мест получают `chapter` на единицу меньше прежнего.

- [ ] **Step 1: Тесты.** В `progress.test.ts` заменить тест глав:

```ts
  it('are the levels that follow one another in one chapter', () => {
    const of = (chapter: number) => ({ chapter });
    expect(chaptersOf([of(0), of(0), of(1), of(4), of(4), of(4)])).toEqual([
      { chapter: 0, from: 0, to: 2 },
      { chapter: 1, from: 2, to: 3 },
      { chapter: 4, from: 3, to: 6 },
    ]);
    expect(chaptersOf([])).toEqual([]);
  });

  it('ask for no stars where the chapter has no gate', () => {
    expect(gateOf({ chapter: 0, from: 0, to: 8 })).toBe(0);
    expect(gateOf({ chapter: 1, from: 8, to: 16 })).toBe(10);
  });
```

Остальные тесты `progress.test.ts` (пределы 15, 25, …, ворота 10 и 20) должны остаться зелёными без правок чисел: поведение нынешней лестницы не меняется. В `levels.test.ts` тест «lets only the faces of its chapter work» сравнивает `level.faces` с гранями рецепта: `expect(level.faces, level.id).toEqual([...recipe.faces].sort())`, и добавляется `expect(level.chapter, level.id).toBe(recipe.chapter)`.

- [ ] **Step 2: Запустить и увидеть провал.**

- [ ] **Step 3: Реализация.** `CHAPTERS` — как в «Produces». `chaptersOf`, `moveLimit`, `gateOf`, `limitedLevel`, `ladderProgress` — по новым полям. В `levels.ts` каждому уровню и запасному добавить `chapter: 0` (`B01`–`B08`), `chapter: 1` (`B09`–`B16`), `chapter: 2` (`B17`–`B23`) сразу после `id`. В `levelOf` (`generate.ts`) и `levelSource` (`select.ts`) — поле `chapter` из рецепта.

- [ ] **Step 4: Проверка.** `npm test`, `npm run typecheck`. `node scripts/stars.mjs | head -20` печатает те же пределы, что в [VI_Levels_Progression_Research.md](../../VI_Levels_Progression_Research.md), раздел 9.

---

### Task 5: Мерила пути

**Files:**
- Create: `src/levels/measures.ts`
- Test: `src/levels/measures.test.ts`

**Interfaces:**
- Consumes: `tryWay`, `solveFrom`, `movesAt`, `playMove`, `WayReport` (`cleared`, `inPlace`, `dice`), `moveOf` из `src/rules/levelSolver.ts`; `roll`, `ALL_ORIENTATIONS` из `src/rules/orientation.ts`.
- Produces:

```ts
/** Moves a way makes after the clearing move before its last one: the end of a level that is only finished off. 0 for a way that clears once. */
export function tailOf(cleared: readonly boolean[]): number;
/** First moves after which the board is still cleared in `par` moves more: a way a move longer than the fewest, at most. */
export function firstsOf(spec: LevelSpec, par: number, maxStates?: number): number;
/** Dice that start with a face that works at the bottom: the rule of seven is of use on them. */
export function underOf(spec: LevelSpec): number;
/**
 * The way begins by riding a face on the side: the die the player starts on is rolled one way,
 * once or more, and then turned across, and the turn lays on top a face that works and that lay,
 * all the while, on the side the turn rolls away from.
 */
export function rides(spec: LevelSpec, way: readonly SolverMove[]): boolean;
/** Steps over the dice from the die the player starts on to the die of the first move; 0 when it is the same die, -1 when no steps lead there. */
export function farOf(spec: LevelSpec, way: readonly SolverMove[]): number;
```

- [ ] **Step 1: Тесты.** Доски задаются раскладкой; ориентации — через `ori` из `src/rules/testkit.ts`.

```ts
import { ori } from '../rules/testkit';

const die = (x: number, z: number, faces: Partial<Orientation>) => {
  const o = ori(faces);
  return { x, z, top: o.top, north: o.north };
};
const level = (size: number, faces: number[], start: { x: number; z: number }, dice: ReturnType<typeof die>[]): LevelSpec => ({
  id: 'test', seed: 1, size, values: faces, norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces, sinkMoves: 2, liftMoves: 1, floor: false, layout: { start, dice },
});

describe('the tail of a way', () => {
  it('is nothing for a way that clears once, and the moves after the clearing before the last for one that clears more', () => {
    expect(tailOf([false, false, true])).toBe(0);
    expect(tailOf([true, true])).toBe(1);
    expect(tailOf([false, true, false, false, true])).toBe(3);
    expect(tailOf([])).toBe(0);
  });
});

describe('dice with a working face at the bottom', () => {
  it('are counted by the face under the top', () => {
    // Where 3s work, a die showing a 4 has its 3 underneath.
    const board = level(3, [3], { x: 0, z: 0 }, [die(0, 0, { top: 4 }), die(2, 2, { top: 3 }), die(2, 1, { top: 5 })]);
    expect(underOf(board)).toBe(1);
  });
});

describe('a ride on the side', () => {
  // Two 3s stand at (2,0) and (2,1). The die at (0,2) has its 3 to the west: rolled north twice it keeps
  // the 3 on that side, and rolled east it lays the 3 on top beside them.
  const board = level(3, [3], { x: 0, z: 2 }, [die(2, 0, { top: 3 }), die(2, 1, { top: 3 }), die(0, 2, { top: 6, west: 3 })]);
  it('is a way of the own die rolled along and then turned, the face on its side all the while', () => {
    expect(rides(board, ['0,2,N', '0,1,N', '0,0,E'].map(moveOf))).toBe(true);
  });
  it('is not a way that turns first', () => {
    expect(rides(board, ['0,2,E', '1,2,N', '1,1,N'].map(moveOf))).toBe(false);
  });
  it('is not one roll', () => {
    expect(rides(board, ['0,2,E'].map(moveOf))).toBe(false);
  });
});

describe('the way to the die of the first move', () => {
  const board = level(3, [3], { x: 0, z: 0 }, [die(0, 0, { top: 3 }), die(1, 0, { top: 3 }), die(2, 0, { top: 6, north: 3 })]);
  it('is counted in steps over the dice', () => {
    expect(farOf(board, ['2,0,S'].map(moveOf))).toBe(2);
    expect(farOf(board, ['0,0,S'].map(moveOf))).toBe(0);
  });
});

describe('first moves that keep a board in hand', () => {
  it('are counted by solving the board again after each', () => {
    // Two dice where 2s work, each a roll away from a pair by more than one way.
    const board = level(3, [2], { x: 0, z: 0 }, [die(0, 0, { top: 6, east: 2 }), die(2, 0, { top: 2 })]);
    const par = solveLevel(board).solution!.par;
    expect(firstsOf(board, par)).toBeGreaterThanOrEqual(1);
    expect(firstsOf(board, par)).toBeLessThanOrEqual(movesAt(createRun({ seed: 1, config: defaultConfig(), level: board })).length);
  });
});
```

В тесте «a ride on the side» строка `'0,0,E'` — третий ход: кость стоит в (0,0), катится на восток в (1,0) и встаёт рядом с тройкой (2,0). Проверить в шаге 4, что `tryWay(board, …).state.endReason === 'passed'`; если раскладка не сходится по клеткам, поправить клетки стоящих троек, а не ослаблять функцию.

- [ ] **Step 2: Запустить и увидеть провал.**

- [ ] **Step 3: Реализация.** Правила каждой функции:
  - `tailOf`: индексы `true`; меньше двух — 0; иначе разность двух последних.
  - `underOf`: кости раскладки, у которых `7 − top` входит в `spec.faces`.
  - `rides`: первый ход — кость старта, не толчок; `k` — первый ход с другим направлением, `k ≥ 1`; ходы `0…k` идут одной костью подряд (клетка каждого следующего — клетка прихода предыдущего); направление `k` перпендикулярно первому; у стартовой ориентации грань на стороне, противоположной направлению `k`, входит в `spec.faces`. Сторона по направлению: `N → north`, `E → east`, `S → south`, `W → west`; противоположные: `N↔S`, `E↔W`.
  - `farOf`: поиск в ширину по костям раскладки, соседним по стороне, от старта до клетки первого хода.
  - `firstsOf`: для каждого хода из `movesAt(start)`: `after = playMove(start, move)`; годится, если `after.endReason === 'passed'` или `!after.over && solveFrom(after, { maxMoves: par, maxStates }).solution`. `maxStates` по умолчанию 50 000.

- [ ] **Step 4: Проверка.** `npx vitest run src/levels/measures.test.ts`, `npm run typecheck`.

---

### Task 6: Условия уроков в рецепте и в отборе

**Files:**
- Modify: `src/levels/recipes.ts` (интерфейс `Recipe`), `src/levels/generate.ts` (`levelId`, `levelOf`, `candidate`), `src/levels/select.ts` (`judge`, `Fit`, `MEASURE_HEAD`, `measureRow`, `levelSource`), `src/levels/table.ts`
- Test: `src/levels/select.test.ts` (новый), `src/levels/generate.test.ts`

**Interfaces:**
- Consumes: мерила задачи 5; `personaRates` из `src/rules/levelBot.ts`.
- Produces: поля `Recipe`:

```ts
  /** The name of the level of the place; `B` and the number of the place when left out. */
  id?: string;
  /** What the player is to notice on the level, in a line: the place is laid for this, and not for its numbers. */
  brief?: string;
  /** Boards laid by hand for the place, judged as any other: seed `SKETCH + n` lays the n-th of them, from 1. */
  sketch?: readonly LevelLayout[];
  /** As many dice as one combo of the one face that works, the floor shut: a board with no dead end, cleared from wherever it stands. */
  safe?: boolean;
  /** The way kept rolls only the die the player stands on: no step is made. */
  ownOnly?: boolean;
  /** Combos the way kept makes, with no die joining one that is leaving. */
  combos?: number;
  /** The way begins by riding a face on the side (see `rides`). */
  ride?: boolean;
  /** Dice that start with a working face at the bottom: at least one (`true`), or none (`false`). */
  under?: boolean;
  /** Steps from the die of the start to the die of the first move, at the least. */
  far?: number;
  /** Dice the way moves, at the least. */
  movers?: number;
  tail?: readonly [number, number];
  firsts?: readonly [number, number];
  /** Share of the runs of a persona that clear the board. */
  hasty?: readonly [number, number];
  casual?: readonly [number, number];
  /** Share of the planner over the share of the hasty one. */
  gap?: readonly [number, number];
  floor?: boolean;
  guard?: boolean;
  guide?: boolean;
  until?: LevelSpec['until'];
  story?: string;
```

- Produces: `SKETCH = 20_000` из `generate.ts`; `Fit.tail`, `Fit.firsts`, `Fit.personas`; `levelId(recipe: Recipe): string`.
- `levelOf` пишет в уровень `id`, `chapter`, `floor`, `guard`, `guide`, `until`, `story`, `lesson` из рецепта. `floor` обязан стоять в уровне до решателя: его читают правила.

- [ ] **Step 1: Тесты.** `src/levels/select.test.ts`: рецепт с эскизом судится по своим условиям.

```ts
const sketch = (size: number, start: { x: number; z: number }, dice: ReturnType<typeof die>[]) => ({ start, dice });
const base: Recipe = { slot: 901, id: 'X01', chapter: 0, size: 3, dice: 3, faces: [3], compact: false, par: [1, 3], floor: false };

describe('a place judged', () => {
  // The ride of the test of the measures: north, north, east.
  const ride = sketch(3, { x: 0, z: 2 }, [die(2, 0, { top: 3 }), die(2, 1, { top: 3 }), die(0, 2, { top: 6, west: 3 })]);

  it('takes a board laid by hand as it takes one laid from a seed, and names the level as the place says', () => {
    const { fit, why } = judge({ ...base, sketch: [ride], par: [3, 3], safe: true, ownOnly: true, ride: true, under: false }, SKETCH + 1);
    expect(why).toBe('');
    expect(fit!.spec.id).toBe('X01');
    expect(fit!.spec.floor).toBe(false);
    expect(fit!.par).toBe(3);
  });

  it('turns a board away by the first thing its place asks for that it does not do, and says which', () => {
    expect(judge({ ...base, sketch: [ride], par: [3, 3], combos: 2 }, SKETCH + 1).why).toBe('combos not 2');
    expect(judge({ ...base, sketch: [ride], par: [3, 3], under: true }, SKETCH + 1).why).toBe('no die with a working face at the bottom');
    expect(judge({ ...base, sketch: [ride], par: [3, 3], far: 1 }, SKETCH + 1).why).toBe('the die of the first move is nearer than 1 steps');
    expect(judge({ ...base, sketch: [ride], par: [3, 3], dice: 3, faces: [2], safe: true }, SKETCH + 1).why).toBe('not a board of one combo');
  });

  it('asks the personas last, and keeps what they came to', () => {
    const { fit } = judge({ ...base, sketch: [ride], par: [3, 3], casual: [0, 1] }, SKETCH + 1);
    expect(fit!.personas.casual).toBeGreaterThanOrEqual(0);
    expect(judge({ ...base, sketch: [ride], par: [3, 3], hasty: [2, 2] }, SKETCH + 1).why).toMatch(/^hasty not/);
  });
});
```

- [ ] **Step 2: Запустить и увидеть провал.**

- [ ] **Step 3: Реализация.**
  - `generate.ts`: `levelId(recipe)` = `recipe.id ?? 'B' + номер места`; `candidate`: при `seed > SKETCH` раскладка — `recipe.sketch?.[seed - SKETCH - 1]`; `levelOf` — поля из рецепта. Обновить вызовы `levelId(recipe.slot)` в тестах на `levelId(recipe)`.
  - `judge`: проверки идут от дешёвых к дорогим. `safe` и `under` читают одну раскладку и стоят сразу после `candidate`, до решателя; остальные — после существующих проверок приёмов и до ловушек. Порядок и причины:

| Условие | Проверка | Причина отказа |
|---|---|---|
| `safe` | `board.faces.length === 1 && board.norm === board.faces[0] && board.floor === false` | `not a board of one combo` |
| `ownOnly` | `report.inPlace.every(Boolean)` | `the way steps to another die` |
| `combos` | число `true` в `report.cleared` равно `recipe.combos`, и в `report.uses` нет `link` | `combos not N` |
| `ride` | `rides(board, way)` | `no ride on the side` |
| `under: true` | `underOf(board) >= 1` | `no die with a working face at the bottom` |
| `under: false` | `underOf(board) === 0` | `a die with a working face at the bottom` |
| `far` | `farOf(board, way) >= recipe.far` | `the die of the first move is nearer than N steps` |
| `movers` | `new Set(report.dice).size >= recipe.movers` | `fewer dice moved than N` |
| `tail` | `tailOf(report.cleared)` в границах | `tail not A-B` |
| `firsts` | `firstsOf(board, par)` в границах | `first moves not A-B` |

  После случайного бота, последними: `personaRates(board, 12)`; `hasty`, `casual`, `gap` (`planner − hasty`) в границах, причины `hasty not A-B`, `casual not A-B`, `gap not A-B`. С флагом `near` эти границы, как прежние, записываются в `misses`, а не отказывают.
  - `MEASURE_HEAD` и `measureRow`: после `depth` столбцы `tail` и `firsts`. `measureBoard` в `table.ts` считает их из пути, который хранит уровень.
  - `levelSource`: поля `chapter`, `floor`, `guard`, `guide`, `until`, `story` — только когда заданы.

- [ ] **Step 4: Проверка.** `npm test`, `npm run typecheck`. `node scripts/ladder.mjs slot=3 seeds=200` находит доски места 3, как раньше.

---

### Task 7: Рецепты курса и главы 1

**Files:**
- Modify: `src/levels/recipes.ts`
- Test: `src/levels/recipes.test.ts` (новый)

**Interfaces:**
- Produces: `COURSE: readonly Recipe[]` (9 мест, `T01`–`T09`, `chapter: 0`), `CHAPTER_ONE: readonly Recipe[]` (9 мест, `C101`–`C109`, `chapter: 1`), `PLACES: readonly Recipe[]` — оба подряд (имя `LADDER` занято словами списка уровней в `src/shell/text.ts`). `RECIPES` (нынешние 23 места) остаётся; их `chapter` становится 5, 6, 7.
- `CHAPTERS` — восемь строк:

| № | `key` | `times` | `gate` | `floor` | `guard` |
|---|---|---|---|---|---|
| 0 | `course` | 5 | нет | закрыт | `all` |
| 1 | `faces` | 5 | нет | закрыт | `all` |
| 2 | `chain` | 5 | да | закрыт | `lessons` |
| 3 | `floor` | 5 | да | открыт | `lessons` |
| 4 | `twoFaces` | 5 | да | открыт | `lessons` |
| 5 | `threes` | 5 | да | открыт | `none` |
| 6 | `twosThrees` | 4 | да | открыт | `none` |
| 7 | `fives` | 3 | да | открыт | `none` |

- [ ] **Step 1: Тест.** `recipes.test.ts`: у каждого места `PLACES` есть `id`, `brief`, `floor: false`, `guard: true`; имена различны; у мест с `lesson` стоит `guide`; `safe` только там, где `dice` равно единственной грани; соседние места различаются гранями или размером поля.

- [ ] **Step 2: Рецепты.** Общее для всех: `compact: true`, `floor: false`, `guard: true`, `avoid: ['floor', 'glass', 'ones', 'link']`, `under: false`, если не сказано иное. Пауза (`depth`): курс — от 1 до 3, глава 1 — от 1 до 4. Номера мест (`slot`) — 101–109 и 201–209.

  Раскладка от решения кладёт все кости одной грани одной кучкой, поэтому места с несколькими комбо одной грани (`T07`–`T09`, `C104`, `C108`, `C109`) набираются главным образом случайной раскладкой. Если такое место не набирает досок за 2000 сидов каждого рода — рисуется эскиз под его бриф.

| Имя | Поле, костей | Грани | Стоят | Ходов | Условия | Урок | Бриф |
|---|---|---|---|---|---|---|---|
| `T01` | 3, 3 | 3 | две тройки | 1 | `safe`, `ownOnly`, `arrow`; `hasty` 0,8–1; `casual` 0,95–1 | `lineCombo`, `guide` | перекат кладёт наверх другую грань; три тройки уходят |
| `T02` | 3, 2 | 2 | — | 1–2 | `safe`, `ownOnly`; `hasty` 0,6–1; `casual` 0,85–1 | — | двойке хватает двух: сам, без стрелки |
| `T03` | 3, 4 | 4 | три четвёрки | 1–2 | `safe`, `ownOnly`; те же персоны | — | четвёрке нужны четыре |
| `T04` | 3, 3 | 3 | две тройки | 1–2 | `safe`, `walk`; `hasty` 0,8–1; `casual` 0,95–1 | `lineStep`, `guide` | моя кость на месте; иду к той, которую надо катить |
| `T05` | 3, 4 | 4 | три четвёрки | 1–2 | `safe`, `walk`, `far: 2`; `hasty` 0,6–1; `casual` 0,85–1 | — | шаги ничего не стоят |
| `T06` | 3, 3 | 3 | — | 2–3 | `safe`, `movers: 2`, `firsts` 2–12; те же персоны | — | выбираю, с какой кости начать |
| `T07` | 3, 4 | 2 | — | 2 | `combos: 2`, `traps` 0–0; `hasty` 0,8–1; `casual` 0,95–1 | `lineWalk`, `guide`, `until: 'end'` | пара уходит у меня под ногами, а я по ней перехожу |
| `T08` | 4, 6 | 3 | — | 2–3 | `combos: 2`, `tail` 0–2; `hasty` 0,6–1; `casual` 0,85–1 | — | то же на тройках: поле пустеет в два приёма |
| `T09` | 3, 6 | 2 | — | 3–4 | `combos: 3`, `tail` 0–1; `casual` 0,85–1 | — | поле очищено целиком — конец курса |
| `C101` | 3, 3 | 3 | две тройки | 3 | `safe`, `ownOnly`, `ride`; `hasty` 0,7–1; `casual` 0,9–1 | `lineSide`, `guide`, `until: 'combo'` | грань сбоку едет со мной; поворот кладёт её наверх |
| `C102` | 3, 2 | 2 | — | 2–3 | `safe`, `ownOnly`, `ride`; `hasty` 0,5–1; `casual` 0,8–1 | — | то же на двойках, уже без подсказки |
| `C103` | 4, 4 | 4 | три четвёрки | 3–4 | `safe`, `ride`; те же персоны | — | довезти четвёрку на боку через всё поле |
| `C104` | 4, 6 | 3 | — | 4–5 | `combos: 2`, `firsts` 2–20, `tail` 0–2; `casual` 0,7–0,9 | — | малый пик: два комбо, у каждого кость надо довернуть |
| `C105` | 3, 3 | 3 | две тройки | 2 | `safe`, `ownOnly`, `under: true`; `hasty` 0,7–1; `casual` 0,9–1 | `lineSeven`, `guide`, `until: 'combo'` | под четвёркой тройка; два переката в одну сторону |
| `C106` | 3, 2 | 2 | — | 2 | `safe`, `under: true`; `hasty` 0,5–1; `casual` 0,8–1 | — | под пятёркой двойка |
| `C107` | 4, 5 | 5 | четыре пятёрки | 1–2 | `safe`; `casual` 0,8–1 | — | награда: пять пятёрок уходят разом |
| `C108` | 4, 4 | 2 | — | 4–6 | `combos: 2`, `under: true`, `tail` 0–2; `casual` 0,7–0,9 | — | сочетание: одной кости «семь», другой «на боку» |
| `C109` | 4, 6 | 3 | — | 5–7 | `combos: 2`, `firsts` 2–20, `tail` 0–3, `traps` 0,3–1; `casual` 0,6–0,8; `gap` 0,3–1 | — | пик главы: поле очищается в два комбо, жадный ход ведёт в тупик |

- [ ] **Step 3: Проверка.** `npx vitest run src/levels/recipes.test.ts`, `npm run typecheck`.

---

### Task 8: Отбор пакетом и скрипт

**Files:**
- Create: `src/levels/variety.ts`
- Modify: `scripts/ladder.mjs`
- Test: `src/levels/variety.test.ts`

**Interfaces:**
- Consumes: `Fit` из `select.ts`.
- Produces:

```ts
/** What makes a level unlike its neighbour, where no new rule does. */
export interface Traits { faces: string; size: number; dice: number; shape: string; ownFirst: boolean; combos: number }
export function traitsOf(fit: Fit): Traits;
/** Traits two levels do not share. */
export function unlike(a: Traits, b: Traits): number;
/** Whether one board is the other turned or mirrored: the cells of its dice and the faces on top. */
export function sameBoard(a: LevelSpec, b: LevelSpec): boolean;
/**
 * One board for every place, in the order of the places: of the five that fit a place best, the
 * first that is no board already taken and is unlike the one before it in two traits; where none
 * is, the one most unlike it. A place with no board that fits gets none (null).
 */
export function arrange(places: readonly (readonly Fit[])[]): (Fit | null)[];
```

`shape` — клетки костей, сдвинутые к углу и приведённые к наименьшей записи из восьми поворотов и отражений.

- [ ] **Step 1: Тесты.** Четыре случая: доска и её поворот на четверть — `sameBoard` истинно; доска с другой гранью наверху — ложно; `arrange` не берёт дважды одну доску на соседние места; `arrange` при равных по качеству берёт ту, что отличается от соседа двумя признаками.

- [ ] **Step 2: Реализация** `variety.ts`.

- [ ] **Step 3: Скрипт.** В `scripts/ladder.mjs`:
  - `place=T04` — подбор досок места по имени (рядом с прежним `slot=7`); сиды эскизов (`SKETCH + n`) добавляются к перебору всегда.
  - `chapter=0` — перебор всех мест главы (`both seeds=1000` по умолчанию), затем `arrange` и печать: таблица мест с выбранной доской, по каждому месту — картинка доски (`boardText`) и строка для `levels.ts` (`levelSource`), следующие четыре годные доски — в запас. По месту без досок — причины отказов.
  - Таблица без аргументов идёт по главам, с новыми столбцами.

- [ ] **Step 4: Проверка.** `npm test`; `node scripts/ladder.mjs place=T01 seeds=300` печатает годные доски места.

---

### Task 9: Доски курса и главы 1, новая лестница

**Files:**
- Modify: `src/levels/levels.ts`, `src/levels/levels.test.ts`, `src/levels/rules.ts`, `src/levels/rules.test.ts`
- Modify: `src/app/game.ts` (`LEVELS_COUNTED`, `LEVEL_OF_COMMIT`), `src/ui/i18n.ts`, `src/ui/lang/*.ts`
- Modify: `docs/superpowers/specs/2026-10-06-vi-levels-onboarding-design.md` (раздел «Что при сборке вышло иначе», если есть расхождения)

**Interfaces:**
- Consumes: всё выше.
- Produces: `LEVELS` — 9 уровней курса, 9 уровней главы 1, 14 нынешних; `SPARES` — запасные.

- [ ] **Step 1: Подбор.** `node scripts/ladder.mjs chapter=0` и `node scripts/ladder.mjs chapter=1`. Вывод сохранить в scratchpad. Для места без досок: назвать условие, которое отсеяло больше всего кандидатов; попробовать эскиз (`sketch` в рецепте) под бриф места; если и он не проходит — остановиться и сообщить, границы не трогать.

- [ ] **Step 2: Нынешние уровни.** Посчитать `personaRates(spec, 50)` для 14 остающихся; `B13` и `B14` — с `faces: [3]`, заново доказав наименьшее число ходов (`solveLevel`). Порядок внутри каждой из трёх глав — по убыванию доли «обычного». Главы 5, 6, 7.

- [ ] **Step 3: `levels.ts`.** Записать уровни в порядке: курс, глава 1, главы 5–7. Временные уроки на нынешних уровнях (исполнено иначе: три, а не четыре — раздел 14 спеки): `B05` — `lineLink`, `B13` — `lineFloor`, `B11` — `lineFaces`; прежние `lesson*` с уровней снять. В `SPARES`: прежние запасные оставшихся мест, ушедшие `B01`–`B04`, `B09`, `B17`, `B18`, `B22`, `B23` и до четырёх запасных на каждое новое место. Шапку файла переписать под новую лестницу.

- [ ] **Step 4: Тесты лестницы.** `levels.test.ts` переписать по имени места: рецепт уровня ищется по `id` среди `PLACES` и `RECIPES`. Проверки:
  - путь каждого уровня очищает доску ровно за `par` ходов; `exact` у всех уровней курса и главы 1;
  - у уровней курса и главы 1: `floor === false`, `guard === true`; путь не ходит по полу, не катит по уходящей кости, не делает звеньев;
  - в курсе ни одна кость не стартует рабочей гранью вниз (`underOf === 0`);
  - на уровнях `T01`–`T06` костей столько же, сколько просит единственная рабочая грань;
  - соседние уровни курса и главы 1 различаются гранями или размером поля; ни одна доска лестницы не повторяет другую (`sameBoard`);
  - `lesson` и `guide` стоят там, где их называет рецепт, и текст урока есть на каждом языке;
  - главы идут по порядку: `chaptersOf(LEVELS)` даёт главы 0, 1, 5, 6, 7.

- [ ] **Step 5: Тексты и приложение.** Девять строк уроков на семи языках (`lineCombo`, `lineStep`, `lineWalk`, `lineSide`, `lineSeven`, `lineLink`, `lineFloor`, `lineGlass`, `lineFaces`): русские — из спеки, раздел 7; остальные шесть — перевод исполнителя, носители не читали. До второго шага их показывает прежнее окно уровня, одним сообщением. Тест: строка урока на русском — не больше двенадцати слов, на любом языке — не больше 110 знаков. В `game.ts`: плашки неполного комбо над каждой группой — на уровнях глав 0 и 1 (`LEVELS_COUNTED` уходит); отметка шага без возврата — с уровня, чей урок `lineWalk`. В `rules.ts`: `LESSONS` — новые ключи по порядку; `lessonsAt` отдаёт уроки всех уровней до данного включительно, без вывода глав из граней; `ruleOf` для новых ключей пока молчит (памятки пишет второй шаг). `rules.test.ts` поправить под это; тесты старых окон (`lessonThrees` и другие) остаются, пока остаются их тексты.

- [ ] **Step 6: Проверка шага целиком.** `npm test`, `npm run typecheck`, `npm run build`, `node scripts/ladder.mjs` — таблица по главам; в ней у каждого уровня курса и главы 1 выполнены условия своего места, а доля «обычного» между соседними уровнями падает не больше чем на 25 пунктов, кроме входа в пик (`C104`, `C109`). Сыграть в preview `T01`–`T09` и `C101`–`C109` на экране 360×640: уровни запускаются и проходятся по своим решениям; закрытый пол держит; «некуда идти» кончает уровень с причиной.

- [ ] **Step 7: Сводка владельцу.** Таблица 18 уровней: место, грань, поле, ходы, персоны, что доказано; места, которые не набрали досок; что вышло иначе, чем в спеке. Коммит — после его «ок».

---

## Что остаётся второму шагу

Строка у доски вместо окна, знаки урока, подсказка, мягкий тупик, окна истории, список по главам, памятки `RULES`, снятие `arrow`. Третьему — главы 2–4.
