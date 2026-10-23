# Playgama

Адаптер площадки Playgama: игра в сборке для неё говорит с Playgama Bridge SDK. Устройство слоя платформы и как добавить другую площадку — [спека](../../docs/superpowers/specs/2026-10-15-vi-platform-layer-design.md).

## Что в папке

- [adapter.ts](adapter.ts) — `platform` для `@platform`: язык, сохранения, пауза и звук по событиям платформы, `game_ready` и прочие сообщения, реклама между сессиями и после каждой третьей отмены хода на уровне (место `session_end`), таблица игроков, аналитика, вход, буфер обмена, адрес игры. Без SDK в окне ведёт себя как `none`, игра идёт сама.
- [adapter.test.ts](adapter.test.ts) — адаптер без SDK, с SDK, который не стартует, и с живым SDK без таблицы.
- [vite.ts](vite.ts) — плагины сборки: скрипт SDK в странице (`@playgama/bridge/vite`, с CDN и с копией в сборке на случай отказа CDN) и файл настроек рядом со страницей.
- [playgama-bridge-config.json](playgama-bridge-config.json) — настройки SDK: реклама (не чаще раза в 120 секунд), таблицы, публичный токен SaaS.

## Сборка

```bash
npm run pack -- playgama
```

Собирает игру с `VI_PLATFORM=playgama` и пишет `release/vi-<версия>-playgama.zip`. Одна сборка без архива — `VI_PLATFORM=playgama npm run build` (в PowerShell: `$env:VI_PLATFORM='playgama'; npm run build`). В `dist` тогда лежат `playgama-bridge.js` и `playgama-bridge-config.json`; в обычной сборке их нет.

Проверить сборку на своей машине: превью `vi-build` (порт 5184) отдаёт `dist`; на localhost SDK работает в режиме `mock`, в консоли браузера `window.bridge.platform.id` — `'mock'`, `window.bridge.isInitialized` — `true`.

## Выкладка

Игра в кабинете Playgama: `VI`, id `cmusa94kw028hpr0hzb9wqkrf`. Таблица игроков игры — `endless`. Таблица `timed` в кабинете осталась от сеанса дня: игра её больше не знает (код удалён 15 октября 2026), а удалить её в кабинете — по слову владельца. Публичный токен SaaS в [playgama-bridge-config.json](playgama-bridge-config.json) — это id игры, он не секрет. Sandbox: https://playgama.ai/play/hbhtrqdwvr — публичная ссылка без модерации.

Новая версия: поднять `version` в `package.json` (по ней различаются архивы в кабинете и сборки в аналитике), `npm run pack -- playgama`, загрузить `release/vi-<версия>-playgama.zip` и опубликовать в sandbox через Playgama MCP (`start_archive_upload` → PUT → `confirm_archive_upload` → `get_archive_status` → `publish_sandbox`). Адрес sandbox при этом не меняется. Отправка на модерацию в основной каталог делается только руками в кабинете. Обложки в кабинете временные: кадры главного меню. Тексты страницы (описание и «как играть») — в [docs/VI_Playgama_Page.md](../../docs/VI_Playgama_Page.md).
