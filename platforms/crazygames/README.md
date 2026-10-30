# CrazyGames

Адаптер площадки CrazyGames: игра в сборке для неё говорит с CrazyGames HTML5 SDK v3 напрямую. Устройство слоя платформы — [спека](../../docs/superpowers/specs/2026-10-15-vi-platform-layer-design.md). Требования площадки и что из них у нас есть — [исследование](../../docs/VI_CrazyGames_Research.md).

## Что в папке

- [adapter.ts](adapter.ts) — `platform` для `@platform`: язык (`systemInfo.locale`), сохранения в модуле Data, звук по настройке `muteAudio`, `loadingStart/Stop` и `gameplayStart/Stop` по сообщениям игры, контекст уровня для отзывов игроков, межстраничная реклама (`midgame`) и реклама за награду (`rewarded`, награда только по `adFinished`), запрет прокрутки страницы колесом, пробелом и стрелками. Аналитики, таблицы игроков, входа и адреса игры нет: у CrazyGames этого нет для нас (см. исследование, раздел 3). Без SDK или вне CrazyGames (`environment: disabled`) ведёт себя как `none`.
- [adapter.test.ts](adapter.test.ts) — без SDK, с отключённым SDK, с зависшим стартом; сохранения, сообщения, звук; реклама: выключена в сборке, досмотрена, сбой, «рекламы нет в этом визите», не началась.
- [vite.ts](vite.ts) — тег скрипта SDK в начале `<head>`, только в сборке для CrazyGames. Копии SDK в сборке нет: CrazyGames отдаёт его только со своего адреса.

## Сборка

```bash
npm run pack -- crazygames
```

Пишет `release/vi-<версия>-crazygames.zip`. Одна сборка без архива — `VI_PLATFORM=crazygames npm run build` (в PowerShell: `$env:VI_PLATFORM='crazygames'; npm run build`).

**Реклама.** На Basic Launch CrazyGames рекламу не показывает, а кнопка рекламы, которая ничего не делает, — причина отказа. Поэтому по умолчанию сборка без рекламы: кнопок `SHOW WAY · AD` и `DOUBLE · AD` нет, межстраничной нет. Для Full Launch архив собирается с ней:

```bash
VITE_CRAZYGAMES_ADS=on npm run pack -- crazygames
```

(PowerShell: `$env:VITE_CRAZYGAMES_ADS='on'; npm run pack -- crazygames`.) Если площадка ответит, что рекламы в этом визите нет (`adsDisabled`), кнопки пропадут и в такой сборке.

## Проверить на своей машине

Превью `vi-build` (порт 5184) отдаёт `dist`. На localhost SDK работает в режиме `local`: `window.CrazyGames.SDK.environment` — `'local'`, вызовы пишутся в консоль («Requesting gameplay start (local)»), реклама — заглушка на 5 секунд, сохранения — в localStorage под `SDK_DATA_local`. С другого адреса — добавить `?useLocalSdk=true`. Полная проверка — инструмент предпросмотра в кабинете CrazyGames.

`SDK.game` отдаёт новый объект при каждом обращении: подменить его метод из консоли нельзя, следить за вызовами — по логу SDK.

## Выкладка

В кабинете CrazyGames (developer.crazygames.com) при отправке:

- **Progress Save** — «Yes, using the Data Module from the CrazyGames SDK». Без этого сохранения остаются только в браузере.
- Ориентации — альбомная и портретная.
- Обложки 1920×1080, 800×1200, 800×800 и видео 15–20 с в двух ориентациях — требования в исследовании, пункт 29.
- Адрес страницы игры, когда он появится, записать в `gameUrl` адаптера: его получает «поделиться».
