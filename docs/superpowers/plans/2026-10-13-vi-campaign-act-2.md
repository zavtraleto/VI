# Кампания, акт II «Время»: шесть мест и строка звена

> Вид: план. Статус: не выполнен. Дата: 2026-10-13.
> Что заменило: —. Что живёт в коде: после выполнения — src/levels/levels.ts, src/levels/campaign.ts, src/levels/campaignRecipes.ts, src/ui/i18n.ts, src/ui/lang/*.ts, boards/.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Места 23–28 ряда становятся актом II: шесть досок на двойках и тройках о времени — когда докатить звено, — с ролями открытие → применение → твист → соединение → пик → передышка и строкой «Звено даёт комбо ещё ход.» на открытии; хвост прежнего списка сдвигается за акт.

**Architecture:** Вся обвязка (акты и роли в ряду, `HINTS`, `CAMPAIGN_PLACES`, `ACT_1`/`TAIL`, процедура доски) сделана планом акта I; здесь добавляются `ACT_2`, три рецепта мест, три новые доски и одна строка. Открытие акта проверяется решателем на смысл (звено на первом ходу держит `par`, на втором — проигрыш) и имеет запасной вариант, записанный в спеке.

**Tech Stack:** как в плане акта I.

**Spec:** [docs/superpowers/specs/2026-10-12-vi-campaign-design.md](../specs/2026-10-12-vi-campaign-design.md), раздел 7 «Акт II», разделы 5.3–5.4, 8, 10. Обвязка и процедура доски — [план акта I](2026-10-13-vi-campaign-act-1.md), разделы «Процедура доски» и задачи 1–2; выполнять этот план только после него.

## Global Constraints

Те же, что в плане акта I: свой worktree, `src/rules` не трогать, семь языков, пол открыт, силуэтные формы, файл в `boards/` на каждую новую доску, `regress` после переноса, коммит на задачу, публикация после «ок» владельца. Ключ акта владельцу не пересказывать.

## Review Focus

1. **Открытие `K23` может не читаться как урок времени.** Правило «докатил на первом ходу — у комбо снова два хода, на втором — один» тонкое; доска должна проигрываться ровно тем, что звено пришло поздно, и тупик должен объявляться сразу (`levelDeadEnd`: «одна кость» или «костей меньше комбо»). Если решатель не находит доски, где поздний ход — тупик, акт II открывается доской «не жадничай» (спека, бриф `K23`), а строка меняется на «Пока комбо уходит, не торопись.» → Задача 2.
2. **`P20` и `P24`.** `P24` — коридор 5×5 с вырезанными рядами, парковка; как и `P23` в акте I, берётся только если клетка на 360×640 не мельче клетки `P20` больше чем на четверть. → Задача 3.
3. **Твист `K25`: жадный ход — на втором ходу, не на первом.** Слово владельца о ловушках на первом ходу («обидно, хочется бросить»); первый ход доски — перекат, который делает любой. Проверяется `moves` со старта: ни один первый ход не `dead`. → Задача 4.
4. **`P05` и `P06` переезжают из хвоста**: их звёзды остаются (по коду). → Задача 1, тест `campaignCells`.
5. **Стык акта II с хвостом**: после `K28` (четвёрки, подарок) идёт `P13` (шестёрки). Два крупных ухода подряд — читается ли это как граница или как повтор; записать для акта III. → Задача 6, проход исполнителя.

---

### Task 1: `ACT_2` в ряду, роли, строка `hintLinkMove`

**Files:**
- Modify: `src/levels/levels.ts` (`ACT_2 = [P20, P06, P05]` временно, `TAIL` без них, `LEVELS = [...ACT_1, ...ACT_2, ...TAIL]`), `src/levels/campaign.ts` (`ACT_ROLES`: `K23 opening, P20 apply, K25 twist, P06 join, P05 peak, K28 rest`; `HINTS.K23 = { key: 'hintLinkMove', until: 'chain' }`), `src/ui/i18n.ts`, `src/ui/lang/*.ts` (`hintLinkMove`), `docs/art/VI_Claims.md`
- Test: `src/levels/campaign.test.ts`, `src/levels/levels.test.ts`

- [ ] **Step 1: Тесты** — роли мест акта II по мере их прихода (в этой задаче `['apply', 'join', 'peak']` для `P20`, `P06`, `P05`), `HINTS.K23`, звёзды `P05` сохраняются при переезде, `LEVELS` равно `[...ACT_1, ...ACT_2, ...TAIL]`, `TAIL` — прежний порядок без `P20`, `P06`, `P05`.

- [ ] **Step 2: Строка** в семи языках (черновики исполнителя, слова за владельцем):

| Язык | Строка |
|---|---|
| ru | Звено даёт комбо ещё ход. |
| en | A link gives the combo a move. |
| de | Ein Glied schenkt dem Combo einen Zug. |
| es | Un eslabón da al combo un turno más. |
| fr | Un maillon offre un tour au combo. |
| pt | Um elo dá ao combo mais um lance. |
| tr | Bir halka komboya bir hamle verir. |

Запись в `docs/art/VI_Claims.md`: утверждение «кость, докатанная к уходящему комбо, даёт ему ход, на котором оно не опускается» — правило цепочки ([правила уровня](../../VI_Levels_Rules.md), раздел 3).

- [ ] **Step 3: Прогнать и закоммитить**

```bash
npm test && npm run typecheck
git add src/levels src/ui docs/art/VI_Claims.md
git commit -m "Акт II в ряду: роли мест, строка звена, хвост без P20, P06, P05"
```

---

### Task 2: Место 23, открытие `K23` (звено на первом ходу) с запасным вариантом

**Files:**
- Modify: `src/levels/campaignRecipes.ts` (место `K23`), `src/levels/levels.ts` (`ACT_2`: `K23` первым), `docs/VI_Levels_Probe_Key.md`
- Create: `boards/K23.txt`

- [ ] **Step 1: Рецепт**

```ts
{
  ...ACT, slot: 1023, id: 'K23', act: 2, role: 'opening', size: 4, dice: 5, faces: [2], standing: [{ value: 2, count: 1 }],
  needs: ['link'], scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 1] }, { event: 'link', face: 2, by: 'roll', moves: [1, 1] }, { event: 'link', face: 2, by: 'roll', moves: [2, 2] }],
  ends: { event: 'link', spare: 0 }, par: [3, 4], firsts: [2, 99], kinds: ['top'], personas: { hasty: 0.5, casual: 0.8 },
  brief: 'time: the pair of 2s goes; the near link on the first move gives the group two more, and the far 2 makes it; a link on the second move leaves it alone',
},
```

- [ ] **Step 2: Доска по процедуре, с проверкой смысла**

Кладка `mode=route`. У каждого кандидата после `check`: `node scripts/level.mjs moves file=… after=<первый ход пути>` — ход, который делает ближнее звено, держит `par`; любой другой ход после комбо (откатить к дальней кости, шагнуть и т. п.) — `dead` или `longer` без решения в `par` + 2. Это и есть урок: доска читается, если ранний ход спасает, поздний — нет. Если за 400 зёрен и в правках руками такой доски нет — **запасной вариант**: место 23 становится доской «не жадничай» (бриф `K25` из задачи 4, роль открытия), `HINTS.K23` получает строку `hintNoHurry` «Пока комбо уходит, не торопись.» (семь языков; en «While the combo leaves, take your time.», остальные — по смыслу), а место 25 (твист) строится как вторая такая доска с иной геометрией. Записать выбор в «Что вышло иначе» и в спеку, раздел «Что вышло иначе» (новый, только фактом).

- [ ] **Step 3: Preview** — `?board=K23` на 360×640: пара двоек и своя двойка видны; после комбо и позднего звена тупик объявляется сразу, отмена возвращает; строка приходит и гаснет на первом звене.

- [ ] **Step 4: Коммит**

```bash
npm test && npm run typecheck && node scripts/level.mjs regress
git add boards/K23.txt src/levels docs/VI_Levels_Probe_Key.md
git commit -m "Акт II, место 23: открытие K23, звено на первом ходу"
```

---

### Task 3: Место 24, применение: `P20` или `P24`

**Files:**
- Modify: `src/levels/levels.ts` (`PARKED`, если берётся `P24`), `docs/VI_Levels_Probe_Key.md`

- [ ] **Step 1:** `check file=game:P20` и `game:P24`: `turns`, `away`, звенья (`chain` в партитуре: `P20` — четыре). По спеке применение — `P20` («вайб», средняя); `P24` — запасной, только если на 360×640 клетка коридора не мельче клетки `P20` больше чем на четверть и спрятанных граней не больше двух. Выбор и числа — в ключ акта II.

- [ ] **Step 2: Коммит** (если что-то менялось): `git commit -m "Акт II, место 24: применение на длинной цепочке"`.

---

### Task 4: Место 25, твист `K25` («не жадничай»)

**Files:**
- Modify: `src/levels/campaignRecipes.ts` (место `K25`), `src/levels/levels.ts`, `docs/VI_Levels_Probe_Key.md`
- Create: `boards/K25.txt`

- [ ] **Step 1: Рецепт**

```ts
{
  ...ACT, slot: 1025, id: 'K25', act: 2, role: 'twist', size: 4, holes: WIDE, dice: 5, faces: [3], standing: [{ value: 3, count: 2 }],
  traps: [0.8, 1], par: [4, 6], firsts: [2, 99], kinds: ['top'], personas: { hasty: 0.4, casual: 0.75 }, gap: [0.3, 1],
  brief: 'greed: the combo of 3s that asks to be made on the second move strands two dice; bring them nearer first, then make it and link',
},
```

Если `WIDE` не даёт досок — `size: 4` без вырезов.

- [ ] **Step 2: Доска по процедуре, с проверкой Review Focus 3**

`moves file=…` со старта: ни один первый ход не `dead`; `moves after=<любой верный первый ход>`: напрашивающееся комбо (ход, уводящий кости) — `dead`, и тупик объявляется сразу (стоящих костей меньше трёх). Жадный бот (`greedy` в отчёте `ladder place=K25`) проигрывает не реже 80%.

- [ ] **Step 3: Preview и коммит**

```bash
npm test && npm run typecheck && node scripts/level.mjs regress
git add boards/K25.txt src/levels docs/VI_Levels_Probe_Key.md
git commit -m "Акт II, место 25: твист K25, не жадничай"
```

---

### Task 5: Места 26–28: `P06`, `P05`, передышка `K28`

**Files:**
- Modify: `src/levels/campaignRecipes.ts` (место `K28`), `src/levels/levels.ts`, `docs/VI_Levels_Probe_Key.md`
- Create: `boards/K28.txt`

- [ ] **Step 1: Паспорта `P06` и `P05`** — `check`, записать в ключ под ролями соединение и пик (ожидание по спеке: `P06` t1 a0 сцепка 2; `P05` t2 a1, много путей, фиеро). Если `P05` по персонам слишком труден для 27-го места (планирующий < 50%), не менять доску: записать в «Что вышло иначе» — владелец назвал его «огонь».

- [ ] **Step 2: Рецепт `K28`**

```ts
{
  ...ACT, slot: 1028, id: 'K28', act: 2, role: 'rest', size: 4, dice: 5, faces: [4], standing: [{ value: 4, count: 3 }],
  par: [1, 2], lossless: true, last: [5, 5], kinds: ['top'], personas: { hasty: 0.9, casual: 1 },
  brief: 'the breather and the first 4s: three stand together, the fourth and the own die a roll away; one roll and five go',
},
```

Четвёрки впервые в игре: рабочая грань видна крестами на остальных; доска читается кучкой из трёх плюс две. Ослабление: `last` `[4, 5]`.

- [ ] **Step 3: Доска по процедуре, в ряд, preview**

`ACT_2 = [K23, P20|P24, K25, P06, P05, K28]`; тест ролей — шесть. Preview: `P05` → `K28` → `P13`: записать, как читается стык с хвостом (Review Focus 5).

- [ ] **Step 4: Коммит**

```bash
npm test && npm run typecheck && node scripts/level.mjs regress
git add boards/K28.txt src/levels docs/VI_Levels_Probe_Key.md
git commit -m "Акт II, места 26–28: соединение, пик и передышка на четвёрках"
```

---

### Task 6: Акт целиком: таблица, проход, документы, версия

- [ ] **Step 1:** `node scripts/ladder.mjs campaign` (в фоне): строки 23–28 в полосах ролей; расхождения — в «Что вышло иначе».
- [ ] **Step 2:** Проход исполнителя на 360×640 с `K22` по `K28` и два уровня хвоста; записи по каждой доске, как в акте I.
- [ ] **Step 3:** Документы: ROADMAP «Кампания» (акт II собран, версия 0.2.53; следующий — черновики актов III–V по решению владельца 13 октября, их план пишет чат планирования); индекс — строка плана «выполнен»; ключ — шапка и «Ключ акта II»; этот план — статус, «Что вышло иначе», «Что не хватало». В «Что не хватало» — сводка по двум актам (спека 10.2: «после акта II они сводятся в одну страницу»): свести разделы обоих планов в одну таблицу здесь, страницу-постановку по лаборатории пишет чат планирования.
- [ ] **Step 4:** Проверки, `npm version 0.2.53 --no-git-tag-version`, коммит «Версия 0.2.53: акт II кампании, время», сообщение владельцу (что изменилось, как играть — с `K22` подряд до 28-го и два уровня хвоста; ключ не пересказывать), «ок?», публикация.

---

## Что вышло иначе

Заполняется исполнителем.

## Что не хватало

Журнал процесса; после акта II — сводка по двум актам.
