# Единый язык картинки — план сборки

> Вид: план. Статус: не начат. Дата: 2026-10-14.
> Спека: [2026-10-14-vi-one-picture-language-design.md](../specs/2026-10-14-vi-one-picture-language-design.md). Исследование: [VI_PS2_Effects_Research.md](../../art/VI_PS2_Effects_Research.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На комбо программа отвечает светом по линиям сетки вместо плоского диска, искры становятся точками трубки и падают в воду, кость не мигает, вспышек не больше трёх в секунду, блик фигуры на стороне лампы воды, вода показывает бегущий свет бликом.

**Architecture:** Всё в `src/render` (чистая симуляция `src/rules` не трогается). Свет по линиям — второй экземпляр `LineGrid` со своей волной из клеток группы (многоисточниковый `waveFrom`). Искры — тот же `InstancedMesh` в `BoardBursts`, но с размером в точках трубки (`dotWorld`), на сетке точек, со своим шейдером «ядро-ореол», двумя судьбами (падение в воду, распад на точки). Новый чистый модуль `flashes.ts` считает вспышки. Вода получает до четырёх «бегущих источников» и рисует их бликом.

**Tech Stack:** TypeScript, three.js (ortho-камера, `InstancedBufferGeometry`, `ShaderMaterial`), vitest, vite. Проверки: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`.

## Global Constraints

- Работать в worktree от `origin/main`, ветка `picture-language`; в `main` — только по слову владельца (CLAUDE.md).
- `src/rules` не трогать. Верхние грани, точки, метки клеток, фигура — не искажаются.
- Вид костей и их числа (Visual_Language 3.1) не трогать, кроме удаления мигания комбо.
- Endless: столб прихода, множитель, «+очки», подводное — не трогать. Общие эффекты поля меняются и там.
- Цена: не дороже **+0,3 мс** на кадр 1920×1080 против 0.2.54; на 540×960 — в пределах шума. Телефон не ниже 60 кадров.
- `reducedMotion`: `BoardView.beat` по-прежнему возвращается до света и искр; расхождение цветов обнулено.
- Новые числа — ползунки в `src/render/params.ts` (`BOARD_GROUPS`) с подписью в `src/lab/boardPanel.ts` (`LABELS`), умолчания из спеки раздел 5.
- Номера строк — по `main` на `6bbb0df`; сверять по месту.
- Комментарии в коде — на английском, в стиле файла (объясняют «почему», простыми словами).
- Коммиты короткие, по-русски, заголовок до 70 знаков; после каждой задачи — `npm test` и `npm run typecheck`.

## Review Focus

1. Группа у края доски или у выреза: волна света не должна «перепрыгивать» вырезы и должна останавливаться на `reach` клеток; тест в Задаче 1 (вырез между двумя клетками группы).
2. Две группы подряд быстрее, чем гаснет свет (цепочка ×2…×6 подряд в `?lab=juice`): новая волна сменяет старую без «зависшей» точки; тест в Задаче 3 (`light.heads.visible` снимается после `wholeMs + afterMs`, новая волна переустанавливает `set`).
3. Искра, вылетевшая при выключенной воде (`water === null`) или в `reducedMotion`: не должна падать «в никуда» вечно; тест в Задаче 4 (падающая искра гаснет не позже `SPARK_FALL_MAX_S`).
4. Больше 32 приземлений за кадр (цепочка ×6, 16 искр на кость): лишние капли отбрасываются, искры всё равно гаснут; тест в Задаче 4.
5. Пять вспышек за две секунды (серия ×2…×6): `chroma` не падает в ноль и не скачет чаще трёх раз в секунду; тест в Задаче 5 (`FlashBudget` + поведение «продлить, не поднять»).

---

### Task 1: `waveFrom` от нескольких клеток

**Files:**
- Modify: `src/render/gridLines.ts:60-141`
- Test: `src/render/gridLines.test.ts`

**Interfaces:**
- Produces: `waveFrom(segments: readonly GridSegment[], from: Cell | readonly Cell[]): GridSegment[]` — стороны всех названных клеток получают `reach` 0; остальное как прежде. `Cell = { x: number; z: number }` (уже есть в файле).

- [ ] **Step 1: Failing tests**

В конец `describe` о волне в `src/render/gridLines.test.ts` (рядом с существующими тестами `waveFrom`):

```ts
describe('a wave from several cells', () => {
  it('starts on the sides of every cell named: all of them are at reach 0', () => {
    const segments = waveFrom(gridSegments(4, []), [{ x: 1, z: 1 }, { x: 2, z: 1 }]);
    for (const [ax, az, bx, bz] of [[1, 1, 2, 1], [1, 2, 2, 2], [1, 1, 1, 2], [2, 1, 3, 1], [2, 2, 3, 2], [3, 1, 3, 2]]) {
      expect(side(segments, ax, az, bx, bz).reach).toBe(0);
    }
    // The side the two cells share is counted once and is at 0 too.
    expect(side(segments, 2, 1, 2, 2).reach).toBe(0);
  });

  it('counts the rest from the nearer of the cells', () => {
    const segments = waveFrom(gridSegments(4, []), [{ x: 0, z: 0 }, { x: 3, z: 3 }]);
    // A side one step from the far cell is at 1, not at the distance from the first cell.
    expect(side(segments, 2, 3, 2, 4).reach).toBe(1);
    expect(side(segments, 1, 0, 2, 0).reach).toBe(1);
  });

  it('does not run across a cell cut out of the board', () => {
    // Two cells with a hole between them: the hole's far sides are reached round it, not through it.
    const segments = waveFrom(gridSegments(3, [{ x: 1, z: 0 }]), [{ x: 0, z: 0 }]);
    expect(side(segments, 2, 0, 3, 0).reach).toBeGreaterThanOrEqual(2);
  });

  it('with one cell is the wave it was', () => {
    const one = waveFrom(gridSegments(3, []), { x: 1, z: 1 });
    const list = waveFrom(gridSegments(3, []), [{ x: 1, z: 1 }]);
    expect(list.map((s) => s.reach)).toEqual(one.map((s) => s.reach));
  });
});
```

- [ ] **Step 2: Run, see them fail**

`npx vitest run src/render/gridLines.test.ts` — падают на типе аргумента / `reach`.

- [ ] **Step 3: Implement**

В `gridLines.ts` заменить начало `waveFrom`:

```ts
export function waveFrom(segments: readonly GridSegment[], from: Cell | readonly Cell[]): GridSegment[] {
  const cells: readonly Cell[] = Array.isArray(from) ? (from as readonly Cell[]) : [from as Cell];
  // The middle of the cells named: where "nearer the middle" and "clockwise" are counted from.
  const mx = cells.reduce((sum, c) => sum + c.x, 0) / Math.max(1, cells.length) + 0.5;
  const mz = cells.reduce((sum, c) => sum + c.z, 0) / Math.max(1, cells.length) + 0.5;
  const away = (x: number, z: number): number => (x - mx) ** 2 + (z - mz) ** 2;
  /** Both ends are corners of one of the cells named: it is one of its sides. */
  const own = (s: GridSegment): boolean =>
    cells.some((c) => (s.ax - c.x - 0.5) ** 2 + (s.az - c.z - 0.5) ** 2 < 0.75 && (s.bx - c.x - 0.5) ** 2 + (s.bz - c.z - 0.5) ** 2 < 0.75);
```

Остальное тело без изменений (`own` уже используется в `segments.forEach`; `away` — для «ближе к середине» и запасного старта с угла). Обновить doc-комментарий: «from one cell, or from several at once: a group of dice».

- [ ] **Step 4: Run tests**

`npx vitest run src/render/gridLines.test.ts` — все зелёные, включая старые.

- [ ] **Step 5: Commit**

```bash
git add src/render/gridLines.ts src/render/gridLines.test.ts
git commit -m "Волна линий от нескольких клеток"
```

---

### Task 2: `LineGrid.show` со своими длительностями

**Files:**
- Modify: `src/render/lineGrid.ts:336-362`
- Test: `src/render/lineGrid.test.ts`

**Interfaces:**
- Produces: `LineGrid.show(share: number, drawing: boolean, timeMs: number, times?: { wholeMs: number; afterglowMs: number; headGlow?: number }): void`. Без `times` — как прежде (из `look.board`).

- [ ] **Step 1: Failing test**

```ts
it('takes the times it is given instead of those of the look', () => {
  const grid = new LineGrid(look); // как в соседних тестах файла
  grid.set(waveFrom(gridSegments(2, []), { x: 0, z: 0 }));
  grid.show(0.5, true, 1000, { wholeMs: 500, afterglowMs: 250, headGlow: 2 });
  const u = (grid as unknown as { uniforms: Record<string, { value: number }> }).uniforms;
  // Tail is afterglow / whole of the wave, in parts of it.
  expect(u.uTail.value).toBeCloseTo((250 / 500) * (grid.reach + 1));
  expect(u.uHead.value).toBe(1);
  grid.show(0.5, true, 1125, { wholeMs: 500, afterglowMs: 250 });
  // Half the afterglow is gone 125 ms after the share last moved.
  expect(u.uAfter.value).toBeCloseTo(0.5);
});
```

- [ ] **Step 2: Run, see it fail** — `npx vitest run src/render/lineGrid.test.ts`.

- [ ] **Step 3: Implement**

В `show`:

```ts
  show(share: number, drawing: boolean, timeMs: number, times?: { wholeMs: number; afterglowMs: number; headGlow?: number }): void {
    ...
    const lasts = Math.max(0, times ? times.afterglowMs : n('afterglowMs'));
    const whole = Math.max(1, times ? times.wholeMs : drawing ? n('drawMs') : n('eraseMs'));
    const glow = Math.max(0, times?.headGlow ?? n('headGlow'));
```

Остальное без изменений.

- [ ] **Step 4: Run tests** — зелёные. **Step 5: Commit** `git commit -m "LineGrid.show: свои длительности для второй волны"`.

---

### Task 3: Свет по линиям вместо кольца

**Files:**
- Modify: `src/render/view.ts` (поля ~274-300; `beat` 871-896; `farewell` 922-927; `draw` ~1146-1151 и 1254; `reset` 940-965; `lay` 622-623; `applyPalette` ~1458; `dispose` ~1434)
- Modify: `src/render/burst.ts` (убрать кольца: 34-35, 59-66, 83-90, 99-106, 161-171, ветка в `update`, `reset`, `dispose`)
- Test: `src/render/burst.test.ts`, `src/render/lineGrid.test.ts`

**Interfaces:**
- Consumes: `waveFrom(sides, cells)` (Task 1), `LineGrid.show(..., times)` (Task 2).
- Produces: в `BoardView` поле `light: LineGrid` и `private lightWave: { cells, startedMs, wholeMs, afterMs, reach } | null`; `BoardBursts.fire` переименован в `sparks(beat)`; `BoardBursts.ring` удалён; `thrown === count > 0`.

- [ ] **Step 1: Failing tests**

`burst.test.ts`: удалить тесты «counts a ring…» и «runs a ring of its own…»; первый тест переписать: `expect(over).toHaveLength(1)` и без `RingGeometry`; `fired()` зовёт `bursts.sparks(...)`.

`lineGrid.test.ts` (поведение второй волны через сам `LineGrid`):

```ts
it('with opacity 0 shows nothing at rest and a point while the wave runs', () => {
  const grid = new LineGrid(look);
  grid.opacity = 0;
  grid.set(waveFrom(gridSegments(3, []), [{ x: 1, z: 1 }]));
  grid.show(1, true, 0, { wholeMs: 400, afterglowMs: 300 });
  expect(grid.heads.visible).toBe(false);
  grid.show(0.3, true, 100, { wholeMs: 400, afterglowMs: 300 });
  expect(grid.heads.visible).toBe(true);
});
```

- [ ] **Step 2: Run, see them fail.**

- [ ] **Step 3: burst.ts — кольца долой**

Удалить `MAX_RINGS`, `RING_REACH`, `RING_MS`, поле `rings`, `ringGeometry`, цикл создания колец в конструкторе, метод `ring`, цикл по кольцам в `update`, строки в `reset`/`dispose`; `thrown` → `return this.count > 0;`; `flying` удалить. `fire` → `sparks` (тело пока прежнее, без вызова `this.ring(...)`). Обновить doc-комментарий класса («sparks, and the short lines a die comes apart into; the ring over the surface is light on the lines now, `LineGrid`»).

- [ ] **Step 4: view.ts — второй LineGrid**

Поля (рядом с `grid`, ~244):

```ts
  /** Light the board answers a group with: it runs over the lines from the group's cells, in the colour of its channel. */
  private readonly light: LineGrid;
  private lightWave: { cells: readonly { x: number; z: number }[]; startedMs: number; wholeMs: number; afterMs: number; reach: number } | null = null;
```

Константы (на месте `BEAT_PUNCH` ~55):

```ts
/** How far the light of a group runs over the lines, in cells, and how long it takes, by tier: the ring that was had these. */
const LIGHT_REACH = [2, 3, 4, 5, 7];
const LIGHT_MS = [420, 480, 560, 640, 720];
```

Конструктор (после `this.grid`, ~366-373):

```ts
    this.light = new LineGrid(look);
    this.light.object.position.y = 0.005;
    this.light.object.renderOrder = -4;
    this.light.opacity = 0;
    this.world.add(this.light.object);
```

`lay()` (~622): после `this.sides = gridSegments(...)` — `this.lightWave = null; this.light.heads.visible = false;`.

Новый метод:

```ts
  /** Light runs over the lines from `cells`, `reach` cells in `wholeMs`, and goes out over `afterMs`. A run that is on is replaced. */
  private lightFrom(cells: readonly { x: number; z: number }[], value: number, reach: number, wholeMs: number): void {
    if (cells.length === 0 || value < 1 || this.still) return;
    const n = (name: string): number => Number(this.look.board[name] ?? 0);
    this.light.set(waveFrom(this.sides, cells));
    this.light.colour.copy(this.lit[value - 1]);
    this.lightWave = { cells, startedMs: this.lastTime, wholeMs: Math.max(1, wholeMs), afterMs: Math.max(0, n('lightAfterMs')), reach: Math.max(0, reach * n('lightScale')) };
  }
```

`beat()`: заменить `this.bursts.fire(beat);` на

```ts
    this.bursts.sparks(beat);
    this.lightFrom(beat.cells, beat.value, LIGHT_REACH[tier], LIGHT_MS[tier]);
```

`farewell()`: заменить `this.bursts.ring(...)` на `this.lightFrom(cells, value, (this.grid.reach + 1) * wide, n('endRingMs') * wide);` (параметр `endRingReach` больше не читается — оставить в params с подписью, или убрать вместе с подписью; выбрать «убрать»).

`draw()` рядом с `this.grid.show(...)` (~1149):

```ts
    const run2 = this.lightWave;
    if (run2) {
      const n2 = (name: string): number => Number(this.look.board[name] ?? 0);
      const elapsed = timeMs - run2.startedMs;
      const parts = this.light.reach + 1;
      const share = Math.min(1, elapsed / run2.wholeMs) * Math.min(1, run2.reach / Math.max(1, parts));
      this.light.show(share, true, timeMs, { wholeMs: run2.wholeMs, afterglowMs: run2.afterMs, headGlow: n2('lightHead') });
      if (elapsed > run2.wholeMs + run2.afterMs) {
        this.lightWave = null;
        this.light.heads.visible = false;
      }
    }
```

Замечание: `share < 1` при `reach < parts` оставляет волну «недорисованной» — это и нужно: точки гаснут с послесвечением, линии второго экземпляра при `opacity` 0 не видны.

`loose` условие (~1254): `if (this.bursts.thrown || this.grid.heads.visible || this.light.heads.visible) this.loose(drawn);`

`reset()`: `this.lightWave = null; this.light.heads.visible = false;`. `dispose()`: `this.light.dispose()`.

`params.ts` группа `road`: добавить `lightAfterMs: number(300, 0, 1500, 10)`, `lightHead: number(1.6, 0, 3, 0.05)`, `lightScale: number(1, 0, 2, 0.05)`; убрать `endRingReach`. `boardPanel.ts` `LABELS`: `lightAfterMs: 'свет группы: послесвечение'`, `lightHead: 'свет группы: точки'`, `lightScale: 'свет группы: дальность'`; убрать подпись `endRingReach`.

- [ ] **Step 5: Run** `npm test`, `npm run typecheck`. Глазами: `?lab=juice&auto=off` → «Группа», «Цепочка ×4»: от клеток группы по линиям бегут точки цвета канала с послесвечением, диска нет; `?lab=board` → папка «Уход», сцена «финал доски»: свет от всех костей. Снимок в папку `docs/superpowers/specs/2026-10-14-vi-one-picture-language/` (`wide-1-light.jpeg`).

- [ ] **Step 6: Commit** `git commit -m "Ответ на группу: свет по линиям сетки вместо кольца"`.

---

### Task 4: Искры как точки трубки, падение в воду

**Files:**
- Modify: `src/render/burst.ts` (класс целиком: материал, `sparks`, `update`, новый `scatter`, `landed`)
- Modify: `src/render/view.ts` (`drip` 497-502; вызов `bursts.update` ~1075; `beat`)
- Modify: `src/render/params.ts` (`screen`: `sparkFall`, `sparkHalo`, `sparkHot`, `sparkBurst`; `water`: `dropSpark`), `src/lab/boardPanel.ts` (подписи)
- Test: `src/render/burst.test.ts`

**Interfaces:**
- Produces: `BoardBursts.update(dtMs, camera, dotWorld, look: { fall: number; halo: number; hot: number; burst: number })`; `BoardBursts.takeLanded(): { x: number; z: number }[]` (отдаёт и очищает список приземлений за кадр, не больше 32); `BoardView.drip` принимает вид `'dropSpark'`.

- [ ] **Step 1: Failing tests** (`burst.test.ts`; `camera` из файла, `dotWorld` 0.1, `look = { fall: 0.5, halo: 1.5, hot: 0.9, burst: 3 }`):

```ts
describe('sparks as dots of the tube', () => {
  const look = { fall: 1, halo: 1.5, hot: 0.9, burst: 3 };
  const lit = (): BoardBursts => {
    const bursts = new BoardBursts();
    bursts.setColours([1, 2, 3, 4, 5, 6].map(() => new THREE.Color(1, 1, 1)));
    bursts.sparks({ kind: 'match', value: 3, tier: 1, cells: [{ x: 0, z: 0 }] });
    return bursts;
  };
  const matrices = (bursts: BoardBursts): THREE.Matrix4[] => {
    const mesh = bursts.group.children[0] as THREE.InstancedMesh;
    return Array.from({ length: mesh.count }, (_, i) => { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); return m; });
  };

  it('is two dots of the tube wide when it flies, measured in cells', () => {
    const bursts = lit();
    bursts.update(16, camera, 0.1, look);
    const scale = new THREE.Vector3();
    for (const m of matrices(bursts)) {
      m.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      expect(scale.x).toBeCloseTo(0.2, 5);
    }
  });

  it('stands on the grid of dots of the picture, along the camera right and up', () => {
    const bursts = lit();
    bursts.update(16, camera, 0.1, look);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const at = new THREE.Vector3();
    for (const m of matrices(bursts)) {
      at.setFromMatrixPosition(m);
      // Half a dot in from the lines of the grid: the square sits between them.
      expect(((at.dot(right) / 0.1 + 0.5) % 1 + 1) % 1).toBeCloseTo(0, 5);
      expect(((at.dot(up) / 0.1 + 0.5) % 1 + 1) % 1).toBeCloseTo(0, 5);
    }
  });

  it('a falling spark lands in the water once, and is gone', () => {
    const bursts = lit();
    let landed = 0;
    for (let ms = 0; ms < 3000; ms += 16) { bursts.update(16, camera, 0.1, look); landed += bursts.takeLanded().length; }
    expect(landed).toBeGreaterThan(0);
    expect(bursts.thrown).toBe(false);
  });

  it('a falling spark that never meets the water goes out by the longest fall', () => {
    const bursts = lit();
    // Fewer than 32 can land on one frame; the rest are dropped, and no spark lives past the longest fall.
    for (let ms = 0; ms < 1700; ms += 16) bursts.update(16, camera, 0.1, look);
    expect(bursts.thrown).toBe(false);
  });

  it('hands over at most 32 landings a frame', () => {
    const bursts = new BoardBursts();
    bursts.setColours([1, 2, 3, 4, 5, 6].map(() => new THREE.Color(1, 1, 1)));
    bursts.sparks({ kind: 'chain', value: 3, tier: 4, cells: Array.from({ length: 6 }, (_, i) => ({ x: i, z: 0 })) });
    let most = 0;
    for (let ms = 0; ms < 3000; ms += 16) { bursts.update(16, camera, 0.1, look); most = Math.max(most, bursts.takeLanded().length); }
    expect(most).toBeLessThanOrEqual(32);
  });

  it('a burning spark comes apart into dots at the end, not into nothing', () => {
    const bursts = lit();
    const burning = { ...look, fall: 0 };
    let seenMore = false;
    let before = 0;
    for (let ms = 0; ms < 2000; ms += 16) {
      bursts.update(16, camera, 0.1, burning);
      const now = (bursts.group.children[0] as THREE.InstancedMesh).count;
      if (now > before && ms > 300) seenMore = true;
      before = now;
    }
    expect(seenMore).toBe(true);
    expect(bursts.thrown).toBe(false);
  });
});
```

- [ ] **Step 2: Run, see them fail.**

- [ ] **Step 3: Implement in burst.ts**

Константы:

```ts
/** The longest a spark may fall before it is put out, in seconds: with no water under it, it does not fall for ever. */
const SPARK_FALL_MAX_S = 1.6;
/** Most landings handed to the water on one frame: as many rings as the water starts in a frame. */
const MAX_LANDED = 32;
```

Массивы на искру: добавить `private readonly falling = new Uint8Array(MAX_SPARKS);` (1 — падающая). Список: `private landed: { x: number; z: number }[] = []`.

Материал искр — `ShaderMaterial` вместо `MeshBasicMaterial`:

```ts
const SPARK_VERTEX = /* glsl */ `
varying vec2 vOff;
void main() {
  vOff = position.xy;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
/**
 * A dot of the tube as light: a square core, white-hot, inside a round halo in the colour of the
 * channel. The square of the instance is the core plus the room of the halo around it; `uDots`
 * is how many dots across the core is of the whole, so the core keeps its size in dots.
 */
const SPARK_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform float uHot;
/** x: half the core as a share of the half-square; y: how strong the halo is. */
uniform vec2 uCore;
varying vec2 vOff;
void main() {
  vec2 a = abs(vOff);
  float px = max(fwidth(a.x), 1e-4);
  float core = (1.0 - smoothstep(uCore.x - px, uCore.x + px, a.x)) * (1.0 - smoothstep(uCore.x - px, uCore.x + px, a.y));
  float off = length(vOff);
  float fall = clamp(1.0 - off, 0.0, 1.0);
  float halo = uCore.y * fall * fall;
  float level = min(1.0, core + (1.0 - core) * halo);
  float hot = uHot * core;
  gl_FragColor = vec4(mix(uColour, vec3(1.0), hot) * level, level);
}
`;
```

Цвет канала — через `instanceColor` как сейчас: в шейдере вместо `uColour` использовать `instanceColor` (объявить `varying vec3 vTint; vTint = instanceColor;` в вершинном, нужен `#ifdef USE_INSTANCING_COLOR` — проще передать цвет своим атрибутом: оставить `setColorAt` и в вершинном шейдере взять `instanceColor` через define `USE_INSTANCING_COLOR`, three подставляет его, когда у меша есть `instanceColor`). Смешение — `LIGHT` + `DoubleSide`, `forceSinglePass`.

Размер квадрата инстанса: `side = dots * dotWorld * (1 + 2 * halo / dots)`; `uCore.x = dots / (dots + 2 * halo)`; `uCore.y = 0.5` (как `HALO_SHARE`). `dots = falling ? 2 : mix(1, 2, left)`.

`sparks(beat)`: как `fire`, но `this.falling[slot] = Math.random() < look.fall ? 1 : 0` — `look.fall` нужен в момент вылета: хранить последнее `look` из `update` в поле `this.look` (умолчание `{ fall: 0.5, halo: 1.5, hot: 0.9, burst: 3 }`). Жизнь: падающая — `SPARK_FALL_MAX_S`; горящая — как сейчас. `size` больше не нужен для искр (оставить для `crumble`/`scatter`: `size` — высота в клетках, `wide > 1` — линия).

`update(dtMs, camera, dotWorld, look)`:

- `this.look = look;` в начале.
- Для искры (`wide === 1`, не линия):
  - если `falling` и `pos.y <= 0` после шага: `if (this.landed.length < MAX_LANDED) this.landed.push({ x, z })`; убрать искру (как при `age >= life`).
  - если не `falling` и `age >= life`: перед удалением `this.scatter(x, y, z, look.burst, dotWorld, tint)`; затем удалить.
  - размер: `dots = this.falling[i] ? 2 : 1 + left`; `side = dots * dotWorld * (1 + (2 * look.halo) / dots)`.
  - привязка к сетке: после `this.at.set(...)`:
    ```ts
    const r = this.along; // column 0 of the camera, already kept
    const u = this.upward; // new: column 1 of camera.matrixWorld, set with `along` each update
    const snap = (axis: THREE.Vector3): void => {
      const along = this.at.dot(axis);
      const to = (Math.floor(along / dotWorld) + 0.5) * dotWorld;
      this.at.addScaledVector(axis, to - along);
    };
    snap(r); snap(u);
    ```
  - цвет: `this.colour.copy(this.hue[i])` без `min(1, left*1.6)` (яркость постоянная).
  - материал: `uHot = look.hot`, `uCore.x = dots/(dots + 2*halo)` — у инстансов разный `dots`; `uCore` один на меш → передать долю ядра атрибутом нельзя без второго буфера. Решение: два `dots` → два значения `uCore.x`; взять **постоянный** `uCore.x = 2/(2 + 2*halo)` и менять только `side`: тогда у 1-точечной искры ядро — половина квадрата 1 точки (ядро полточки, ореол полторы) — приемлемо и дешевле. Записать в «Что вышло иначе» как упрощение.
- Для линий (`wide > 1`) — как сейчас.

`scatter(x, y, z, count, dot, tint)`: общий с `crumble`: `crumble` вызывает `scatter` с `dashes` штрихами (`wide = 2 + floor(rand*5)`, жизнь 0,26–0,62, `way` как сейчас); искра — `scatter(..., count, dot, tint)` с `wide = 1`, `size = dot`, жизнь `0.1 + rand*0.08`, `way = ±(0.6 + rand*0.8)`, `pull = DASH_PULL`, цвет `tint * 0.6`. Эти точки — тоже «линии» по признаку `pull === DASH_PULL`? Нет: признак «линия» сейчас `wide > 1`; для точек распада добавить `this.falling[slot] = 0` и `this.life` малую; они проходят ветку искры и при `age >= life` **не** должны снова распадаться — хранить `private readonly kind = new Uint8Array(MAX_SPARKS)` (0 искра, 1 линия, 2 осколок) вместо проверки `wide > 1`.

`takeLanded()`: `const out = this.landed; this.landed = []; return out;`.

- [ ] **Step 4: view.ts**

`drip`: тип `kind` расширить `'dropSpark'`; в `water.drop(...)` аргумент `die` = `kind !== 'dropStep'` остаётся (искра — в воде костей, короткое затухание).

Вызов (~1075):

```ts
    this.bursts.update(dt, this.camera, this.dotWorld, { fall: n('sparkFall'), halo: n('sparkHalo'), hot: n('sparkHot'), burst: n('sparkBurst') });
    for (const { x, z } of this.bursts.takeLanded()) this.drip(x, z, 'dropSpark', 1, false);
```

(`drip` сам молчит при `!water || this.still`.)

`params.ts`: `screen` — `sparkFall: number(0.5, 0, 1, 0.05)`, `sparkHalo: number(1.5, 0, 4, 0.1)`, `sparkHot: number(0.9, 0, 1, 0.01)`, `sparkBurst: number(3, 0, 6, 1)`; `water` — `dropSpark: number(0.015, 0, 0.2, 0.005)`. `boardPanel.ts` подписи: «искры: доля падающих», «искры: ореол, точек», «искры: белое ядро», «искры: распад, точек», «капля: искра».

- [ ] **Step 5: Run** `npm test`, `npm run typecheck`. Глазами в `?lab=juice&auto=off` и на K17: искры — квадраты 2×2 точки, белое ядро, ореол канала; часть падает за край и даёт малый круг в воде (включить воду, `dropSpark` 0,1 для проверки, вернуть 0,015); остальные распадаются. Зум на фрагмент снимка: квадраты стоят по точкам.

- [ ] **Step 6: Commit** `git commit -m "Искры как точки трубки: ядро и ореол, падение в воду, распад"`.

---

### Task 5: Кость не мигает; предел вспышек; расхождение на финале

**Files:**
- Modify: `src/render/cubes.ts:75-85, 452, 513, 775-790, 824` и константы `BLINK_*`; `src/render/view.ts:875-877, 860, 977, 1105-1113` и `beat`; `src/render/params.ts:283-284` (убрать) + `screen.flashLimit`; `src/lab/boardPanel.ts:129-130` (убрать) + подпись
- Create: `src/render/flashes.ts`
- Test: `src/render/flashes.test.ts`

**Interfaces:**
- Produces: `class FlashBudget { constructor(perSecond: number); allow(nowMs: number): boolean; set limit(perSecond: number) }`.

- [ ] **Step 1: Failing tests** (`flashes.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { FlashBudget } from './flashes';

describe('the budget of flashes', () => {
  it('lets three through in a second and holds the fourth', () => {
    const budget = new FlashBudget(3);
    expect(budget.allow(0)).toBe(true);
    expect(budget.allow(100)).toBe(true);
    expect(budget.allow(200)).toBe(true);
    expect(budget.allow(300)).toBe(false);
  });
  it('is a sliding window: a second after the first, one more may come', () => {
    const budget = new FlashBudget(3);
    budget.allow(0); budget.allow(100); budget.allow(200);
    expect(budget.allow(999)).toBe(false);
    expect(budget.allow(1001)).toBe(true);
  });
  it('with no limit lets everything through', () => {
    const budget = new FlashBudget(0);
    for (let i = 0; i < 20; i++) expect(budget.allow(i)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, see it fail.**

- [ ] **Step 3: Implement `flashes.ts`**

```ts
/**
 * Not more than so many flashes a second, over the whole picture (WCAG 2.3.1: three). A flash
 * that is not allowed is not dropped by the caller: it is folded into the one that is on, which
 * goes on instead of starting over.
 */
export class FlashBudget {
  private times: number[] = [];
  constructor(private perSecond: number) {}
  set limit(perSecond: number) { this.perSecond = perSecond; }
  allow(nowMs: number): boolean {
    if (!(this.perSecond > 0)) return true;
    this.times = this.times.filter((t) => nowMs - t < 1000);
    if (this.times.length >= this.perSecond) return false;
    this.times.push(nowMs);
    return true;
  }
}
```

- [ ] **Step 4: Wire in view.ts**

Поле `private readonly flashes = new FlashBudget(3);`. В `draw()` в начале: `this.flashes.limit = n('flashLimit')` (после объявления `n`). Новый помощник:

```ts
  /** Raises an envelope to `to` as a flash; when no flash is allowed now, keeps it where it is and lets it go on from there. */
  private flashTo(current: number, to: number): number {
    if (to <= current) return current;
    return this.flashes.allow(this.lastTime) ? to : Math.max(current, Math.min(to, current + 0.001));
  }
```

Применить: в `beat()` строку `this.chroma = Math.max(this.chroma, ...)` → `this.chroma = this.flashTo(this.chroma, Math.min(1, PART_FROM + (tier - 2) * PART_PER_TIER))`; добавить для уровня: `if (beat.kind === 'level' || tier >= 4) this.chroma = this.flashTo(this.chroma, 0.75);` (проверить, что финальный удар `answerPassed` приходит с `kind: 'level'`; если нет — ключ по `tier === FINALE_TIER`, импортировать константу из `src/app/juice.ts`). В `notify` `wiped`: `this.chroma = this.flashTo(this.chroma, 1)`. В `notify` для `this.burst = 1` / `this.flash = 1` (события группы, `happyOne`): `this.burst = this.flashTo(this.burst, 1)`, `this.flash = this.flashTo(this.flash, 1)`.

«Продлить, не поднять»: когда `allow` вернул false, значение остаётся (спад продолжается с текущего) — это и есть слияние в одно свечение; никакого сброса таймера спада не нужно, потому что спад линейный от текущего значения.

`params.ts` `screen`: `flashLimit: number(3, 0, 6, 1)`; подпись «вспышек в секунду, не больше».

- [ ] **Step 5: cubes.ts — мигание долой**

Удалить ветку `cubes.ts:775-790`, поля `combo/comboMs/comboBody` в `CubeGlow`, `taken` (452, 824), `glows`/`glowGeometry`/`glowShares` (513 и использование), константы `BLINK_BODY`/`BLINK_RISE`; в `view.ts:1110-1112` убрать `combo`, `comboBody`, `comboMs`; `params.ts` убрать `comboGlow`, `comboBlinkMs`; `boardPanel.ts` убрать подписи. `npm run typecheck` покажет хвосты.

- [ ] **Step 6: Run** `npm test`, `npm run typecheck`. Глазами: `?lab=juice` → «Цепочка ×2 … ×6 подряд»: не больше трёх скачков яркости/расхождения за секунду; кость при комбо не мигает (иней стекла остаётся).

- [ ] **Step 7: Commit** `git commit -m "Кость не мигает; не больше трёх вспышек в секунду; расхождение на финале"`.

---

### Task 6: Одна лампа справа; бегущий свет на воде; круги чуть заметнее

**Files:**
- Modify: `src/render/figure.ts:56, 69` и `FigureBody.set`; `src/render/player.ts` (где зовётся `set`) и `src/render/view.ts` (передать `lampSide`)
- Modify: `src/render/water.ts` (uniforms ~426-440, фрагмент ~229-240, `frame` ~529-572, комментарий 561), `src/render/view.ts` (~1241-1252: передать источники)
- Modify: `src/render/params.ts` (`water`: `lightWater`, `lightWidth`, `lightTight`; `dropSmall` 0.04), `src/lab/boardPanel.ts`
- Test: нет (отрисовка); проверка глазами и замером

**Interfaces:**
- Produces: `Water.light(index: 0|1|2|3, x: number, z: number, reach: number, colour: THREE.Color, strength: number): void` (мировые координаты, как `drop`); `FigureBody.set(colour, look, gleamSide: number)`.

- [ ] **Step 1: figure.ts**

Заменить константу на uniform: `uniforms = { uColour, uLook, uGleam: { value: new THREE.Vector3(0.3511, 0.5461, 0.7606) } }`; в шейдере `uniform vec3 uGleam;` и `dot(normal, uGleam)`; `set(colour, look, gleamSide = 1)` ставит `uGleam.x = 0.3511 * (gleamSide < 0 ? -1 : 1)`. Найти вызовы `set` (`grep -n "\.set(" src/render/player.ts src/render/view.ts | grep -i figure`), передать `Number(this.look.board.lampSide ?? 1)` при смене палитры/вида (там же, где уже передаётся `FIGURE_LOOK` из параметров `figureBody/figureRim/figureShine`).

- [ ] **Step 2: water.ts — бегущий свет**

Константа `const LIGHTS = 4;`. Uniforms: `uLights: { value: Array.from({ length: LIGHTS }, () => new THREE.Vector4()) }`, `uLightColours: { value: Array.from({ length: LIGHTS }, () => new THREE.Color()) }`, `uLightLook: { value: new THREE.Vector3() }` (сила, ширина, блик). Метод:

```ts
  /** One of the lights that run over the lines of the board, as the water shows it: a square front `reach` cells from (x, z), in `colour`. Strength 0 puts it out. */
  light(index: number, x: number, z: number, reach: number, colour: THREE.Color, strength: number): void {
    const slot = this.plane.material.uniforms.uLights.value[index] as THREE.Vector4 | undefined;
    if (!slot) return;
    slot.set(x, z, reach, strength);
    (this.plane.material.uniforms.uLightColours.value[index] as THREE.Color).copy(colour);
  }
```

В `frame`: `(uniforms.uLightLook.value as THREE.Vector3).set(n('lightWater'), n('lightWidth'), Math.max(1, n('lightTight')));`.

Фрагмент, после строки `float glint = pow(...)` (~238), до сложения цвета:

```glsl
  // Light that runs over the lines of the board, as the water gives it back: a square front
  // round each source, broken by the slope of the water towards the eye. Under the cells the
  // sheet keeps the water still, and the light shows mostly on the free cells and past the edge.
  vec3 running = vec3(0.0);
  for (int i = 0; i < LIGHTS; i++) {
    vec4 l = uLights[i];
    if (l.w <= 0.0) continue;
    vec2 d = abs(vWorld.xz - l.xy);
    float along = max(d.x, d.y);
    float front = exp(-pow((along - l.z) / max(uLightLook.y, 1e-3), 2.0));
    vec3 toLight = normalize(vec3(l.x, 0.5, l.y) - vWorld);
    float shine = pow(max(dot(normal, normalize(toEye + toLight)), 0.0), uLightLook.z);
    running += uLightColours[i] * (l.w * front * (0.35 + shine));
  }
  colour += running * uLightLook.x * (1.0 - uFar.z * sheet);
```

(`LIGHTS` подставить в шаблон строки как `${LIGHTS}`; имя переменной цвета — как в шейдере на месте, где складывается `crestLight`; `uFar.z` — `ringCalm`, как у кругов.)

- [ ] **Step 3: view.ts — передать источники**

В блоке `if (this.water)` (~1241) перед `this.water.frame(...)`:

```ts
      const { origin } = this.board;
      // The wave that draws or erases the lines, while it runs.
      if (this.wave.share < 1 && this.wave.from) this.water.light(0, this.wave.from.x + origin.x, this.wave.from.z + origin.z, this.wave.share * this.gridParts, this.grid.colour, 1);
      else this.water.light(0, 0, 0, 0, this.grid.colour, 0);
      // The light of a group, while it runs over the lines.
      const run2 = this.lightWave;
      if (run2) {
        const cx = run2.cells.reduce((s, c) => s + c.x, 0) / run2.cells.length + origin.x;
        const cz = run2.cells.reduce((s, c) => s + c.z, 0) / run2.cells.length + origin.z;
        const elapsed = timeMs - run2.startedMs;
        const reach = Math.min(1, elapsed / run2.wholeMs) * run2.reach;
        const left = Math.max(0, 1 - Math.max(0, elapsed - run2.wholeMs) / Math.max(1, run2.afterMs));
        this.water.light(1, cx, cz, reach, this.light.colour, left);
      } else this.water.light(1, 0, 0, 0, this.light.colour, 0);
      this.water.light(2, 0, 0, 0, this.light.colour, 0);
      this.water.light(3, 0, 0, 0, this.light.colour, 0);
```

- [ ] **Step 4: params/labels**

`water`: `lightWater: number(0.25, 0, 1, 0.01)` «бегущий свет на воде», `lightWidth: number(0.6, 0.1, 2, 0.05)` «бегущий свет: ширина», `lightTight: number(8, 1, 64, 1)` «бегущий свет: блик»; `dropSmall` 0.025 → 0.04. Комментарий `water.ts:561` исправить на «on the right of the frame by default (`lampSide` 1): the figure's gleam takes the same side».

- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, `npm run build`. Глазами: K17 комбо — на свободных клетках и за краем доски видна квадратная бегущая полоса света, ломающаяся о волны; переход R01→R02 — свет рисования доски на воде; блик фигуры справа-сверху.

- [ ] **Step 6: Commit** `git commit -m "Одна лампа справа; вода показывает бегущий свет бликом"`.

---

### Task 7: Проверка, документы, версия

**Files:**
- Create: `docs/superpowers/specs/2026-10-14-vi-one-picture-language/*.jpeg`
- Modify: `docs/art/VI_Visual_Language.md` (1.3, 2.3, 3.1, 3.3), `docs/art/VI_World_Logic.md` (76, 86, 87, 91, 105 + новая строка), `docs/superpowers/specs/2026-10-13-vi-water-backdrop-probe.md` (только шапка), `docs/README.md` (статусы спеки и плана), `docs/ROADMAP.md` (если есть список по виду), спека раздел 11, этот план (шапка: выполнен), `package.json` (`0.2.55`)

- [ ] **Step 1: Снимки** — по спеке раздел 8: холст 1920×1080 и 540×960 (окно 360×640 при плотности 1,5), в отдельном Chrome (chrome-devtools `new_page`) или с `?auto=off`; K17 ход 2 на +100/+400/+1000 мс, ход 3, финал +300; `?lab=juice` «Группа» +80/+300, «Цепочка ×4» +60/+260/+660; переход R01→R02. Имена: `wide-N-*.jpeg`, `tall-N-*.jpeg`. Способ прокрутки кадров — память `vi-preview-of-a-worktree` (подмена `requestAnimationFrame`, `vi.frame(t)`).

- [ ] **Step 2: Проба знака** — снимок 540×960 на пике (+100 мс после «Цепочка ×4») в сером, уменьшенный вдвое: грани и точки читаются. Приложить `tall-sign-grey.jpeg`.

- [ ] **Step 3: Вспышки** — серия ×2…×6 подряд: по кадрам (каждые 50 мс) записать `chroma`/`burst` через `window.vi` (dev-only) и убедиться, что скачков вверх за любую секунду не больше трёх.

- [ ] **Step 4: Цена** — `EXT_disjoint_timer_query_webgl2`, 4 кадра на запрос, 40 кругов, чередовать 0.2.54 (`git stash`-free способ из памяти: `git diff > patch; git apply -R; замер; git apply`) и ветку: K17 покой; K17 +0,3 с после комбо; Endless +0,3 с после «Цепочка ×4»; 1920×1080 и 540×960. Процессор: p95 `frame` под троттлингом ×4, 300 кадров. Таблица — в раздел 11 спеки. Цель +0,3 мс; если дороже — сначала `LIGHTS` 2 и один `pow` на точку, потом `sparkHalo` меньше.

- [ ] **Step 5: Документы**

`VI_Visual_Language.md` 3.1: убрать строку «Вспышка комбо»; в «Расхождение на событии» добавить «финал доски 0,75; не больше трёх вспышек в секунду (`flashLimit`)»; новые строки «Свет группы по линиям» (`LIGHT_REACH`/`LIGHT_MS`, `lightAfterMs` 300, `lightHead` 1,6, `lightScale` 1; второй `LineGrid`, `opacity` 0) и «Искры» (2×2 → 1×1 точки, ядро белое `sparkHot` 0,9, ореол `sparkHalo` 1,5, доля падающих `sparkFall` 0,5, распад `sparkBurst` 3, капля `dropSpark` 0,015); 3.3 «Сетка»: абзац о бегущем свете на воде (`lightWater`, `lightWidth`, `lightTight`) и о том, что зеркало для линий бесполезно; 1.3: строка за 14 октября (решения из спеки раздел 2); 2.3: упоминание кольца заменить светом по линиям. Шапку «Проверено» обновить.

`VI_World_Logic.md`: строки 86, 87, 105 — «по полу идёт кольцо» → «от клеток группы по линиям сетки бежит свет её канала»; 91 — искры: точки трубки, падают в воду; новая строка: «**Искра падает в воду** — свет программы касается мира: искра группы, упав за край, оставляет в воде малый круг; остальные догорают и рассыпаются на точки»; 76 — вода показывает бегущий свет бликом.

Проба воды: в шапке добавить «Долг пункта 34 (совместить круги комбо с эффектами поля) закрыт спекой единого языка картинки 14 октября 2026».

Спека раздел 11 «Что вышло иначе»: отступления, числа замера, что не проверено (глазами на телефоне и т. п.). Этот план: шапка «выполнен», в конце — журнал процесса (коротко: что мешало, сколько прогонов).

`docs/README.md`: статус спеки «построено, не опубликовано», плана «выполнен». `package.json` версия `0.2.55`.

- [ ] **Step 6: Полная проверка** — `npm test`, `npm run typecheck`, `npm run build`, `node scripts/docs-check.mjs`; `npx vitest run src/rules/bot.test.ts --testTimeout 20000` отдельно, если полный прогон его не дождался.

- [ ] **Step 7: Commit** `git commit -m "Версия 0.2.55: единый язык картинки — документы и снимки"`. Пуш в `main` — только по слову владельца (CLAUDE.md: `git fetch`, rebase на `origin/main`, проверки, `git push origin HEAD:main`).

- [ ] **Step 8: Доложить владельцу** — списком: что сделано, снимки (пути), числа цены, что отличается от спеки, адрес worktree-страницы для его взгляда (память `vi-preview-of-a-worktree`: копия `index.html` в корне worktree, не коммитить).
