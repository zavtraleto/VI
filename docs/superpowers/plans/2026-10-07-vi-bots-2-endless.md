# Боты Endless: голова и руки, стили, края — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Игрок Endless получает две раздельные ручки («голова» и «руки»), давление, стили и края, а мерила темпа — сетку, таблицу стилей и выживание; пять нынешних игроков играют как играли.

**Architecture:** Один игрок, как сейчас: смотрит на стоящую доску, находит путь к комбо, идёт, смотрит снова (`src/rules/bot.ts`). Меняются только его настройки и то, что он предпочитает; прогон и таблицы — в `src/rules/paceBot.ts`, запуск — `scripts/pace.mjs`.

**Tech Stack:** TypeScript, vitest, node-скрипты через `runnerImport` из vite.

**Spec:** [docs/superpowers/specs/2026-10-07-vi-bots-design.md](../specs/2026-10-07-vi-bots-design.md), раздел 5 и раздел 6 (строка «Endless»).

## Global Constraints

- Правила игры не меняются: `RULES_VERSION` остаётся `0.9`; в `src/rules` правятся только `bot.ts`, `paceBot.ts` и их тесты.
- Пять игроков `SKILLS` (`newbie`, `novice`, `average`, `pro`, `esports`) дают те же прогоны, что до правки: те же числа настроек и тот же порядок обращений к генератору бота.
- Файлы `src/rules/levelBot.ts`, `src/rules/levelSolver.ts`, `src/rules/level.ts`, `src/levels/**` не трогать: их в это же время правит другой исполнитель. `levelBot.ts` берёт из `bot.ts` имена `SKILLS`, `SKILL_NAMES`, `botCommand`, `createBot`, `Bot`, `Skill`, `SkillName` — они остаются и значат то же.
- Комментарии в коде — на английском, в манере соседних: что это и зачем, без пересказа кода.
- Проверка после каждой задачи: `npm test`, `npm run typecheck`. В конце ещё `npm run build`.
- Коммит после каждой задачи, обычным сообщением в одну строку; в `main` не пушить.

## Карта файлов

| Файл | Что в нём меняется |
|---|---|
| `src/rules/bot.ts` | `Head`, `Hands`, `HEADS`, `HANDS`, `skillOf`, `RUSH`, `pressure`, `missOf`, `slipOf`; `Plan.dice`; `Style`, `STYLES`, `styled` |
| `src/rules/bot.test.ts` | тесты всего перечисленного |
| `src/rules/paceBot.ts` | `PaceOptions` и `PaceRun` с головой, руками, стилем, давлением и прогоном без игрока; `paceGrid`, `paceStyles`, `survival`, `survivalTable`, `paceEdges` |
| `src/rules/paceBot.test.ts` (новый) | тесты мерил |
| `scripts/pace.mjs` | слова `grid`, `styles`, `survival`, `edges`, `rush` |

---

### Task 1: Голова и руки

**Files:**
- Modify: `src/rules/bot.ts` (интерфейс `Skill` и таблица `SKILLS`, строки 24–97)
- Test: `src/rules/bot.test.ts`

**Interfaces:**
- Produces: `Head`, `Hands`, `Skill = Head & Hands`, `HEADS: Record<SkillName, Head>`, `HANDS: Record<HandsName, Hands>`, `type HandsName = SkillName | 'instant'`, `skillOf(head: SkillName, hands: HandsName): Skill`, `SKILLS: Record<SkillName, Skill>`, `SkillName`, `SKILL_NAMES`.

- [x] **Step 0: Снять таблицу темпа до правок.** До любой правки выполнить `node scripts/pace.mjs endless seeds=2 minutes=3 players=newbie,pro` и сохранить вывод в файл вне репозитория (временная папка системы). В Task 5 та же команда обязана напечатать то же самое.

- [x] **Step 1: Записать, как игроки играют сейчас.** До любой правки добавить в `src/rules/bot.test.ts`, в блок `describe('a player made of rules', ...)`, тест, который печатает прогон:

```ts
  it('plays as it did before its head and hands were set apart', () => {
    const run = play('average', 3, 2);
    const kept = { score: run.score, removed: run.removed, steps: run.steps, clears: run.clears, chains: run.chains, maxChain: run.maxChain, seconds: run.seconds };
    console.log(JSON.stringify(kept));
  });
```

Run: `npx vitest run src/rules/bot.test.ts -t "plays as it did before"`. Взять напечатанный объект и заменить им `console.log`: тест становится

```ts
    expect(kept).toEqual({ /* the object printed, pasted as it is */ });
```

То же сделать вторым прогоном в том же тесте: `play('newbie', 5, 2)` — свой объект, своё `toEqual`. Запустить ещё раз: PASS. Это страховка всей задачи: после каждой правки тест обязан проходить с теми же числами.

- [x] **Step 2: Тест на новые имена.** В `src/rules/bot.test.ts` добавить импорт `HANDS, HEADS, skillOf` и блок:

```ts
describe('a head and hands', () => {
  it('make the five players as they were: a head and the hands of the same name', () => {
    for (const name of SKILL_NAMES) {
      expect(SKILLS[name]).toEqual({ ...HEADS[name], ...HANDS[name] });
      expect(skillOf(name, name)).toEqual(SKILLS[name]);
      expect(SKILLS[name].rush).toBe(0);
    }
    expect(SKILLS.average).toMatchObject({ depth: 6, rolls: 2, budget: 320, think: [28, 65], thinkPerMove: 10, thinkPerCube: 1.5, pause: [4, 10], idle: [8, 25], miss: 0.2, missPerRoll: 0.4, lapse: 0.06, lapseTicks: [40, 100], slip: 0.04, greed: 0.5, tidy: true });
  });

  it('are set apart: one who sees far and moves slowly is a player too', () => {
    const slow = skillOf('pro', 'newbie');
    expect(slow.depth).toBe(SKILLS.pro.depth);
    expect(slow.miss).toBe(SKILLS.pro.miss);
    expect(slow.think).toEqual(SKILLS.newbie.think);
    expect(slow.slip).toBe(SKILLS.newbie.slip);
  });

  it('have hands that take no time and make no mistake: the most a head can do', () => {
    expect(HANDS.instant).toEqual({ think: [0, 0], thinkPerMove: 0, thinkPerCube: 0, pause: [0, 0], idle: [0, 0], lapse: 0, lapseTicks: [0, 0], slip: 0, rush: 0 });
    expect(skillOf('esports', 'instant').depth).toBe(SKILLS.esports.depth);
  });
});
```

Run: `npx vitest run src/rules/bot.test.ts` — FAIL: `HEADS` не экспортируется.

- [x] **Step 3: Развести настройки.** В `src/rules/bot.ts` заменить `export interface Skill { ... }` двумя интерфейсами и псевдонимом. Комментарии полей переносятся к тем же полям без изменений.

```ts
/** What a player sees and wants. */
export interface Head {
  depth: number;
  rolls: number;
  budget: number;
  miss: number;
  missPerRoll: number;
  greed: number;
  tidy: boolean;
}

/** How fast and how surely a player moves. */
export interface Hands {
  think: readonly [number, number];
  thinkPerMove: number;
  thinkPerCube: number;
  pause: readonly [number, number];
  idle: readonly [number, number];
  lapse: number;
  lapseTicks: readonly [number, number];
  slip: number;
  /**
   * How many times likelier a slip and an oversight are with the board at the danger mark than
   * with it calm. 0 keeps them what they are whatever the board holds.
   */
  rush: number;
}

/** A player: a head and hands. */
export type Skill = Head & Hands;
```

Таблицу `SKILLS` заменить тремя. Числа — те же, что стоят в `SKILLS` сейчас, по одному полю; комментарии над игроками переносятся к `HEADS`.

```ts
export const HEADS = {
  newbie: { depth: 3, rolls: 1, budget: 80, miss: 0.45, missPerRoll: 0.8, greed: 0, tidy: false },
  novice: { depth: 4, rolls: 2, budget: 160, miss: 0.3, missPerRoll: 0.6, greed: 0, tidy: true },
  average: { depth: 6, rolls: 2, budget: 320, miss: 0.2, missPerRoll: 0.4, greed: 0.5, tidy: true },
  pro: { depth: 7, rolls: 3, budget: 700, miss: 0.08, missPerRoll: 0.2, greed: 1, tidy: true },
  esports: { depth: 8, rolls: 4, budget: 1200, miss: 0.03, missPerRoll: 0.08, greed: 1, tidy: true },
} as const satisfies Record<string, Head>;

export type SkillName = keyof typeof HEADS;
export type HandsName = SkillName | 'instant';

export const HANDS: Record<HandsName, Hands> = {
  newbie: { think: [75, 175], thinkPerMove: 30, thinkPerCube: 3, pause: [14, 30], idle: [25, 70], lapse: 0.16, lapseTicks: [60, 180], slip: 0.12, rush: 0 },
  novice: { think: [50, 120], thinkPerMove: 20, thinkPerCube: 2, pause: [10, 22], idle: [15, 45], lapse: 0.1, lapseTicks: [50, 150], slip: 0.07, rush: 0 },
  average: { think: [28, 65], thinkPerMove: 10, thinkPerCube: 1.5, pause: [4, 10], idle: [8, 25], lapse: 0.06, lapseTicks: [40, 100], slip: 0.04, rush: 0 },
  pro: { think: [15, 40], thinkPerMove: 6, thinkPerCube: 1, pause: [2, 5], idle: [4, 12], lapse: 0.02, lapseTicks: [25, 60], slip: 0.02, rush: 0 },
  esports: { think: [6, 16], thinkPerMove: 3, thinkPerCube: 0.5, pause: [0, 2], idle: [2, 6], lapse: 0.005, lapseTicks: [15, 40], slip: 0.005, rush: 0 },
  /** Hands that take no time and make no mistake: with them a head does the most it can. */
  instant: { think: [0, 0], thinkPerMove: 0, thinkPerCube: 0, pause: [0, 0], idle: [0, 0], lapse: 0, lapseTicks: [0, 0], slip: 0, rush: 0 },
};

/** A player of one head and other hands: one who sees far and moves slowly, or the other way about. */
export function skillOf(head: SkillName, hands: HandsName): Skill {
  return { ...HEADS[head], ...HANDS[hands] };
}

/** The five players, the weakest first: a head and the hands of the same name. */
export const SKILLS: Record<SkillName, Skill> = {
  newbie: skillOf('newbie', 'newbie'),
  novice: skillOf('novice', 'novice'),
  average: skillOf('average', 'average'),
  pro: skillOf('pro', 'pro'),
  esports: skillOf('esports', 'esports'),
};
```

Строку `export type SkillName = keyof typeof SKILLS;` убрать (тип теперь объявлен выше); `SKILL_NAMES` остаётся `Object.keys(SKILLS) as SkillName[]`.

- [x] **Step 4: Проверить.** Run: `npx vitest run src/rules/bot.test.ts src/rules/levelBot.test.ts src/rules/level.test.ts && npm run typecheck` — PASS, тест из шага 1 проходит с прежними числами.

- [x] **Step 5: Commit.** `git add src/rules/bot.ts src/rules/bot.test.ts && git commit -m "bot: a head and hands set apart; the five players are the same"`

---

### Task 2: Давление

**Files:**
- Modify: `src/rules/bot.ts` (`sight`, `decide`, `botCommand`)
- Test: `src/rules/bot.test.ts`

**Interfaces:**
- Consumes: `Skill` с полем `rush` (Task 1).
- Produces: `RUSH: Record<SkillName, number>`, `pressure(state: RunState): number`, `missOf(skill: Skill, pressure: number): number`, `slipOf(skill: Skill, pressure: number): number`; `sight(skill, plan, pressure = 0)`.

- [x] **Step 1: Тесты.** В `src/rules/bot.test.ts` добавить импорт `RUSH, missOf, pressure, slipOf` и блок:

```ts
describe('a player under pressure', () => {
  const board = (cubes: number) => {
    const s = emptyRun();
    return { ...s, cubes: new Array(cubes).fill(s.cubes[0] ?? {}) } as typeof s;
  };

  it('is calm on a board that holds no more than it is kept at, and pressed to the full at the danger mark', () => {
    const { targetCubes, warnOccupied } = emptyRun().config;
    expect(pressure(board(0))).toBe(0);
    expect(pressure(board(targetCubes))).toBe(0);
    expect(pressure(board(warnOccupied))).toBe(1);
    expect(pressure(board(warnOccupied + 5))).toBe(1);
    const half = pressure(board(Math.round((targetCubes + warnOccupied) / 2)));
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(0.7);
  });

  it('slips and overlooks no more than ever with no rush in its hands', () => {
    expect(slipOf(SKILLS.newbie, 1)).toBe(SKILLS.newbie.slip);
    expect(missOf(SKILLS.newbie, 1)).toBe(SKILLS.newbie.miss);
  });

  it('slips and overlooks more, the fuller the board, with a rush: so many times more at the danger mark', () => {
    const rushed = { ...SKILLS.average, rush: 2 };
    expect(slipOf(rushed, 0)).toBe(rushed.slip);
    expect(slipOf(rushed, 0.5)).toBeCloseTo(rushed.slip * 2);
    expect(slipOf(rushed, 1)).toBeCloseTo(rushed.slip * 3);
    expect(missOf(rushed, 1)).toBeCloseTo(rushed.miss * 3);
    expect(missOf({ ...SKILLS.newbie, rush: 9 }, 1)).toBe(0.95);
    expect(slipOf({ ...SKILLS.newbie, slip: 0.5, rush: 9 }, 1)).toBe(1);
  });

  it('sees a way the worse for it', () => {
    const one: Plan = { moves: ['E'], kinds: ['roll'], points: 4, chain: 1 };
    const rushed = { ...SKILLS.average, rush: 2 };
    expect(sight(rushed, one, 1)).toBeLessThan(sight(rushed, one, 0));
    expect(sight(rushed, one)).toBe(sight(SKILLS.average, one));
  });

  it('has a rush for every pair of hands, less for the better', () => {
    for (let i = 1; i < SKILL_NAMES.length; i++) expect(RUSH[SKILL_NAMES[i]]).toBeLessThan(RUSH[SKILL_NAMES[i - 1]]);
  });
});
```

Поле `dice` у `Plan` появится в Task 3; там оно и дописывается в объект `one` этого теста. Run: `npx vitest run src/rules/bot.test.ts` — FAIL: `pressure` не экспортируется.

- [x] **Step 2: Написать.** В `src/rules/bot.ts`, после `SKILLS`:

```ts
/**
 * The rush a pair of hands is in at the danger mark, for a run that asks for it: so many times
 * likelier a slip and an oversight are there than on a calm board. A guess to try paces with,
 * not a measure of people; the hands themselves carry none.
 */
export const RUSH: Record<SkillName, number> = { newbie: 1.5, novice: 1.2, average: 0.8, pro: 0.4, esports: 0.2 };

/** How pressed the board is: 0 with no more cubes than it is kept at, 1 at the danger mark and over it. */
export function pressure(state: RunState): number {
  const { targetCubes, warnOccupied } = state.config;
  const room = warnOccupied - targetCubes;
  if (room <= 0) return 0;
  return Math.min(1, Math.max(0, (state.cubes.length - targetCubes) / room));
}

/** Most of the ways a player may overlook, however pressed: something is always seen. */
const MISS_AT_MOST = 0.95;

/** Share of the ways to a clear a player overlooks at this pressure. */
export function missOf(skill: Skill, pressed: number): number {
  return Math.min(MISS_AT_MOST, skill.miss * (1 + skill.rush * pressed));
}

/** Share of the moves that go astray at this pressure. */
export function slipOf(skill: Skill, pressed: number): number {
  return Math.min(1, skill.slip * (1 + skill.rush * pressed));
}
```

`sight` получает третий параметр и считает через `missOf`:

```ts
export function sight(skill: Skill, plan: Plan, pressed = 0): number {
  // ...the counting of `workedOut` stays as it is...
  return (1 - missOf(skill, pressed)) * Math.pow(1 - skill.missPerRoll, workedOut);
}
```

В `decide` давление считается один раз, до отбора путей, и обращений к генератору не добавляет:

```ts
  const pressed = pressure(state);
  const noticed = findPlans(state, skill.depth, skill.budget, WANTED, skill.rolls).filter((plan) => nextRandom(bot) < sight(skill, plan, pressed));
```

В `botCommand` строка `if (nextRandom(bot) < bot.skill.slip) {` становится

```ts
  if (nextRandom(bot) < slipOf(bot.skill, pressure(state))) {
```

- [x] **Step 3: Проверить.** Run: `npx vitest run src/rules/bot.test.ts && npm run typecheck` — PASS; тест «plays as it did before» проходит с прежними числами (у всех рук `rush: 0`, так что `missOf` и `slipOf` отдают `miss` и `slip`).

- [x] **Step 4: Commit.** `git add src/rules/bot.ts src/rules/bot.test.ts && git commit -m "bot: slips and oversights grow with the board for a player in a rush"`

---

### Task 3: Стили

**Files:**
- Modify: `src/rules/bot.ts` (`Plan`, `worth`, после `createBot`)
- Test: `src/rules/bot.test.ts`

**Interfaces:**
- Consumes: `Bot.prefer`, `Bot.wants` (есть), `inChain` из `./board` (уже импортирован).
- Produces: `Plan.dice: number`; `Style`, `StyleName = 'plain' | 'survivor' | 'builder'`, `STYLES: Record<StyleName, Style>`, `STYLE_NAMES: StyleName[]`, `styled(bot: Bot, style: StyleName): Bot`.

- [x] **Step 1: Тесты поля `dice`.** В существующих тестах `src/rules/bot.test.ts`: в «sees a clear one roll away» добавить `expect(plan.dice).toBe(2);`; в «knows what a die brought to a running chain is worth» добавить `expect(plan.dice).toBe(1);` (звено уводит одну кость). В тест давления из Task 2 в объект `one` дописать `dice: 2`. Run — FAIL: поля нет.

- [x] **Step 2: Поле `dice`.** В `Plan`:

```ts
  /** Dice that begin to leave with the clear: those of a new group, or the ones that join a chain. */
  dice: number;
```

`worth` возвращает его в каждой ветке: для единиц — число уходящих единиц (то же, что `points`), для группы и для звена — `group.length`. Тип возвращаемого значения: `{ points: number; chain: number; value: number; dice: number }`. Run — PASS.

- [x] **Step 3: Тесты стилей.** Добавить импорт `STYLES, STYLE_NAMES, createBot, styled` и блок. Доску с идущей цепочкой собрать так же, как в тесте «knows what a die brought to a running chain is worth» этого файла (те же вызовы `put`, `land`, `putOri`, `place`); в блоке она названа `withChain()` и должна вернуть партию, где группа двоек уходит, а игрок стоит на кости, которую можно докатить двойкой.

```ts
describe('what a player is after', () => {
  const plan = (over: Partial<Plan>): Plan => ({ moves: ['E'], kinds: ['roll'], points: 4, chain: 1, value: 2, dice: 2, ...over });

  it('has three styles, and the plain one changes nothing', () => {
    expect(STYLE_NAMES).toEqual(['plain', 'survivor', 'builder']);
    const bot = createBot(SKILLS.average, 1);
    expect(styled(createBot(SKILLS.average, 1), 'plain')).toEqual(bot);
  });

  it('keeps the board low as a survivor: the clear that takes the most dice, whatever it scores', () => {
    const bot = styled(createBot(SKILLS.pro, 1), 'survivor');
    expect(bot.skill.greed).toBe(0);
    const s = emptyRun();
    expect(bot.prefer!(plan({ dice: 5, points: 5 }), s)).toBeGreaterThan(Number(bot.prefer!(plan({ dice: 2, points: 12 }), s)));
  });

  it('plays for chains as a builder: a link before anything else while one runs', () => {
    const bot = styled(createBot(SKILLS.novice, 1), 'builder');
    expect(bot.skill.greed).toBe(1);
    const s = withChain();
    expect(Number(bot.prefer!(plan({ chain: 2 }), s))).toBeGreaterThan(Number(bot.prefer!(plan({ chain: 1 }), s)));
    expect(Number(bot.prefer!(plan({ chain: 3 }), s))).toBeGreaterThan(Number(bot.prefer!(plan({ chain: 2 }), s)));
    expect(bot.wants!(2, s)).toBe(true);
    expect(bot.wants!(5, s)).toBe(false);
  });

  it('opens, as a builder, with the group that has the most dice of its face left to feed it', () => {
    const bot = styled(createBot(SKILLS.novice, 1), 'builder');
    const s = emptyRun();
    put(s, 0, 0, 3);
    put(s, 2, 0, 3);
    put(s, 4, 0, 3);
    put(s, 6, 0, 3);
    put(s, 0, 6, 2);
    put(s, 2, 6, 2);
    // Four 3s stand about and three make the group: one is left to feed it. Two 2s make theirs and none is left.
    expect(Number(bot.prefer!(plan({ value: 3, dice: 3 }), s))).toBeGreaterThan(Number(bot.prefer!(plan({ value: 2, dice: 2 }), s)));
    expect(bot.wants!(3, s)).toBe(false);
  });
});
```

Run — FAIL: `STYLES` не экспортируется.

- [x] **Step 4: Написать.** В `src/rules/bot.ts`, после `createBot`:

```ts
/** What a player is after, laid over its head. */
export interface Style {
  /** Takes the place of the greed of the head. */
  greed?: number;
  prefer?: Bot['prefer'];
  wants?: Bot['wants'];
}

/** What a builder makes of a group of its own while a chain runs: next to nothing. */
const BESIDE_THE_CHAIN = 0.1;

/** Faces of the chains that are running. */
function chainFaces(state: RunState): number[] {
  return state.cubes.filter(inChain).map((cube) => cube.ori.top);
}

export const STYLES = {
  /** As the player is: the nearest clear, or the richest for its moves, as its head says. */
  plain: {},
  /** Keeps the board low: the clear that takes the most dice for its moves, whatever it scores. */
  survivor: { greed: 0, prefer: (plan) => plan.dice },
  /**
   * Plays for chains. While one runs, a link comes before anything else, the further on the
   * better, and with no link in sight a die is turned to the face of the chain. With none
   * running, the group to open with is the one with the most dice of its face left around it.
   */
  builder: {
    greed: 1,
    prefer: (plan, state) => {
      if (state.reactions.length > 0) return plan.chain >= 2 ? plan.chain : BESIDE_THE_CHAIN;
      const about = state.cubes.filter((cube) => cube.state === 'idle' && cube.ori.top === plan.value).length;
      return 1 + Math.max(0, about - plan.dice);
    },
    wants: (top, state) => chainFaces(state).includes(top),
  },
} as const satisfies Record<string, Style>;

export type StyleName = keyof typeof STYLES;
export const STYLE_NAMES = Object.keys(STYLES) as StyleName[];

/** The bot with a style laid over it: the same bot, changed. */
export function styled(bot: Bot, style: StyleName): Bot {
  const { greed, prefer, wants }: Style = STYLES[style];
  if (greed !== undefined) bot.skill = { ...bot.skill, greed };
  if (prefer) bot.prefer = prefer;
  if (wants) bot.wants = wants;
  return bot;
}
```

`Plan.value` объявлено необязательным (`value?: number`); в `builder.prefer` сравнение `cube.ori.top === plan.value` с `undefined` даёт «нет» — этого достаточно.

- [x] **Step 5: Проверить.** Run: `npx vitest run src/rules/bot.test.ts src/rules/director.test.ts src/rules/levelBot.test.ts && npm run typecheck` — PASS.

- [x] **Step 6: Commit.** `git add src/rules/bot.ts src/rules/bot.test.ts && git commit -m "bot: styles - a survivor and a builder of chains"`

---

### Task 4: Прогон с головой, руками, стилем, давлением и без игрока

**Files:**
- Modify: `src/rules/paceBot.ts` (`PaceRun`, `PaceOptions`, `playPace`)
- Create: `src/rules/paceBot.test.ts`

**Interfaces:**
- Consumes: `skillOf`, `RUSH`, `styled`, `HandsName`, `StyleName` из `./bot`.
- Produces: `PaceOptions` с полями `head?: SkillName`, `hands?: HandsName`, `style?: StyleName`, `rush?: boolean`, `nobody?: boolean`; `PaceRun` с полями `head: SkillName`, `hands: HandsName`, `style: StyleName`, `nobody: boolean`.

- [x] **Step 1: Тесты.** Создать `src/rules/paceBot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { playPace } from './paceBot';

const total = (runs: { score: number }[]) => runs.reduce((sum, run) => sum + run.score, 0);
const SEEDS = [1, 2, 3];

describe('a run of the pace', () => {
  it('is the run of the player of that name unless told otherwise', () => {
    const plain = playPace({ skill: 'average', seed: 3, limitMinutes: 2 });
    expect(plain).toMatchObject({ skill: 'average', head: 'average', hands: 'average', style: 'plain', nobody: false });
    expect(playPace({ skill: 'average', head: 'average', hands: 'average', style: 'plain', rush: false, seed: 3, limitMinutes: 2 })).toEqual(plain);
  });

  it('takes a head and hands apart', () => {
    const run = playPace({ skill: 'pro', hands: 'newbie', seed: 2, limitMinutes: 2 });
    expect(run).toMatchObject({ head: 'pro', hands: 'newbie' });
    expect(run).not.toEqual(playPace({ skill: 'pro', seed: 2, limitMinutes: 2 }));
  });

  it('scores more with hands that take no time, for the same head', () => {
    const slow = SEEDS.map((seed) => playPace({ skill: 'average', seed, limitMinutes: 3 }));
    const fast = SEEDS.map((seed) => playPace({ skill: 'average', hands: 'instant', seed, limitMinutes: 3 }));
    expect(total(fast)).toBeGreaterThan(total(slow));
  });

  it('makes more links of a chain as a builder than as a survivor', () => {
    const links = (style: 'builder' | 'survivor') => SEEDS.reduce((sum, seed) => sum + playPace({ skill: 'pro', style, seed, limitMinutes: 3 }).chains, 0);
    expect(links('builder')).toBeGreaterThan(links('survivor'));
  });

  it('plays another run in a rush', () => {
    const calm = playPace({ skill: 'newbie', seed: 4, limitMinutes: 3 });
    expect(playPace({ skill: 'newbie', rush: true, seed: 4, limitMinutes: 3 })).not.toEqual(calm);
  });

  it('is lost with nobody at it: the board fills', () => {
    const run = playPace({ skill: 'newbie', nobody: true, timed: true, seed: 1, limitMinutes: 5 });
    expect(run).toMatchObject({ nobody: true, endReason: 'full', steps: 0, clears: 0 });
  });
});
```

Run: `npx vitest run src/rules/paceBot.test.ts` — FAIL.

Если утверждение о направлении («больше счёта с мгновенными руками», «больше звеньев у строителя») на сидах 1–3 не выполняется, тест не ослаблять и стиль под тест не подгонять: сообщить числа в отчёте о задаче.

- [x] **Step 2: Написать.** В `PaceRun`, после `skill`:

```ts
  /** The head and the hands of the player, its style, and whether anybody played at all. */
  head: SkillName;
  hands: HandsName;
  style: StyleName;
  nobody: boolean;
```

В `PaceOptions`:

```ts
  /** The head and the hands of the player, when they are not those of `skill`. */
  head?: SkillName;
  hands?: HandsName;
  /** What the player is after. */
  style?: StyleName;
  /** The player slips and overlooks more as the board fills: the rush of its hands. */
  rush?: boolean;
  /** Nobody plays: what the pace does to a board left alone. */
  nobody?: boolean;
```

В `playPace` создание бота становится

```ts
  const head = opts.head ?? skill;
  const hands = opts.hands ?? skill;
  const style = opts.style ?? 'plain';
  const nobody = opts.nobody ?? false;
  const base = skillOf(head, hands);
  const bot = styled(createBot(opts.rush && hands !== 'instant' ? { ...base, rush: RUSH[hands] } : base, seed), style);
```

а строка шага — `step(state, nobody ? null : botCommand(bot, state));`. В возвращаемый объект после `skill` добавить `head, hands, style, nobody,`. Импорт из `./bot`: `RUSH, SKILLS, SKILL_NAMES, botCommand, createBot, skillOf, styled, type HandsName, type SkillName, type StyleName` (`SKILLS` остаётся, если ещё используется в файле; иначе убрать).

- [x] **Step 3: Проверить.** Run: `npx vitest run src/rules/paceBot.test.ts src/rules/bot.test.ts && npm run typecheck` — PASS; «plays as it did before» — с прежними числами.

- [x] **Step 4: Commit.** `git add src/rules/paceBot.ts src/rules/paceBot.test.ts && git commit -m "pace: a run takes a head, hands, a style, a rush, or nobody"`

---

### Task 5: Сетка, стили, выживание, края

**Files:**
- Modify: `src/rules/paceBot.ts` (после `paceTable`), `scripts/pace.mjs`
- Test: `src/rules/paceBot.test.ts`

**Interfaces:**
- Consumes: `playPace`, `PaceRun`, `clock`, `middle` (есть в файле).
- Produces: `survival(runs: readonly PaceRun[], minutes: number): { minute: number; alive: number; died: number }[]`; `paceGrid(opts?)`, `paceStyles(opts?)`, `survivalTable(opts?)`, `paceEdges(opts?)` — все возвращают текст таблицы.

- [x] **Step 1: Тесты.** В `src/rules/paceBot.test.ts` добавить импорт `paceEdges, paceGrid, paceStyles, survival, survivalTable, type PaceRun` и блок:

```ts
describe('tables of the pace', () => {
  const quick = { seeds: [1], limitMinutes: 1 };
  const lines = (table: string) => table.split('\n');

  it('count who is still playing minute by minute, and who was lost in each', () => {
    const run = (seconds: number, over: boolean) => ({ seconds, endReason: over ? 'full' : null }) as PaceRun;
    const runs = [run(30, true), run(90, true), run(100, true), run(180, false)];
    expect(survival(runs, 3)).toEqual([
      { minute: 1, alive: 0.75, died: 0.25 },
      { minute: 2, alive: 0.25, died: 2 / 3 },
      { minute: 3, alive: 0.25, died: 0 },
    ]);
    expect(survival([], 2)).toEqual([
      { minute: 1, alive: 0, died: 0 },
      { minute: 2, alive: 0, died: 0 },
    ]);
  });

  it('lay heads against hands: a row to a head, a column to a pair of hands', () => {
    const table = lines(paceGrid({ ...quick, heads: ['newbie', 'pro'], hands: ['newbie', 'instant'] }));
    expect(table).toHaveLength(3);
    expect(table[0]).toMatch(/head.*newbie.*instant/);
    expect(table[1]).toMatch(/^newbie/);
    expect(table[2]).toMatch(/^pro/);
  });

  it('lay the styles side by side for a player, and say what the builder scores to the survivor', () => {
    const table = lines(paceStyles({ ...quick, skills: ['average'] }));
    expect(table).toHaveLength(4);
    expect(table[0]).toMatch(/player.*style.*time.*score.*links.*builder to survivor/);
    expect(table.slice(1).map((line) => line.split(/\s+/)[1])).toEqual(['plain', 'survivor', 'builder']);
  });

  it('show the share of the runs alive at every minute for every player', () => {
    const table = lines(survivalTable({ ...quick, skills: ['newbie', 'pro'], minutes: 2 }));
    expect(table).toHaveLength(3);
    expect(table[0]).toMatch(/player.*1 min.*2 min/);
  });

  it('show the edges: a board with nobody at it, and the most the rules let a player do', () => {
    const table = lines(paceEdges(quick));
    expect(table[0]).toMatch(/player.*time.*score/);
    expect(table.slice(1).map((line) => line.split(/\s+/)[0])).toEqual(['nobody', 'ceiling']);
  });
});
```

Run — FAIL.

- [x] **Step 2: Написать.** В `src/rules/paceBot.ts`, после `paceTable`. Общая раскладка столбцов выносится из `paceTable` в функцию (в `paceTable` последние две строки заменить на `return layOut(rows);`):

```ts
/** Rows of text laid out in columns. */
function layOut(rows: readonly string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n');
}

type TableOptions = Omit<PaceOptions, 'skill' | 'seed' | 'head' | 'hands' | 'style' | 'nobody'> & { seeds?: number[] };
const SEEDS = [1, 2, 3, 4, 5];

/**
 * Who is still playing: for every minute, the share of the runs that outlast it, and of those
 * that came into it the share lost in it. A run the trial gave up on counts as playing on.
 */
export function survival(runs: readonly PaceRun[], minutes: number): { minute: number; alive: number; died: number }[] {
  const lastsTo = (run: PaceRun) => (run.endReason === null ? Infinity : run.seconds);
  return Array.from({ length: minutes }, (_, index) => {
    const came = runs.filter((run) => lastsTo(run) >= index * 60).length;
    const stayed = runs.filter((run) => lastsTo(run) >= (index + 1) * 60).length;
    return { minute: index + 1, alive: runs.length > 0 ? stayed / runs.length : 0, died: came > 0 ? (came - stayed) / came : 0 };
  });
}

/** Heads against hands: for every pair, how long the middle run lasts and what it scores. */
export function paceGrid(opts: TableOptions & { heads?: SkillName[]; hands?: HandsName[] } = {}): string {
  const { heads = SKILL_NAMES, hands = [...SKILL_NAMES, 'instant'], seeds = SEEDS, ...rest } = opts;
  const rows: string[][] = [['head \\ hands', ...hands]];
  for (const head of heads) {
    rows.push([
      head,
      ...hands.map((pair) => {
        const runs = seeds.map((seed) => playPace({ ...rest, skill: head, hands: pair, seed }));
        return `${clock(middle(runs.map((run) => run.seconds)))} ${middle(runs.map((run) => run.score))}`;
      }),
    ]);
  }
  return layOut(rows);
}

/** The styles side by side: what each makes of a run, and what a builder scores to a survivor. */
export function paceStyles(opts: TableOptions & { skills?: SkillName[]; styles?: StyleName[] } = {}): string {
  const { skills = SKILL_NAMES, styles = STYLE_NAMES, seeds = SEEDS, ...rest } = opts;
  const rows: string[][] = [['player', 'style', 'time', 'score', 'links', 'best chain', 'most cubes', 'builder to survivor']];
  for (const skill of skills) {
    const played = new Map(styles.map((style) => [style, seeds.map((seed) => playPace({ ...rest, skill, style, seed }))]));
    const score = (style: StyleName) => middle((played.get(style) ?? []).map((run) => run.score));
    const ratio = played.has('builder') && played.has('survivor') && score('survivor') > 0 ? (score('builder') / score('survivor')).toFixed(2) : '-';
    for (const style of styles) {
      const runs = played.get(style)!;
      const of = (read: (run: PaceRun) => number) => middle(runs.map(read));
      rows.push([skill, style, clock(of((run) => run.seconds)), String(of((run) => run.score)), String(of((run) => run.chains)), `x${of((run) => run.maxChain)}`, String(of((run) => run.peakCubes)), style === 'builder' ? ratio : '']);
    }
  }
  return layOut(rows);
}

/** The share of the runs of every player that are still going at each minute. */
export function survivalTable(opts: TableOptions & { skills?: SkillName[]; minutes?: number } = {}): string {
  const { skills = SKILL_NAMES, seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], minutes = 10, ...rest } = opts;
  const limitMinutes = rest.limitMinutes ?? minutes;
  const rows: string[][] = [['player', ...Array.from({ length: minutes }, (_, index) => `${index + 1} min`)]];
  for (const skill of skills) {
    const runs = seeds.map((seed) => playPace({ ...rest, limitMinutes, skill, seed }));
    rows.push([skill, ...survival(runs, minutes).map((minute) => `${Math.round(minute.alive * 100)}%`)]);
  }
  return layOut(rows);
}

/** The edges: a board nobody plays, and a player with the best head and hands that take no time. */
export function paceEdges(opts: TableOptions = {}): string {
  const { seeds = SEEDS, ...rest } = opts;
  const rows: string[][] = [['player', 'time', 'shortest-longest', 'cubes/min', 'score', 'best chain', 'most cubes']];
  const edges: [string, Partial<PaceOptions>][] = [
    ['nobody', { nobody: true }],
    ['ceiling', { hands: 'instant' }],
  ];
  for (const [name, edge] of edges) {
    const runs = seeds.map((seed) => playPace({ ...rest, ...edge, skill: 'esports', seed }));
    const of = (read: (run: PaceRun) => number) => middle(runs.map(read));
    const times = runs.map((run) => run.seconds);
    rows.push([name, clock(middle(times)), `${clock(Math.min(...times))}-${clock(Math.max(...times))}`, of((run) => run.perMinute).toFixed(1), String(of((run) => run.score)), `x${of((run) => run.maxChain)}`, String(of((run) => run.peakCubes))]);
  }
  return layOut(rows);
}
```

Импорт из `./bot` дополнить `STYLE_NAMES`.

- [x] **Step 3: Скрипт.** В `scripts/pace.mjs` дописать в шапку-комментарий:

```js
//   node scripts/pace.mjs grid                     heads against hands: time and score of every pair
//   node scripts/pace.mjs styles                   a survivor and a builder of chains beside the player as it is
//   node scripts/pace.mjs survival minutes=12      the share of the runs still going at every minute
//   node scripts/pace.mjs edges                    a board nobody plays, and the most a player can do
//   node scripts/pace.mjs rush                     the players slip and overlook more as the board fills
```

В разборе слов, перед веткой `else if (key === 'seeds')`:

```js
  if (['grid', 'styles', 'survival', 'edges'].includes(arg)) which = arg;
  else if (arg === 'rush') table.rush = true;
  else if (arg === 'endless' || arg === 'timed') { table.modes = [arg === 'timed']; table.timed = arg === 'timed'; }
```

(прежняя ветка `if (arg === 'endless' || arg === 'timed') ...` заменяется этой третьей строкой), над циклом — `let which = 'table';`. Вывод в конце:

```js
const { modes, skills, timed, limitMinutes, ...shared } = table;
const print = {
  table: () => module.paceTable({ tuning, experiments, ...table, timed: undefined }),
  grid: () => module.paceGrid({ tuning, experiments, ...shared, timed, limitMinutes }),
  styles: () => module.paceStyles({ tuning, experiments, ...shared, skills, timed, limitMinutes }),
  survival: () => module.survivalTable({ tuning, experiments, ...shared, skills, timed, minutes: limitMinutes }),
  edges: () => module.paceEdges({ tuning, experiments, ...shared, timed, limitMinutes }),
};
console.log(print[which]());
```

`paceTable` не знает поля `timed`: оно снимается перед вызовом, как показано. `paceTable` получает поле `rush` через `...rest` и передаёт его в `playPace` без правок.

- [x] **Step 4: Проверить.** Run: `npx vitest run src/rules/paceBot.test.ts && npm run typecheck && npm test` — PASS. Затем руками:

```bash
node scripts/pace.mjs endless seeds=2 minutes=3 players=newbie,pro
node scripts/pace.mjs grid endless seeds=2 minutes=3
node scripts/pace.mjs styles endless seeds=2 minutes=3 players=average,pro
node scripts/pace.mjs survival endless seeds=4 minutes=6
node scripts/pace.mjs edges endless seeds=2 minutes=5
node scripts/pace.mjs endless rush seeds=2 minutes=3 players=newbie
```

Каждая печатает таблицу и не падает. Первая — та же таблица, что печаталась до правок на тех же словах (сверить со снимком, снятым на исходном коммите: `git stash` не использовать, снимок снять до начала Task 1 и сохранить в файл вне репозитория).

- [x] **Step 5: Сборка и коммит.** Run: `npm run build` — PASS. `git add src/rules/paceBot.ts src/rules/paceBot.test.ts scripts/pace.mjs && git commit -m "pace: the grid of heads and hands, the styles, who is still playing, the edges"`

---

### Task 6: Числа

**Files:** нет правок кода.

- [x] **Step 1: Снять таблицы на нынешнем темпе.**

```bash
node scripts/pace.mjs grid endless seeds=5 minutes=20
node scripts/pace.mjs styles endless seeds=5 minutes=20
node scripts/pace.mjs survival endless seeds=10 minutes=12
node scripts/pace.mjs edges endless seeds=5 minutes=20
node scripts/pace.mjs endless rush seeds=5 minutes=20
node scripts/pace.mjs endless seeds=5 minutes=20
```

- [x] **Step 2: Отчёт.** В последнем сообщении задачи привести все шесть таблиц как есть и три вывода по ним, каждый одной фразой с числами: что даёт голове смена рук (строка `pro` и строка `newbie` сетки); набирает ли строитель больше выживальщика и живёт ли он меньше; на какой минуте гибнет половина прогонов у `newbie` и у `novice`. Выводы — только то, что видно в таблицах; без советов по темпу.
