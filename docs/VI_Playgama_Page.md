# VI — тексты страницы на Playgama

> Вид: истина. Статус: черновик. Дата: 2026-10-23. Проверено: 2026-10-23.
> Что заменило: эта редакция 23 октября 2026 заменила тексты 3 октября (режимы LIMITED, EXERCISE, TASKS; достать — `git show e5f2dd3:docs/VI_Playgama_Page.md`). Что живёт в коде: —.
> Тексты для кабинета Playgama, временные.

23 октября 2026. Тексты формы игры в кабинете Playgama, как они стоят сейчас. Правятся здесь и переносятся в кабинет (`update_application_form`), затем `publish_sandbox` тем же архивом, чтобы страница песочницы показала новые тексты. Голос — программа: сухо, без оценок. Сверено с [VI_Lore.md](art/VI_Lore.md): только твёрдые факты и первая ступень масштаба, тёмные места не затронуты. Утверждения записаны в [VI_Claims.md](art/VI_Claims.md), раздел «Вне игры». Механика описана по строкам `HOW TO PLAY` (`how*`, `lessonGlass`, `lessonFloor` в `src/ui/i18n.ts`) и по правилам: уровни — [VI_Levels_Rules.md](VI_Levels_Rules.md), Endless — [VI_Endless_Rules.md](VI_Endless_Rules.md).

Слово владельца 23 октября: «меняй всю инфу в кабинете на актуальную». Тон и формулировки решает он: это черновик исполнителя. Сеансов вживую в тексте нет, пока их нет в игре.

## Форма в кабинете

- **Title** — `VIZAVI` (с 19 октября; в игре программа зовётся VI). В описании программа названа так же, как стояло в кабинете: `VIZAVI`.
- **Languages** — EN, RU, ES, PT_BR, TR, DE, FR: семь языков игры; португальский в игре бразильский (`src/ui/lang/pt.ts`), в форме это `PT_BR`.
- **Category** — `puzzle`.
- Устройства, ориентации и остальное — как стояли.

## Description

```text
VIZAVI CORE 2.06. Previous start: H13.03.21. Link device: NOT FOUND. The program runs in emulation mode.

VIZAVI is the operating program of a link table, written at a Japanese institute for sessions with the other side. The table, a board of dice, is not connected. The program still starts, emulates the table, and waits for a subject. Subject file No.07: UNREGISTERED.

Six channels, one for each face of a die. You stand on a die and roll it across the board. Put together as many equal faces as the face has pips - two 2s, three 3s, six 6s - and the combo goes under the surface: sent. While it is leaving, the channel is open: roll one more die with the same face up to it, and it leaves too.

The menu is a die. Six files on its faces:
LEVELS - forty-two boards in one row, seven chapters. Clear every die. Stars by the number of moves. No move limit. A move can be taken back.
PROTOCOL - a session without a limit. Dice come up from below by themselves. What comes up is noise. When noise fills the board, the link is lost. The results of all subjects go into one table.
RECORDS, HOW TO PLAY, README, SYSTEM.

After a session something may come through. The program does not say what it is.

Dice puzzle. Keyboard and touch. Seven languages.
```

## How to play

```text
OPERATING PROCEDURE

1. Roll. You stand on a die and roll it: a side face comes up on top. Into an empty cell the die rolls with you. Onto a die next to you, you simply step. Opposite faces make seven: under a 1 lies a 6.
2. Combo. As many dice side by side as their top face has pips: two 2s, three 3s, six 6s. A finished combo leaves.
3. Chain. A combo does not leave at once. While it is leaving, roll one more die with the same face up to it: it leaves with the combo. A leaving die can be walked over. Roll over it, and your die takes its place; if the face matches, it joins the chain.
4. Ones. A 1 makes no combo. Bring a 1 to a leaving combo, and every other 1 on the board leaves.
5. Floor. If the die under you leaves, you are on the floor. From the floor dice are pushed: a pushed die slides one cell and does not turn.

LEVELS. Clear every die off the board. The faces in the corner are the ones to put together. Nothing comes up and there is no clock: the board moves only when a die moves. A step is not a move. From the floor, the only way up is a leaving die. Stars by the number of moves. Z - take a move back. R - start the board again.

PROTOCOL. Dice come up by themselves. A chain multiplies the score. From the floor, climb onto a die that is coming up or leaving, or onto one that cannot be pushed. The board fills up and stays full: the session is over.

Keyboard: arrow keys or WASD. Touch screen: swipe up, down, left or right. Enter - confirm. Esc - pause. SYSTEM - sound, motion, language, on-screen buttons instead of swipes.
```
