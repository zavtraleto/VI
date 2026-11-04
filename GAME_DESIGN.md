# VI — дизайн игры: карта

> Вид: истина. Статус: в силе. Дата: 2026-11-04.

Кто правит: директор студии; при расхождении с кодом правится в том же коммите.

Тонкий слой над страницами-истинами: игра в десяти строках, столпы, какая страница владеет чем, что заморожено и что владелец ещё не сказал. Правила, числа и слова владельца — только на своих страницах; здесь — ссылки.

## Игра в десяти строках

1. Игрок стоит на кубе и перекатывает его по клеткам; перекат кладёт наверх другую грань.
2. Кости с одинаковой гранью наверху, собранные рядом в нужном числе, уходят — это комбо.
3. Кость с той же гранью, поставленная вплотную к уходящему комбо, уходит с ним — так растёт цепочка.
4. По уходящей кости ходят; с неё можно сойти на пол, если пол уровня открыт.
5. С пола игрок толкает кости и поднимается на уходящие; пол — второй слой решений.
6. Цель уровня — очистить поле; мир двигается только ходом, времени на уровне нет.
7. У каждой доски есть par — наименьшее число ходов; звёзды даются за близость к нему, пройти можно всегда.
8. Ряд — сто мест подряд, все открыты; между главами — короткие сеансы вживую, где кости приходят сами.
9. Endless — те же кости против часов: поток растёт, счёт идёт в таблицу рекордов.
10. Отмена хода есть; мир говорит с игроком передачами, лор — намёками, без ответов на тёмные места.

## Столпы

Заголовки [docs/VI_Puzzle_Principles.md](docs/VI_Puzzle_Principles.md), текст — там: текст владельца 15 октября 2026 (раздел 1); что решено 15 октября — отмены, смена граней, озарение не единственная эмоция, вариативность, доска, доносящая идею (раздел 2); правила одной доски (раздел 3); шесть вопросов к каждой новой доске (раздел 4); правила ряда (раздел 5).

## Какая страница владеет чем

| Область | Страница-истина | Рядом |
|---|---|---|
| Правила уровня | [docs/VI_Levels_Rules.md](docs/VI_Levels_Rules.md) | код — `src/rules/level.ts`, `src/rules/movement.ts` |
| Принципы досок и ряда | [docs/VI_Puzzle_Principles.md](docs/VI_Puzzle_Principles.md) | [docs/VI_Game_Psychology_Digest.md](docs/VI_Game_Psychology_Digest.md) (исследование) |
| Правила Endless и сеансов вживую | [docs/VI_Endless_Rules.md](docs/VI_Endless_Rules.md) | ступени — `src/rules/live.ts` |
| Ряд, доски, лаборатория, шкала D | [docs/VI_Levels_Lab.md](docs/VI_Levels_Lab.md) | данные — `boards/row.json`, `boards/*.txt`; [спека инструментов прогрессии](docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md) |
| Пересборка 31–100 | [спека пересборки](docs/superpowers/specs/2026-10-28-vi-rebuild-31-100-design.md) (решение) | [план](docs/superpowers/plans/2026-10-28-vi-rebuild-31-100.md) |
| Обучение | истины нет | помощь на каждом месте — `boards/row.json`; окна — [docs/art/VI_Interface_Layer.md](docs/art/VI_Interface_Layer.md); решения — [docs/VI_Levels_Onboarding_Decisions.md](docs/VI_Levels_Onboarding_Decisions.md) |
| Прогрессия и звёзды | [docs/VI_Levels_Rules.md](docs/VI_Levels_Rules.md), раздел 8 | код — `src/levels/progress.ts`; [исследование](docs/VI_Levels_Progression_Research.md) |
| Вид | [docs/art/VI_Visual_Language.md](docs/art/VI_Visual_Language.md), [docs/art/VI_Visual_Spec.md](docs/art/VI_Visual_Spec.md) | почему так — [docs/art/VI_World_Logic.md](docs/art/VI_World_Logic.md) |
| Интерфейс | [docs/art/VI_Interface_Layer.md](docs/art/VI_Interface_Layer.md) | слова — [docs/art/VI_Interface_Words_Research.md](docs/art/VI_Interface_Words_Research.md) |
| Лор и текст | [docs/art/VI_Lore.md](docs/art/VI_Lore.md), [docs/art/VI_Claims.md](docs/art/VI_Claims.md) | [docs/VI_Story_Brief.md](docs/VI_Story_Brief.md) (черновик) |
| Звук | истины нет | [спека звука](docs/superpowers/specs/2026-10-03-vi-sound-design.md), [звук уровней](docs/superpowers/specs/2026-10-12-vi-sound-levels-design.md); слова — [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 5 |
| Рекорды и журналы | [README.md](README.md), «Журнал сеансов» | код — `src/app/standings.ts`, `src/app/archive.ts` |
| Реклама и площадки | [docs/VI_Analytics.md](docs/VI_Analytics.md) (события) | [реклама после отмен](docs/superpowers/specs/2026-10-23-vi-ads-after-undos-design.md), [по желанию](docs/superpowers/specs/2026-10-23-vi-rewarded-ads-design.md) |

## Что заморожено

- **Правила уровня** — с 7 октября 2026 по слову владельца: правка хода уровня — только по его слову и с записью в [docs/VI_Levels_Rules.md](docs/VI_Levels_Rules.md); идеи — в её раздел 11.
- **Ключ слепой пробы** [docs/VI_Levels_Probe_Key.md](docs/VI_Levels_Probe_Key.md) — владельцу не показывать, пока он не сыграл и не сказал своё.
- **Места 1–30** приняты владельцем («1–30 ок») — их не меняют без его слова.
- **Endless** стоит: «над endless мы будем работать отдельно, после уровней» ([docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 2).
- **Вид** ведёт владелец: агент делает ровно названное ([CLAUDE.md](CLAUDE.md)). Слова владельца — на странице области, а если места нет — [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md).

## Открытые вопросы к владельцу

| # | Вопрос | Где поставлен |
|---|---|---|
| Q1 | Слова по местам 31–60 после его плейтеста (обещал 29 октября) | [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 1 |
| Q2 | «Ок» на шаг 2 пересборки 61–100 и ответы 10.1–10.6: окно у фиксированной кости, `states` в D, сколько задач Devil Dice, par 10–14 с 71-го, имена глав | [спека пересборки](docs/superpowers/specs/2026-10-28-vi-rebuild-31-100-design.md), раздел 10 |
| Q3 | Окно первого сеанса вживую: сказать, что правило пола в эфире другое, — какими словами | [спека сеансов вживую](docs/superpowers/specs/2026-10-22-vi-live-sessions-design.md); [docs/VI_Endless_Rules.md](docs/VI_Endless_Rules.md), раздел 13 |
| Q4 | Что дают звёзды и как сделать экран LEVELS интереснее (вид — его) | [docs/ROADMAP.md](docs/ROADMAP.md), «Очки за звёзды» и «Список уровней — сделать интереснее» |
| Q5 | Что игрок копит между визитами: сумма звёзд и вехи, собранные сцены после сеансов, повод дня | [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 6 (сцены 29 октября); [свод психологии](docs/VI_Game_Psychology_Digest.md) |
| Q6 | Межстраничная реклама за отмены — не раньше N-го места или M минут визита | [спека рекламы после отмен](docs/superpowers/specs/2026-10-23-vi-ads-after-undos-design.md) |
| Q7 | CrazyGames: обложки и видео, когда отправлять, включать ли рекламу | [docs/VI_CrazyGames_Research.md](docs/VI_CrazyGames_Research.md) |
| Q8 | Архив вымышленных игроков сыгран по правилам 4 октября и выше нынешнего счёта: пересчитать или оставить | [план релиза Playgama](docs/superpowers/plans/2026-10-22-vi-release-playgama.md), 1.6 |
| Q9 | Endless: провис длинной партии и предложения исследования удержания | [docs/VI_Retention_Research.md](docs/VI_Retention_Research.md), «Предложения»; [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 2 |
| Q10 | «Звонок» и его счёт в сеансах вживую, ответ в конце слоя | [docs/VI_Rest_And_Bonus_Research.md](docs/VI_Rest_And_Bonus_Research.md) |
| Q11 | Плашки над костями: логика появления (он обещал вернуться) | [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 1, 15 октября |
| Q12 | Шрифт программы «как EarthBound» | [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 4 |
| Q13 | Вычитка пяти переводов носителями (отложил он сам) | [docs/ROADMAP.md](docs/ROADMAP.md), «Языки» |
| Q14 | Пробы мягкости из раздела «Работа, которой нет в main», похоже, утрачены — сказать ему | [docs/VI_Owner_Words.md](docs/VI_Owner_Words.md), раздел 8 |
