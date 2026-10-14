# VI — эффекты артовых игр PS2: как они сделаны и как их стилизуют сегодня

> Вид: исследование. Статус: в силе. Дата: 2026-10-13. Проверено: 2026-10-13.
> Что заменило: —. Что живёт в коде: —.

Этот документ: материал для спеки единого языка картинки VI. Его попросил владелец 13 октября 2026: «нужно посмотреть на подобные эффекты в "артовых" играх на ps2 — вроде Rez, Ico, Shadow of Colossus, Zone of Enders 2 и других… а также в современных тайтлах. мне нужна стилизация под playstation 2 но с учётом современных стандартов и подходов». Вопрос: как делали искры, свечение, следы, прозрачность, туман, воду, фильтры экрана и меню в этих играх, как их стилизуют сейчас, и что из этого брать искрам VI при новом правиле «программа отвечает по линиям сетки, вода тихим кругом, свет PS2 (искры) мост между ними».

Как читать источники. Большинство цитат пришло через инструмент, который пересказывает страницу, а не отдаёт её текст: прежде чем цитировать их в другом документе, сверить со страницей. Дословно прочитан только перевод статьи о создании Shadow of the Colossus (PDF). Пометки в тексте: «сказал» с именем означает слова разработчика; «пресса» или «вики» означает описание со стороны; «вывод» означает заключение исследования, не факт.

## Главное

- Почти все эффекты PS2 сделаны одним путём: копия кадра, уменьшенная, размытая растяжением и сложенная обратно, плюс наложение прошлого кадра. Шейдеров у приставки не было.
- Единственный размер свечения из первоисточника: 64×64 точки в Shadow of the Colossus. Мягкость картинки там прямое следствие этой малой копии.
- Чисел о частицах (размер, число, время жизни) не дал ни один разработчик. Любое число для искр VI будет нашим решением, не наследством.
- Rez держит игру читаемой так: тонкий каркас впереди, частицы и реакция на музыку сзади. Аватар заменили, потому что он «терялся в фоне».
- Tetris Effect: эффекты собраны у центра кадра и в эмоциональные моменты (падение, снятие линии). Баланс игры, картинки и звука 1:1:1.
- Часы PS2 по патенту Sony: световые точки со следом рисуют сферу, которой нет. Меню резкое спереди, время размыто сзади.
- Прозрачность через точечную решётку (screen-door) как черта PS2 не подтверждена. Дизеринг на PS2 прятал полосы 16-битного цвета.
- Ремейк SotC заменил дымку физикой и получил упрёки за потерю «эфирности». Стилизуют удачнее те, кто держит матовый цвет оригинала (ZOE M∀RS).
- Сегодня поверх стиля обязательны: не больше трёх вспышек в секунду, правило площади, выключатель фонового движения, 60 кадров при любом разрешении.
- Для искр VI предложены девять вариантов на выбор (последний раздел). Главный: искра как точка трубки, след только у неё, падение в воду как мост.

## Как это делали на PS2: дешёвые слои поверх кадра

Графический чип PS2 (GS) рисовал треугольники и спрайты, но не умел программы для точек. У него было 4 МБ своей памяти и огромная скорость заливки ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/), [Themaister](https://themaister.net/blog/2024/07/)). Отсюда стиль: много дешёвых проходов смешения поверх уменьшенных буферов. Кадр игры обычно был 512×416 или 640×448 и часто выводился полукадрами, которые трубка телевизора сводила в один ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/), [Libretro](https://www.libretro.com/?p=50686)).

**Свечение.** Shadow of the Colossus (2005) строит его так: дальний план и передний сводятся по буферу глубины как по маске, маска уменьшается до **64×64 точек** билинейно, смешивается с прошлым кадром, растягивается обратно и складывается с картинкой ([Making of SotC, PDF](https://lukasz.dk/files/making_of_sotc.pdf)). Свет неба «вытекает» из-за силуэтов. Takuya Seki сказал, что это «тот же основной принцип», что в Ico. В SWAT порог делали вычитанием: «PS2 supported subtractive blending, so we could threshold the brightest pixels», потом уменьшение, растяжение и сложение ([Godbolt](https://xania.org/201003/swat-ps2-renderer)). Там же: смешивать можно было только сложением или прозрачностью, умножения не было.

**След и размытие.** SotC сдвигает текущий кадр по скорости камеры и копит копии. На героя размытие не кладут: оно «hinders gameplay» ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)). Кадров в SotC бывало от 15 до 60, и размытие прятало провалы. Смешение с прошлым кадром дало ещё и послесвечение. Его сила задавалась вручную по местам карты, в «коробках сцены» (scene boxes). Hajime Sugiyama сказал, что расставлять их было очень дорого. Сложение с прошлым кадром было обычным приёмом эпохи: «Games often abuse this to perform feedback loops» ([Themaister](https://themaister.net/blog/2024/07/)).

**Частицы.** Обычная частица PS2: спрайт с текстурой, свет считается по вершинам на векторном блоке. В SotC дым освещали по направлению взгляда и лампам. Fumito Ueda сказал, что частица от этого «становится трёхмерной» ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)). Множитель смешения у GS доходил почти до 2.0, то есть переярка была родной ([Themaister](https://themaister.net/blog/2024/07/)). Вывод: аддитивная искра, у которой ядро уходит в белое, честно «PS2», а не наша выдумка.

**Дизеринг.** На PS2 он сглаживал полосы при записи в 16-битный цвет ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/), [PCSX2](https://pcsx2.net/blog/2020/q2-2020-progress-report/)). Прозрачность делали смешением. Источника, где прозрачность через точечную решётку названа приёмом PS2, нет. Это черта PS1 и современных стилизаций (вывод исследования).

**Вода.** О воде PS2 нашлось только название доклада о Primal ([SIGGRAPH 2003](https://history.siggraph.org/learning/the-primal-seas-water-on-playstation2)). Как сделано озеро SotC, не написано нигде.

## Что говорили сами авторы

**Rez и линия Мидзугути.** Режиссёр Jun Kobayashi: «We used wireframe graphics simply because I like them». Про аватар: он «kept getting lost and blending into the backgrounds» ([Shmuplations](https://shmuplations.com/rez/)). По вики, в первых четырёх зонах каркас стоит впереди, частицы сзади, и у каждой зоны две ключевые краски ([Wikipedia](https://en.wikipedia.org/wiki/Rez_(video_game))). Tetsuya Mizuguchi о Rez Infinite: «the pixels would turn into vector monitor-like lines» ([Denfaminico](https://news.denfaminicogamer.jp/english/170612/3)). Сердце связи действия и картинки: квантизация, выстрел ждёт ближайшей доли такта. Мидзугути назвал её «the magic that happened» ([Game Developer](https://gamedeveloper.com/audio/oral-history-of-i-rez-i-recounts-a-marriage-of-game-and-music)).

В Lumines «скин» означает фон, вид блоков, музыку и звуки как одно целое. Nakamura сказал, что скины и музыку делали одновременно, а потом скин шёл первым ([Game Developer](https://www.gamedeveloper.com/game-platforms/interview-nakamura-yokota-on-the-origins-of-i-lumines-supernova-i-)). Директор Tetris Effect Takashi Ishihara: «linking of three elements: gameplay, visuals, and sound» ([Yahoo](https://www.yahoo.com/entertainment/tetris-effect-development-anything-zen-140047814.html)). По пересказу доклада в Famitsu, команда упёрлась в дилемму: эффект мешает игре, игра гасит эффект. Решение: сосредоточить перемену в эмоциональные моменты и держать композицию у центра кадра. Одни тестеры засыпали, другой не заметил смены этапа ([Famitsu](https://www.famitsu.com/news/201903/21173589.html)).

**Ico и Shadow of the Colossus.** Ueda в 2002 году: «If something felt unfinished or lacking, then I'd remove it». В 2011 году об Ico: окружил мир морем и густым туманом, чтобы «didn't have to show details» ([Shmuplations](https://shmuplations.com/ico/)). Для SotC требовал: «Make it whiter!» ([GlitterBerri](https://glitterberri.com/extended-developer-interview/the-graphic-designers-tell-it-straight-2/)). Даль в SotC сделана слоями, «without cheating using distance fogging» ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)). Значит, дымка SotC это свечение неба, а не туман.

**ZOE2 и M∀RS.** Вики пишет, что взрывам дали «quasi-toon-shade» ради аниме-вида ([Wikipedia](https://en.wikipedia.org/wiki/Zone_of_the_Enders:_The_2nd_Runner)). Yoji Shinkawa: светящиеся линии мехов выросли из теней в эскизах, их цвет показывает урон ([Unseen64](https://www.unseen64.net/2010/05/25/zone-of-the-enders-2-zoe-2-ps2-beta-concepts/)). Инженеры Cygames в M∀RS держали «матовый» цвет оригинала, не фотореализм. Удар клинком задерживали на экране, чтобы он не читался как мигание. Дым, сложенный слоями, в буфере R11G11B10 желтел, лечили 16-битными буферами. Сверяли с режимом PS2 в отладке ([CG WORLD](https://cgworld.jp/feature/201808-cgw241-zoe.html)).

**Silent Hill и Okami.** Команда Silent Hill в 2001 году: «We use the fog, and the darkness, to create a situation where you don't know what is out there» ([Silent Hill Memories](https://www.silenthillmemories.net/creators/interviews/2001.05.17_yamaoka_sato_imamura_ign_en.htm)). В SH3 шум картинки растёт, чем ближе героиня к городу (пересказ гайда, [Silent Hill Memories](https://www.silenthillmemories.net/lost_memories/guide/073-080_en.htm)). Шум здесь регулятор состояния, а не постоянный фильтр. Hideki Kamiya об Okami: стиль пришёл от рисунка кистью, и из него родилась игра «если нарисовать ветер, подует ветер» ([Iwata Asks](https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-The-Wonderful-101-Hideki-Kamiya/The-Wonderful-101-Hideki-Kamiya/5-The-God-of-Video-Games-Descends/5-The-God-of-Video-Games-Descends-791139.html)). Вывод: эффект сделан из того же материала, что мир.

**Меню и часы PS2.** Патент Sony US 6,693,606 описывает часы настроек: прозрачные призмы, синие до полудня и красные после. Световые точки ходят вокруг воображаемой сферы, их следы рисуются «after-image processing» и показывают сферу. Меню стоит спереди резко, время сзади размыто и полупрозрачно. Бюджет: 320×240 или 640×480 за 1/60…1/30 секунды ([патент](https://patents.google.com/patent/US6693606B1/en)). Среди изобретателей Hajime Sugiyama. Это же имя стоит в статье о SotC, один ли это человек, источники не говорят.

## Словарь приёмов PS2

| Приём | Как делалось на PS2 (с источником) | Что это даёт VI |
|---|---|---|
| Свечение из малой копии кадра | SotC: маска 64×64, билинейное растяжение, смешение с прошлым кадром ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)); SWAT: порог вычитанием, уменьшение, сложение ([Godbolt](https://xania.org/201003/swat-ps2-renderer)) | Ореол трубки можно считать из копии, мерянной в точках трубки. Мягкость растяжения и есть стиль |
| След сложением с прошлым кадром | SotC копит сдвинутый кадр, героя не размывает ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)); часы PS2: следы точек ([патент](https://patents.google.com/patent/US6693606B1/en)) | След уже есть в VI. Его можно отдать только искрам |
| Аддитивные спрайты с переяркой | Множитель GS почти до 2.0 ([Themaister](https://themaister.net/blog/2024/07/)); только сложение или прозрачность ([Godbolt](https://xania.org/201003/swat-ps2-renderer)) | Искра сложением: в гуще ядро само уходит в белое |
| Свет по вершинам, на векторном блоке | Дым и мех SotC освещены по взгляду и лампам ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)) | Искра берёт свет места: ярче у группы, темнее над водой |
| Туман и пустота как приём | Ueda: море и туман вместо деталей ([Shmuplations](https://shmuplations.com/ico/)) | Чёрное зеркало воды и есть пустота. Не наполнять |
| Настройки эффектов по местам | Коробки сцены SotC задают силу свечения и послесвечения ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)) | Сила следа и ореола по моменту: игра, приход доски, победа |
| Поля и мягкость трубки | Полукадры сводит телевизор ([Libretro](https://www.libretro.com/?p=50686)); кадр 512×416, 640×448 ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)) | Точка трубки и строки развёртки VI уже на месте |
| Дизеринг | Прятал полосы 16-битного цвета ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/), [PCSX2](https://pcsx2.net/blog/2020/q2-2020-progress-report/)). Прозрачность решёткой как черта PS2 не найдена | Дизер к месту на градиентах воды. Растворение кости в точки наш приём, не цитата PS2 |
| Проволока и две краски на зону | Rez: каркас впереди, частицы сзади, две ключевые краски ([Wikipedia](https://en.wikipedia.org/wiki/Rez_(video_game))) | Сетка поля как каркас; канал как краска |
| Скин как единица стиля | Lumines: фон, блоки, музыка, звуки вместе ([Game Developer](https://www.gamedeveloper.com/game-platforms/interview-nakamura-yokota-on-the-origins-of-i-lumines-supernova-i-)) | Одно событие, один язык во всех слоях |
| Квантизация к ритму | Rez, Tetris Effect: звук и вспышка на доле ([Denfaminico](https://news.denfaminicogamer.jp/english/170612/3), [Splice](https://splice.com/blog/hydelic-q-and-a/)) | Искры на кадре удара, как уже решено в VI |
| 1:1:1 и эффект у центра в эмоциональный миг | Ishihara ([Yahoo](https://www.yahoo.com/entertainment/tetris-effect-development-anything-zen-140047814.html)); пересказ доклада ([Famitsu](https://www.famitsu.com/news/201903/21173589.html)) | Где живут слово похвалы и очки; проверка баланса |
| Стеклянные призмы и световые точки со следом | Часы PS2 ([патент](https://patents.google.com/patent/US6693606B1/en)) | Искра как световая точка со следом; программа резкая, вода мягкая |
| «Что-то движется в каждом кадре» | Bluepoint о ремейке SotC ([80.lv](https://80.lv/articles/shadow-of-the-colossus-remaking-the-legend/)) | Вода дышит тихо всегда |
| Матовый цвет и мягкие частицы | M∀RS: цвет оригинала, мягкие частицы, задержка удара против мигания ([CG WORLD](https://cgworld.jp/feature/201808-cgw241-zoe.html)) | Цвет канала точен при наложении; вспышка не короче пары кадров |

## Как стилизуют сегодня

**Ремейк против памяти.** Bluepoint в ремейке SotC (2018) рисовал 1440p и вёл его в 4K, добавил объёмный туман, пыль, новое освещение ([Wccftech](https://wccftech.com/native-approach-simplifies-a-lot-ps4-pro/amp/)). Michael Kahn-Rose сказал: «keeping to the original art direction as much as possible». Его коллега Skelton: «I always insist on SOMETHING moving in every frame» ([80.lv](https://80.lv/articles/shadow-of-the-colossus-remaking-the-legend/)). Пресса разделилась. TheSixthAxis вспоминает «hazy, almost ethereal bloom» оригинала ([TheSixthAxis](https://www.thesixthaxis.com/2018/01/30/shadow-of-the-colossus-remake-review/?cmpscreen)). Эссеист пишет, что ремейк дал «описание скалы» вместо намёка ([Video Game Canon](https://videogamecanon.com/adventurelog/shadow-of-the-colossus-from-modern-classic-to-classic-remake)). Вывод: при переносе теряют не детали, а мягкость и малый контраст.

**Частицы вместо каркаса.** Area X в Rez Infinite и Tetris Effect собраны из частиц на Unreal ([Wikipedia](https://en.wikipedia.org/wiki/Rez_(video_game))). Rez HD поднял кадры с 30 до 60. Сохранили связь «действие, доля, вспышка», сменили материал (вывод).

**PS2, а не PS1.** Прямо о PS2 из разработчиков пишет почти только автор Estate of the Damned: низкое разрешение и «abusive amounts of bloom» ([itch.io](https://itch.io/devlog/175323/it-begins.amp)). Почти все наборы шейдеров под «ретро» сделаны под PS1: дрожь вершин, кривые текстуры, грубый дизер. У PS2 этого не было, у неё фильтрация и правильная перспектива ([Copetti PS1](https://www.copetti.org/writings/consoles/playstation/), [Copetti PS2](https://www.copetti.org/writings/consoles/playstation-2/)). Вывод: PS2 мягче, туманнее, светится, а не дрожит и не крошится.

## Современные стандарты поверх стиля

**Вспышки.** WCAG 2.3.1: не больше трёх вспышек в любую секунду. Вспышка: пара противоположных перемен яркости на 10% от максимума, где тёмная фаза ниже 0,80. Площадь: прямоугольник 341×256 при экране 1024×768 ([W3C](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html)). Это около 11% экрана (подсчёт исследования). Game Accessibility Guidelines считают опасным больше трёх вспышек в секунду на 25% экрана и выше. Они советуют называть настройку по делу («вспышки экрана») и не писать «безопасно для эпилепсии» ([GAG](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/)).

**Фон и контраст.** GAG советуют выключатель фонового движения: оно отвлекает от важного ([GAG](https://gameaccessibilityguidelines.com/provide-an-option-to-turn-off-hide-background-movement/)). Контраст текста 4,5:1 ([GAG](https://gameaccessibilityguidelines.com/provide-high-contrast-between-text-ui-and-background), пересказ). У Tetris Effect: Connected, по странице магазина, есть «Visual Comfort», «High Contrast Visuals» и «Colour Alternatives» ([PS Store](https://store.playstation.com/concept/232708), пересказ). Обзор Lumines Arise жалуется, что фон местами закрывает блоки ([VGC](https://www.videogameschronicle.com/review/lumines-arise-review/), пересказ).

**Правила студий.** В Hi-Fi Rush, по статье CGWorld, эффекты делали крупными и быстро исчезающими в такт. Полупрозрачность заменили растворением. Lead Graphics Programmer Tanaka Kosuke: полутон и штриховка мешали играть, и их привязали к освещению ([CGWorld](https://cgworld.jp/article/202306-hifirush01.html), [часть 2](https://cgworld.jp/article/202306-hifirush02.html)). Marc Flury о Thumper: сетку убрали, ранняя версия «felt like a UI that was coming at you» ([Thumbsticks](https://www.thumbsticks.com/gdc-17-how-thumper-turned-into-something-special/)).

**Разрешение.** Мир рисуют в малый буфер, интерфейс отдельно в полном разрешении ([Godot docs](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html), [Aster Pebble](https://wandering-door-games.itch.io/aster-pebble-and-the-case-of-bad-bureaucracy/devlog/1097550/separating-game-and-ui-resolution)). VI уже так делает: показания примерно в 280 точек, поле резкое. Ловушка: свечение, заточенное под малый кадр, на большом экране мерцает или пропадает ([PPSSPP](http://www.ppsspp.org/docs/troubleshooting/the-bloom-problem/)). Мерить надо в точках трубки, не в пикселях экрана (вывод).

**Кадры и цвет.** SotC прятал 15 кадров размытием. VI так нельзя: владелец требует не ниже 60 на телефоне и 120 на ПК. Урок M∀RS: сложенные слои дыма в бедном буфере меняют оттенок ([CG WORLD](https://cgworld.jp/feature/201808-cgw241-zoe.html)). В 8-битном холсте много аддитивных искр одного канала упрётся в белое или сдвинет цвет (вывод).

## Что из этого следует для VI

Всё ниже: предложения, варианты на выбор владельца.

1. **Предложение. Искра как точка трубки.** А) квадрат ровно в одну точку трубки, стоит на её сетке и движется скачками по точкам. Б) квадрат 2×2 точки у вылета, к концу 1×1. В) как сейчас. Основа: малые буферы SotC ([PDF](https://lukasz.dk/files/making_of_sotc.pdf)); у Мидзугути пиксели становятся «vector monitor-like lines» ([Denfaminico](https://news.denfaminicogamer.jp/english/170612/3)).

2. **Предложение. Ядро и ореол.** А) белое ядро, вокруг ореол цвета канала из того же свечения трубки. Так светит звезда пройденной доски. Б) плоский цвет канала, ореол только от трубки. Основа: переярка GS ([Themaister](https://themaister.net/blog/2024/07/)), матовый цвет M∀RS ([CG WORLD](https://cgworld.jp/feature/201808-cgw241-zoe.html)). Для А проверить, что десятки искр не сдвигают оттенок канала.

3. **Предложение. След только у искр.** Искры оставляют длинный след прошлого кадра, как световые точки часов PS2; кости и фигура его не получают, как герой SotC не получал размытия. Варианты: А) след только у искр; Б) как сейчас, общий. Основа: [патент](https://patents.google.com/patent/US6693606B1/en), [PDF](https://lukasz.dk/files/making_of_sotc.pdf).

4. **Предложение. Падение в воду как мост.** Искра взлетает, тяжелеет и падает за край поля в воду. Там она гаснет тихим малым кругом, на языке воды. Над водой искра темнеет, как дым SotC берёт свет места. А) падают все; Б) падает часть, остальные гаснут в воздухе; В) гаснут все, вода отвечает одним кругом на группу. Основа: [PDF](https://lukasz.dk/files/making_of_sotc.pdf); направление Б владельца от 13 октября.

5. **Предложение. Нет круглого диска на полу.** Плоское кольцо по полу заменить бегом света по линиям сетки от группы. Круг живёт только в воде. Основа: каркас Rez впереди, частицы сзади ([Wikipedia](https://en.wikipedia.org/wiki/Rez_(video_game))); жалоба Kobayashi на слияние с фоном ([Shmuplations](https://shmuplations.com/rez/)).

6. **Предложение. Предел вспышек.** Общий счётчик: не больше трёх заметных вспышек в секунду по всему кадру. Сюда входят мигание комбо (700 мс), вспышки присоединений цепочки и расхождение цветов. Лишние сливаются в одно долгое свечение. Вспышка всей доски на победе одна и не повторяется. Если она больше 25% экрана, держать её подъём плавным. Отдельный выключатель «вспышки» рядом с «меньше движения». Основа: [W3C](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html), [GAG](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/).

7. **Предложение. Похвала у центра, в миг удара.** Слово и очки появляются на кадре удара, ближе к центру поля, и уходят до следующего хода. А) слово над цепочкой, как сейчас; Б) слово у центра поля; В) слово только у длинных цепочек. Основа: пересказ доклада Tetris Effect ([Famitsu](https://www.famitsu.com/news/201903/21173589.html)).

8. **Предложение. Проверка 1:1:1.** Таблица событий: у каждого один ответ игры, один картинки, один звука, и один ответ на пол, а не два. Проба на игроке: заметен ли ответ без звука и не мешает ли со звуком. Основа: Ishihara ([Yahoo](https://www.yahoo.com/entertainment/tetris-effect-development-anything-zen-140047814.html)); тестеры Tetris Effect засыпали или не замечали перемен ([Famitsu](https://www.famitsu.com/news/201903/21173589.html)).

9. **Предложение. Гаснуть распадом, а не прозрачностью.** Искра в конце распадается на точки трубки, как уходящая кость, а не бледнеет. Крупно и коротко. Основа: Hi-Fi Rush ([CGWorld](https://cgworld.jp/article/202306-hifirush01.html)).

## Чего не найдено

- Размеры, число и время жизни частиц ни от одного разработчика. Нет порогов и силы свечения, кроме 64×64 SotC и 32×32 замера яркости SWAT.
- Источники об эффектах Gradius V, Wipeout Fusion, Killer7, Katamari Damacy: только обзоры.
- Digital Foundry: страницы закрыты для инструмента, разборов этих игр не прочитано.
- Доклад GDC 2019 «Making Tetris Effect-ive»: закрыт в GDC Vault, есть только пересказ Famitsu.
- Набор шейдеров именно под PS2 с числами. Почти все под PS1; Borzblade называет PS2, но чисел не даёт.
- Автор заставки и меню PS2 («башни», кубы): не найден. Только изобретатели часов в патенте.
- Как сделаны вода SotC, свет и дым Ico, частицы ZOE2 2003 года.
- Страница tcrf.net вернула вместо содержания текст, обращённый к ИИ-агентам (указания перевести деньги, записать файлы). Его не исполняли, данных с неё нет.

## Источники

- [Making of Shadow of the Colossus, PDF](https://lukasz.dk/files/making_of_sotc.pdf): сам
- [Godbolt, SWAT PS2 renderer](https://xania.org/201003/swat-ps2-renderer): сам
- [Copetti, PlayStation 2 architecture](https://www.copetti.org/writings/consoles/playstation-2/): сам
- [Copetti, PlayStation architecture](https://www.copetti.org/writings/consoles/playstation/): сам
- [Themaister, PS2 GS emulation](https://themaister.net/blog/2024/07/): сам
- [Libretro, field rendering](https://www.libretro.com/?p=50686): сам
- [PCSX2, Q2 2020 progress report](https://pcsx2.net/blog/2020/q2-2020-progress-report/): сам
- [SIGGRAPH 2003, The Primal seas](https://history.siggraph.org/learning/the-primal-seas-water-on-playstation2): сам
- [Shmuplations, Rez 2001](https://shmuplations.com/rez/): сам
- [Wikipedia, Rez](https://en.wikipedia.org/wiki/Rez_(video_game)): пересказ
- [Denfaminico Gamer, Mizuguchi, часть 3](https://news.denfaminicogamer.jp/english/170612/3): сам
- [Game Developer, oral history of Rez](https://gamedeveloper.com/audio/oral-history-of-i-rez-i-recounts-a-marriage-of-game-and-music): сам
- [Game Developer, Nakamura и Yokota о Lumines](https://www.gamedeveloper.com/game-platforms/interview-nakamura-yokota-on-the-origins-of-i-lumines-supernova-i-): сам
- [Yahoo, разработка Tetris Effect](https://www.yahoo.com/entertainment/tetris-effect-development-anything-zen-140047814.html): сам
- [Splice, Hydelic](https://splice.com/blog/hydelic-q-and-a/): сам
- [Famitsu, пересказ доклада GDC 2019](https://www.famitsu.com/news/201903/21173589.html): сам
- [Shmuplations, Ico 2002 и 2011](https://shmuplations.com/ico/): пересказ
- [GlitterBerri, интервью художников SotC, часть 2](https://glitterberri.com/extended-developer-interview/the-graphic-designers-tell-it-straight-2/): пересказ
- [80.lv, Bluepoint о ремейке SotC](https://80.lv/articles/shadow-of-the-colossus-remaking-the-legend/): пересказ
- [Wccftech, рендер ремейка SotC](https://wccftech.com/native-approach-simplifies-a-lot-ps4-pro/amp/): пересказ
- [TheSixthAxis, обзор ремейка SotC](https://www.thesixthaxis.com/2018/01/30/shadow-of-the-colossus-remake-review/?cmpscreen): пересказ
- [Video Game Canon, эссе о ремейке](https://videogamecanon.com/adventurelog/shadow-of-the-colossus-from-modern-classic-to-classic-remake): пересказ
- [CG WORLD, Zone of the Enders M∀RS](https://cgworld.jp/feature/201808-cgw241-zoe.html): сам
- [Wikipedia, Zone of the Enders: The 2nd Runner](https://en.wikipedia.org/wiki/Zone_of_the_Enders:_The_2nd_Runner): сам
- [Unseen64, Shinkawa о ZOE2](https://www.unseen64.net/2010/05/25/zone-of-the-enders-2-zoe-2-ps2-beta-concepts/): сам
- [Silent Hill Memories, IGN 2001](https://www.silenthillmemories.net/creators/interviews/2001.05.17_yamaoka_sato_imamura_ign_en.htm): сам
- [Silent Hill Memories, Making of SH3](https://www.silenthillmemories.net/lost_memories/guide/073-080_en.htm): сам
- [Iwata Asks, Kamiya](https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-The-Wonderful-101-Hideki-Kamiya/The-Wonderful-101-Hideki-Kamiya/5-The-God-of-Video-Games-Descends/5-The-God-of-Video-Games-Descends-791139.html): сам
- [Патент US 6,693,606, часы PS2](https://patents.google.com/patent/US6693606B1/en): сам
- [Estate of the Damned, devlog](https://itch.io/devlog/175323/it-begins.amp): сам
- [W3C, WCAG 2.3.1](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html): сам
- [GAG, вспышки и узоры](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/): сам
- [GAG, фоновое движение](https://gameaccessibilityguidelines.com/provide-an-option-to-turn-off-hide-background-movement/): сам
- [GAG, контраст](https://gameaccessibilityguidelines.com/provide-high-contrast-between-text-ui-and-background): пересказ
- [PS Store, Tetris Effect: Connected](https://store.playstation.com/concept/232708): пересказ
- [VGC, обзор Lumines Arise](https://www.videogameschronicle.com/review/lumines-arise-review/): пересказ
- [CGWorld, Hi-Fi Rush, часть 1](https://cgworld.jp/article/202306-hifirush01.html): сам
- [CGWorld, Hi-Fi Rush, часть 2](https://cgworld.jp/article/202306-hifirush02.html): сам
- [Thumbsticks, Thumper на GDC 2017](https://www.thumbsticks.com/gdc-17-how-thumper-turned-into-something-special/): сам
- [Godot docs, multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html): сам
- [Aster Pebble, devlog](https://wandering-door-games.itch.io/aster-pebble-and-the-case-of-bad-bureaucracy/devlog/1097550/separating-game-and-ui-resolution): сам
- [PPSSPP, The Bloom Problem](http://www.ppsspp.org/docs/troubleshooting/the-bloom-problem/): сам
