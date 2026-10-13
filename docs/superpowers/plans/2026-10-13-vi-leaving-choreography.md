# Уход группы на уровне: замах, удар, ступени ударом — план

> Вид: план. Статус: выполнен (первая постройка опубликована 13 октября 2026 коммитом `31b8893`, второй круг — `010d68c`; третий — в ветке). Дата: 2026-10-13. Проверено: 2026-10-13.
> Что заменило: —. Что живёт в коде: src/render/ease.ts, src/render/leaving.ts, src/render/punch.ts, src/render/view.ts, src/render/cubes.ts, src/app/juice.ts, src/app/game.ts.
> Где код разошёлся с этим планом — раздел 9 [спеки](../specs/2026-10-13-vi-leaving-choreography-design.md); второй и третий круги правок после игры владельца — её разделы 10 и 11. Код в задачах ниже — первая постройка; в игре стоит третий круг (раздел 11 спеки), таймлайна ударов из задачи 3 в коде больше нет.

> **Исполнителю (Opus):** вести по superpowers:executing-plans (сам, задача за задачей) или superpowers:subagent-driven-development. Шаги — чекбоксы. Субагентов запускать с `model: opus` для реализации и `model: sonnet` для поиска.

**Цель:** на уровне группа уходящих костей уходит как одно тело: замах, пауза, удар на первую ступень, отдача; каждое приземление переката вбивает её на ступень; в конце удар под пол и кольцо у пола; удары поля и звук срабатывают в момент удара; толчок камеры получает атаку.

**Архитектура:** правила (`src/rules`) не трогаются. В `src/render/leaving.ts` появляется таймлайн `LeavingShow`, который в картинном времени ведёт показанную высоту каждой уходящей кости уровня и отдаёт события `sent`, `impact`, `step`, `gone`; все, кто читал `shownHeight`, читают его через `BoardView.heightOf`. Кривые — в новом `src/render/ease.ts`. `Game` держит удары `match`/`chain` до `impact`.

**Стек:** TypeScript, three.js, vitest. Проверки: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`.

**Спека:** [2026-10-13-vi-leaving-choreography-design.md](../specs/2026-10-13-vi-leaving-choreography-design.md). Читать её разделы 3–5 до начала; план спорит со спекой только там, где прямо сказано.

## Где и как работать

- Worktree `.claude/worktrees/leaving`, ветка `leaving` от `origin/main` (не старше `b602307`). Основную папку `GAMES\VI` не трогать.
- Коммит после каждой задачи, заголовок до 70 знаков, тело до пяти строк. Публикация: `git fetch`, rebase на `origin/main`, все проверки, `git push origin HEAD:main` — только после «ок» владельца.
- Дев-сервер только через preview (`vi-dev`, порт 5183); страница worktree на общем сервере и покадровая съёмка через CDP — память `vi-preview-of-a-worktree`.
- Стиль кода как вокруг: комментарии по-английски, объясняют «почему»; документы по-русски.

## Общие ограничения

- `src/rules` не меняется ни на строку; `cubeHeight` и `leavingHeight` считают то же, что считали.
- Endless не меняется: вне `state.levelRun` `LeavingShow.height` возвращает `shownHeight`, `frame` ничего не делает и событий не отдаёт. Единственное общее изменение — атака и спад толчка камеры (3.4 спеки).
- Переход между досками (`passing`) не меняется: `passingHeight` по-прежнему получает на вход показанную высоту.
- Новых вызовов отрисовки нет; призраки рисуются стеклянными костями из запаса `spare` в `CubeMeshes`.
- Уменьшенное движение: без замаха, паузы, отдачи и призраков; кольцо у пола не рисуется.
- Все числа — в группе `leaving` в `src/render/params.ts`, с теми же именами и умолчаниями, что в разделе 5 спеки.

## На что смотреть ревьюеру

1. Быстрый игрок: приземление во время удара или отдачи должно оборвать движение и бить от текущей высоты к новой ступени, без скачка (тест в задаче 3, шаг 7).
2. Кость, по которой прокатились (убрана раньше времени, `removed` с `crumble`): призрака и кольца быть не должно; `crumble` как был (задача 3, шаг 8).
3. Кость под игроком в момент совпадения: просадка `pressDepth` не должна выстреливать вверх; замах начинается с просаженной высоты (задача 4, шаг 4).
4. Уровень пройден (`state.over`, переход): таймлайн молчит, удержанные удары не раздаются после конца (задача 6, шаг 3).
5. Две группы на одном приземлении: один `impact` раздаёт оба удержанных удара; `gone` двух групп даёт два кольца (задача 3, шаг 6; задача 6).

---

### Задача 1: словарь кривых `src/render/ease.ts`

**Файлы:**
- Создать: `src/render/ease.ts`
- Тест: `src/render/ease.test.ts`

**Интерфейсы:**
- Даёт: `type Curve = (t: number) => number`; `linear, inQuad, outQuad, inCubic, outCubic, inQuart, inExpo, inOutSine: Curve`; `outBack(overshoot?: number): Curve`; `CURVES: Record<string, Curve>`; `tween(t, from, to, curve): number`.

- [ ] **Шаг 1: тест**

```ts
// src/render/ease.test.ts
import { describe, expect, it } from 'vitest';
import { CURVES, inExpo, inOutSine, inQuart, outBack, outCubic, tween } from './ease';

describe('the curves of the look', () => {
  it('start at 0 and end at 1', () => {
    for (const [name, curve] of Object.entries(CURVES)) {
      expect(curve(0), name).toBeCloseTo(0);
      expect(curve(1), name).toBeCloseTo(1);
    }
  });

  it('go one way: none of them turns back', () => {
    for (const [name, curve] of Object.entries(CURVES)) {
      let last = curve(0);
      for (let i = 1; i <= 100; i++) {
        const next = curve(i / 100);
        expect(next, `${name} at ${i}`).toBeGreaterThanOrEqual(last - 1e-9);
        last = next;
      }
    }
  });

  it('is slow at the start when it is in, and slow at the end when it is out', () => {
    expect(inQuart(0.5)).toBeLessThan(0.1);
    expect(inExpo(0.5)).toBeLessThan(0.05);
    expect(outCubic(0.5)).toBeGreaterThan(0.85);
    expect(inOutSine(0.5)).toBeCloseTo(0.5);
  });

  it('goes past the end and comes back when it is back', () => {
    const back = outBack();
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => back(i / 100)))).toBeGreaterThan(1.05);
    expect(back(1)).toBeCloseTo(1);
  });

  it('tweens from one number to another along a curve, and stays at the ends outside 0..1', () => {
    expect(tween(0.5, 2, 4, (t) => t)).toBeCloseTo(3);
    expect(tween(-1, 2, 4, (t) => t)).toBe(2);
    expect(tween(2, 2, 4, (t) => t)).toBe(4);
  });
});
```

- [ ] **Шаг 2: убедиться, что тест падает**

```bash
npx vitest run src/render/ease.test.ts
```
Ожидание: FAIL, модуль `./ease` не найден.

- [ ] **Шаг 3: реализация**

```ts
// src/render/ease.ts
/**
 * The curves every movement of the look goes by, by name, so that the look has one vocabulary
 * of motion (docs/art/VI_Visual_Language.md, «Словарь движения»). `t` is the share of the
 * movement done, 0 to 1; the result is the share of the way gone, 0 to 1, except for a curve
 * that goes past the end and comes back.
 */
export type Curve = (t: number) => number;

export const linear: Curve = (t) => t;
export const inQuad: Curve = (t) => t * t;
export const outQuad: Curve = (t) => 1 - (1 - t) * (1 - t);
export const inCubic: Curve = (t) => t * t * t;
export const outCubic: Curve = (t) => 1 - Math.pow(1 - t, 3);
export const inQuart: Curve = (t) => t * t * t * t;
export const inExpo: Curve = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, 10 * t - 10));
export const inOutSine: Curve = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Goes past the end by about a tenth with the usual `overshoot`, and comes back to it. */
export function outBack(overshoot = 1.70158): Curve {
  const c3 = overshoot + 1;
  return (t) => 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

/** The curves by name: for the numbers of the look that pick one. */
export const CURVES: Record<string, Curve> = { linear, inQuad, outQuad, inCubic, outCubic, inQuart, inExpo, inOutSine, outBack: outBack() };

/** Where a movement from `from` to `to` is at share `t` of its time, along `curve`; held at either end outside 0..1. */
export function tween(t: number, from: number, to: number, curve: Curve): number {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return from + (to - from) * curve(t);
}
```

- [ ] **Шаг 4: тест проходит**

```bash
npx vitest run src/render/ease.test.ts
```
Ожидание: PASS, 5 тестов.

- [ ] **Шаг 5: коммит**

```bash
git add src/render/ease.ts src/render/ease.test.ts
git commit -m "Словарь кривых движения: ease.ts"
```

---

### Задача 2: группа параметров «Уход» и пружина, которую можно забыть

**Файлы:**
- Изменить: `src/render/params.ts` (рядом с группой `road`, после `stairMiddle`)
- Изменить: `src/render/springs.ts`
- Тест: `src/render/params.test.ts` (добавить), `src/render/springs.test.ts` (добавить)

**Интерфейсы:**
- Даёт: `boardDefaults()` содержит `liftHeight, liftMs, hangMs, dropMs, dropCurve, settleMs, settleOver, stepMs, sighHeight, sighMs, endRingReach, endRingMs, punchAttackMs, punchDecayMs`; `CubeSprings.forget(id: number): void`.

- [ ] **Шаг 1: тесты**

В `src/render/params.test.ts` добавить:

```ts
it('has the numbers of the leaving of a group, as the spec sets them', () => {
  const values = boardDefaults();
  expect(values.liftHeight).toBe(0.08);
  expect(values.liftMs).toBe(90);
  expect(values.hangMs).toBe(60);
  expect(values.dropMs).toBe(130);
  expect(values.dropCurve).toBe(1);
  expect(values.settleMs).toBe(120);
  expect(values.settleOver).toBe(0.015);
  expect(values.stepMs).toBe(120);
  expect(values.sighHeight).toBe(0.04);
  expect(values.sighMs).toBe(160);
  expect(values.endRingReach).toBe(1.6);
  expect(values.endRingMs).toBe(300);
  expect(values.punchAttackMs).toBe(30);
  expect(values.punchDecayMs).toBe(120);
});
```

В `src/render/springs.test.ts` добавить:

```ts
it('forgets a cube: its offset is nothing at once, with no spring back', () => {
  const springs = new CubeSprings();
  springs.hold(7, 0.1);
  springs.update(500);
  expect(springs.offset(7)).toBeCloseTo(-0.1, 2);
  springs.forget(7);
  expect(springs.offset(7)).toBe(0);
  springs.update(16);
  expect(springs.offset(7)).toBe(0);
});
```

- [ ] **Шаг 2: убедиться, что тесты падают**

```bash
npx vitest run src/render/params.test.ts src/render/springs.test.ts
```
Ожидание: FAIL (`liftHeight` undefined; `forget` не функция).

- [ ] **Шаг 3: реализация**

В `src/render/params.ts`, в `BOARD_GROUPS`, после группы `road` новая группа (по образцу `road`: тот же помощник `number(default, min, max, step)` и комментарии перед полями):

```ts
  leaving: {
    /**
     * A group that leaves a level goes as one body (the owner, 13 October: «все приподнимаются
     * как одна плита»): up over its full height by `liftHeight` in `liftMs`, hangs for `hangMs`,
     * drops onto its first step in `dropMs` along the curve `dropCurve` (0 inCubic, 1 inQuart,
     * 2 inExpo), presses `settleOver` of a die below the step and comes back in `settleMs`. Every
     * landing of the figure's roll drives it one step down in `stepMs`, the last one under the
     * floor; then a ring runs over the floor from its middle, `endRingReach` cells in `endRingMs`.
     * A chain that is added to on a level sighs: up `sighHeight` and back in `sighMs`.
     */
    liftHeight: number(0.08, 0, 0.3, 0.01),
    liftMs: number(90, 0, 300, 10),
    hangMs: number(60, 0, 300, 10),
    dropMs: number(130, 40, 400, 10),
    dropCurve: number(1, 0, 2, 1),
    settleMs: number(120, 0, 400, 10),
    settleOver: number(0.015, 0, 0.1, 0.005),
    stepMs: number(120, 40, 400, 10),
    sighHeight: number(0.04, 0, 0.2, 0.01),
    sighMs: number(160, 0, 500, 10),
    endRingReach: number(1.6, 0.5, 4, 0.1),
    endRingMs: number(300, 100, 800, 10),
    /** The lean of the camera on a beat: up to its peak in `punchAttackMs`, then down with a half-life of `punchDecayMs`. In every mode. */
    punchAttackMs: number(30, 0, 120, 5),
    punchDecayMs: number(120, 30, 400, 10),
  },
```

Если у группы есть русское имя для панели (посмотреть, как подписана `road`), подписать «Уход».

В `src/render/springs.ts` в класс `CubeSprings` добавить:

```ts
  /** Lets go of a cube at once: no spring is left on it, and nothing springs back. */
  forget(id: number): void {
    this.springs.delete(id);
  }
```

- [ ] **Шаг 4: тесты проходят, typecheck**

```bash
npx vitest run src/render/params.test.ts src/render/springs.test.ts
npm run typecheck
```

- [ ] **Шаг 5: коммит**

```bash
git add src/render/params.ts src/render/params.test.ts src/render/springs.ts src/render/springs.test.ts
git commit -m "Группа параметров «Уход» и CubeSprings.forget"
```

---

### Задача 3: таймлайн `LeavingShow` в `src/render/leaving.ts`

**Файлы:**
- Изменить: `src/render/leaving.ts` (добавить в конец; `leavingSteps`, `leavingHeight`, `isStair`, `shownHeight` остаются как есть)
- Тест: `src/render/leaving.test.ts` (новый `describe` в конце)

**Интерфейсы:**
- Берёт: `tween`, `outCubic`, `inCubic`, `inQuart`, `inExpo`, `inOutSine` из `./ease`; `worldRuns` из `../rules`; значения группы `leaving`.
- Даёт:

```ts
export type HeightOf = (cube: Cube, alpha: number) => number;
export interface LeavingEvent {
  kind: 'sent' | 'impact' | 'step' | 'gone';
  value: number;
  cells: readonly { x: number; z: number }[];
  /** The dice it is about; `sent` is for the view only, to let go of their springs. */
  cubeIds: readonly number[];
}
export interface Ghost { x: number; z: number; ori: Orientation; value: number; height: number }
export class LeavingShow {
  reset(): void;
  frame(state: RunState, dtMs: number, values: ParamValues, reducedMotion: boolean, dip: (cubeId: number) => number): LeavingEvent[];
  height(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number;
  ghosts(): readonly Ghost[];
  /** How high a ghost on this cell is, 0 with none or one under the floor. */
  ghostHeight(x: number, z: number): number;
}
```

- [ ] **Шаг 1: тесты**

В конец `src/render/leaving.test.ts` (импорты: `LeavingShow` из `./leaving`; `levelRun`, `put` из `../rules/testkit`; `boardDefaults` уже есть):

```ts
describe('the leaving of a group on a level, as one body', () => {
  const values = boardDefaults();
  const noDip = (): number => 0;

  /**
   * A level whose world stands, with a pair of 2s that has just been sent: t 1, as the rules have it
   * on the frame after the tick of the match (a tick of the window gone), six moves to go.
   */
  function sentPair(): { state: RunState; a: Cube; b: Cube } {
    const state = levelRun();
    const a = put(state, 1, 1, 2, 'sinking');
    const b = put(state, 2, 1, 2, 'sinking');
    a.t = b.t = 1;
    a.reactionId = b.reactionId = 1;
    state.reactions.push({ id: 1, value: 2, chain: 1, total: 2 });
    return { state, a, b };
  }

  /** A landing: the world has run a move and stands again. */
  function land(state: RunState, ...cubes: Cube[]): void {
    for (const cube of cubes) cube.t += state.config.actionTicks;
  }

  it('lifts a sent pair as one body, hangs, drops onto the first step and settles, with the beat on the drop', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    const first = show.frame(state, 0, values, false, noDip);
    expect(first.map((e) => e.kind)).toEqual(['sent']);
    expect(first[0].cubeIds).toEqual([a.id, b.id]);
    expect(show.height(a, state, 0)).toBeCloseTo(1);
    // 90 ms of lift: at the top.
    show.frame(state, 90, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(1.08);
    expect(show.height(b, state, 0)).toBeCloseTo(show.height(a, state, 0));
    // 60 ms of hang: still there.
    expect(show.frame(state, 60, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(1.08);
    // Half way into the drop it is still high: the curve is in.
    show.frame(state, 65, values, false, noDip);
    expect(show.height(a, state, 0)).toBeGreaterThan(1.0);
    // The drop ends 130 ms in: the beat, and the press below the step.
    const events = show.frame(state, 65, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['impact']);
    expect(events[0].value).toBe(2);
    expect(events[0].cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78 - 0.015);
    // The settle brings it back to the step.
    show.frame(state, 120, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
    show.frame(state, 1000, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
  });

  it('stands on its step through the roll, and is driven a step down when the roll lands', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    // The world runs: the figure rolls, and the rules take the dice down through the move.
    state.player.action = { kind: 'roll', dir: 'N', t: 5, fromX: 0, fromZ: 0, fromLevel: 'top' } as RunState['player']['action'];
    a.t = b.t = 5;
    show.frame(state, 100, values, false, noDip);
    expect(show.height(a, state, 0.5)).toBeCloseTo(0.78);
    // It lands: the world stands with the move done. The step it goes to is the one the rules have it on.
    state.player.action = undefined;
    a.t = b.t = 1 + state.config.actionTicks;
    const step1 = shownHeight(a, state, 0);
    expect(step1).toBeLessThan(0.7);
    expect(step1).toBeGreaterThan(0.6);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    show.frame(state, 60, values, false, noDip);
    expect(show.height(a, state, 0)).toBeLessThan(0.78);
    expect(show.height(a, state, 0)).toBeGreaterThan(step1);
    const events = show.frame(state, 60, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['step']);
    show.frame(state, 120, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
  });

  it('is what the rules have, with no events, outside a level', () => {
    const session = createRun({ seed: 1, config: defaultConfig() });
    const show = new LeavingShow();
    const sinking = { ...session.cubes[0], state: 'sinking' as const, t: 3 };
    session.cubes[0] = sinking;
    expect(show.frame(session, 16, values, false, noDip)).toEqual([]);
    expect(show.height(sinking, session, 0.5)).toBe(shownHeight(sinking, session, 0.5));
    expect(show.ghosts()).toEqual([]);
  });

  it('lets a chain that is added to sigh, and sends the new die by the whole lift and drop', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    land(state, a, b);
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    const step1 = shownHeight(a, state, 0);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
    // A third 2 joins: held for two moves by the rules, the pair stays where it is.
    const c = put(state, 3, 1, 2, 'sinking');
    c.t = 1;
    c.reactionId = 1;
    a.hold = b.hold = 2 * state.config.actionTicks;
    state.reactions[0].chain = 2;
    state.reactions[0].total = 3;
    const sent = show.frame(state, 0, values, false, noDip);
    expect(sent.map((e) => e.kind)).toEqual(['sent']);
    expect(sent[0].cubeIds).toEqual([c.id]);
    // Half way through the sigh the pair is up by the sigh; the new die is on its way up.
    show.frame(state, 80, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(step1 + 0.04);
    expect(show.height(c, state, 0)).toBeGreaterThan(1);
    show.frame(state, 80, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
    // The new die drops to its own first step, and that is the beat of the chain.
    const events = [...show.frame(state, 120, values, false, noDip), ...show.frame(state, 70, values, false, noDip)];
    expect(events.map((e) => e.kind)).toEqual(['impact']);
    expect(events[0].cubeIds).toEqual([c.id]);
    show.frame(state, 200, values, false, noDip);
    expect(show.height(c, state, 0)).toBeCloseTo(0.78);
  });

  it('keeps a ghost of a die the rules have taken at the end of its way, drives it under the floor and says so', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    // Five landings: the last step.
    for (let i = 0; i < 5; i++) {
      land(state, a, b);
      show.frame(state, 0, values, false, noDip);
      show.frame(state, 1000, values, false, noDip);
    }
    expect(show.height(a, state, 0)).toBeCloseTo(0.12);
    // The sixth: the rules take the pair away.
    state.cubes = state.cubes.filter((cube) => cube.id !== a.id && cube.id !== b.id);
    state.reactions = [];
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.ghosts().map((ghost) => [ghost.x, ghost.z, ghost.value])).toEqual([[1, 1, 2], [2, 1, 2]]);
    expect(show.ghostHeight(1, 1)).toBeCloseTo(0.12);
    show.frame(state, 60, values, false, noDip);
    expect(show.ghosts()[0].height).toBeLessThan(0.12);
    const events = show.frame(state, 60, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['gone']);
    expect(events[0].cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
    expect(show.ghosts()).toEqual([]);
    expect(show.ghostHeight(1, 1)).toBe(0);
  });

  it('cuts a drop short on a landing that comes early, and drops on from where it is', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 90 + 60 + 65, values, false, noDip);
    const midway = show.height(a, state, 0);
    expect(midway).toBeGreaterThan(0.78);
    land(state, a, b);
    const step1 = shownHeight(a, state, 0);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    // On the next frame it has gone down from where it was, not jumped.
    show.frame(state, 8, values, false, noDip);
    expect(show.height(a, state, 0)).toBeLessThanOrEqual(midway);
    expect(show.height(a, state, 0)).toBeGreaterThan(step1);
    const events = [...show.frame(state, 112, values, false, noDip), ...show.frame(state, 200, values, false, noDip)];
    // The first beat was never struck: the landing's step is what sounds, and the game lets its held beats go on it.
    expect(events.map((e) => e.kind)).toEqual(['step']);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
  });

  it('makes no ghost of a die taken away early, rolled over with moves still left to it', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    state.cubes = state.cubes.filter((cube) => cube.id !== a.id);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.ghosts()).toEqual([]);
    expect(show.height(b, state, 0)).toBeCloseTo(0.78);
  });

  it('puts a stair laid as leaving on its step at once, with no lift, and drives it down by landings like any die', () => {
    const stair = start(pieceOf('R02'));
    const show = new LeavingShow();
    const lower = cubeAt(stair, 4, 5)!;
    const upper = cubeAt(stair, 4, 4)!;
    expect(show.frame(stair, 0, values, false, noDip)).toEqual([]);
    expect(show.height(lower, stair, 0)).toBeCloseTo(0.12);
    expect(show.height(upper, stair, 0)).toBeCloseTo(0.5);
  });

  it('with less motion puts every die on its step at once, strikes the beat at once and keeps no ghost', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    const events = show.frame(state, 0, values, true, noDip);
    expect(events.map((e) => e.kind)).toEqual(['sent', 'impact']);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
    land(state, a, b);
    expect(show.frame(state, 0, values, true, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(shownHeight(a, state, 0));
    // Down to the last step, and taken away: said at once, with no ghost.
    for (let i = 0; i < 4; i++) {
      land(state, a, b);
      show.frame(state, 0, values, true, noDip);
    }
    expect(show.height(a, state, 0)).toBeCloseTo(0.12);
    state.cubes = [];
    state.reactions = [];
    expect(show.frame(state, 0, values, true, noDip).map((e) => e.kind)).toEqual(['gone']);
    expect(show.ghosts()).toEqual([]);
  });

  it('starts the lift from where the die was drawn: a die pressed under the figure does not jump up', () => {
    const { state, a } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    const pressed = new LeavingShow();
    pressed.frame(state, 0, values, false, (id) => (id === a.id ? -0.1 : 0));
    expect(pressed.height(a, state, 0)).toBeCloseTo(0.9);
    pressed.frame(state, 90, values, false, noDip);
    expect(pressed.height(a, state, 0)).toBeCloseTo(1.08);
  });
});
```

Если `put` не даёт выставить `t` или `hold` напрямую — это обычные поля `Cube`, тест ставит их после `put`. Если `state.player.action` типизирован строже, собрать объект по `PlayerAction` из `src/rules/types.ts`.

- [ ] **Шаг 2: убедиться, что тесты падают**

```bash
npx vitest run src/render/leaving.test.ts
```
Ожидание: FAIL, `LeavingShow` не экспортирован.

- [ ] **Шаг 3: реализация**

В конец `src/render/leaving.ts` (к импортам добавить `worldRuns` уже есть; `Orientation` из `../rules`; из `./ease` — `inCubic, inExpo, inOutSine, inQuart, outCubic, tween, type Curve`):

```ts
export type HeightOf = (cube: Cube, alpha: number) => number;

export interface LeavingEvent {
  kind: 'sent' | 'impact' | 'step' | 'gone';
  /** The face of the group, 1 to 6. */
  value: number;
  cells: readonly { x: number; z: number }[];
  /** The dice it is about; `sent` is for the view only, to let go of their springs. */
  cubeIds: readonly number[];
}

/** A die the rules have taken away that the show still draws: under the floor it goes. */
export interface Ghost {
  x: number;
  z: number;
  ori: Orientation;
  value: number;
  height: number;
}

type Phase = 'lift' | 'hang' | 'drop' | 'settle' | 'still' | 'sigh';

interface Going {
  id: number;
  x: number;
  z: number;
  ori: Orientation;
  value: number;
  reactionId: number;
  /** `cube.t` as it was when the world last stood: with the world standing, a change of it is a landing. */
  settledT: number;
  /** The step it goes to, and where the phase that is on started from. */
  target: number;
  from: number;
  phase: Phase;
  /** Time into the phase. */
  ms: number;
  /** The first drop is the beat of the group; every other is a step. */
  first: boolean;
  /** The rules have taken it: it goes under the floor and is let go of. */
  ghost: boolean;
  height: number;
}

const DROP_CURVES: readonly Curve[] = [inCubic, inQuart, inExpo];
/** Where a ghost is driven to: under the floor, out of sight. */
const UNDER = -0.5;
/** The numbers of the look where the values given say nothing of one (`boardDefaults` from `./params`). */
const DEFAULTS = boardDefaults();

/**
 * The leaving of a group on a level, as one body: a sent group lifts over its full height, hangs,
 * drops onto its first step and settles; every landing of the figure's roll drives it one step
 * down; the last landing drives it under the floor and a ring runs over the floor where it stood
 * (spec: docs/superpowers/specs/2026-10-13-vi-leaving-choreography-design.md). All in the time of
 * the picture: the rules know nothing of it and are read, never written. Outside a level it does
 * nothing and `height` is what `shownHeight` gives.
 */
export class LeavingShow {
  private readonly going = new Map<number, Going>();

  reset(): void {
    this.going.clear();
  }

  /**
   * Once a frame, before the dice are drawn: notices the dice that have just been sent, the
   * landings and the dice the rules have taken; moves every timeline on by `dtMs`. Returns what
   * fell due on this frame. `dip` is where the spring of a die holds it, so that a die pressed
   * under the figure lifts from where it is drawn.
   */
  frame(state: RunState, dtMs: number, values: ParamValues, reducedMotion: boolean, dip: (cubeId: number) => number): LeavingEvent[] {
    if (!state.levelRun || state.over) {
      this.going.clear();
      return [];
    }
    const n = (name: string): number => Number(values[name] ?? DEFAULTS[name] ?? 0);
    const steps = leavingSteps(values);
    const standing = !worldRuns(state) && !state.player.action;
    const events: LeavingEvent[] = [];
    const sent: Going[] = [];
    const seen = new Set<number>();

    for (const cube of state.cubes) {
      if (cube.state !== 'sinking') {
        this.going.delete(cube.id);
        continue;
      }
      seen.add(cube.id);
      let going = this.going.get(cube.id);
      if (!going) {
        // Just sent, with its whole window before it: it lifts. A stair the board was laid with, or a die found
        // half way down (the board was put on with it going), stands on its step at once.
        const fresh = cube.t <= 1 && !isStair(cube, state);
        const target = this.stepOf(cube, state, cube.t, steps);
        going = { id: cube.id, x: cube.x, z: cube.z, ori: cube.ori, value: cube.ori.top, reactionId: cube.reactionId, settledT: cube.t, target, from: 1 + dip(cube.id), phase: 'still', ms: 0, first: fresh, ghost: false, height: target };
        if (fresh) {
          going.height = going.from;
          going.phase = reducedMotion ? 'still' : 'lift';
          if (reducedMotion) going.height = target;
          sent.push(going);
          // The chain it joins sighs: the dice already going, held where they are by the rules.
          if (!reducedMotion) {
            for (const other of this.going.values()) {
              if (other.reactionId === cube.reactionId && !other.ghost && other.phase === 'still') {
                other.phase = 'sigh';
                other.ms = 0;
                other.from = other.target;
              }
            }
          }
        }
        this.going.set(cube.id, going);
        continue;
      }
      going.x = cube.x;
      going.z = cube.z;
      going.ori = cube.ori;
      going.reactionId = cube.reactionId;
      if (standing && cube.t !== going.settledT) {
        // A landing: the rules have taken the die a move down. It is driven to its new step from where it is.
        going.settledT = cube.t;
        const target = this.stepOf(cube, state, cube.t, steps);
        if (target !== going.target) {
          going.target = target;
          going.first = false;
          this.drive(going, reducedMotion);
        }
      }
    }

    // The rules have taken a die: at the end of its way it is driven under the floor as a ghost; one taken early
    // (rolled over, with moves left to it) comes apart as it always did and is let go of here at once.
    for (const going of this.going.values()) {
      if (seen.has(going.id) || going.ghost) continue;
      if (going.target > steps.last + 1e-6 || reducedMotion) {
        if (going.target <= steps.last + 1e-6) events.push({ kind: 'gone', value: going.value, cells: [{ x: going.x, z: going.z }], cubeIds: [going.id] });
        this.going.delete(going.id);
        continue;
      }
      going.ghost = true;
      going.target = UNDER;
      going.first = false;
      this.drive(going, false);
    }

    if (sent.length > 0) {
      events.push({ kind: 'sent', value: sent[0].value, cells: sent.map((g) => ({ x: g.x, z: g.z })), cubeIds: sent.map((g) => g.id) });
      if (reducedMotion) events.push(...this.grouped(sent, 'impact'));
    }

    const struck: Going[] = [];
    const stepped: Going[] = [];
    const gone: Going[] = [];
    for (const going of this.going.values()) {
      going.ms += dtMs;
      const hit = this.advance(going, n);
      if (hit === 'gone') gone.push(going);
      else if (hit === 'struck') {
        (going.first ? struck : stepped).push(going);
        going.first = false;
      }
    }
    for (const going of gone) this.going.delete(going.id);
    events.push(...this.grouped(struck, 'impact'), ...this.grouped(stepped, 'step'), ...this.grouped(gone, 'gone'));
    return events;
  }

  /** The height a sinking die of a level is drawn at: by its timeline. Outside a level, what the rules have. */
  height(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number {
    if (!state.levelRun) return shownHeight(cube, state, alpha, values);
    return this.going.get(cube.id)?.height ?? shownHeight(cube, state, alpha, values);
  }

  ghosts(): readonly Ghost[] {
    const ghosts: Ghost[] = [];
    for (const going of this.going.values()) if (going.ghost) ghosts.push({ x: going.x, z: going.z, ori: going.ori, value: going.value, height: going.height });
    return ghosts;
  }

  ghostHeight(x: number, z: number): number {
    for (const going of this.going.values()) if (going.ghost && going.x === x && going.z === z) return Math.max(0, going.height);
    return 0;
  }

  /** The step a die stands on with `t` of its window gone, by the look's steps. */
  private stepOf(cube: Cube, state: RunState, t: number, steps: LeavingSteps): number {
    const { sinkingTicks, actionTicks } = state.config;
    const window = Math.max(1, sinkingTicks - 1);
    const moves = Math.max(1, Math.round(window / Math.max(1, actionTicks)));
    return leavingHeight((sinkingTicks - t) / window, moves, steps, isStair(cube, state));
  }

  /** Drives a die from where it is drawn to its target: a drop, or at once with less motion. */
  private drive(going: Going, reducedMotion: boolean): void {
    if (reducedMotion) {
      going.phase = 'still';
      going.height = going.target;
      return;
    }
    going.from = going.height;
    going.phase = 'drop';
    going.ms = 0;
  }

  /** How long the phase a die is in takes. */
  private phaseMs(going: Going, n: (name: string) => number): number {
    switch (going.phase) {
      case 'lift':
        return n('liftMs');
      case 'hang':
        return n('hangMs');
      case 'drop':
        return going.first ? n('dropMs') : n('stepMs');
      case 'settle':
        return n('settleMs');
      case 'sigh':
        return n('sighMs');
      default:
        return 0;
    }
  }

  /**
   * Moves one die on by the time it has, through as many phases as that time covers, so that a
   * long frame leaves it where a run of short ones would. Says whether a drop has ended on the
   * way: the strike of the die, or its going under.
   */
  private advance(going: Going, n: (name: string) => number): 'struck' | 'gone' | null {
    let hit: 'struck' | 'gone' | null = null;
    for (let guard = 0; guard < 8; guard++) {
      if (going.phase === 'still') {
        going.height = going.target;
        return hit;
      }
      const ms = this.phaseMs(going, n);
      const share = ms > 0 ? going.ms / ms : 1;
      switch (going.phase) {
        case 'lift':
          going.height = tween(share, going.from, 1 + n('liftHeight'), outCubic);
          break;
        case 'drop': {
          const curve = DROP_CURVES[Math.max(0, Math.min(DROP_CURVES.length - 1, Math.round(n('dropCurve'))))];
          going.height = tween(share, going.from, going.target - (going.ghost ? 0 : n('settleOver')), curve);
          break;
        }
        case 'settle':
          going.height = tween(share, going.from, going.target, outCubic);
          break;
        case 'sigh':
          going.height = going.target + n('sighHeight') * Math.sin(Math.PI * inOutSine(Math.min(1, share)));
          break;
        default:
          break;
      }
      if (going.ms < ms) return hit;
      // The phase has run out: on to the next, with the time left over.
      going.ms -= ms;
      going.from = going.height;
      switch (going.phase) {
        case 'lift':
          going.phase = 'hang';
          break;
        case 'hang':
          going.phase = 'drop';
          break;
        case 'drop':
          hit = going.ghost ? 'gone' : 'struck';
          going.phase = going.ghost ? 'still' : 'settle';
          // A step after the first goes in the step's time: the strike is counted by whoever called.
          break;
        default:
          going.phase = 'still';
      }
    }
    return hit;
  }

  /** One event for the dice of each group: they go together, so they strike together. */
  private grouped(dice: readonly Going[], kind: LeavingEvent['kind']): LeavingEvent[] {
    const byGroup = new Map<number, Going[]>();
    for (const going of dice) {
      const list = byGroup.get(going.reactionId) ?? [];
      list.push(going);
      byGroup.set(going.reactionId, list);
    }
    return [...byGroup.values()].map((list) => ({ kind, value: list[0].value, cells: list.map((g) => ({ x: g.x, z: g.z })), cubeIds: list.map((g) => g.id) }));
  }
}
```

Замечания исполнителю:

- Отдача по спеке «outBack»; здесь она сделана как удар до `target − settleOver` и возврат `outCubic`: тот же вид (дожим ниже ступени и возврат), но перелёт задаётся числом прямо. Записать в раздел 9 спеки.
- Ход «вздоха» (`sigh`) для кости в `'still'`: если на вздохе приходит приземление, `drive` перебивает фазу — это и нужно.
- `boardDefaults()` импортируется из `./params`, как `BOARD_GROUPS` сейчас; если это даёт цикл импортов при загрузке, перенести `DEFAULTS` в ленивое поле класса.
- Кость, по которой прокатились на последней ступени (0,12): она и призраком уходит под пол, и рассыпается `crumble`, как раньше. Это допустимо: новая кость ставит её под пол; если глазами выглядит двойным — убрать призрак для кости, которой нет в `state.cubes`, но чья клетка занята другой костью.
- Порядок клеток в событиях — порядок `state.cubes`; тесты на него опираются.
- Тест «обрыв удара»: после `land` первая `drop` помечена `first: false`, так что срабатывает `step`, не `impact`. Удержанные в `Game` удары тогда раздаются по `step`? Нет: `Game` раздаёт удержанные удары по первому из `impact` **или** `step` (задача 6), чтобы удар группы не пропал.

- [ ] **Шаг 4: тесты проходят**

```bash
npx vitest run src/render/leaving.test.ts
npm run typecheck
```

Если какой-то из численных ожиданий не сходится на 1–2 мс из-за порядка фаз внутри одного кадра — подправить тест (длительности кадров), не реализацию; смысл каждого ожидания записан в его комментарии.

- [ ] **Шаг 5: коммит**

```bash
git add src/render/leaving.ts src/render/leaving.test.ts
git commit -m "LeavingShow: таймлайн ухода группы на уровне"
```

---

### Задача 4: вид читает таймлайн; толчок камеры с атакой; кольцо у пола

**Файлы:**
- Изменить: `src/render/view.ts` — поля (~195–270), `beat` (~809–830), `reset` (~845–868), `draw` (~871–1020), `punch` (~877, ~1047)
- Изменить: `src/render/burst.ts` — `fire` (~133–165): выделить `ring`
- Изменить: `src/render/cubes.ts` — `sync` (~620–800)
- Изменить: `src/render/player.ts` — `footing` (~11–15), `sync` (~81–84)
- Изменить: `src/render/signs.ts` — `heightOf` (~50), `sync` (~170, ~192), `lift` (~273)
- Изменить: `src/app/signWay.ts` — `signBody` (~125–131), `signHeight` (~140–145)
- Тест: `src/render/burst.test.ts` (добавить), `src/render/view.test.ts` если есть, иначе без теста: проверка глазами в задаче 7

**Интерфейсы:**
- Берёт: `LeavingShow`, `LeavingEvent`, `Ghost`, `HeightOf` из `./leaving`; `CubeSprings.forget`; `outCubic` из `./ease`.
- Даёт: `SceneParams.onLeaving?: (event: LeavingEvent) => void`; `BoardView.heightOf: HeightOf` (публичное поле-функция); `BoardView.thud(): void`; `BoardView.farewell(cells, value): void`; `BoardBursts.ring(cx, cz, reachCells, ms, tint, strength): void`; `CubeMeshes.sync(state, alpha, glow, dip, passing, height: HeightOf, ghosts: readonly Ghost[])`; `Figure.sync(state, alpha, dt, dip, frame, height: HeightOf, ghostAt: (x, z) => number)`; `ChainSigns.sync(..., height: HeightOf)`; `signBody(state, height: HeightOf)`, `signHeight(state, height: HeightOf)`.

- [ ] **Шаг 1: `burst.ts` — `ring` отдельным входом, тест**

В `src/render/burst.test.ts` добавить (посмотреть, как там создаётся `BoardBursts` и читаются кольца; если кольца недоступны снаружи, добавить геттер `ringsLit(): number` — число видимых колец):

```ts
it('runs a ring of its own from a point, as far and as long as it is told', () => {
  const bursts = new BoardBursts();
  bursts.ring(2, 3, 1.6, 300, new THREE.Color(1, 0, 0), 0.75);
  expect(bursts.ringsLit()).toBe(1);
  bursts.update(350, camera);
  expect(bursts.ringsLit()).toBe(0);
});
```

В `burst.ts` вынести хвост `fire` в метод и звать его из `fire`:

```ts
  /** A ring runs over the surface from (cx, cz): `reach` cells in `ms`, in `tint`, as strong as `strength`. */
  ring(cx: number, cz: number, reach: number, ms: number, tint: THREE.Color, strength: number): void {
    const ring = this.rings.reduce((oldest, candidate) => (candidate.age / candidate.life > oldest.age / oldest.life ? candidate : oldest));
    ring.age = 0;
    ring.life = ms / 1000;
    ring.reach = reach;
    ring.strength = strength;
    ring.mesh.material.color.copy(tint);
    ring.mesh.position.set(cx, 0.006, cz);
    ring.mesh.visible = true;
  }

  ringsLit(): number {
    return this.rings.filter((ring) => ring.mesh.visible).length;
  }
```

и в `fire` вместо восьми строк хвоста: `this.ring(cx / beat.cells.length, cz / beat.cells.length, RING_REACH[tier], RING_MS[tier], tint, 0.75 + tier * 0.06);`.

```bash
npx vitest run src/render/burst.test.ts
```

- [ ] **Шаг 2: `cubes.ts` — высота через функцию, призраки**

В `sync` добавить параметры `height: HeightOf` и `ghosts: readonly Ghost[]` (после `passing`). Строку `let place = look === 'idle' ? 1 : shownHeight(cube, state, alpha, this.values);` заменить на `let place = look === 'idle' ? 1 : height(cube, alpha);`. Импорт `shownHeight` из `./leaving` убрать, если больше не нужен; импортировать `type Ghost, type HeightOf`.

Призраки: вынести тело ветки стекла (от `alive.add(cube.id);` до конца тела цикла, включая рёбра) в приватный метод

```ts
  private glass(id: number, x: number, z: number, ori: Orientation, value: number, look: Look, height: number, place: number, lit: number, dimmed: boolean, glow: CubeGlow, dip: (cubeId: number) => number, n: (name: string) => number, slots: { glasses: number; glows: number }): void
```

где `slots` — счётчики `glasses`/`glows`, которые цикл раньше держал в локальных `let` (передавать объектом и обновлять в нём). Цикл по `state.cubes` зовёт `this.glass(cube.id, cube.x, cube.z, cube.ori, cube.ori.top, look, height, place, lit, dimmed, glow, dip, n, slots)`. После цикла:

```ts
    // The dice the rules have taken that the show still drives under the floor: low glass, drawn with what they had left.
    for (const [i, ghost] of ghosts.entries()) {
      const id = -1 - i;
      const height = Math.max(0, ghost.height);
      this.glass(id, ghost.x, ghost.z, ghost.ori, ghost.value, 'sinkingLow', height, ghost.height, 0, false, glow, () => 0, n, slots);
      alive.add(id);
    }
```

`worn`/`spare` работают по `id`; отрицательные id призраков не пересекаются с костями. `this.shown.set(id, …)` для призраков безвреден. `uCover` призрака считается от `height` ≥ 0 как у низкой кости, этого достаточно (спека: «с той решёткой, что была на последнем кадре» — при высоте 0,12 → 0 решётка и так редеет до пустой).

- [ ] **Шаг 3: `player.ts`, `signs.ts`, `signWay.ts` — высота через функцию**

`player.ts`:

```ts
function footing(state: RunState, x: number, z: number, level: Level, alpha: number, dip: (cubeId: number) => number, frame: (x: number, z: number) => number, height: HeightOf, ghostAt: (x: number, z: number) => number): number {
  if (level === 'ground') return frame(x, z);
  const cube = cubeAt(state, x, z);
  if (cube) return height(cube, alpha) + dip(cube.id);
  // The die under the figure is gone from the rules and still going under in the show: the figure rides it down to the floor.
  return ghostAt(x, z);
}
```

`sync(state, alpha, dt, dip, frame, height: HeightOf, ghostAt: (x: number, z: number) => number)`; `supportHeight` передаёт `height, ghostAt`. Импорт `shownHeight` и `values` убрать.

`signs.ts`: `const heightOf = …` удалить; `sync(..., ghosts, height: HeightOf)` сохраняет `this.height = height`; строки 192 и 273 — `height(cube, alpha)` / `this.height(cube, alpha)`. Поле `private height: HeightOf = () => 1;`.

`signWay.ts`:

```ts
export function signBody(state: RunState, height: HeightOf): { x: number; y: number; z: number }[] {
  const { x, z, level } = state.player;
  const top = level === 'top' ? signHeight(state, height) : 1;
  …
}
export function signHeight(state: RunState, height: HeightOf): number {
  const { x, z, level } = state.player;
  if (level !== 'top') return 0;
  const under = cubeAt(state, x, z);
  return under ? height(under, 0) : 0;
}
```

Комментарии над ними поправить: высота приходит от вида (`BoardView.heightOf`). Тесты `signWay.test.ts`, если зовут `signBody(state, values)`, перевести на `signBody(state, (cube, alpha) => shownHeight(cube, state, alpha))`.

- [ ] **Шаг 4: `view.ts` — таймлайн, пружины, толчок, события**

Поля:

```ts
  private readonly show = new LeavingShow();
  /** The state the frame is drawn from: for `heightOf`, which is handed out to whoever draws a die. */
  private drawn: RunState | null = null;
  /** How high a die is drawn: by the show of its leaving on a level, by the rules elsewhere. */
  readonly heightOf: HeightOf = (cube, alpha) => (this.drawn ? this.show.height(cube, this.drawn, alpha, this.look.board) : 1);
  /** The lean of the camera on a beat: its peak, and how long ago it was struck. */
  private punchPeak = 0;
  private punchMs = 0;
```

Убрать поля `punch`, `sinking`, `sinkingBefore`, `whole` и всё, что их читает (блок «A chain that is added to brings its cubes back up…» в `draw`, строки в `reset`).

`SceneParams`: добавить `onLeaving?: (event: LeavingEvent) => void;` с комментарием: «What the leaving of a group on a level has come to on this frame: the board answers a beat on `impact`, a step on `step`, and sends a ring over the floor on `gone`.»

`beat`: вместо `this.punch = Math.max(this.punch, BEAT_PUNCH[tier]);`:

```ts
    this.lean(BEAT_PUNCH[tier]);
```

и новые методы:

```ts
  /** The camera leans in: up to `peak` in the attack, then back. A beat in the attack raises the peak; one later starts over from where the lean is. */
  private lean(peak: number): void {
    const attack = Number(this.look.board.punchAttackMs ?? 30);
    if (this.punchMs < attack) {
      this.punchPeak = Math.max(this.punchPeak, peak);
      return;
    }
    this.punchPeak = Math.max(this.punchValue(), peak);
    this.punchMs = 0;
  }

  private punchValue(): number {
    const attack = Number(this.look.board.punchAttackMs ?? 30);
    const decay = Math.max(1, Number(this.look.board.punchDecayMs ?? 120));
    if (this.punchMs < attack) return this.punchPeak * outCubic(attack > 0 ? this.punchMs / attack : 1);
    return this.punchPeak * Math.exp(-(this.punchMs - attack) / decay);
  }

  /** A step of a group driven down: the slightest lean of the camera, and nothing else. */
  thud(): void {
    if (this.still) return;
    this.lean(BEAT_PUNCH[0]);
  }

  /** A group has gone under: a ring runs over the floor where it stood, in the colour of its face. */
  farewell(cells: readonly { x: number; z: number }[], value: number): void {
    if (this.still || cells.length === 0 || value < 1) return;
    const n = (name: string): number => Number(this.look.board[name] ?? 0);
    const cx = cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length;
    const cz = cells.reduce((sum, cell) => sum + cell.z, 0) / cells.length;
    this.bursts.ring(cx, cz, n('endRingReach'), n('endRingMs'), this.lit[value - 1], 0.75);
  }
```

В `draw`: строку `this.punch *= Math.exp(-dt / 90);` заменить на `this.punchMs += dt;`; строку `const zoom = params.shake && !reducedMotion ? 1 + this.punch : 1;` — на `const zoom = params.shake && !reducedMotion ? 1 + this.punchValue() : 1;`. В `reset`: `this.punchPeak = 0; this.punchMs = 1e9; this.show.reset();`. В начале `draw` после `this.still = params.reducedMotion;`: `this.drawn = state;`.

Вызов таймлайна — сразу после `this.springs.hold(pressed?.id ?? null, n('pressDepth'));` и строки с `kick` и `this.lastStep = stepNow;`, на месте убранного блока:

```ts
    // The leaving of a group on a level, as one body: the show drives the height of every die that goes.
    // A die that has just been sent lifts from where its spring held it, and the spring is let go of.
    for (const event of this.show.frame(state, dt, values, reducedMotion, (id) => this.springs.offset(id))) {
      if (event.kind === 'sent') for (const id of event.cubeIds) this.springs.forget(id);
      else params.onLeaving?.(event);
    }
```

`this.cubes.sync(state, alpha, {...}, dip, passing, this.heightOf, this.show.ghosts())`; `this.player.sync(state, alpha, dt, dip, (x, z) => this.signs.lift(state, x, z, alpha, dip), this.heightOf, (x, z) => this.show.ghostHeight(x, z))`; `this.signs.sync(…, params.ghosts, this.heightOf)`. В ветке перехода (`passing && player.level === 'top'`) `shownHeight(own, state, 0, values)` → `this.heightOf(own, 0)`. Импорты: `shownHeight` убрать, если не остался читателей; `LeavingShow, type HeightOf, type LeavingEvent` добавить; `outCubic` из `./ease`.

- [ ] **Шаг 5: typecheck, все тесты**

```bash
npm run typecheck
npm test
```

Ожидание: зелено. Если `view.test.ts`/`cubes.test.ts` зовут `sync` со старыми аргументами — передать `(cube, alpha) => shownHeight(cube, state, alpha)` и `[]`.

- [ ] **Шаг 6: коммит**

```bash
git add src/render src/app/signWay.ts
git commit -m "Вид читает таймлайн ухода; толчок камеры с атакой; кольцо у пола"
```

---

### Задача 5: `game.ts` — удары в момент удара, хлопок ступени, кольцо

**Файлы:**
- Изменить: `src/app/game.ts` — `onTick` (~2481), `beat` (~2501–2520), сброс (~1026, ~1047), `view.draw` (~2898–2912), `signBody` (~2662)
- Тест: `src/app/game.test.ts`, если есть обвязка `Game` без DOM; иначе — `src/app/juice.test.ts` остаётся как есть, проверка глазами в задаче 7

**Интерфейсы:**
- Берёт: `SceneParams.onLeaving`, `BoardView.thud`, `BoardView.farewell`, `BoardView.heightOf`, `LeavingEvent`.

- [ ] **Шаг 1: удержание ударов**

Поле `private heldBeats: Beat[] = [];`. В `onTick` строку 2481 заменить:

```ts
    // The combo that passes a level is answered by the passage: its dice light up one after another, each on its own note.
    if (!(state.levelRun && state.endReason === 'passed')) {
      for (const beat of beatsOf(state, state.events)) {
        // On a level a group strikes when its dice come down, not when they are sent: the board waits for the show.
        if (state.levelRun && (beat.kind === 'match' || beat.kind === 'chain')) this.heldBeats.push(beat);
        else this.beat(beat);
      }
    }
```

Новый метод:

```ts
  /** What the leaving of a group on a level has come to: the beats held for it, a step, or the ring of its going. */
  private onLeaving(event: LeavingEvent): void {
    const { state } = this;
    if (state.over) {
      this.heldBeats = [];
      return;
    }
    if (event.kind === 'impact' || event.kind === 'step') {
      for (const beat of this.heldBeats.splice(0)) this.beat(beat);
      if (event.kind === 'step') this.view.thud();
    } else if (event.kind === 'gone') {
      this.view.farewell(event.cells, event.value);
    }
  }
```

`this.heldBeats = [];` рядом с `this.hold.reset()` (сброс партии) и с `this.ghosts = []` (новая доска). В `view.draw(...)` добавить `onLeaving: (event) => this.onLeaving(event),`. Строку 2662: `signBody(state, this.view.heightOf)`.

- [ ] **Шаг 2: typecheck, тесты, сборка**

```bash
npm run typecheck
npm test
npm run build
```

- [ ] **Шаг 3: коммит**

```bash
git add src/app/game.ts
git commit -m "Уровень: удары группы в момент удара, хлопок ступени, кольцо у пола"
```

---

### Задача 6: глазами и покадрово

**Файлы:** ничего не меняет, кроме чисел группы `leaving`, если владелец попросит. Отчёт — в сообщении исполнителя.

- [ ] **Шаг 1: превью**

`preview_start` с `vi-dev`; страница worktree по памяти `vi-preview-of-a-worktree`. Открыть дорогу с первого куска (`R01`: четыре переката на север до пары).

- [ ] **Шаг 2: покадрово**

Через CDP (`Emulation.setVirtualTimePolicy` или ручные кадры из той же памяти) снять полосу кадров от приземления четвёртого переката до конца отдачи: ожидается подъём до 1,08 за 90 мс, пауза, падение за 130 мс, дожим и возврат; искры и кольцо — на кадре удара, не раньше. Второй кусок `R02`: лесенка стоит на 0,12 и 0,5 без замаха, на приземлении первого переката верхняя бьёт на 0,12. Любой уровень списка с цепочкой: вздох цепочки и удар новой кости.

- [ ] **Шаг 3: телефон и большой экран**

360×640 и 1920×1080 (`resize_window`): фигура на уходящей кости падает с плитой; знак свайпа стоит на высоте кости; переход между досками как был; `?reduced` или настройка «меньше движения» — ступени без замаха, кольца нет.

- [ ] **Шаг 4: Endless**

Одна партия Endless: ничего не изменилось, кроме толчка камеры (теперь с атакой 30 мс); ошибок в консоли нет.

- [ ] **Шаг 5: цена кадра**

`?perf` на `R03` и уровне списка: кадр с ударом не дороже, чем был (сравнить с `main` в основной сборке на том же устройстве).

---

### Задача 7: документы

**Файлы:**
- Изменить: `docs/art/VI_Interface_Layer.md` — строка «Высота уходящей кости на уровне, с 12 октября 2026»
- Изменить: `docs/art/VI_World_Logic.md` — новая строка после «Уходящая кость растворяется в точки трубки»
- Изменить: `docs/art/VI_Visual_Language.md` — новый раздел «Словарь движения» (после 4.3 «Язык движения — предложение»); в 2.2 фраза «Общих длительностей и кривых движения нет» получает «с 13 октября 2026 — словарь движения, раздел ниже»
- Изменить: `docs/ROADMAP.md` — абзац «Сделано первым слоем» в «Juice»: добавить «уход группы на уровне как одно тело (13 октября)»
- Изменить: спека `docs/superpowers/specs/2026-10-13-vi-leaving-choreography-design.md` — шапка (статус «построено», проверено) и раздел 9
- Изменить: этот план — шапка (статус «выполнен»)
- Изменить: `docs/README.md` — строки спеки и плана

- [ ] **Шаг 1: строки**

Interface_Layer: переписать строку так, чтобы она говорила: ступени те же (0,78 / 0,12 / лесенка 0,5), но путь между ними — удар; совпадение → замах 0,08 за 90 мс, пауза 60 мс, удар 130 мс, отдача 120 мс; каждое приземление — хлопок на ступень за 120 мс; последнее — под пол и кольцо у пола 1,6 клетки за 300 мс; искры, кольцо, толчок камеры и звук группы — в момент удара; цепочка на присоединение вздыхает на 0,04; уменьшенное движение — ступени без замаха; где в коде (`LeavingShow` в `src/render/leaving.ts`, `BoardView.heightOf`, `Game.onLeaving`), числа — группа «Уход» (`?liftHeight=0.1`); слово владельца 13 октября дословно из раздела 1 спеки.

World_Logic:

```
| Группа уходит как одно тело: в момент совпадения кости группы вместе приподнимаются, миг висят и разом бьют на первую ступень; каждый ход игрока вбивает группу на ступень ниже; с последним ходом она уходит под пол, и по полу от неё расходится кольцо | Уход — удар игрока по миру: у удара есть замах и отдача, и мир отвечает в момент удара, не раньше; кольцо у пола — сообщение ушло на ту сторону | слово владельца 13 октября 2026: «собраться в одно целое… как одна плита», «каждый ход вбивает плиту», «удар и кольцо у пола»; числа — первая версия, владелец правит |
```

Visual_Language, «Словарь движения» — таблица: `ease.ts`, кривая, где, длительность: замах `outCubic` 90; удар `inQuart` 130 (ступень 120); отдача `outCubic` 120 после дожима 1,5 %; вздох `inOutSine` 160; толчок камеры атака `outCubic` 30, спад экспонента 120; перекат — линейно 200 (как было, не переведён); пружины — `CubeSprings` 200/25 (как было). Правило: новое движение берёт кривую отсюда и добавляет строку.

- [ ] **Шаг 2: проверка документов**

```bash
node scripts/docs-check.mjs
```
Ожидание: `расхождений 0`.

- [ ] **Шаг 3: коммит**

```bash
git add docs
git commit -m "Документы: уход группы как одно тело, словарь движения"
```

---

### Задача 8: публикация

- [ ] `git fetch && git rebase origin/main`; `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`.
- [ ] Отчёт владельцу: полосы кадров «до» (из `main`) и «после», что вышло иначе (раздел 9 спеки), какие числа стоит покрутить. Спросить «ок» на `git push origin HEAD:main`. Версию в `package.json` поднимает владелец или по его слову.
