# Кампания, шаг 1: мерила `turns` и `away`, один ряд уровней, `R10` без обхода

> Вид: план. Статус: выполнен (13 октября 2026 в ветке `campaign-row`, версия 0.2.51, ждёт «ок» на публикацию; что сделано не по плану — раздел «Что вышло иначе» в конце). Дата: 2026-10-12. Проверено: 2026-10-13.
> Что заменило: —. Что живёт в коде: src/levels/campaign.ts, src/rules/levelScore.ts, src/app/game.ts, src/app/passage.ts, src/shell/panels.ts, src/shell/screens/menu.ts, src/levels/road.ts, src/levels/progress.ts.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Игра получает один ряд уровней — дорога и список одним файлом «Уровни» с номерами 1–33, — лаборатория считает два мерила трудности из спеки, урок `R10` перестаёт проходиться без пола, а слова и документы перестают говорить о пределе ходов, которого в игре уже нет.

**Architecture:** Новый модуль `src/levels/campaign.ts` даёт ряд остановок `CAMPAIGN` поверх существующих массивов `ROAD` и `LEVELS` и всё, что нужно списку и заголовку: номер, клетки, фокус. `game.ts` читает список и номер из него; `startBoard`/`boardAfter` в `passage.ts` не меняются (они уже ведут дорогу в список). Файл меню «Как играть» открывает страницы правил сразу; `roadList.ts` и `roadPanel` уходят. Мерила `turns` и `away` считаются в партитуре (`scoreOf`) и печатаются `check`. Правила (`src/rules`, кроме измерительного `levelScore.ts`) не трогаются.

**Tech Stack:** TypeScript, Vite, vitest; `node scripts/level.mjs`, `node scripts/ladder.mjs`; документы в `docs/` с проверкой `node scripts/docs-check.mjs`.

**Spec:** [docs/superpowers/specs/2026-10-12-vi-campaign-design.md](../specs/2026-10-12-vi-campaign-design.md) — разделы 5.3 (паспорт, `turns`/`away`), 6 (`R10`), 9 (механизм ряда), 10.2 шаги 0–1, 14 (документы). Исполнитель читает спеку, этот план и названные файлы; [правила уровня](../../VI_Levels_Rules.md) и [лабораторию](../../VI_Levels_Lab.md) — по ссылкам.

## Global Constraints

- Работа в своём worktree от `origin/main`; в основную папку ничего не писать. Публикация: `git fetch`, rebase на `origin/main`, проверки, `git push origin HEAD:main` — только после «ок» владельца (CLAUDE.md).
- `src/rules` — чистая симуляция; здесь меняется только `src/rules/levelScore.ts` (измерение пути, не правило) и `src/rules/levelReport.ts` (печать). `RULES_VERSION` не меняется.
- Весь интерфейс — канвас через `src/shell`; новых элементов интерфейса нет; цвета и размеры только из `src/shell/theme.ts`. Новый DOM не заводится.
- Коммит: заголовок до 70 знаков, тело до пяти строк, без рассуждений. Каждая задача кончается коммитом.
- Проверки после каждой задачи: `npm test`, `npm run typecheck`; перед публикацией ещё `npm run build`, `node scripts/docs-check.mjs`, `node scripts/level.mjs regress`.
- Тексты игрока: семь языков в `src/ui/i18n.ts` (ru, en) и `src/ui/lang/{de,es,fr,pt,tr}.ts`; каждая правка строки — во всех семи.
- Слова владельца и решения — в документах, не в коде и не в коммитах.
- Дев-сервер — только через preview (`vi-dev` в `.claude/launch.json`, порт 5183; из worktree preview поднимет свободный порт).

## Review Focus

Что спека подразумевает, а тесты задач сами не ловят; у каждой строки — задача, где добавлен тест.

1. **Старое сохранение посреди дороги** (`levels.road = 'R07'`, часть уровней списка пройдена): список открывается на седьмой клетке, номер в заголовке `R07` — 7, а не 1 и не 17. → Задача 2, тест `campaignFocus`.
2. **Игрок за дорогой без пройденных уровней списка**: фокус — 17-я клетка (`P13`), и `START` открывается на ней же. → Задача 2 (фокус) и задача 3 (проверка в preview).
3. **Кусок дороги, выбранный из списка вне очереди** (игрок стоит на `R12`, выбрал `R03`): проход `R03` не двигает место (`placeAfter` уже так устроен), список после него снова открывается на `R12`. → Задача 3, тест в `passage.test.ts` остаётся; проверка в preview по шагам.
4. **`R10` в сохранении пятой редакции**: пройден с `bestMoves: 2`; после шестой редакции `passed` остаётся, запись ходов снята, в списке у него одна звезда до новой игры. → Задача 5, тест `toRoadEdition`.
5. **Заголовок уровня на куске дороги**: раньше номера не было (`number: null`), теперь номер; HUD не должен рисовать `LV 00` или ломать разметку на 360×640. → Задача 3, проверка в preview на телефонной рамке.

---

### Task 1: Мерила `turns` и `away` в партитуре и в `check`

**Files:**
- Modify: `src/rules/levelScore.ts` (интерфейс `Score`, функция `scoreOf`)
- Modify: `src/rules/levelReport.ts:146-165` (`scoreText`)
- Modify: `src/levels/labText.ts:95-120` (`checkText`, `checkJson`)
- Test: `src/rules/levelScore.test.ts`

**Interfaces:**
- Consumes: `Score`, `Beat`, `scoreOf(spec, way, config)` из `src/rules/levelScore.ts`; `cubeAt(state, x, z)` из `src/rules/board.ts`; `DELTA` из `src/rules/board.ts`.
- Produces: `Score.turns: number` — кости, которые путь катит до первого события включительно и у которых верхняя грань на старте не рабочая (`spec.faces`); `Score.away: number` — перекаты пути, после которых расстояние катящейся кости до её конечной клетки (клетки после её последнего переката) растёт. Оба печатаются `check` строкой `turns N  away M` и ключами `turns`, `away` в JSON.

- [ ] **Step 1: Прочитать, как `scoreOf` знает кость хода**

В `scoreOf` (`src/rules/levelScore.ts:117-158`) ход `move` называет клетку кости (`move.x`, `move.z`) и направление `move.dir`; для переката игрок стоит на этой кости, для толчка — на полу рядом. Кость до хода: `cubeAt(state, move.x, move.z)`; у неё есть `id`, `top` и после хода она стоит в `(move.x + DELTA[move.dir].dx, move.z + DELTA[move.dir].dz)`. Убедиться в этом по `tellMove` в `src/rules/levelSolver.ts` и по `Cube` в `src/rules/types.ts` (имена полей верхней грани и id); если поле верхней грани называется иначе, чем `top`, использовать его имя во всём, что ниже.

- [ ] **Step 2: Написать падающие тесты**

В `src/rules/levelScore.test.ts`, в `describe('the score of a way')`, после теста о звене:

```ts
import { ROAD } from '../levels/road';
import { LEVELS } from '../levels/levels';

const road = (id: string) => ROAD.find((spec) => spec.id === id)!;
const level = (id: string) => LEVELS.find((spec) => spec.id === id)!;

it('counts the dice turned before the first event: none on R01, whose 2 is up from the start; one on R02, whose die shows a 1', () => {
  expect(scoreOf(road('R01'), parseWay(road('R01').solution!)).turns).toBe(0);
  expect(scoreOf(road('R02'), parseWay(road('R02').solution!)).turns).toBe(1);
});

it('counts the rolls away from the die\'s last cell: none where every roll comes nearer, one or more on the board where a die is rolled back', () => {
  expect(scoreOf(road('R01'), parseWay(road('R01').solution!)).away).toBe(0);
  expect(scoreOf(road('R02'), parseWay(road('R02').solution!)).away).toBe(0);
  // P03, «Семь вслепую»: the owner's word of its way is «откатить кость в конце обратно».
  expect(scoreOf(level('P03'), parseWay(level('P03').solution!)).away).toBeGreaterThanOrEqual(1);
  expect(scoreOf(level('P03'), parseWay(level('P03').solution!)).turns).toBeGreaterThanOrEqual(2);
});
```

`parseWay` — то, чем этот файл уже превращает `solution` в `SolverMove[]` (посмотреть первые строки файла: там есть разбор `'x,z,D'`; если функция называется иначе, взять её имя).

- [ ] **Step 3: Запустить тесты, убедиться, что падают**

Run: `npx vitest run src/rules/levelScore.test.ts`
Expected: FAIL — `turns`/`away` undefined.

- [ ] **Step 4: Реализовать в `scoreOf`**

В интерфейс `Score` после `chain: number;`:

```ts
  /**
   * Dice the way rolls up to and including the first event whose top face at the start is not a
   * face that works: what the player has to turn in their head before anything goes.
   */
  turns: number;
  /**
   * Rolls after which the die rolled is farther from the cell its last roll leaves it on than
   * before the roll: a die rolled away to be brought back with another face up.
   */
  away: number;
```

В `scoreOf` до цикла:

```ts
  const working = new Set(spec.faces ?? spec.values ?? []);
  const startTop = new Map(state.cubes.map((cube) => [cube.id, cube.top]));
  // Every roll of the way by the die it moves: the die's cell after the roll, in order.
  const rolled = new Map<number, { x: number; z: number }[]>();
  const rolledBeforeEvent = new Set<number>();
  let eventSeen = false;
```

Внутри `way.forEach`, после `const found = ...` и до `beats.push`:

```ts
    const die = cubeAt(state, move.x, move.z);
    if (die && !move.push) {
      const after = { x: move.x + DELTA[move.dir].dx, z: move.z + DELTA[move.dir].dz };
      rolled.set(die.id, [...(rolled.get(die.id) ?? [{ x: move.x, z: move.z }]), after]);
      if (!eventSeen) rolledBeforeEvent.add(die.id);
    }
```

и после вычисления `event`: `if (event !== 'none') eventSeen = true;` (ставить после того, как кость хода уже учтена: событие своего хода входит в «до первого события включительно»).

После цикла, перед `return`:

```ts
  const turns = [...rolledBeforeEvent].filter((id) => !working.has(startTop.get(id) ?? 0)).length;
  let away = 0;
  for (const cells of rolled.values()) {
    const last = cells[cells.length - 1];
    const far = (cell: { x: number; z: number }) => Math.abs(cell.x - last.x) + Math.abs(cell.z - last.z);
    for (let i = 1; i < cells.length; i++) if (far(cells[i]) > far(cells[i - 1])) away++;
  }
```

и в возвращаемый объект `turns, away`. Имя поля id у `Cube` сверить по `src/rules/types.ts`; если `top` там называется иначе — взять то имя. `cubeAt` и `DELTA` уже импортированы в файл.

- [ ] **Step 5: Запустить тесты**

Run: `npx vitest run src/rules/levelScore.test.ts`
Expected: PASS. Если `P03` даёт `away` 0, посмотреть `node scripts/level.mjs check file=game:P03` и путь: мерило считает перекаты, уводящие кость от её *последней* клетки; если кость откатывается и возвращается в ту же клетку, расстояние растёт на откате, и `away` ≥ 1. Если путь решателя иной, чем играл владелец (без отката), заменить в тесте `P03` на `P16` («переставить кость, прежде чем идти») и записать это в разделе «Что вышло иначе».

- [ ] **Step 6: Печать**

В `scoreText` (`src/rules/levelReport.ts`) первой строкой перед таблицей: `turns ${score.turns}  away ${score.away}  quiet ${score.quiet}  tail ${score.tail}` — если такой сводной строки нет; если `scoreText` возвращает только таблицу, добавить строку в `checkText` (`src/levels/labText.ts`) после `route …`: `lines.push(\`turns ${check.score.turns}  away ${check.score.away}\`)`. В `checkJson` добавить `turns: check.score?.turns ?? null, away: check.score?.away ?? null`. Тест печати — в `src/levels/labText.test.ts`: у `check` доски `R02` в тексте есть `turns 1  away 0`, в JSON — `turns: 1, away: 0`.

- [ ] **Step 7: Страница лаборатории**

`src/lab/labFacts.ts` `Seconds` уже несёт `check` целиком, а страница печатает партитуру из него; убедиться, что ярус «секунды» показывает новую строку (она идёт из `checkText`/`scoreText`). Если страница собирает строки сама (`src/lab/levelsLab.ts`), добавить строку `turns … away …` рядом с `par`. Проверить в preview: `?lab=levels`, открыть `R02`.

- [ ] **Step 8: Документы и коммит**

В [docs/VI_Levels_Lab.md](../../VI_Levels_Lab.md), раздел 5 «Цифры: три яруса», в ярус «секунды» добавить `turns`, `away` со ссылкой на спеку кампании, раздел 5.3. Коммит:

```bash
git add src/rules/levelScore.ts src/rules/levelScore.test.ts src/rules/levelReport.ts src/levels/labText.ts src/levels/labText.test.ts src/lab docs/VI_Levels_Lab.md
git commit -m "Партитура: мерила turns и away, печать в check и на странице лаборатории"
```

---

### Task 2: Модуль ряда `campaign.ts`

**Files:**
- Create: `src/levels/campaign.ts`
- Test: `src/levels/campaign.test.ts`

**Interfaces:**
- Consumes: `ROAD`, `roadPlace(road, firstPassed)` из `src/levels/road.ts`; `LEVELS` из `src/levels/levels.ts`; `starsHeld` из `src/levels/progress.ts`; `goalOf` из `src/rules/level.ts`; `Board` из `src/app/passage.ts` (`{ road?: number; level?: number }`).
- Produces:

```ts
export interface Stop { spec: LevelSpec; number: number; board: Board }
export const CAMPAIGN: readonly Stop[];          // ROAD, затем LEVELS; number от 1
export function stopOf(board: Board): Stop | undefined;
export function numberOf(board: Board): number | null;  // null для доски лаборатории (board без road и level)
export interface CampaignKept { passed: Readonly<Record<string, boolean | undefined>>; stats: Readonly<Record<string, { bestMoves?: number | null } | undefined>>; road?: string }
export interface CampaignCell { number: number; passed: boolean; stars: 0 | 1 | 2 | 3; goal: GoalLine[]; faces?: readonly number[] }
export function campaignCells(kept: CampaignKept): CampaignCell[];
export function campaignFocus(kept: CampaignKept, firstPassed: boolean, nextLevel: number): number; // индекс остановки
export function campaignDone(kept: Pick<CampaignKept, 'passed'>): number;
```

- [ ] **Step 1: Тесты**

`src/levels/campaign.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CAMPAIGN, campaignCells, campaignDone, campaignFocus, numberOf, stopOf } from './campaign';
import { LEVELS } from './levels';
import { ROAD } from './road';

const none = { passed: {}, stats: {} };

describe('the row of the campaign', () => {
  it('is the road and then the list, numbered from one, every board once', () => {
    expect(CAMPAIGN.length).toBe(ROAD.length + LEVELS.length);
    expect(CAMPAIGN.map((stop) => stop.number)).toEqual(CAMPAIGN.map((_, i) => i + 1));
    expect(CAMPAIGN.slice(0, ROAD.length).map((stop) => stop.spec.id)).toEqual(ROAD.map((spec) => spec.id));
    expect(CAMPAIGN.slice(ROAD.length).map((stop) => stop.spec.id)).toEqual(LEVELS.map((spec) => spec.id));
    expect(new Set(CAMPAIGN.map((stop) => stop.spec.id)).size).toBe(CAMPAIGN.length);
  });

  it('names a board by its number: a piece of the road by its place, a level of the list after the road, a board of the lab by none', () => {
    expect(numberOf({ road: 0 })).toBe(1);
    expect(numberOf({ road: ROAD.length - 1 })).toBe(ROAD.length);
    expect(numberOf({ level: 0 })).toBe(ROAD.length + 1);
    expect(numberOf({})).toBeNull();
    expect(stopOf({ level: 2 })?.spec.id).toBe(LEVELS[2].id);
  });
});

describe('the cells of the list', () => {
  it('show nothing passed to one who is new, and the stars of the fewest moves to one who passed', () => {
    expect(campaignCells(none).every((cell) => !cell.passed && cell.stars === 0)).toBe(true);
    const kept = { passed: { R01: true, P13: true }, stats: { R01: { bestMoves: ROAD[0].par }, P13: { bestMoves: 99 } } };
    const cells = campaignCells(kept);
    expect(cells[0]).toMatchObject({ number: 1, passed: true, stars: 3 });
    expect(cells[ROAD.length]).toMatchObject({ number: ROAD.length + 1, passed: true, stars: 1 });
  });

  it('gives one star to a board passed with no fewest moves kept', () => {
    expect(campaignCells({ passed: { R02: true }, stats: {} })[1].stars).toBe(1);
  });

  it('carries the faces and the goal of every board, for the line under the cells', () => {
    expect(campaignCells(none)[0].faces).toEqual(ROAD[0].faces);
    expect(campaignCells(none)[ROAD.length].goal.length).toBeGreaterThan(0);
  });
});

describe('where the list opens', () => {
  it('is the piece the player is on, by the place kept of them', () => {
    expect(campaignFocus({ ...none, road: 'R07' }, false, 0)).toBe(6);
  });
  it('is the first piece for one who is new, whatever they passed of the list', () => {
    expect(campaignFocus({ passed: { P13: true }, stats: {} }, false, 1)).toBe(0);
  });
  it('is the level the player goes on with for one past the road', () => {
    const past = { ...none, road: 'R17' };
    expect(campaignFocus(past, false, 0)).toBe(ROAD.length);
    expect(campaignFocus(past, false, 3)).toBe(ROAD.length + 3);
  });
  it('counts the boards passed, pieces and levels alike', () => {
    expect(campaignDone({ passed: { R01: true, R02: true, P13: true, F1: true } })).toBe(3);
  });
});
```

Код «за дорогой» — `ROAD_END` из `road.ts` (`pieceAfter(ROAD.length - 1)`, то есть `R17` при шестнадцати кусках); в тесте лучше импортировать `ROAD_END` и использовать его вместо строки.

- [ ] **Step 2: Запустить, убедиться, что падают**

Run: `npx vitest run src/levels/campaign.test.ts` — FAIL: модуля нет.

- [ ] **Step 3: Реализация**

```ts
import { goalOf } from '../rules/level';
import type { GoalLine, LevelSpec } from '../rules/types';
import type { Board } from '../app/passage';
import { LEVELS } from './levels';
import { starsHeld } from './progress';
import { ROAD, roadPlace } from './road';

/**
 * The campaign: every board the player is led through, in one row with one number each — the
 * pieces of the road first, then the levels of the list. The row is read, never kept: what the
 * player has passed is kept by the codes of the boards, as it was.
 */
export interface Stop {
  spec: LevelSpec;
  /** The number of the board in the row, from 1. */
  number: number;
  board: Board;
}

export const CAMPAIGN: readonly Stop[] = [
  ...ROAD.map((spec, road) => ({ spec, number: road + 1, board: { road } })),
  ...LEVELS.map((spec, level) => ({ spec, number: ROAD.length + level + 1, board: { level } })),
];

export function stopOf(board: Board): Stop | undefined {
  if (board.road !== undefined) return CAMPAIGN[board.road];
  if (board.level !== undefined) return CAMPAIGN[ROAD.length + board.level];
  return undefined;
}

export function numberOf(board: Board): number | null {
  return stopOf(board)?.number ?? null;
}

export interface CampaignKept {
  passed: Readonly<Record<string, boolean | undefined>>;
  stats: Readonly<Record<string, { bestMoves?: number | null } | undefined>>;
  road?: string;
}

export interface CampaignCell {
  number: number;
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  goal: GoalLine[];
  faces?: readonly number[];
}

export function campaignCells(kept: CampaignKept): CampaignCell[] {
  return CAMPAIGN.map(({ spec, number }) => {
    const passed = kept.passed[spec.id] === true;
    return { number, passed, stars: passed ? starsHeld(kept.stats[spec.id]?.bestMoves ?? null, spec.par) || 1 : 0, goal: goalOf(spec), faces: spec.faces };
  });
}

/** The stop the list opens on: the piece the player is on; for one past the road, the level they go on with. */
export function campaignFocus(kept: CampaignKept, firstPassed: boolean, nextLevel: number): number {
  const place = roadPlace(kept.road, firstPassed);
  return place === null ? ROAD.length + nextLevel : place;
}

export function campaignDone(kept: Pick<CampaignKept, 'passed'>): number {
  return CAMPAIGN.filter(({ spec }) => kept.passed[spec.id] === true).length;
}
```

Если импорт типа `Board` из `src/app/passage.ts` тянет в `src/levels` зависимость от `src/app` (проверить `npm run typecheck` и существующие границы: `road.ts` ничего из `app` не берёт), перенести `Board` в `src/levels/campaign.ts` и в `passage.ts` импортировать его оттуда (`export type { Board }` для совместимости).

- [ ] **Step 4: Тесты и коммит**

Run: `npx vitest run src/levels/campaign.test.ts && npm run typecheck` — PASS.

```bash
git add src/levels/campaign.ts src/levels/campaign.test.ts src/app/passage.ts
git commit -m "Кампания: ряд остановок поверх дороги и списка, клетки и фокус"
```

---

### Task 3: Один файл «Уровни», номера, «Как играть» без списка кусков

**Files:**
- Modify: `src/app/game.ts` — `showLevels` (1702–1728), `showRoad` (удалить, 1937–1956), `showHowTo` (1958–1962), `open` (1965–1980), `showMenu` (2004–2022: данные меню), заголовок уровня (2730: `number`), `step()` (836–837), импорты (40–41, 106).
- Modify: `src/app/passage.ts:176-193` — `FileLead`, `FILE_LEADS`.
- Modify: `src/shell/panels.ts` — `levelsPanel` (349–386) берёт клетки ряда; `roadPanel` (388–430) удалить.
- Modify: `src/shell/screens/menu.ts:33,360` — поле файла «Как играть».
- Modify: `src/lab/shellLab.ts:23` — `SAMPLE_DATA`.
- Delete: `src/levels/roadList.ts`, `src/levels/roadList.test.ts`.
- Test: `src/app/passage.test.ts:163-175`, `src/shell/levelPanels.test.ts:68-232`.
- Docs: `docs/art/VI_Interface_Layer.md` (строки `HOW TO PLAY` и «Уровни»).

**Interfaces:**
- Consumes: `CAMPAIGN`, `campaignCells`, `campaignFocus`, `campaignDone`, `numberOf`, `stopOf` из задачи 2; `ROAD_HINTS` из `road.ts`.
- Produces: `FILE_LEADS.howto === 'rules'`; `FileLead` получает `'rules'` и теряет `'road'`; `MenuData` без `roadDone`/`roadTotal`, с `rules: number` (число страниц правил); `levelsPanel(cells: CampaignCell[], current, actions)`.

- [ ] **Step 1: Тесты меню и панели**

В `src/app/passage.test.ts` (163–167) заменить тест:

```ts
it('opens the list of the levels from the file of the levels, and the rules from the file that says how the game is played', () => {
  expect(FILE_LEADS.levels).toBe('levels');
  expect(FILE_LEADS.howto).toBe('rules');
});
```

В `src/shell/levelPanels.test.ts` удалить `describe('the list of the pieces of the road')` (176–232) и в `describe('the list of levels')` добавить:

```ts
it('lists the pieces of the road before the levels, numbered on from one, every one open', () => {
  const cells = campaignCells({ passed: { R01: true }, stats: { R01: { bestMoves: ROAD[0].par } } });
  const spec = levelsPanel(cells, 0, { onPick: nothing, share, onBack: nothing });
  const items = row(spec, 'levels');
  expect(items.levels.length).toBe(ROAD.length + LEVELS.length);
  expect(items.levels[0]).toMatchObject({ stars: 3, locked: false });
  expect(items.levels[ROAD.length]).toMatchObject({ stars: 0, locked: false });
});
```

(`row`, `nothing`, `share` — вспомогательные этого файла; `campaignCells`, `ROAD`, `LEVELS` импортировать.)

- [ ] **Step 2: Запустить, убедиться, что падают**

Run: `npx vitest run src/app/passage.test.ts src/shell/levelPanels.test.ts` — FAIL.

- [ ] **Step 3: `passage.ts`**

```ts
export type FileLead = 'levels' | 'endless' | 'rules' | 'readme' | 'records' | 'system';
export const FILE_LEADS = { levels: 'levels', protocol: 'endless', howto: 'rules', readme: 'readme', records: 'records', system: 'system' } as const satisfies Record<string, FileLead>;
```

Комментарий над `FILE_LEADS` переписать: файл «Как играть» открывает страницы правил; куски дороги — в списке уровней с 12 октября 2026.

- [ ] **Step 4: `panels.ts`**

`levelsPanel` принимает `readonly CampaignCell[]` (импорт типа из `../levels/campaign`); `locked` у клетки ряда нет — ворот нет с 7 октября: убрать ветку `locked` из `levels.map` и из `note`, оставить `stars: cell.stars`, `locked: false`. Удалить `roadPanel` целиком и его импорты. Проверить `src/shell/panels.test.ts:288` (там `tasksPanel`, не трогать).

- [ ] **Step 5: `game.ts`**

- Импорты: убрать `roadCells, roadDone, roadFocus` (41) и `roadPanel` из импорта панелей (84); добавить `import { campaignCells, campaignDone, campaignFocus, CAMPAIGN, numberOf, stopOf } from '../levels/campaign';`.
- `showLevels` (1702–1728):

```ts
    const { levels } = this.settings;
    const current = this.kind === 'level' && this.labSpec === null
      ? (numberOf(this.piece !== null ? { road: this.piece } : { level: this.levelIndex }) ?? 1) - 1
      : campaignFocus(levels, levels.passed[FIRST_ID] === true, this.nextLevel());
    this.shell.showPanel(
      levelsPanel(campaignCells(levels), current, {
        onPick: (index) => {
          const stop = CAMPAIGN[index];
          if (stop.board.road !== undefined) this.startPiece(stop.board.road);
          else this.startLevel(stop.board.level!, true);
        },
        share: { label: () => this.shareLabel(), action: () => this.shareLevels() },
        onBack: () => this.showMenu(),
      }),
      true,
    );
```

  `ladder()` в `showLevels` больше не нужен; `startLevel` по-прежнему проверяет `locked` (ворота выключены, все открыты).
- `showRoad` удалить; `showHowTo`: `onBack: () => this.showMenu('howto')`.
- `open`: `case 'rules': return this.showHowTo();` вместо `case 'road'`.
- Данные меню (2014–2020): убрать `roadDone`, `roadTotal`; `levelsDone: campaignDone(this.settings.levels)`, `levelsTotal: CAMPAIGN.length`; добавить `rules: HOW_TO_PLAY.length`.
- Заголовок (2730): `number: this.labSpec === null ? numberOf(this.piece !== null ? { road: this.piece } : { level: this.levelIndex }) : null`.
- `step()` (836–837): одна ветка для уровня — `{ step_id: \`level_${this.levelId()}\`, step_index: numberOf(...) ?? undefined }`; доска лаборатории — без `step_index`.
- Строка 2729 комментарий «A piece of the road has no number» убрать.
- Строка над полем — по коду любой доски ряда, не только куска дороги (спека, раздел 9, пункт 5): в `runLevel` (1285) `const carried = this.labSpec === null ? (ROAD_HINTS[spec.id] ?? (this.piece !== null ? HINT_PROBE : null)) : null;`. Сейчас ни у одного уровня списка строки нет, поведение игры не меняется; акт I положит сюда `hintSeven` по коду `K17`. Тест: в `src/app/hint.test.ts` ничего не меняется; проверка — `npm run typecheck`.

- [ ] **Step 6: `menu.ts` и `shellLab.ts`**

В `MenuData` (`src/shell/screens/menu.ts:33` и рядом) заменить `roadDone`, `roadTotal` на `rules: number`; в строке 360 поле файла «Как играть» печатать `${digits(data.rules, 2)}` под словом, которым это поле печаталось до 10 октября (`規則`, см. [VI_Interface_Layer.md](../../art/VI_Interface_Layer.md), строка `HOW TO PLAY`: «до 10 октября — `規則 08`, число правил»); посмотреть, как сейчас печатается `levelsDone/levelsTotal`, и сделать так же. `SAMPLE_DATA` в `src/lab/shellLab.ts`: `levelsTotal: 33, rules: 8`, без `roadDone`/`roadTotal`.

- [ ] **Step 7: Удалить `roadList.ts`, запустить всё**

```bash
git rm src/levels/roadList.ts src/levels/roadList.test.ts
npm test && npm run typecheck
```

Expected: PASS; `grep -rn "roadPanel\|roadCells\|roadDone\|roadTotal\|showRoad" src` пусто.

- [ ] **Step 8: Проверка в preview**

`preview_start` `vi-dev`. На рамке 360×640 и на 1920×1080:
1. Новый игрок (чистые настройки, `?first`): `START` на `R01`; в заголовке номер 1; пройти `R01`, `R02`: заголовки 2, 3; меню → «Уровни»: 33 клетки, фокус на третьей; «Как играть» → сразу страницы правил, назад — меню.
2. Сохранение за дорогой: в консоли выставить `settings.levels.road = 'R17'` (как хранится — см. `src/platform/settings.ts`), перезагрузить: `START` на `P13`, номер 17, список на 17-й клетке.
3. Выбрать из списка `R03`, стоя на `R12`: `R03` играется, после прохода список снова на 12-й.
4. HUD на 360×640 с номером `LV 01`…`LV 33`: ничего не наезжает.
Скриншоты по пункту 1 и 4 — в раздел «Что вышло иначе» этого плана словами (что увидено), сами файлы не коммитить.

- [ ] **Step 9: Документы и коммит**

[docs/art/VI_Interface_Layer.md](../../art/VI_Interface_Layer.md): строка `HOW TO PLAY` — с 12 октября файл открывает страницы правил, список кусков дороги ушёл в «Уровни», поле файла — число правил; строка «Уровни» — список на все 33 доски кампании с номерами 1–33, куски дороги в нём первыми, заголовок уровня показывает номер и на куске дороги. Ссылка на спеку кампании, раздел 9.

```bash
git add src/app/game.ts src/app/passage.ts src/app/passage.test.ts src/shell/panels.ts src/shell/screens/menu.ts src/shell/levelPanels.test.ts src/lab/shellLab.ts docs/art/VI_Interface_Layer.md
git commit -m "Один файл «Уровни»: дорога и список одним рядом с номерами 1–33"
```

---

### Task 4: Предел ходов: убрать из кода, слов и правил

Предела ходов в игре уже нет: `startLevel` ставит уровень как хранится (`moves: 0`, `src/app/game.ts:1257`), `limitedLevel` и `moveLimit` зовутся только из тестов. Остаются слова «Ходы ограничены» в семи языках и строки правил. Слово владельца 12 октября: «предел ходов не нужен сейчас».

**Files:**
- Modify: `src/levels/progress.ts:60-92` (`LIMIT_SPARE`, `moveLimit`, `limitedLevel` и их комментарии в шапке модуля)
- Modify: `src/levels/gates.test.ts:35-48`, `src/levels/levels.test.ts:14,118-126`
- Modify: `src/ui/i18n.ts:170,300`, `src/ui/lang/de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `tr.ts` — ключ `howLevels`
- Modify: `src/levels/levels.ts:9-11` (комментарий шапки)
- Docs: `docs/VI_Levels_Rules.md` разделы 7, 8, 12; `docs/art/VI_Claims.md` (если строка `howLevels` там записана — поправить утверждение)

- [ ] **Step 1: Тесты**

В `src/levels/gates.test.ts` удалить `describe('the limit of moves of a chapter')` (35–48) и импорты `limitedLevel`, `moveLimit`. В `src/levels/levels.test.ts` найти тест 118 («…the level as it is kept has no limit of moves») и оставить только проверку `spec.moves === 0` у каждого уровня; убрать импорт `limitedLevel`. Добавить в `src/ui/i18n.test.ts` (если файла нет — в `src/ui/lang/words.test.ts` или рядом, где проверяются ключи): для каждого из семи языков `t('howLevels')` не содержит слов «ограничен», «limited», «begrenzt», «limitad», «limité», «limitad», «sınırl» (по языку). Проще: один тест, что строка `howLevels` каждого языка состоит из трёх строк (`split('\n').length === 3`).

- [ ] **Step 2: Запустить — падают** (тест трёх строк).

- [ ] **Step 3: Код и слова**

`progress.ts`: удалить `LIMIT_SPARE`, `moveLimit`, `limitedLevel`; из шапки модуля убрать абзац о пределе; `CHAPTERS[].times` в `recipes.ts` остаётся (его читают рецепты) — проверить `grep -rn "\.times" src` и, если `times` больше никто не читает, убрать поле из `CHAPTERS` и его тип. `howLevels` в семи языках — без строки о ходах: ru «УРОВНИ: убери с поля все кости.\nРаботают только грани уровня, остальные помечены крестом.\nПравила пола здесь свои: наверх — только по уходящей кости.»; en «LEVELS: clear every die off the board.\nOnly the faces of the level work, the others are marked with a cross.\nThe floor has rules of its own here: the only way up is a leaving die.»; de, es, fr, pt, tr — убрать соответствующее предложение, не переводя заново остальное. Комментарий шапки `levels.ts`: «As it is kept here a level has no limit of moves; played, it has the generous one of its chapter» → «A level has no limit of moves: it is played as it is kept».

- [ ] **Step 4: Правила**

[docs/VI_Levels_Rules.md](../../VI_Levels_Rules.md): раздел 7 — строка «**Вышли ходы:** у уровня есть предел ходов» → «**Вышли ходы** — на кампании не наступает: предела ходов у уровней нет с 12 октября 2026 (слово владельца: «предел ходов не нужен сейчас»); правило остаётся в коде для Endless и проб»; раздел 8 — строка «Предел ходов остаётся щедрым…» → «Предела ходов нет (12 октября 2026)»; раздел 12 — новая строка таблицы «12 октября | предел ходов снят на всех уровнях: число, не правило; `moveLimit` и `limitedLevel` убраны | владелец». Шапку страницы не менять (правила хода не менялись). Если в `docs/art/VI_Claims.md` есть запись о строке `howLevels` — поправить её текст.

- [ ] **Step 5: Тесты, документы, коммит**

```bash
npm test && npm run typecheck && node scripts/docs-check.mjs
git add src/levels/progress.ts src/levels/gates.test.ts src/levels/levels.test.ts src/levels/levels.ts src/ui docs/VI_Levels_Rules.md docs/art/VI_Claims.md
git commit -m "Предел ходов: убран из кода и слов, правила уровня поправлены"
```

---

### Task 5: `R10` без обхода, шестая редакция дороги

**Files:**
- Modify: `src/levels/road.ts:172-195` (доска `R10` и её картинка), `436` (`ROAD_EDITION`), `527-560` (`toRoadEdition`)
- Modify: `src/levels/road.test.ts:93` (`KEYS.R10`), `470-517` (тест `R10`), тесты редакций (найти по `ROAD_EDITION`)
- Docs: `docs/superpowers/specs/2026-10-09-vi-road-free-pieces-design.md` (шапка и раздел 16.7), `docs/VI_Levels_Rules.md` (не меняется: правила те же)

**Interfaces:**
- Produces: `ROAD_EDITION = 6`; `toRoadEdition` из пятой редакции снимает `stats['R10']` и оставляет `passed['R10']`.

Проверено решателем 12 октября на файле доски (лаборатория): фиксированная двойка на (1,3) вместо (2,0) даёт `par` 4, путь `0,3,N 3,1,S 3,2,W 2,2,W`, маршрут `K v ^ K` (`downAndUp`); с закрытым полом доска не чистится вовсе; верных первых ходов 1 (`0,3,N`).

- [ ] **Step 1: Тесты**

В `src/levels/road.test.ts`:
- `KEYS.R10` (93): `'N:roll E:descend E:walk N:mount E:hop S:roll W:roll W:roll'` (с уходящей пары на (0,2) шаг на восток на пол (1,2), по полу на восток (2,2), подъём на лесенку (2,1) к северу, шаг на кость (3,1) к востоку, перекат на юг, два на запад — к фиксированной двойке (1,3)). Если разбор `KEYS` ждёт другие имена шагов — взять их по строкам 116–130.
- Тест `R10` (470–517): `par` 4 вместо 2; `clearedWithout(spec, 7, 'floor')` → `false` (без пола решения нет и в `par` + 3); фиксированные кости `[2, 2]` как были (286); `leaving` у `R10` остаётся. Числа обхода (проигранных положений) пересчитать по факту и записать.
- Тест редакций: добавить

```ts
it('brings a player of the fifth edition to the sixth: R10 passed stays passed, its fewest moves are dropped, every other board keeps its own', () => {
  const kept = toRoadEdition({ passed: { R10: true, R09: true }, stats: { R10: { bestMoves: 2 }, R09: { bestMoves: 3 } }, road: 'R11', roadEdition: 5 });
  expect(kept.roadEdition).toBe(6);
  expect(kept.passed).toEqual({ R10: true, R09: true });
  expect(kept.stats).toEqual({ R09: { bestMoves: 3 } });
  expect(kept.road).toBe('R11');
});
```

- [ ] **Step 2: Запустить — падают.**

- [ ] **Step 3: Доска**

В `road.ts` у `R10`: кость `{ x: 2, z: 0, top: 2, north: 1, fixed: true }` → `{ x: 1, z: 3, top: 2, north: 1, fixed: true }`; `par: 4`; `solution: ['0,3,N', '3,1,S', '3,2,W', '2,2,W']`. Картинка в комментарии:

```
// # # # #    C1, the lesson of the way down and up, on a whole board. One roll north makes the 2s with
// 2 # s B    the 2 that waits, and the player stands on a die that is leaving. The die that is to make
// # # # #    the other 2s is off to the east, beside no die of the pair: no step over the dice leads to
// A 2 # #    it. Down to the floor, along it to the stair, up it while it stands, a step onto the die,
//            and three rolls, south and twice west, bring its 2 up beside the 2 that waits in the south
//            row. The stair goes with the first of them. Since 12 October 2026 the 2 that waits stands
//            at (1,3), not (2,0): there the board has no way round without the floor at all (the
//            campaign, docs/superpowers/specs/2026-10-12-vi-campaign-design.md, section 6).
```

Сверить восток/запад/юг с тем, как картинки читаются в этом файле (`z` растёт вниз, север вверху).

- [ ] **Step 4: Редакция**

`ROAD_EDITION = 6`. В `toRoadEdition`: пятая редакция — та же раскладка кодов, только `stats.R10` снимается:

```ts
const FIFTH_EDITION_RESET: readonly string[] = ['R10'];
...
if (kept.roadEdition === ROAD_EDITION) return kept;
const edition = kept.roadEdition === 2 || kept.roadEdition === 3 || kept.roadEdition === 4 || kept.roadEdition === 5 ? kept.roadEdition : 1;
```

и после `carried(kept.stats)`: `for (const code of FIFTH_EDITION_RESET) delete moved.stats[code];` — для редакций 1–5 (все они играли `R10` на прежней доске или не играли вовсе). Ветка `edition !== 4` для `road` → `edition !== 4 && edition !== 5`. Комментарий над функцией дополнить абзацем о пятой редакции.

- [ ] **Step 5: Прогнать**

```bash
npx vitest run src/levels/road.test.ts
node scripts/level.mjs check file=game:R10
node scripts/level.mjs regress
```

Expected: PASS; `check` — `moves 4`, `route K v ^ K`, `kept: same`; `regress` — `0 not ok`.

- [ ] **Step 6: Глазами**

Preview, `?road=R10`, рамка 360×640: лесенка и фиксированная двойка в южном ряду видны, строка урока горит до подъёма, после прохода переход на `R11` цел.

- [ ] **Step 7: Документы и коммит**

Спека дороги: в шапке — «с 12 октября дорога — пролог кампании ([спека](../specs/2026-10-12-vi-campaign-design.md)); `R10` переложен: двойка на (1,3), `par` 4, без обхода»; в разделе 16.7 после абзаца «На целом `R10` есть путь без пола…» — абзац «Снято 12 октября: …» с числами из `check`.

```bash
git add src/levels/road.ts src/levels/road.test.ts docs/superpowers/specs/2026-10-09-vi-road-free-pieces-design.md
git commit -m "Дорога: R10 без обхода, двойка на (1,3), шестая редакция"
```

---

### Task 6: Таблица ряда `node scripts/ladder.mjs campaign`

**Files:**
- Modify: `scripts/ladder.mjs:82-97` (ветка `road`), `src/levels/table.ts:34,45-75` (`ROAD_HEAD`, `roadRow`, `roadTable`)
- Docs: `docs/README.md` (строка команд раздела «Уровни»), `docs/VI_Levels_Lab.md` (если там перечислены команды `ladder`)

- [ ] **Step 1: Реализация**

В `table.ts`: `ROAD_HEAD` → `['n', 'board', 'role', 'size', 'dice', 'faces', 'par', 'turns', 'away', 'firsts', 'worst', 'lost', 'boards', 'hasty', 'casual']`; `roadRow(spec, role, walkLimit, runs)` получает первым параметром `number: number` и печатает его первым столбцом, а `turns` и `away` берёт из `scoreOf(spec, parseWay(spec.solution))` (как `measureBoard` уже считает партитуру — посмотреть, чем он разбирает `solution`). В `ladder.mjs` рядом с `flag('road')` добавить `flag('campaign')`: обходит `CAMPAIGN` из `/src/levels/campaign.ts`, роль — из `ROAD_PLACES` для кусков, `'list'` для уровней; `road` оставить как есть (с номером места на дороге). Таблица печатается `roadTable`.

- [ ] **Step 2: Проверить**

Run: `node scripts/ladder.mjs campaign` — 33 строки, номера 1–33, у `R02` `turns 1 away 0`, у `R10` `par 4`. Запуск долгий (минуты): запускать в фоне.

- [ ] **Step 3: Документы и коммит**

В [docs/README.md](../../README.md), команды раздела «Уровни»: `node scripts/ladder.mjs campaign` — таблица ряда. 

```bash
git add scripts/ladder.mjs src/levels/table.ts docs/README.md
git commit -m "ladder campaign: таблица ряда с номерами, turns и away"
```

---

### Task 7: Документы кампании, версия, публикация

**Files:**
- Modify: `docs/ROADMAP.md` (раздел «Кампания», состояние), `docs/VI_Levels_Probe_Key.md` (шапка), `docs/superpowers/specs/2026-10-12-vi-campaign-design.md` (новый раздел «Что вышло иначе» — только если что-то вышло иначе), этот план (статус в шапке → «выполнен», раздел «Что вышло иначе»)
- Modify: `package.json`, `package-lock.json` — версия

- [ ] **Step 1: Документы**

ROADMAP, раздел «Кампания»: «Состояние: шаг 1 выполнен <дата>, версия 0.2.51: ряд из 33 досок одним файлом «Уровни», предел ходов снят, `R10` без обхода, `turns`/`away` в лаборатории. Дальше — план акта I». Ключ пробы: в шапку абзац «С 12 октября уровни списка стоят в ряду кампании под номерами 17–33 за шестнадцатью кусками дороги; состав и порядок списка не менялись». Этот план: статус `выполнен`, раздел «Что вышло иначе» — всё, что сделано не по плану, и числа обхода `R10`, значения `turns`/`away` по `P03`.

- [ ] **Step 2: Проверки**

```bash
npm test && npm run typecheck && npm run build && node scripts/docs-check.mjs && node scripts/level.mjs regress
```

Expected: всё чисто.

- [ ] **Step 3: Версия и коммит**

```bash
npm version 0.2.51 --no-git-tag-version
git add package.json package-lock.json docs
git commit -m "Версия 0.2.51: кампания одним рядом, R10 без обхода, предел снят"
```

- [ ] **Step 4: Спросить «ок» на публикацию**

Показать владельцу: что изменилось для игрока (меню «Уровни» на 33 клетки, «Как играть» без списка, номер на кусках дороги, `R10`), что не изменилось (доски, правила, звёзды), и спросить «ок?». После «ок»: `git fetch origin main && git rebase origin/main`, проверки шага 2 ещё раз, `git push origin HEAD:main`.

---

## Что вышло иначе

Выполнено 12–13 октября 2026 одной сессией в worktree `campaign-row`, задачи 1–7 по порядку, коммит на задачу.

### Отступления от плана

1. **Ряд — 34 доски, не 33.** В `LEVELS` восемнадцать уровней: `P31` встал в список вечером 12 октября (`0972f7b`), после того как спека посчитала семнадцать. Ряд собран как есть: шестнадцать кусков дороги и восемнадцать уровней, номера 1–34; уровни списка стоят под номерами 17–34. Документы пишут 34.
2. **Фокус списка — место игрока в ряду, а не доска, которая играется.** Код задачи 3 ставил фокус на играемую доску, а пункт 3 раздела Review Focus и спека (раздел 9, пункт 4) хотят, чтобы после куска, выбранного вне очереди, список снова открывался на своём месте. Сделано так: на дороге — кусок, на котором игрок стоит (как было у списка кусков), за дорогой — уровень, который играется, или первый непройденный (как было у списка уровней). Цена: игрок на дороге, поставивший уровень списка вне очереди и открывший список из паузы, видит фокус на своём куске дороги.
3. **`Board` живёт в `src/levels/campaign.ts`**, `passage.ts` его переэкспортирует: `src/levels` ничего не берёт из `src/app`. `levelsPanel` принимает клетку по форме (`CampaignCell` под неё подходит), `src/shell` не берёт тип из `src/levels`.
4. **Поле файла «Как играть»** — `規則 08`: кроме `menu.ts`, правка в `src/shell/text.ts` (`FileField` `rules`, `MENU_FILES`). Слова `LADDER` (`LOCKED`, `STARS`) в `text.ts` остались непрочитанными — мёртвый код, не тронут.
5. **Окно перед уровнем** (`showLevelIntro`) тоже читает номер ряда: иначе оно разошлось бы с шапкой. Сейчас ни один уровень окна не показывает.
6. **Предел ходов читали ещё три места**, которых план не назвал: `src/levels/progress.test.ts`, `src/levels/levels.test.ts` (тест «уровень как он играется» теперь проверяет, что уровень играется как хранится и чистится своим путём) и `scripts/stars.mjs` (держит у себя прежний предел `5 × par + 10`, чтобы мерить против него, и говорит, что в игре предела нет). Поле `times` у `ChapterRule` убрано: его никто не читает.
7. **`howLevels` без строки о ходах больше не говорит о звёздах**: убранное предложение было единственным местом страницы правил, где они названы. Записи о `howLevels` в `VI_Claims.md` нет; поправлена строка в `VI_Interface_Layer.md`.
8. **Перенос сохранений пятой редакции.** По наброску плана сохранение пятой редакции прошло бы через перестановку `R06` ↔ `R07` второй раз. Пятая редакция перестановку пропускает; тест добавлен (`R06`, `R07` и место остаются как были). Запись ходов `R10` снимается у сохранений всех прежних редакций. Тесты загрузки настроек (`src/platform/settings.test.ts`) ждут шестую редакцию.
9. **Спека дороги — только шапка.** План просил абзац в разделе 16.7; по правилу проекта в решении меняется только шапка. Числа — здесь, ниже.
10. **Метка маршрута `R10`** — `K v ^ K (other)`, а не `downAndUp`: `kindOf` называет `downAndUp` только путь с подъёмом после толчка. Маршрут тот, что в плане.
11. **Таблица.** У `roadRow` первым параметром номер места; `ladder.mjs road` и `campaign` — одна ветка скрипта, `road` — первые шестнадцать строк ряда. Мерило `away` считается по парам «откуда — куда» каждого переката, а не по цепочке клеток: так оно не врёт, если кость между перекатами толкнули.

### Числа, которые план просил записать

- **`P03`**, путь из файла (он же путь решателя) `2,2,N 2,1,N 2,0,W 1,2,E 2,2,N 1,0,E 1,1,N`: `turns` 3, `away` 1.
- **`R01`**: `turns` 0, `away` 0. **`R02`**: `turns` 1, `away` 0.
- **`R10` новый**: `par` 4, путь `0,3,N 3,1,S 3,2,W 2,2,W`, маршрут `K v ^ K`, `turns` 1, `away` 0, досок у решателя 21. Без пола (`ban: floor`) и без подъёма (`ban: up`) решения нет вовсе — перебор полный.
- **Обход `R10`.** В двух ходах от старта: 6 досок, 1 тупик, объявленный сразу, 1 молча проигранная, худшее число ходов из остальных 4 (было 9, 1, 0, 6). Обход `walk`: 247 досок — все, без обрезки на 300; проиграно 17; худшее 6; первая проигранная — `NEEEN` (было: 300 с обрезкой, 40, 8, `EWN`).
- **Условие спеки «первый тупик не раньше третьего хода».** По клавишам обхода оно держится: пять клавиш. По ходам — нет: это второй ход. Игрок собирает пару двоек, сходит на пол, проходит мимо лесенки и толкает дальнюю кость на север, от ряда, где ждёт её двойка; уровень этого не объявляет. Прежняя доска в двух ходах молча не проигрывалась. Сказано владельцу при вопросе о публикации.

### Что проверено глазами

Preview из worktree (свой порт, своё хранилище), рамка 360×640 и экран 1920×1080.

- **Новый игрок, `?first`:** доска `R01`, в шапке `LV 01`; `R02` — `LV 02`. Шапка на 360×640 с номером не наезжает ни на очки, ни на кнопки.
- **Сохранение на дороге** (`road = R03`, два куска пройдены): `START` на `R03`; «Уровни» — 34 клетки, шесть в ряд, фокус на третьей, под клетками `FACE 2 · CLEAR 02`; поле файла в меню `完了 02/34`.
- **«Как играть»:** сразу страница правил `КАК ИГРАТЬ 1/3`, `НАЗАД` ведёт в меню на тот же файл; поле файла `規則 08`.
- **Кусок вне очереди** (`road = R12`, выбран `R03`): играется `R03` с `LV 03`, список снова открывается на двенадцатой клетке. Что проход `R03` место не двигает, держит тест `placeAfter`.
- **За дорогой** (`road = R17`): `START` на `P13`, шапка `LV 17`, список на семнадцатой клетке; последний уровень — `LV 34`.
- **Широкий экран:** 34 клетки по десять в ряд, фокус и строка цели на месте; шапка колонкой с `LV 10` на `R10`.
- **`R10` на 360×640:** лесенка и фиксированная двойка в южном ряду видны, строка урока горит до подъёма на лесенку, доска пройдена клавишами за четыре хода (`BEST 004`), переход на `R11` цел.
- **Страница лаборатории** `?lab=levels`: строка `turns 1 · away 0` в ярусе «секунды» — смотрено на `P06` (страница открывает файлы `boards/`, адреса `board=game:R02` у неё нет; `R02` проверен тестом и `check`).

### Таблица ряда

`node scripts/ladder.mjs campaign` с обходом по умолчанию (`walk=300`) за сорок минут посчитала 32 доски из 34 и была остановлена: на двух уровнях списка обход трёхсот досок не кончается за разумное время. С `walk=30` таблица считается за три минуты; числа обхода (`worst`, `lost`, `boards`) в ней — только о тридцати досках, ближайших к старту. Это недостача лаборатории, не ряда: полный обход уровней списка надо либо резать по времени, либо считать по одной доске.

```
n   board  role    size  dice  faces  par  turns  away  firsts  worst  lost  boards  hasty  casual
1   R01    lesson  1x6   2     2      4    0      0     1       4      0     5       100%   100%
2   R02    lesson  3x7   5     3      4    1      0     1       7      0     13      90%    97%
3   R03    free    3x3   2     2      2    1      0     2       6+     0+    30+     80%    97%
4   R04    free    3x4   3     3      2    1      0     2       4+     0+    30+     87%    100%
5   R05    free    4x3   4     2      3    1      0     2       5+     1+    30+     47%    93%
6   R06    free    4x4   4     3      2    1      0     1       5+     10+   30+     97%    100%
7   R07    lesson  4x4   3     2      4    1      0     2       5+     0+    30+     70%    83%
8   R08    free    4x4   5     2      5    1      0     1       8+     1+    30+     53%    77%
9   R09    mix     4x4   5     3 2    3    1      0     3       5+     1+    30+     80%    97%
10  R10    lesson  4x4   5     2      4    1      0     1       5+     3+    30+     90%    97%
11  R11    free    4x4   5     3 2    3    1      0     2       7+     0+    30+     93%    97%
12  R12    mix     4x4   6     3 2    3    1      0     2       6+     0+    30+     90%    97%
13  R13    lesson  4x4   5     2 3    3    1      0     1       7+     0+    30+     90%    100%
14  R14    free    4x4   6     2 3    3    1      0     2       9+     0+    30+     90%    97%
15  R15    free    4x4   5     3 2    3    1      0     2       4+     0+    30+     93%    93%
16  R16    mix     4x4   6     3 2    4    0      0     2       7+     1+    30+     80%    83%
17  P13    list    4x4   6     6      5    2      1     6       7+     0+    30+     3%     13%
18  P04    list    4x4   6     5      4    1      0     1       7+     3+    30+     17%    83%
19  P09    list    4x4   6     3      5    3      1     2       7+     0+    30+     7%     10%
20  P02    list    4x2   4     2      4    1      0     1       6+     2+    30+     23%    80%
21  P14    list    4x4   5     4      4    1      0     1       6+     1+    30+     23%    53%
22  P03    list    3x3   3     3      7    3      1     1       9+     0+    30+     7%     7%
23  P20    list    4x4   7     3      6    1      0     1       9+     0+    30+     27%    63%
24  P16    list    4x4   6     3      4    2      0     1       6+     1+    30+     3%     0%
25  P07    list    3x3   5     2 3    4    1      0     2       7+     0+    30+     33%    7%
26  P01    list    3x3   4     3      6    3      0     4       9+     0+    30+     27%    43%
27  P12    list    4x4   6     2 3    4    1      0     1       7+     0+    30+     20%    43%
28  P08    list    4x4   6     2 3    4    1      0     3       6+     4+    30+     63%    97%
29  P06    list    4x4   5     2      4    1      0     1       7+     0+    30+     53%    87%
30  P05    list    3x3   6     3      6    3      1     3       7+     0+    30+     17%    23%
31  P17    list    4x4   7     3 4    5    2      0     4       8+     0+    30+     0%     3%
32  P15    list    3x3   7     2 3    6    1      0     2       8+     0+    30+     10%    37%
33  P31    list    4x4   6     6      4    2      0     2       7+     0+    30+     10%    40%
34  P19    list    4x4   6     3      4    1      0     1       7+     1+    30+     33%    43%
```

### Ревью ветки

Свежий ревьюер (Opus) на всю ветку: критичного нет. Поправлено: строка страницы-истины `docs/art/VI_World_Logic.md` о `moveLimit`. Оставлено как есть и названо владельцу: молча проигранное положение `R10` на втором ходу. Мелочи, не тронутые: у перенесённого `R10` в списке одна звезда, а очки её не считают, пока доска не сыграна заново; перенос снимает всю запись `R10`, а не только лучшие ходы; `step_index` аналитики с 0.2.51 значит номер ряда (уровни списка 17–34 вместо 1–18); `SHARE` в списке на 34 клетки отчитывается о восемнадцати уровнях списка; комментарии над `startPiece` и над файлом `howto` в `text.ts` устарели; слова `LADDER` читает только тест.
