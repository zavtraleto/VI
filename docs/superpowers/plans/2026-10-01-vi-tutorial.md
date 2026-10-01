# VI Tutorial Implementation Plan

> **Superseded.** This plan built the first tutorial (five moves, all dice on the board at once). After the playtest it was replaced by the six-lesson tutorial described in the spec; the module layout below still holds, the script and the UI do not.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the practice run with a five-move tutorial on rails that hands straight over to Endless.

**Architecture:** The script, the rails and the hold live in the deterministic `rules` module (`rules/tutorial.ts`) and are covered by Vitest. The pointer is drawn by the existing floor overlay; the text line, the input glyph and the rule triangle are DOM in `ui/tutorial.ts`. `app/game.ts` connects them and starts Endless around the cell where the player finished.

**Tech Stack:** TypeScript, Vite, Three.js, DOM UI, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-vi-tutorial-design.md`

## Global Constraints

- Script: `W, N, W, N, W`. Layout: A (5,4) top 1 east 2, under the player; B (3,4) top 2; C (4,3) top 6 east 3; D (3,2) top 5 east 3; E1 (2,3) top 3; E2 (1,3) top 3. (The first draft went north from (3,4); the browser check showed that the cell north of the player is hidden behind the player's own die, so the layout was turned west. The code blocks of Task 1 below show the first draft.)
- A step off the script changes nothing: no `blocked` event, no `blockedSteps`, event `nudge`.
- Sinking dice wait at height 0.6 until the tutorial is done.
- `tutorialDone` comes 1600 ms after the fifth command, once.
- Text lines exactly as in the spec table, Russian and English.
- No context hints while the tutorial runs.
- Comments and identifiers in English, user-facing text through `ui/i18n.ts`.

---

### Task 1: Tutorial rules

**Files:**
- Create: `src/rules/tutorial.ts`, `src/rules/tutorial.test.ts`
- Modify: `src/rules/types.ts`, `src/rules/config.ts`, `src/rules/sim.ts`, `src/rules/spawn.ts`, `src/rules/index.ts`, `src/rules/sim.test.ts`

**Interfaces:**
- Produces:
  - `TutorialState { step: number; timer: number; done: boolean }` on `RunState.tutorial`
  - events `{ type: 'nudge'; dir: Dir }`, `{ type: 'tutorialStep'; step: number }`, `{ type: 'tutorialDone' }`; `tutorialRefill` is removed
  - `RulesConfig.tutorialEndTicks` (replaces `tutorialRefillTicks`)
  - `TUTORIAL_SCRIPT: readonly Dir[]`, `TUTORIAL_HOLD_HEIGHT = 0.6`, `TUTORIAL_A: Orientation`
  - `placeTutorialLayout(state)`, `tutorialDir(state): Dir | null`, `tutorialMove(state, dir): void`, `isHeld(state, cube): boolean`, `runTutorial(state): void`
  - `placeStartLayout` works for any `config.startX/startZ`, including the fallback layout

- [ ] **Step 1: Write the failing tests** — `src/rules/tutorial.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from './board';
import { defaultConfig } from './config';
import { createRun, step } from './sim';
import { hasReadyGroup } from './spawn';
import { run, snapshot } from './testkit';
import { TUTORIAL_HOLD_HEIGHT, TUTORIAL_SCRIPT, tutorialDir } from './tutorial';
import type { Dir, GameEvent, RunState, Tuning } from './types';

function tutorial(tuning: Partial<Tuning> = {}): RunState {
  return createRun({ seed: 3, config: defaultConfig({}, tuning), tutorial: true });
}

function collect(s: RunState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

/** Issues a command, lets the action finish and returns everything that happened. */
function play(s: RunState, dir: Dir): GameEvent[] {
  step(s, dir);
  return [...s.events, ...collect(s, s.config.actionTicks)];
}

describe('tutorial layout', () => {
  it('sets up six dice with nothing ready to clear and no spawning', () => {
    const s = tutorial();
    expect(s.mode).toBe('practice');
    expect(s.spawnEnabled).toBe(false);
    expect(s.player).toMatchObject({ x: 3, z: 4, level: 'top' });
    for (const [x, z, top] of [[3, 4, 1], [2, 3, 2], [4, 3, 6], [3, 2, 5], [4, 1, 3], [5, 1, 3]]) {
      expect(cubeAt(s, x, z)?.ori.top).toBe(top);
    }
    expect(s.cubes.length).toBe(6);
    const tops = new Array<number>(49).fill(0);
    for (const c of s.cubes) tops[c.z * 7 + c.x] = c.ori.top;
    expect(hasReadyGroup(tops, 7)).toBe(false);
    run(s, 500);
    expect(s.cubes.length).toBe(6);
    expect(s.pending.length).toBe(0);
  });
});

describe('tutorial script', () => {
  it('teaches a pair, a triple and a chain in five moves', () => {
    const s = tutorial();
    expect(TUTORIAL_SCRIPT).toEqual(['N', 'E', 'N', 'W', 'N']);
    expect(play(s, 'N')).toContainEqual(expect.objectContaining({ type: 'match', value: 2, count: 2, points: 4 }));
    expect(play(s, 'E')).toContainEqual({ type: 'move', kind: 'hop', dir: 'E' });
    expect(play(s, 'N')).toContainEqual(expect.objectContaining({ type: 'match', value: 3, count: 3, points: 9 }));
    expect(play(s, 'W')).toContainEqual({ type: 'move', kind: 'hop', dir: 'W' });
    expect(play(s, 'N')).toContainEqual(expect.objectContaining({ type: 'chain', value: 3, chain: 2, count: 1, points: 24 }));
    expect(s.score).toBe(37);
    expect(s.maxChain).toBe(2);
    expect(s.player).toMatchObject({ x: 3, z: 1, level: 'top' });
    expect(tutorialDir(s)).toBeNull();
  });

  it('reports each scripted move', () => {
    const s = tutorial();
    expect(tutorialDir(s)).toBe('N');
    expect(play(s, 'N')).toContainEqual({ type: 'tutorialStep', step: 1 });
    expect(tutorialDir(s)).toBe('E');
  });

  it('ignores a step off the script', () => {
    const s = tutorial();
    for (const dir of ['E', 'S', 'W'] as const) {
      const before = snapshot(s);
      step(s, dir);
      expect(s.events).toEqual([{ type: 'nudge', dir }]);
      expect(snapshot(s)).toBe(before);
    }
    expect(s.stats.blockedSteps).toBe(0);
    expect(s.stats.steps).toBe(0);
  });

  it('keeps sinking dice waiting for the player', () => {
    const s = tutorial();
    play(s, 'N');
    run(s, s.config.sinkingTicks * 3);
    expect(s.cubes.length).toBe(6);
    expect(s.player.level).toBe('top');
    expect(s.stats.falls).toBe(0);
    const own = cubeAt(s, 3, 3)!;
    expect(own.state).toBe('sinking');
    expect(cubeHeight(own, s.config)).toBeCloseTo(TUTORIAL_HOLD_HEIGHT);
    play(s, 'E');
    play(s, 'N');
    run(s, s.config.sinkingTicks * 3);
    play(s, 'W');
    expect(play(s, 'N')).toContainEqual(expect.objectContaining({ type: 'chain', chain: 2 }));
  });

  it('does not depend on the pace variables', () => {
    const s = tutorial({ sinkMs: 1000, stepMs: 400, lowHeight: 0.9 });
    for (const dir of TUTORIAL_SCRIPT) {
      play(s, dir);
      run(s, 200);
    }
    expect(s.score).toBe(37);
    expect(s.maxChain).toBe(2);
  });

  it('ends once, a moment after the last move, and takes no input meanwhile', () => {
    const s = tutorial();
    for (const dir of TUTORIAL_SCRIPT) play(s, dir);
    step(s, 'S');
    expect(s.events).toEqual([]);
    expect(s.player).toMatchObject({ x: 3, z: 1 });
    // The clock started with the fifth command: actionTicks + 2 ticks have passed.
    const quiet = collect(s, s.config.tutorialEndTicks - s.config.actionTicks - 3);
    expect(quiet.some((e) => e.type === 'tutorialDone')).toBe(false);
    const rest = collect(s, 50);
    expect(rest.filter((e) => e.type === 'tutorialDone').length).toBe(1);
    expect(s.tutorial?.done).toBe(true);
    // Released: every die was part of a clear, so the board empties under the player.
    run(s, s.config.sinkingTicks + 5);
    expect(s.cubes.length).toBe(0);
    expect(s.player.level).toBe('ground');
  });
});
```

Add to `describe('start layout')` in `src/rules/sim.test.ts`:

```ts
  it('builds the layout around any start cell', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createRun({ seed, config: { ...defaultConfig(), startX: 3, startZ: 1 } });
      expect(s.player).toMatchObject({ x: 3, z: 1, level: 'top' });
      expect(cubeAt(s, 3, 1)).toBeDefined();
      expect(s.cubes.length).toBe(s.config.startCubes);
      expect(hasReadyGroup(topsOf(s), 7)).toBe(false);
    }
    const fallback = createRun({ seed: 1, config: { ...defaultConfig(), startX: 5, startZ: 5 }, forceFallback: true });
    expect(cubeAt(fallback, 5, 5)).toBeDefined();
    expect(fallback.cubes.length).toBe(fallback.config.startCubes);
  });
```

Remove the old `describe('tutorial')` block and the `TUTORIAL_A` import from `sim.test.ts`.

- [ ] **Step 2: Run** `npx vitest run src/rules` — expected: FAIL (`./tutorial` does not exist).

- [ ] **Step 3: Implement.**

`types.ts`: add `TutorialState`, set `RunState.tutorial: TutorialState | null`, swap the events, rename the config field. `config.ts`: `tutorialEndTicks: msToTicks(1600)`.

`src/rules/tutorial.ts`:

```ts
import { applyMove } from './movement';
import { ALL_ORIENTATIONS } from './orientation';
import { addCube } from './spawn';
import type { Cube, Dir, Orientation, RunState } from './types';

/** The five moves of the tutorial: a pair, a hop, a triple, a hop, a chain. */
export const TUTORIAL_SCRIPT: readonly Dir[] = ['N', 'E', 'N', 'W', 'N'];

/** Sinking dice stop here while the tutorial runs, so the player sets the pace. */
export const TUTORIAL_HOLD_HEIGHT = 0.6;

export const TUTORIAL_A: Orientation = { top: 1, bottom: 6, north: 5, south: 2, east: 4, west: 3 };

function facing(faces: Partial<Orientation>): Orientation {
  const found = ALL_ORIENTATIONS.find((o) =>
    (Object.keys(faces) as (keyof Orientation)[]).every((k) => o[k] === faces[k]),
  );
  if (!found) throw new Error(`no orientation for ${JSON.stringify(faces)}`);
  return found;
}

/** Offsets from the start cell. The face each die needs is its south one, towards the camera. */
const LAYOUT: readonly { dx: number; dz: number; ori: Orientation }[] = [
  { dx: 0, dz: 0, ori: TUTORIAL_A }, // A, under the player: north turns up its 2 beside B
  { dx: -1, dz: -1, ori: facing({ top: 2 }) }, // B
  { dx: 1, dz: -1, ori: facing({ top: 6, south: 3 }) }, // C: north turns up its 3 beside E1
  { dx: 0, dz: -2, ori: facing({ top: 5, south: 3 }) }, // D: north turns up its 3 beside sinking E1
  { dx: 1, dz: -3, ori: facing({ top: 3 }) }, // E1
  { dx: 2, dz: -3, ori: facing({ top: 3 }) }, // E2
];

export function placeTutorialLayout(state: RunState): void {
  const { startX, startZ } = state.config;
  for (const { dx, dz, ori } of LAYOUT) addCube(state, startX + dx, startZ + dz, ori);
}

/** The move the tutorial is waiting for; null once the script is finished or outside it. */
export function tutorialDir(state: RunState): Dir | null {
  const tutorial = state.tutorial;
  if (!tutorial || tutorial.step >= TUTORIAL_SCRIPT.length) return null;
  return TUTORIAL_SCRIPT[tutorial.step];
}

/** The tutorial runs on rails: only the scripted step is carried out. */
export function tutorialMove(state: RunState, dir: Dir): void {
  const tutorial = state.tutorial;
  const expected = tutorialDir(state);
  if (!tutorial || expected === null) return;
  if (dir !== expected) {
    state.events.push({ type: 'nudge', dir });
    return;
  }
  if (!applyMove(state, dir)) return;
  tutorial.step++;
  state.events.push({ type: 'tutorialStep', step: tutorial.step });
}

/** A sinking die that has reached the hold height and waits there. */
export function isHeld(state: RunState, cube: Cube): boolean {
  if (!state.tutorial || state.tutorial.done || cube.state !== 'sinking') return false;
  return cube.t >= Math.round(state.config.sinkingTicks * (1 - TUTORIAL_HOLD_HEIGHT));
}

/** Counts down from the last scripted move to the end of the tutorial. */
export function runTutorial(state: RunState): void {
  const tutorial = state.tutorial;
  if (!tutorial || tutorial.done || tutorial.step < TUTORIAL_SCRIPT.length) return;
  tutorial.timer++;
  if (tutorial.timer < state.config.tutorialEndTicks) return;
  tutorial.done = true;
  state.events.push({ type: 'tutorialDone' });
}
```

`sim.ts`: import from `./tutorial`; initial `tutorial: { step: 0, timer: 0, done: false }`; in `finishRemovals` skip `isHeld` cubes; in `step` route the command through `tutorialMove` while `state.tutorial && !state.tutorial.done`; delete the local `runTutorial`.

`spawn.ts`: delete `TUTORIAL_A`, `placeTutorialLayout`, `tutorialRefill`, `isBesidePlayer`; in `placeStartLayout` move the first fallback cube to the start cell when the fallback has no cube there.

`index.ts`: `export { TUTORIAL_SCRIPT, isHeld, tutorialDir } from './tutorial';`

- [ ] **Step 4: Run** `npx vitest run src/rules` — expected: PASS. (`app/game.ts` will not typecheck until Task 4.)

- [ ] **Step 5: Commit** — `Tutorial rules: five scripted moves on rails, held sinking, hand-off event`

---

### Task 2: Pointer and rise-in in the renderer

**Files:**
- Modify: `src/render/overlays.ts`, `src/render/view.ts`, `src/render/cubes.ts`, `src/render/player.ts`

**Interfaces:**
- Consumes: `isHeld` from `rules`.
- Produces:
  - `OverlayOptions.marker: { x: number; z: number; raised: boolean; top?: number } | null` — `raised` puts the marker on top of a die; `top` shows the ghost face of that value on the cell.
  - `BoardView.reset(riseIn = false)` — with `riseIn` the dice and the figure come up out of the floor over 600 ms.

- [ ] **Step 1:** `overlays.ts` — add a `markerGhost` plane (ghost materials, y 0.02); in `sync` set marker height to `0.985` when `raised`, else `0.015`; show `markerGhost` with `ghostMaterials[top - 1]` when `top` is set.
- [ ] **Step 2:** `view.ts` — field `rise` (1 → 0 over 600 ms, 0 at once with reduced motion); `cubes.group.position.y = -rise²`, and the same offset added to the figure after `player.sync`.
- [ ] **Step 3:** `cubes.ts`, `player.ts` — pass `alpha = 0` to `cubeHeight` for a held die, so it does not creep between ticks.
- [ ] **Step 4:** verified together with Task 4 in the browser.

---

### Task 3: Guide UI

**Files:**
- Create: `src/ui/tutorial.ts`
- Modify: `src/ui/i18n.ts`, `src/ui/styles.css`

**Interfaces:**
- Produces:

```ts
export type InputGlyph = 'swipe' | 'keys' | 'none';

export class TutorialGuide {
  constructor(root: HTMLElement);
  /** Shows the line for a step (0..5) and the input glyph for `dir`; `screen` is where `dir` points on screen. */
  show(step: number, dir: Dir | null, glyph: InputGlyph, screen: { x: number; y: number } | null): void;
  /** Lights the row of the rule triangle for a face value. */
  light(value: number): void;
  /** Lights the remaining rows one after another. */
  finale(): void;
  /** Answers a step off the script. */
  nudge(): void;
  hide(): void;
}
```

- i18n keys `tutLine0` … `tutLine5` (texts from the spec table); remove `hintRollHere`, `hintRollKey`, `hintRollSwipe`, `hintTwos`; `guidedStart` label becomes «Разовые подсказки в партии» / "One-time hints during a run".
- CSS classes: `.guide`, `.guide-line`, `.guide-swipe`, `.guide-swipe-track`, `.guide-swipe-dot`, `.guide-keys`, `.key`, `.key.lit`, `.guide.nudge`, `.rule-tri`, `.rule-row`, `.rule-row.lit`; reduced-motion overrides.

- [ ] **Step 1:** write `ui/tutorial.ts`, the texts and the styles.
- [ ] **Step 2:** `npx tsc --noEmit` for this file's types (full typecheck after Task 4).

---

### Task 4: Game wiring and hand-off

**Files:**
- Modify: `src/app/game.ts`, `src/audio/engine.ts`, `docs/ROADMAP.md`, `docs/superpowers/specs/2026-10-01-vi-mvp-design.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `Game.startRun(kind, start?: { x: number; z: number })`; `AudioEngine.begin()`.

- [ ] **Step 1:** `game.ts` — create `TutorialGuide`; `syncGuide()` picks line, glyph (`swipe` on a coarse pointer with gestures, `keys` on a fine pointer, otherwise `none`) and the seal pulse from `tutorialDir`; per-frame marker from `resolveMove(state, tutorialDir(state))`; events: `match` → `guide.light(value)`, `tutorialStep` → `syncGuide()` and `guide.finale()` after the last step, `nudge` → `guide.nudge()`, `tutorialDone` → save `tutorialDone`, remember the player's cell; after `runner.advance` start Endless there with `view.reset(true)` and `audio.begin()`. `hintOnce` returns early while `state.tutorial` is set. Old sticky hint, `hintTwos` and `tutorialRefill` handling are removed.
- [ ] **Step 2:** `npm run typecheck && npm test` — expected: PASS.
- [ ] **Step 3:** browser check at phone and desktop width (dev server `vi-dev`, port 5183; the preview tab is hidden, so frames are driven with `window.vi.frame(t)`): pointer on every step, ghost face, text line, glyph, triangle rows, nudge, hand-off into Endless with the player on a die at (3,1), record-eligible run.
- [ ] **Step 4:** update ROADMAP and section 11 of the MVP design doc.
- [ ] **Step 5: Commit** — `Tutorial: guided five-move script with pointer, text, rule triangle and hand-off to Endless`
