# VI — тексты страницы на CrazyGames

> Вид: истина. Статус: в силе. Дата: 2026-10-30. Проверено: 2026-10-30.
> Что заменило: —. Что живёт в коде: —.
> Тексты формы отправки игры на CrazyGames.

30 октября 2026. Владелец: тексты Playgama «нужно сильно сократить, сделать приятными и ёмкими, чуть более художественными»; эту редакцию принял словами «подходят, запиши». Правятся здесь и переносятся в форму кабинета CrazyGames руками владельца.

Сверено с [VI_Lore.md](art/VI_Lore.md): твёрдые факты 1, 2, 7 и 9, первая ступень масштаба, тёмные места не затронуты. Утверждения записаны в [VI_Claims.md](art/VI_Claims.md), раздел «Вне игры: страница на CrazyGames». Числа и режимы — как в игре 30 октября: 100 уровней (`CAMPAIGN` в `src/levels/campaign.ts`), Endless. Управление — по `src/app/game.ts` и `src/input/`.

## Ответы формы

- **Mute audio through the SDK** — Yes: настройка звука CrazyGames главнее звука игры (`onAudio` в [platforms/crazygames/adapter.ts](../platforms/crazygames/adapter.ts)).
- **Progress Save** — Data Module ([platforms/crazygames/README.md](../platforms/crazygames/README.md)).
- **Реклама** — нет: архив без `VITE_CRAZYGAMES_ADS` (слово владельца 30 октября, [VI_Owner_Words.md](VI_Owner_Words.md), раздел 7).

## Description

```text
An old program from a Japanese institute. Its table of dice is not connected, but the program still runs — and waits for someone to lead the dice.

Stand on a die and roll it. Gather as many equal faces as they show — two 2s, three 3s, six 6s — and they sink below the surface. While they sink, roll one more matching die in: that's a chain.

Levels — 100 boards. Clear every die; fewer moves, more stars. Any move can be undone.
Endless — the dice keep coming. Chain them before the board fills up.

After a session, something may come through.
```

## Controls

```text
Arrow keys / WASD — roll or step
Mouse / touch — click or tap where to go, or swipe
Z — undo · R — restart · Esc — pause
```
