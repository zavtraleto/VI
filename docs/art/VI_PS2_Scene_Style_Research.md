# VI — стиль PS2 для сцены «море со столбом»: что это, как собрать, что будет стоить

> Вид: исследование. Статус: в силе. Дата: 2026-10-18. Проверено: 2026-10-18.
> Что заменило: —. Что живёт в коде: —. Опирается на [VI_PS2_Effects_Research.md](VI_PS2_Effects_Research.md) и часть 5 [VI_Visual_Language.md](VI_Visual_Language.md).

Этот документ отвечает на вопрос владельца: чем отличалась графика PlayStation 2, как перенести этот вид на сцену передачи «море, столб, красное солнце» (сейчас она в виде PS1), насколько это трудно и дорого для видеокарты и как это будет выглядеть. Владелец хочет сначала попробовать одну сцену. Что уже есть в [VI_PS2_Effects_Research.md](VI_PS2_Effects_Research.md) (свечение SotC из копии 64×64, след прошлого кадра, аддитивные спрайты с переяркой, слова авторов Rez, Ico, SotC, ZOE2, Silent Hill) и в части 5 [VI_Visual_Language.md](VI_Visual_Language.md) (таблица черт PS2, принятых для поля, список «чего не берём», пробы мягкости с ценой), здесь не повторяется, только упоминается ссылкой.

Пометки источников: **[разработчик]** слова авторов игры; **[код]** код игры, декомпилированный фанатами (OpenGOAL для Jak); **[эмулятор]** объяснения разработчиков эмуляторов (PCSX2, PPSSPP, paraLLEl-GS); **[железо]** документация по приставке; **[пресса]**; **мнение** пост на форуме или в обсуждении; **вывод** заключение исследования, не факт; **оценка** число, посчитанное нами, а не измеренное.

Правила, которые держит этот документ. Вид ведёт владелец, агент не придумывает картинку сам ([CLAUDE.md](../../CLAUDE.md), раздел «Работа»), поэтому ниже варианты словами, а не выбранный вид. Вид передач утверждён владельцем в духе PS1: «очень нравится, вообще отлично, оставляем экраны такими» ([VI_Owner_Words.md](../VI_Owner_Words.md), строка 106). Значит, PS2-сцена здесь добавка для окна подсказки и сюжетных сцен, а не замена передач. Фон уровня должен оставаться спокойным: «всё должно быть более плавным, тягучим и вязким» ([VI_World_Logic.md](VI_World_Logic.md), строка о фоне уровня). Бюджет кадра: вся вода не дороже 1 мс видеокарты ([спека воды](../superpowers/specs/2026-10-13-vi-water-backdrop-probe.md), раздел 5) и 60 кадров при любом разрешении ([VI_PS2_Effects_Research.md](VI_PS2_Effects_Research.md), «Главное»).

## 1. Главное

- PS2 не «улучшенная PS1», а другой конвейер. Графический чип GS не умел программ для точек, брал одну текстуру за проход, зато заливал 1,2–2,4 млрд точек в секунду в 4 МБ встроенной памяти со скоростью 48 ГБ/с ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer)). Отсюда вид эпохи: много дешёвых прозрачных проходов и малых копий кадра.
- Две главные приметы PS1 исчезли на уровне железа: текстуры на PS2 перспективно правильные ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)), а вершины стоят с точностью 1/16 точки ([Themaister](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation)). Дрожь вершин в «PS2-стиле» это ошибка эпохи.
- Мягкость PS2 складывается из нескольких фильтров сразу: кадр шириной 512–640 растягивает схема вывода, часть игр рисует полукадрами по 224–240 строк, текстуры малые и билинейные, сверху проходы размытия и свечения, потом аналоговый кабель ([libretro](https://www.libretro.com/?p=50686), [Copetti](https://www.copetti.org/writings/consoles/playstation-2/)).
- Сегодня игроки описывают PS2 словами «мягкая, тусклая, туманная, со свечением», PS1 словами «хрусткая, дрожащая» ([ResetEra 2026](https://www.resetera.com/threads/what-do-you-consider-to-be-the-recognisable-visual-characteristics-of-the-dc-ps2-xb-gc.1497903/), мнение). Палитра не примета: у эпохи есть и тёмная линия, и «пляжное поколение».
- Лучший первоисточник о море PS2: декомпилированный код Jak and Daxter. Волна там не синусы, а флипбук из 64 кадров сетки 32×32; каждый кадр игра рисует текстуру океана 128×128; ближняя вода идёт двумя проходами; цвет тумана воды равен общему туману ([OpenGOAL](https://github.com/open-goal/jak-project/tree/master/goal_src/jak1/engine/gfx/ocean), [код]). В Jak II к этому добавлена карта окружения 64×64 из цвета неба, облаков и полосы «дымки» ([OceanEnvmap.h](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/OceanEnvmap.h), [код]).
- Солнечную вспышку игры той поры гасили за предметами, читая буфер глубины процессором вокруг точки солнца: так делают Kingdom Hearts II на PS2 и Wipeout Pure на PSP ([PCSX2](https://pcsx2.net/blog/2016/q2-2016-progress-report/), [PPSSPP](https://github.com/hrydgard/ppsspp/issues/15923), [эмулятор]).
- В нашей сцене от PS1 по-настоящему видны четыре вещи: привязка вершин к сетке, слой в 240 строк, 5 бит цвета с сильным дизером, зерно и строки развёртки. Кривые текстуры и фильтр «ближайшая точка» в материале есть, но в этой сцене не работают: текстур в ней нет.
- Половина инструментов PS2 уже в коде: ореол из малой копии кадра (`src/display/present.ts:390-394`), след прошлого кадра, медленные блики `glintSoft`, мягкий фон уровня как прецедент. Ореол до передач не доходит: у слоя передачи нет его настроек, а порог работает только у «кодированных» слоёв.
- Проба 18 октября в лаборатории, только значениями: 448 строк, без привязки вершин, глубина 6 с лёгким дизером, без зерна и строк. Кадр переходит от «плёнки» к «чистому 3D начала 2000-х», а вода от этого хуже: блики-клетки мельчают и резчают. Для слова «PS2» глазу не хватает пяти вещей: свечения солнца поверх силуэтов, проводов с весом, отражения столба и солнца, мягкости вывода и другой дорожки на воде.
- Цену пробы грубый замер на ноутбуке не различил: медиана 16,7 мс у обоих вариантов, упор в частоту экрана. Таймером видеокарты не мерили, телефон не мерили.
- Сложность. Шаг значений бесплатный и уже показывает направление. Минимальный прототип (флаг, ореол для слоя передачи, солнце-спрайт, замер) около дня. Полный вид (провода-ленты, отражение, свет, мягкость вывода) ещё 2–3 дня (оценка).
- Цена по оценке умеренная: 0,2–1 мс на ноутбуке. Главная статья расхода: видеопроход, который при 448 строках читает в 3,5 раза больше точек; отказ от расхождения цветов и короткого свечения в пользу ореола почти его окупает (оценка). Телефон неизвестен.
- Опыт можно запереть в одном месте: параметр `generation` со значением `'ps1'` по умолчанию и флаг `?ps2` в окне подсказки. Фон уровня, Endless и меню он не трогает.
- Слово владельца на пути сборки: «точно не текстурированное что-то, скорее генеративное… подумай как о 3д тех времён с вайбом playstation 2». Предложение в 7.2: всё, что на PS2 было текстурой, считается кодом при сборке карточки в малых размерах (градиент неба, облака, волны, дерево столба, корона солнца), как Jak рисовал океан и небо на приставке; композиция и модели текущие; оценка 4–5 дней; четыре вопроса владельцу перед спекой.
- Вода PS2 под низким солнцем по 28 просмотренным картинкам (раздел 10.1): цвет солнца заливает всю воду, дымка растворяет горизонт, узкой дорожки из бликов нет ни на одной; где блики есть, они рассыпаны по всей воде. Это противоположно сегодняшней дорожке передач VI.
- Референсы владельца (Boku no Natsuyasumi 2, GTA San Andreas, раздел 7.1) показали: их «PS2» держится на материале кадра, текстурах, многослойном небе, планах глубины и тёплом свете, а не на фильтре вывода. Boku это к тому же рисованные фоны с 3D-персонажами поверх. Для нашей плоскоцветной сцены это значит другую сборку сцены, а не флаг: путь «нарисованный фон и живые вещи» или путь «текстурированная сцена»; выбор за владельцем.
- Решение за владельцем: уместно ли окно подсказки в виде PS2 рядом с передачами в виде PS1, остаются ли поверх зерно и строки трубки программы, какая палитра. Отчёт даёт варианты словами.

## 2. Что отличало картинку PS2: железо и конвейер

### 2.1. Чип GS и векторные блоки: огромная заливка, никакой программы на точку

Графический чип GS работал на 147,456 МГц, имел 4 МБ встроенной памяти и три внутренние шины (1024 бита на запись, 1024 на чтение, 512 на чтение и запись), всего 48 ГБ/с: 38,4 ГБ/с к буферу кадра и 9,6 ГБ/с к текстурам ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer), [железо]). Шестнадцать конвейеров давали **2,4 млрд точек в секунду без текстуры и 1,2 млрд с одной текстурой**; растеризатор выдаёт 8 текстурированных точек за такт или 16 без текстуры ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)). Это пиковые числа из рекламы, настоящие игры брали меньше.

Что чип умел на точку: цвет RGBA, глубину, туман, координаты текстуры; заливку плоскую или по Гуро; проверки альфы, альфы приёмника, глубины и окна; смешение с кадром, дизер, ограничение цвета 0–255. Copetti подытоживает: «No fancy tweaking or shaders either» ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)). Смешение одно, жёсткое: `((A − B) × C >> 7) + D`, где A и B берут цвет источника, цвет кадра или ноль, C альфу источника, альфу кадра или константу, D цвет источника, кадра или ноль ([ps2tek](https://psi-rockin.github.io/ps2tek/), [железо]). Из этой одной формулы получаются сложение, прозрачность и вычитание; умножения нет ([Godbolt](https://xania.org/201003/swat-ps2-renderer), [разработчик]). Одна текстура на проход: эмуляторщик сравнивает этот смеситель с более сложным у N64 ([Themaister](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation), [эмулятор]). Зато у чипа два набора настроек, и одну и ту же геометрию можно отправить дважды с разными режимами: SWAT так рисовал текстуру и свет в отдельный буфер ([Godbolt](https://xania.org/201003/swat-ps2-renderer)). Буфер глубины 16, 24 или 32 бита; цвет 32 бита RGBA8 или 16 бит 5551; сглаживание рёбер ×2 только при сортировке треугольников ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer)).

Вершины чип не считал. Повороты, свет и туман на вершине делал процессор Emotion Engine (294,912 МГц, 6,2 GFLOPS) своими векторными блоками: VU0 с 4 КБ памяти данных и VU1 с 16 КБ; к чипу шина 1,2 ГБ/с ([Wikipedia: Emotion Engine](https://en.wikipedia.org/wiki/Emotion_Engine)). Свет поэтому был программой, которую пишет студия, а не встроенной функцией, и обычно считался по вершинам. Отсечение тоже писали сами; Godbolt вспоминает, что слишком далеко за экраном геометрия «would crash horribly» ([Godbolt](https://xania.org/201003/swat-ps2-renderer), [разработчик]).

### 2.2. Геометрия: перспектива и 1/16 точки

Координаты вершин у GS в формате 12.4, то есть с шагом 1/16 точки, с запасом около ±4 тысяч точек вокруг экрана ([Themaister](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation)). У PS1 координаты целые, без дробной части, отсюда скачки рёбер и дрожь ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)). Текстуры на PS2 перспективно правильные ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)). Тонкость: цвет вершин на PS2 перспективно не поправлялся ([Godbolt](https://xania.org/201003/swat-ps2-renderer)), поэтому на больших близких треугольниках градиент цвета слегка «плывёт» (вывод). Уровень детализации текстуры чип выбирал по Q, а не по производным; анизотропной фильтрации нет ([Themaister](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation)). Вывод: плоскость воды на PS2 быстро размывается к горизонту.

Бампа по точкам не было: в SWAT нет ни карт нормалей, ни объёмных текстур, потому что нет расчёта на точку ([Godbolt](https://xania.org/201003/swat-ps2-renderer)). Wikipedia при этом перечисляет Dot3 и сферические гармоники среди возможностей эпохи ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer)). Источники расходятся; вывод: Dot3 делали редкими многопроходными трюками, для вида его можно считать отсутствующим. Плотность моделей: колоссы SotC в среднем около 20 тысяч треугольников ([PlayStation LifeStyle](https://www.playstationlifestyle.net/2018/01/25/things-you-may-not-know-shadow-of-the-colossus-ps4-remake/), пресс-материал Sony к ремейку); персонажи Kingdom Hearts 1,5–3 тысячи ([Polycount](https://polycount.com/discussion/comment/872947), мнение).

### 2.3. Кадр и вывод: откуда мягкость

Размеры кадров: Final Fantasy X 512×416, Crash: Wrath of Cortex 640×448, Kingdom Hearts 512×447 ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)); Shadow of the Colossus 512×448, вдвое выше Ico с его 512×224 ([GBAtemp](https://gbatemp.net/blogs/tech-talks-shadow-of-the-colossus-all-3-versions-ps2-ps3-ps4-analysed-and-compared.14075/), вторичный источник). Источники расходятся о Gran Turismo 4: Copetti пишет 576×480 с выводом «960i», libretro пишет 640×540, растянутые множителями 3 и 2, «not true 1080» ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/), [libretro](https://www.libretro.com/?p=50686)). Ширина кадра кратна 64 ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)), диапазон от 256×224 до 2048×1024 ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer)).

Почему кадры такие: 4 МБ часто не хватало на полный 640×480 ([libretro](https://www.libretro.com/?p=50686)). Расчёт (вывод): 640×448 в 32 битах это 1,15 МБ; два таких кадра и 32-битная глубина около 3,4 МБ, остаётся около 0,6 МБ на текстуры, которые подгружались из основной памяти по ходу кадра. Поэтому игры брали ширину 512, 16-битный цвет или полукадры. При рисовании полукадрами кадр 640×240 или даже 512×224, вдвое меньше памяти и времени; ранние версии SDK умели только чересстрочный режим; пропущенный кадр сдвигает картинку на строку, и SSX 3, по рассказу, пропускал шаги симуляции, чтобы держать 60 ([libretro](https://www.libretro.com/?p=50686)). Игры с прогрессивной развёрткой иногда падали до 16 бит, «trading interlacing artifacts for more color banding» ([libretro](https://www.libretro.com/?p=50686)).

Схема вывода умеет смешивать два буфера и отдавать результат на экран или в память; игры так брали прошлый кадр для нового ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)). Эмулятор PCSX2 держит отдельное исправление для игр с полукадрами, которые ждут определённого сдвига строк; там названы Armored Core 3, Klonoa 2, Crash: Wrath of Cortex и другие, а Ico «responds poorly» к снятию сдвига ([PCSX2 PR #6106](https://github.com/PCSX2/pcsx2/pull/6106), [эмулятор]). Есть ли у GS собственный аппаратный фильтр против мерцания, не подтвердил ни один источник; форумный пост говорит, что фильтр появился в поздних наборах разработчика ([ResetEra 2023](https://www.resetera.com/threads/anyone-else-have-a-fondness-for-the-objectively-poor-image-quality-output-of-the-ps2.776270/), мнение). Два наблюдения из истории вывода, полезные для нас: журналы печатали один полукадр, поэтому на бумаге игры PS2 выглядели зубастее, чем на трубке; а размытие прошлым кадром, хорошее на трубке, сильно двоилось на ранних ЖК-экранах ([libretro](https://www.libretro.com/?p=50686)). Кабели меняли вид: композит мягкий, S-Video «a huge difference», компонент на трубке «sparkles» ([ResetEra 2023](https://www.resetera.com/threads/anyone-else-have-a-fondness-for-the-objectively-poor-image-quality-output-of-the-ps2.776270/), мнение).

Вывод: «мыло PS2» это не один эффект, а пять отдельных ручек: растяжение по ширине, смешение полукадров по вертикали, билинейные малые текстуры, проходы размытия и свечения, аналоговое кодирование.

### 2.4. Текстуры, прозрачность, тени

Текстуры в основном с палитрой: 4 бита сжимают в 6 раз, 8 бит в 3 раза против 24-битных ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer)); кэш палитры 1 КБ ([Themaister](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation)); сторона до 1024 ([ps2tek](https://psi-rockin.github.io/ps2tek/)). Фильтр обычный билинейный, есть мип-уровни и трилинейный ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)), и игра выбирала его сама на каждый вызов: в PCSX2 есть режим «Bilinear (PS2)», который слушается игры ([руководство по моддингу Persona 3 FES](https://persona-3-fes-modding-guide.readthedocs.io/en/latest/_sources/pcsx2setup.rst)). У PS1 для сравнения кэш текстур 2 КБ, только ближайшая точка и никаких мип-уровней ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)).

Прозрачность шла на полной скорости заливки, поэтому многослойность дешёвая. Игры постоянно читали тот кадр, в который рисуют: камуфляж MGS2 берёт свой кадр со сдвигом, Tales of the Abyss гоняет размытие туда-обратно, и вывод эмуляторщика: «Developers used blending and blur passes heavily» ([Themaister](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation)). Тени в SWAT: окружение заранее запечено, под персонажем чёрный круг, динамические тени отброшены как слишком дорогие без трафарета ([Godbolt](https://xania.org/201003/swat-ps2-renderer)). Godbolt пишет, что у PS2 не было «stencil or depth buffer support»; все остальные источники описывают буфер глубины ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer), [Copetti](https://www.copetti.org/writings/consoles/playstation-2/)). Вывод: он имел в виду, что глубину нельзя читать как карту теней, а трафарета нет вовсе.

### 2.5. PS1 и PS2 рядом

| Черта | PS1 | PS2 |
|---|---|---|
| Текстура на треугольнике | аффинная, «плывёт» ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)) | перспективно правильная ([Copetti](https://www.copetti.org/writings/consoles/playstation-2/)) |
| Точность вершин | целые точки, дрожь ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)) | 1/16 точки ([Themaister](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation)) |
| Видимость | нет буфера глубины, таблицы порядка, пересечения мерцают ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)) | глубина 16/24/32 бита ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer)) |
| Фильтр текстур | ближайшая точка, без мип-уровней | билинейный и трилинейный, мип-уровни |
| Видеопамять | 1 МБ ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)) | 4 МБ, 48 ГБ/с ([Wikipedia: GS](https://en.wikipedia.org/wiki/Graphics_Synthesizer)) |
| Цвет кадра | 16 бит с дизером ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)) | 32 бита или 16 бит 5551 |
| Кадр | например 512×240 у Spyro ([Copetti: PS1](https://www.copetti.org/writings/consoles/playstation/)) | 512–640 × 448, полукадром × 224 ([libretro](https://www.libretro.com/?p=50686)) |
| Свет | плоский или по Гуро | по Гуро, программа векторного блока |
| Прозрачность | ограниченная | дешёвая многопроходность, 1,2–2,4 млрд точек/с |

PS2 против Xbox и GameCube. Xbox брал до четырёх текстур за проход и смешивал их как угодно ([Godbolt](https://xania.org/201003/swat-ps2-renderer)), GameCube до восьми текстур в шестнадцати ступенях за проход ([AnandTech 2001](https://www.anandtech.com/show/858), слова Factor 5). PS2 брала заливкой и полосой памяти, отсюда её слои и размытия вместо сложных материалов; вывод: кадр читается как PS2, а не Xbox, когда в нём нет карт нормалей и бликов по точкам, а есть слои прозрачного и мягкий вывод.

## 3. Визуальный язык игр PS2

### 3.1. Черты, по которым узнают кадр

Сводка из обсуждений игроков и слов авторов (мнения помечены). Картинка мягкая и тусклая: «fuzzier, lower-res» против резкого Dreamcast, «slightly dim and blurry quality» ([ResetEra 2026](https://www.resetera.com/threads/what-do-you-consider-to-be-the-recognisable-visual-characteristics-of-the-dc-ps2-xb-gc.1497903/), мнение); у Xbox «a much softer picture» на стороне PS2 ([ResetEra 2023](https://www.resetera.com/threads/anyone-else-have-a-fondness-for-the-objectively-poor-image-quality-output-of-the-ps2.776270/), мнение). Свечение: Ico назван одной из первых игр со свечением ([Wikipedia: Ico](https://en.wikipedia.org/wiki/Ico), со ссылкой на 1UP); фанатская вики считает первой The Bouncer, где свечение будто бы прятало отсутствие сглаживания ([Codex Gamicus](https://gamicus.fandom.com/wiki/Light_Bloom), не проверено). Размытие в движении как наложение прошлого кадра: GTA, Enter the Matrix, MGS2 ([ResetEra 2026](https://www.resetera.com/threads/what-do-you-consider-to-be-the-recognisable-visual-characteristics-of-the-dc-ps2-xb-gc.1497903/), мнение). Свет по вершинам и запечённый в текстуры, без карт нормалей, которые игроки относят к Xbox (там же). Текстуры низкого и среднего разрешения, сглаженные, часто из фотографий (там же). Туман и дымка: Silent Hill 2, GTA San Andreas, SotC (там же). Отдельные модели для роликов (там же). Мерцание лесенок одни игроки ценят как «perpetual motion» ([ResetEra 2023](https://www.resetera.com/threads/anyone-else-have-a-fondness-for-the-objectively-poor-image-quality-output-of-the-ps2.776270/), мнение).

Зерно не общая черта PS2, а выбор отдельных игр. В Silent Hill 2 оно было «very present (voluntarily)», и порт на Xbox дал его выключить ([Flying Omelette](https://www.flyingomelette.com/reviews/xbox/silenthill2.html)); фанатский патч для ПК подгоняет шум под PS2 ([SH2 Enhancements](https://github.com/elishacloud/Silent-Hill-2-Enhancements)). Туман Silent Hill 3, по догадке арт-директора Masahiro Ito, держался на полупрозрачных слоях, которые тяжело дались порту на PS3 ([Wikipedia: Silent Hill HD Collection](https://en.wikipedia.org/wiki/Silent_Hill_HD_Collection)).

### 3.2. Что говорили авторы

Слова Ueda о белизне SotC, о море и тумане Ico и цитаты команды Silent Hill уже в [VI_PS2_Effects_Research.md](VI_PS2_Effects_Research.md); ниже только новое. Ueda описал свечение как «the vague glow of the sky» и то, как оно играет на колоссе перед игроком ([GlitterBerri, часть 3](https://glitterberri.com/extended-developer-interview/the-graphic-designers-tell-it-straight-3/), [разработчик]). Мастер эффектов Nakano говорил, что туман и свечение для него две отдельные ручки: многие игры держат слабый туман и слабое свечение, а он хотел попробовать «even less fog and more bloom»; эффекты упрощали, пока они не помещались на экран приставки, и часть команды сочла итог слишком тёмным (там же). Арт-директор FFX Yusuke Naora хотел довести до предела выразительность «света» и «цвета» ([Blue Aurochs](https://blueaurochs.substack.com/p/creators-salon-graphics-team-part-d50), перевод). Главный дизайнер FFX Tetsuya Takahashi требовал, чтобы на экране всегда двигался хотя бы один элемент; на острове Бесайд растения расставляли вручную тысячами полигонов и раскачивали программно (там же). Takayoshi Sato называл источниками Silent Hill 2 «Лестницу Иакова», Линча, Бэкона, Уайета и Рембрандта ([Silent Hill Memories](https://www.silenthillmemories.net/creators/interviews/2001.08.17_sato_ign_en.htm)).

Вывод для нашей сцены: у Team Ico туман и свечение регулируются отдельно, и SotC убавил туман ради свечения. Закат в духе PS2 может держаться ясным горизонтом и сильным свечением солнца и неба, а не стеной тумана. Правило FFX про постоянное движение у нас уже выполнено: провода дрожат, вода дышит.

### 3.3. Как о PS2 говорят сегодня

Эссеист Scanlines пишет, что PS2 «had the confidence to be unapologetically moody», и связывает вид с настроением Y2K, чёрно-синими палитрами и красной пустотой загрузочного экрана ([Scanlines' Journal](https://scanlines.substack.com/p/the-ps2s-foreboding-aesthetic), мнение). Рядом живёт противоположная линия: тропики, синее небо, «Beach Generation» с Бесайдом FFX ([ResetEra 2026](https://www.resetera.com/threads/what-do-you-consider-to-be-the-recognisable-visual-characteristics-of-the-dc-ps2-xb-gc.1497903/), мнение). Значит, **палитра это выбор, а не примета эпохи**. Современный инди-хоррор Hollowbody собирает «PS2» прежде всего дисциплиной ассетов (только диффузные текстуры из фотографий, мало полигонов, много тонированных ламп без теней) и «very heavy» цветокоррекцией ([80.lv](https://80.lv/articles/how-hollowbody-blends-silent-hill-inspirations-with-cyberpunk-horror)); при этом автор темы на ResetEra считает его мир и свет слишком продвинутыми, ближе к ранней Xbox 360 ([ResetEra 2026](https://www.resetera.com/threads/what-do-you-consider-to-be-the-recognisable-visual-characteristics-of-the-dc-ps2-xb-gc.1497903/), мнение).

### 3.4. «Мягкая PS2» против «хрусткой PS1»

| Черта | PS1 в глазах игроков | PS2 в глазах игроков |
|---|---|---|
| Геометрия | дрожит, «watery polygon jitter» ([Unity Discussions](https://discussions.unity.com/t/making-a-game-look-like-a-ps2-title/917427), мнение) | стоит; «PS1 but more rounded» ([ResetEra 2026](https://www.resetera.com/threads/what-do-you-consider-to-be-the-recognisable-visual-characteristics-of-the-dc-ps2-xb-gc.1497903/), мнение) |
| Текстуры | крупные квадраты, плывут | сглаженные, «goopy, smeary» (там же) |
| Свет | плоский | по вершинам, цветные лампы, запечённый |
| Свечение | нет | свечение неба, «ethereal» дымка SotC |
| Туман | прячет дальность (SH1) | выбор настроения; SH2 убавил туман SH1, но оставил ради напряжения ([GameSpot](https://gamespot.com/articles/silent-hill-2-impressions/1100-2662590/)) |
| Вывод | резкие 240 строк, видимый дизер | мягкий, тусклый, лесенки и мерцание полукадров |

Пары для сравнения с проверенными кадрами: Silent Hill 1 и 2, Metal Gear Solid и MGS2, Final Fantasy IX и X, Resident Evil 3 и Code: Veronica, Tomb Raider Chronicles и Angel of Darkness (ссылки в разделе 10).

Важно для VI: в части 5 [VI_Visual_Language.md](VI_Visual_Language.md) уже записано, чего из той эпохи не берём: «лесенки на рёбрах, мутные текстуры, бурую палитру, дрожание вершин PS1». Значит, «честные» лесенки без сглаживания не цель; PS2 для VI это мягкость, свечение и покой, а не дефекты.

## 4. Море, небо, солнце и даль на PS2

### 4.1. Океан Jak and Daxter: флипбук, текстура 128×128, два прохода [код]

Код Jak and Daxter (2001) декомпилирован проектом OpenGOAL, и он даёт единственные числа о море PS2. Открытое море отдельная система: комментарий в `ocean-h.gc` говорит, что «ocean» рисует бесконечную воду, но не реки ([OpenGOAL, ocean](https://github.com/open-goal/jak-project/tree/master/goal_src/jak1/engine/gfx/ocean)). Волна хранится как **флипбук из 64 кадров по 1024 байта**, всего 64 КБ; каждый кадр игра интерполирует между кадрами флипбука и строит вершины. Сетка высот **32 в ширину**, высота читается билинейно по четырём соседям (там же). Структура с частотой, амплитудой, скоростью и углом волны есть, но во время игры читаются готовые кадры; вывод: кадры собраны из суммы волн заранее.

Вода рисуется полосами по дальности: ближняя, средняя, переходная и дальняя; **дальний океан рисуется внутри прохода неба** с уровнями детализации 2, 4, 8 или 16 ([документация OpenGOAL](https://opengoal.dev/docs/source-docs/jak1/packages/engine/gfx/ocean/)). Каждый кадр игра рисует **текстуру океана 128×128** с мип-уровнями (порт на ПК: 32 полосы по 66 вершин, 8 мип-уровней) и выбирает её трилинейно ([OceanTexture.h](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/OceanTexture.h)). Ближняя и средняя вода идут **двумя проходами**: сетка с текстурой океана, затем та же сетка с картой окружения, сначала грубая, потом подробная поверх ([CommonOceanRenderer.cpp](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/CommonOceanRenderer.cpp)). При запуске воды игра пишет в регистр тумана **общий цвет тумана**, и у каждой вершины есть байт тумана (там же). Вывод для нас: вода и небо сходятся в одном цвете, потому что это один и тот же регистр.

### 4.2. Jak II: карта окружения 64×64 из неба и «дымки» [код]

В Jak II и Jak 3 вода отражает карту окружения **64×64**, которую игра каждый кадр рисует заново: очищает цветом неба, кладёт текстуры неба и облаков, затем полосы без текстуры, которые авторы порта называют эффектом «haze» ([OceanEnvmap.h](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/OceanEnvmap.h), [OceanEnvmap.cpp](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/OceanEnvmap.cpp)). Разработчики OpenGOAL говорят, что их версия «not 100% identical to PCSX2» ([OpenGOAL, Q2 2026](https://opengoal.dev/blog/progress-report-q2-2026/)). Попадает ли солнце в эту карту, не проверено; вывод: если попадает, на воде оно ляжет размытой полосой без всякого света по точкам.

### 4.3. Primal: параболическая карта и преломление [разработчик, только аннотация]

Andrew Ostler на SIGGRAPH 2003 показал море Primal: параболическую карту окружения, которую рисуют в реальном времени, и преломлённый вид подводной сцены ([SIGGRAPH history](https://history.siggraph.org/learning/the-primal-seas-water-on-playstation2)). Полный текст закрыт (ACM ответил 403), чисел нет.

### 4.4. Даль и свечение SotC [разработчик]

Схема свечения SotC (копия 64×64, прошлый кадр, растяжение) уже разобрана в [VI_PS2_Effects_Research.md](VI_PS2_Effects_Research.md). Новое здесь о дали. Авторы говорят, что рисуют дальние места «without cheating using distance fogging»: ландшафт в три яруса, ближний подробный кусками 100×100 м, средний упрощён в 30–100 раз кусками 600×600 м, а самый дальний, «Super Low», это картинка на далёком полигоне, которую обновляют настоящей отрисовкой, поэтому переход к среднему ярусу незаметен ([Making of SotC](https://lukasz.dk/files/making_of_sotc.pdf)). Дальний план и ближний сводятся по буферу глубины как по маске, и из этой маски растёт свечение, при котором даль «bleeding out from the shape of the foreground» (там же). Яркое небо в SotC «tends to become almost white», а выдержку ставят коробки сцены, по которым переход идёт плавно (там же). Озеро SotC фанаты считают не живым отражением, хотя оно убедительно ([GBAtemp](https://gbatemp.net/blogs/tech-talks-shadow-of-the-colossus-all-3-versions-ps2-ps3-ps4-analysed-and-compared.14075/), мнение); бассейн в Святилище правильно рисуется только при точном смешении кадра ([PCSX2 #12313](https://github.com/PCSX2/pcsx2/issues/12313), [эмулятор]).

### 4.5. Небо: градиент 32×32, два слоя облаков, восемь небес [код]

Небо Jak это **градиент 32×32** с билинейным фильтром на четырёх больших «крышах» из треугольников; облака **два слоя по 9 четырёхугольников** на одной текстуре 64×64, смешение сложением по альфе, у каждого слоя свой сдвиг, то есть своя скорость; ниже горизонта ещё четыре «базовых» треугольника ([OpenGOAL, sky](https://github.com/open-goal/jak-project/tree/master/goal_src/jak1/engine/gfx/sky)). У каждого уровня **8 небес**, и время суток смешивает их прямо в видеопамяти с весом-константой; свет ламп сцены тоже берётся из неба (там же). Солнце и луна в вышедшей игре это частицы-спрайты на орбите (там же). Вывод для нас: закат на PS2 это смешение готовых градиентов, а не формула, и цвет тумана берётся из нижней строки неба.

### 4.6. Солнце и вспышка: глубина, прочитанная процессором [эмулятор]

Запросов «видно ли» у PS2 не было. Kingdom Hearts II читала буфер глубины процессором, и только перевод глубины в формат GS при чтении «finally fixed the lens flare issue» в PCSX2 ([PCSX2, Q2 2016](https://pcsx2.net/blog/2016/q2-2016-progress-report/)). На PSP той же эпохи Wipeout Pure берёт квадрат 4×4 вокруг точки солнца через пиксель и считает ноль небом ([PPSSPP #15923](https://github.com/hrydgard/ppsspp/issues/15923)). В Burnout 3 ореол солнца отдельный слой от диска: при поломке эмуляции ореол светил сквозь стены, а без него оставался «a yellow circle in the sky» ([PCSX2 #883](https://github.com/PCSX2/pcsx2/issues/883)). Вывод: «солнце PS2» это диск плюс отдельный мягкий ореол, который гаснет за предметами.

### 4.7. Туман, привязанный к небу [железо, код]

Туман GS считается на вершине: у каждой вершины 8-битное F, итог `(F × цвет >> 8) + ((255 − F) × FOGCOL >> 8)`, и цвет тумана FOGCOL один на весь кадр ([ps2tek](https://psi-rockin.github.io/ps2tek/)). На грубой дальней сетке переход тумана поэтому грубый, ступенями по треугольникам (вывод). Jak пишет в FOGCOL общий цвет тумана при рисовании воды (раздел 4.1). Silent Hill 2, по словам моддеров, держит туман на текстуре 512×512, «which now also matches the PlayStation 2 version» ([SH2 Enhanced Edition](https://enhanced.townofsilenthill.com/SH2/config.htm), мнение).

### 4.8. Тонкие вещи: провода

Как игры PS2 рисовали провода, не нашлось ни в одном источнике. У GS есть примитивы «линия» и бит сглаживания AA1, поведение которого не описано ([ps2tek](https://psi-rockin.github.io/ps2tek/)). Вывод: провод на PS2 был либо линией в одну точку, зубастой и мерцающей в 480i, либо тонкой полосой с мягким краем в текстуре; свечение неба SotC объедает такие силуэты.

## 5. Как это воспроизводят сегодня

### 5.1. Что выключить, что оставить, что поменять

| Действие | Что | Основание |
|---|---|---|
| Выключить | привязку вершин, кривые текстуры, ближайшую точку, тяжёлый 15-битный дизер | дрожь «was not a common PS2 effect» ([Unity Discussions](https://discussions.unity.com/t/making-a-game-look-like-a-ps2-title/917427), мнение); Retro Shaders Pro относит привязку и кривые текстуры к PS1 ([Daniel Ilett](https://danielilett.com/2026-01-27-article-retro-1-5-1-update/)) |
| Оставить, приглушить | свет по вершинам, линейный туман, след прошлого кадра | железо (раздел 2) |
| Поменять | 240 строк на 448–480; цвет на 6 бит на канал с лёгким дизером или без него | кадры 448 строк (раздел 2.3); у Ilett 64 ступени ≈ 6 бит, PS1 это 5 бит = 32 ступени, и пакет добавляет сдвиг, чтобы округление вниз не темнило ([Daniel Ilett](https://danielilett.com/2026-01-27-article-retro-1-5-1-update/)) |
| Добавить | свечение из крошечной копии, мягкость вывода, тонкие вещи полосами | разделы 4.4, 4.8 |

Рецепт с форума Unity: текстуры до 256×256 и 256 цветов, свет по вершинам, запечённый свет на вершинах, расчёт в гамме ([Unity Discussions](https://discussions.unity.com/t/making-a-game-look-like-a-ps2-title/917427), мнение). Hollowbody добавляет к этому много ламп без теней и тяжёлую цветокоррекцию; о свечении, зерне и разрешении автор не говорит ([80.lv](https://80.lv/articles/how-hollowbody-blends-silent-hill-inspirations-with-cyberpunk-horror)). Вывод: инди «PS2-стиль» держится на правилах ассетов и цвете, эмуляция вывода идёт поверх как добавка.

### 5.2. Наборы и параметры

Retro Shaders Pro (Unity и Godot) делит эффекты по эпохам: привязка и кривые текстуры это PS1, обводка вывернутой оболочкой «more common on PS2»; предел разрешения текстуры делается выбором мип-уровня, `LOD = log2(исходный/предел)`; чересстрочность чередует строки каждый кадр, храня прошлый кадр, и Ilett называет её дешевле прогрессивной ([Daniel Ilett](https://danielilett.com/2026-01-27-article-retro-1-5-1-update/)). Ultimate PSX Retro Shader от Borz Blade имеет пресет «Clean PS2», но значения не опубликованы ([itch.io](https://borzblade.itch.io/psx-shader)). VNTG даёт чересстрочность и «pixel decay» ([GitHub](https://github.com/Colby-O2/VNTG)). Для Godot по тегу psx нашлись только PS1-шейдеры ([godotshaders](https://godotshaders.com/shader-tag/psx)).

Простейшая маска чересстрочности libretro (`interlacing.glsl`): параметры `percent` (яркость неактивного полукадра, по умолчанию 0), `enable_480i` (1), `top_field_first` (0); строка считается как `y = TextureSize.y × uv.y + FrameCount × enable_480i + top_field_first`, и если `mod(y, 2)` попадает на неактивный полукадр, цвет умножается на `percent` ([libretro glsl-shaders](https://raw.githubusercontent.com/libretro/glsl-shaders/master/misc/shaders/interlacing.glsl)). Каждый полукадр это другой миг времени, поэтому движущиеся рёбра дёргаются ([Blender manual](https://docs.blender.org/manual/en/2.79/render/blender_render/post_processing/fields.html)). Из режимов снятия чересстрочности смешение даёт размытие, «боб» качание, сплетение гребёнку ([форум PCSX2](https://forums.pcsx2.net/Thread-PCSX2-motion-handling?pid=252055), мнение); разработчик PCSX2 называет «боб» ближайшим к тому, что делает сама приставка ([PCSX2 #1717](https://github.com/PCSX2/pcsx2/issues/1717), по пересказу поиска). Для PCSX2 люди ставят CRT-шейдеры через ReShade, а не отдельные пресеты PS2 ([форум libretro](https://forums.libretro.com/t/crt-guest-advanced-hd-and-ntsc-for-reshade/41880/79)).

### 5.3. Цена в браузере и на телефоне

Мобильные видеокарты упираются в заливку: точки экрана × сложность × перерисовка ([Unity Manual](https://docs.unity3d.com/2017.3/Documentation/Manual/MobileOptimisation.html)); плиточные карты держат работу на кристалле, и главная ручка это то, что пишется в память ([Vulkan guide](https://docs.vulkan.org/guide/latest/tile_based_rendering_best_practices.html)). Слияние проходов свечения и тона в один на Mali-G76 дало 49 кадров против 41 ([Vulkanised 2023](https://dev.vulkan.org/user/pages/09.events/vulkanised-2023/vulkanised_2023_battle_tested_optimisations_for_mobile_v2.pdf)). `UnrealBloomPass` из three.js строит цепочку из 5 мип-уровней со своим размытием на каждом ([three.js docs](https://threejs.org/docs/pages/UnrealBloomPass.html)), а буферы половинной точности стали умолчанием компоновщика с r153 ([форум three.js](https://discourse.threejs.org/t/using-unrealbloompass-causes-shadow-acne/52790.md)); pmndrs/postprocessing сам сливает эффекты в один проход и по умолчанию держит 8-битные буферы ([README](https://github.com/pmndrs/postprocessing)). Измеренных миллисекунд на проход в WebGL для телефона не нашлось. Вывод: свечение PS2 из крошечной копии дешевле, чем `UnrealBloomPass`; дорого то, что идёт на полном разрешении экрана или в половинной точности.

### 5.4. Ловушки

Свечение с обратной связью разгоняется: если брать источник после того, как свечение уже добавлено, яркость копится от кадра к кадру; на железе SotC берёт кадр до свечения ([форум PCSX2](https://forums.pcsx2.net/Thread-Shadow-of-the-Colossus--4737?page=16), мнение). Игроки жалуются на пересвет SotC ([GameFAQs](https://gamefaqs.gamespot.com/boards/998181-the-ico-and-shadow-of-the-colossus-collection/60571808), только заголовок). Настройки полукадров и их смешения могут сложиться в неподвижные узоры ([форум libretro](https://forums.libretro.com/t/new-crt-shader-from-guest-crt-guest-advanced-updates/25444/4942)). Вывод: мерцание строк 30/60 Гц на телефоне прочтётся как рябь, особенно на линии горизонта; если чересстрочность вообще пробовать, то с неактивным полукадром не темнее половины и с вертикальным смягчением. Для VI действуют свои правила: не больше трёх вспышек в секунду и выключатель фонового движения ([VI_PS2_Effects_Research.md](VI_PS2_Effects_Research.md), «Современные стандарты»), при «меньше движения» послесвечения нет ([VI_Visual_Language.md](VI_Visual_Language.md), 7.2). Источников о вреде эмулированной чересстрочности для глаз не нашлось.

## 6. Наша сцена сегодня и что в ней от PS1

### 6.1. Из чего собрана сцена

«Море со столбом и красным солнцем» не картинка, а открытое место `sea` и вещи `pole` и `sun`, собранные из параметров. Окно подсказки берёт рецепт `sea_pole_sun` (`src/signal/hintFrame.ts:15`) и случайные палитры, свет, свечение 0,15–0,4, блики, наклон камеры, размер солнца, высоту и провис столба (`src/signal/hintFrame.ts:15-47`, `84-120`). Ценности подсказки ложатся поверх ценностей настроения только для имён, которые есть в параметрах сцены (`src/signal/card.ts:73-80`); контакт подсказки 0–0,25, то есть смесь `dream` и `sad` (`src/signal/hintFrame.ts:46`). Окно открывает `SignalPlayer.tell` (`src/signal/player.ts:188-199`), и пока оно открыто, поле и показания не рисуются ([спека окна подсказки](../superpowers/specs/2026-10-15-vi-hint-transmission-design.md), раздел 3.2).

Все передачи рисуются в один общий слой `signal` на 240 строк, без сглаживания и не «кодированный» (`src/signal/player.ts:134`). Тот же рецепт живёт в фоне уровня, в своём слое `level-scene` (`src/render/levelScene.ts:35-47`, `234`), который перерисовывается 30 раз в секунду. Значит, правка общих материалов меняет и подсказку, и фон уровня, и случайные передачи Endless.

Состав: море это веер 64 ряда × 40 столбцов (2665 вершин, 5120 треугольников) от 0,5 до 800 м, волны три синуса, которые процессор пересчитывает каждый кадр (`src/signal/places/open.ts:107-185`); небо стенка с цветом вершин (`open.ts:35-85`); одна лампа на 40° и общий свет (`open.ts:88-100`); солнце плоский круг из 20 сегментов без тумана и глубины (`src/signal/things/sky.ts:38-74`); столб из 11 коробок со светом, посчитанным процессором в цвет вершин (`src/signal/things/pole.ts:73-89`, `src/signal/surface.ts:106-132`); провода 16 штук по 16 отрезков линиями в одну точку (`pole.ts:92-162`). Всего около 5 вызовов и 5,4 тысячи треугольников, **текстур нет**. Вывод: геометрия ничего не стоит, цена сцены целиком в проходах слоя.

### 6.2. Какие черты PS1 здесь действуют

| Черта | Где | Видна в этой сцене? |
|---|---|---|
| Привязка вершин к сетке `snap` 240 | `src/display/ps1.ts:79-84`, параметр `src/signal/scene.ts:71-72` | да: столб и провода дрожат |
| Слой 240 строк | `src/signal/scene.ts:65-66`, размер `src/display/sizing.ts:34-39` | да |
| 5 бит цвета и дизер Байера 4×4 силой 1 | `src/signal/scene.ts:67-70`, шейдер `src/display/present.ts:33-38, 63-68` | да: ступени в закате |
| Зерно `noise` 0,15, 24 раза в секунду | `src/display/present.ts:206-222` | да |
| Строки `scanlines` 0,15 на шаге слоя | `src/display/present.ts:240-244` | да |
| Провода линиями в одну точку | `src/signal/things/pole.ts:118`; three.js не умеет толщину линий | да, при 240 строках с размытием они толще на вид |
| Кривые текстуры, ближайшая точка | `src/display/ps1.ts:103-105, 179-184` | нет: текстур в сцене нет |
| Растяжение слоя | `smooth: true`, билинейное (`src/signal/scene.ts:73-74`) | уже мягкое, не PS1 |
| Свет и туман по вершинам, блики, виньетка | `src/display/ps1.ts:86-101, 17-41, 139-166` | не зависят от эпохи |

Видеопроход (размытие 0,7, растяжение 1, расхождение цветов 0,6, короткое свечение с порогом 0,55) в точках слоя (`src/display/present.ts:111-150`) общий для всех эпох; при расхождении цветов и свечении он читает до 55 точек на точку слоя (`present.ts:77-78, 125-146`).

### 6.3. Что для PS2 уже есть и почему передачи этого не получают

Ореол из малой копии кадра сделан ровно в духе PS2: комментарий в коде говорит, что так светились приставки последних лет трубки (`src/display/present.ts:390-394`). Порог, уменьшение в 4 раза по стороне и четыре прохода размытия (`present.ts:267-320, 607-655`). Передачам он недоступен по двум причинам. У `signalLook` нет полей ореола (`src/signal/scene.ts:92-120`). А режим с порогом включается только у слоя `encoded && !topDown` (`src/display/present.ts:669-670`), слой передачи не кодированный (`src/signal/player.ts:134`), и это свойство задаётся при создании слоя и потом не меняется (`src/display/layer.ts:200, 231`). Сейчас ореол есть только у поля (`src/render/view.ts:1211-1217`).

След прошлого кадра есть у каждого слоя (`src/display/layer.ts:252-289`), но показывается только у слоёв без отдельной промежуточной картинки (`src/display/present.ts:575-577`); передачи идут через неё, поэтому следа на них не будет.

Прецедент: фон уровня уже снял с этой сцены зерно, привязку вершин и малую глубину цвета (`src/render/levelScene.ts:393-399`) и на высоком экране поднял строки до 400 с вдвое меньшим размытием (`levelScene.ts:400-405`). Причина была покой, а не PS2: владелец просил «плавнее, тягучее, вязче», и блики стали медленным светом `glintSoft`, после чего число точек, меняющихся скачком за кадр, упало с 617–1098 до 0 ([VI_World_Logic.md](VI_World_Logic.md), строка о фоне уровня). Это показывает, что шаг «прочь от PS1» на этой сцене уже однажды прошёл без поломок.

## 7. Проба 18 октября в лаборатории

**Как ставили.** Дев-сервер проекта (`vi-dev`, Vite) поднялся на порту 5186, потому что 5183 был занят, видимо, сервером другого чата. Страница `?lab=frame&place=sea&things=pole,sun` во встроенном браузере приложения, 1024×768 CSS-точек, плотность 1,5, холст 1536×1152. Значения ставились через `window.lab.values` и `lab.touch()`, так же, как это делают ползунки лаборатории. Код не менялся, всё сделано существующими параметрами `LOOK_PARAMS` из `src/signal/scene.ts`.

**Что ставили.** Исходное, как открывается лаборатория (настроение `dream`, вариант `a`, зерно 1): `snap` 240, `lines` 240, `depth` 5, `dither` 1, `noise` 0,15, `scanlines` 0,15, `chroma` 0,6, `blur` 0,7, `smear` 1, `glow` 0,35, `vignette` 0,05, `glint` 0,35, `glintSoft` 0, `glintSpeed` 5. «Значения PS2»: `snap` 0, `lines` 448, `depth` 6, `dither` 0,35, `noise` 0, `scanlines` 0, `chroma` 0,2, `blur` 0,35, `smear` 0,5 (размытие и растяжение вдвое меньше, потому что они в точках слоя, а строк стало в 1,87 раза больше), `glintSoft` 1, `glintSpeed` 1,5. Для пары «закат» обоим вариантам поставили одинаковые цвета: верх неба #5a4f7a, горизонт #f2a765, море #7a5f63, высота солнца 4, размер 4,2, цвет бликов #ffd9a8, `glint` 0,5, `glow` 0,6, `vignette` 0,15, `fogFar` 200.

**Поправка по слову владельца (18 октября, вечер).** Закатная пара `03`/`04` раскрашена координатором (тёмное море #7a5f63, тёплое небо, низкое солнце) и **сценой игры не является**: владелец указал, что настоящая сцена другая, «очень красное солнце при очень светлом цвете всего». Пара пересняты честно, без смены цветов, только «значениями эпохи», в двух настоящих окрасках: как передача `sea_pole` открывается в лаборатории (бледное небо #f2f0ea, вода #cfd8dc, красное солнце #d8261a) и в палитре окна подсказки (`HINT_SCENE.palettes[0]` в `src/signal/hintFrame.ts`: небо #2a0606 → #b8321c, вода #1a0c0c, блики #ffb08a, `glint` 0,45, `glintWidth` 15, `glintSize` 0,17, `lightAmount` 0,3, `glow` 0,3). Блики во второй серии не трогали (`glintSoft` 0, `glintSpeed` 5 как в игре), чтобы увидеть, что с водой делают одни значения эпохи.

**Снимки** (800×600, уменьшенные с панели 1024×768) лежат в чате, в папке `scratchpad/probe/` этой сессии, **а не в репозитории**: честные пары `05-pale-ps1-240.jpg` / `06-pale-ps2values-448.jpg` (бледная передача) и `07-hintpalette-ps1-240.jpg` / `08-hintpalette-ps2values-448.jpg` (палитра окна подсказки); первые снимки `01` (исходное) и `02` (значения PS2) совпадают с парой 05/06; `03`, `03b`, `04`, `04b` это закат в раскраске координатора, не сцена игры, годятся только как иллюстрация дрожи и зерна.

**Что увидел глаз** (наблюдения координатора и сверка по снимкам, не замеры):

- Самая большая перемена от пары «448 строк и без привязки». Столб перестаёт дрожать, градиент неба становится ровным (глубина 6 с дизером 0,35 полос в закате на этом размере не даёт), зерно и строки пропадают. Кадр читается как «чистое мягкое 3D», а не «плёнка».
- Провода при 448 строках становятся волосками: это линии в одну точку, и на более частом слое они тоньше на экране. При 240 строках слой и размытие делали их толще. Это противоположно PS2, где тонкое было зубастым, но смягчалось выводом. Нужны полосы с мягким краем.
- Солнце в обоих вариантах плоский диск с жёстким краем; на крупном снимке PS2 по краю видна лесенка. `glow` 0,6 чуть смягчает весь кадр, но ореола, который заходил бы на силуэт столба, нет.
- Блики при 448 строках и `glintSoft` 1 мельче и медленнее и в движении читаются как солнечная дорожка; при значениях PS1 это крупные мигающие клетки, то есть вид передачи. На неподвижном снимке видно, что и при 448 строках блики остаются прямоугольными клетками, только меньше: они считаются клетками в пространстве взгляда (`src/display/ps1.ts:17-41`), и смена эпохи их форму не меняет.
- **Вода на честных парах не стала «как PS2».** В бледной передаче при 448 строках блики превращаются в мелкие белые ползущие точки на белёсой воде; в палитре окна подсказки дорожка под солнцем становится плотным полем мелких жёстких чёрточек, которое читается как шум, а не как вода. При 240 строках размытие и дизер связывали те же клетки в мягкую дорожку. Причина та же: блик это клетка в пространстве взгляда, которая горит или не горит (`src/display/ps1.ts:17-41`, `PS1_GLINT`), и чем больше строк, тем мельче и резче клетки. Значит, вода PS2-варианта это не настройка, а отдельная работа: либо медленный свет `glintSoft` с крупной клеткой (уже есть, цена нулевая, но вид другой и его выбирает владелец), либо дорожка солнца как в Jak (раздел 4.1: карта окружения из неба и полосы дымки на втором проходе воды). В таблице 8.1 строка «Вода у горизонта» этого не покрывает; добавлена строка ниже.
- Туман у горизонта при `fogFar` 200 даёт мягкую полосу цвета неба. Это близко к тому, как Jak связывает туман воды с небом (раздел 4.1); работы здесь не нужно.
- Чистый кадр открывает геометрию: ряды волн у горизонта видны как прямые полосы бликов, изоляторы на траверсе читаются как несколько коробок. При значениях PS1 это прятали размытие и дизер. PS2-вариант потребует либо более плотной воды у горизонта, либо свечения и мягкости, которые снова это спрячут.
- Итог: одни значения PS2 переводят кадр из «передачи на кассете» в «чистое 3D начала 2000-х». Чтобы глаз сказал «PS2», не хватает четырёх вещей: свечения солнца и яркого неба поверх силуэтов, проводов с весом, отражения столба и солнца в воде, мягкости вывода (вертикальное смягчение или очень лёгкое смешение строк), чтобы картинка не была резкой, как у современной отрисовки.

**Цена.** Цикл `requestAnimationFrame` по 300 кадров, по три чередующихся прогона каждого варианта, в панели на холсте 1536×1152, на ноутбуке владельца со встроенной AMD. Медиана **16,7 мс у обоих вариантов** в устойчивых прогонах (25 мс в первом прогоне каждого, пока панель устанавливалась). Числа упираются в частоту экрана. Таймера видеокарты не было: в коде его нет, а метод проекта это `EXT_disjoint_timer_query_webgl2` с парными чередующимися вариантами. Вывод: на этом размере ни один вариант не упирается в процессор, а разницу видеокарты такой замер показать не может. О телефоне он ничего не говорит. Панель предпросмотра Claude к тому же снимает сглаживание ([спека воды](../superpowers/specs/2026-10-13-vi-water-backdrop-probe.md), раздел 5), так что настоящий замер нужен в отдельном Chrome или с `?auto=off`.

### 7.1. Референсы владельца: другой подход, а не фильтр

Вечером 18 октября владелец принёс два кадра PS2 и сказал о пробе значениями: «ну это же разительно иной подход». Кадры: закатная улица из **Boku no Natsuyasumi 2** (Millennium Kitchen, Sony, 2002: автомат с напитками, столб с табличкой «あさひ 2-1», качели, деревья, дома до холмов, оранжево-лиловое небо с облаками) и прибрежная дорога в сумерках из **GTA San Andreas** (Rockstar North, 2004: три столба с проводами, уходящие вдаль, чайки, фонари, машины, тёмное море и лиловое небо). Сами кадры в репозиторий не кладём (чужие снимки), они в чате.

Что это за кадры по устройству. Boku no Natsuyasumi 2, как и первая часть, это **трёхмерные персонажи поверх заранее отрисованных рисованных фонов** (серия: фоны студии Kusanagi, персонажи Mineko Ueda, [Wikipedia](https://en.wikipedia.org/wiki/Boku_no_Natsuyasumi); о второй части рецензенты пишут то же: «3D character models against pre-rendered, hand-painted 2D backgrounds», [gamecritics](https://gamecritics.com/guest-critic/3627/), пресса). То есть небо, облака, холмы, дома и свет на асфальте там **картина**, а не отрисовка в реальном времени; PS2 в этом кадре даёт мягкость растянутого малого кадра и Гуро-свет на мальчике. GTA San Andreas отрисован в реальном времени: небо из файла `timecyc` с отдельными цветами верха и низа, ядра и короны солнца, дальностью прорисовки и началом тумана по часу и погоде ([Grand Theft Wiki: TimeCyc](https://www.grandtheftwiki.com/TimeCyc_Definition)); версия PS2 известна «rich, warm orange glow», который потом приглушали ([libertycity, набор timecyc PS2](https://libertycity.net/files/gta-san-andreas/216030-timecyc.dat-and-seabed.ipl-from-ps2-version.html), мнение); тёплая дымка заодно прячет недогруженную геометрию (пересказ видео, [sozai](https://sozai.app/transcript/gta-san-andreas-ps2-limits/), пресса). Разбора света по вершинам и тумана PS2-сборки в источниках нет.

Чем оба кадра устроены иначе, чем наша сцена (вывод по кадрам):

| Слой кадра | У владельца в референсах | В нашей сцене сейчас |
|---|---|---|
| Поверхности | текстуры везде: дерево столба, асфальт, стены, трава; на PS2 билинейно размытые, детали несёт текстура, а не геометрия | текстур нет, все поверхности плоские цвета (`src/signal/places/open.ts`, `things/pole.ts`) |
| Небо | многополосный градиент с облаками и дымкой у горизонта; солнце с короной (GTA: отдельные цвета ядра и короны) | два цвета, верх и горизонт (`skyGeometry`), солнце плоский диск |
| Глубина | 3–5 планов: предмет у камеры, средний план, силуэты холмов и деревьев, горизонт; воздушная перспектива | один предмет и горизонт |
| Свет | тёплый ключевой свет окрашивает всё, длинные тени, запечённый или нарисованный свет | одна лампа по вершинам силой 0,5 на плоских цветах |
| Опора и масштаб | земля или дорога уходит от ног к горизонту, предметы рядом с камерой | камера висит над водой, земли нет |
| Насыщенность мира | обжитое: автомат, табличка, качели, трансформатор на столбе, машины, чайки | намеренно пусто (пустота это принцип передач, [VI_Visual_Language.md](VI_Visual_Language.md), часть 6) |
| Провода | тёмные полосы с провисом, сходятся к точке схода, несут глубину | линии в одну точку (`pole.ts:118`) |
| Вывод | мягкий, без строк и зерна | 240 строк, строки развёртки, зерно, дизер |

Вывод из таблицы. «Стиль PS2» в этих кадрах держится не на фильтре вывода, а на **материале кадра**: текстурах, многослойном небе, планах глубины и тёплом свете. Наша сцена построена наоборот: плоские цвета и минимум геометрии, которые вид PS1 (дрожь, дизер, зерно, размытие) делает читаемыми как «передача». Сними вид PS1, и остаётся не PS2, а пустая векторная картинка; проба 18 октября это и показала. Значит, PS2-вариант сцены это **другая сборка сцены**, и значения, ореол и провода из таблицы 8.1 здесь лишь часть.

Два пути сборки, словами, на выбор владельца (вид ведёт он; агент только называет пути):

- **Путь Boku: нарисованный фон и живые вещи поверх.** Задник сцены (море, небо, облака, дымка, дальний берег) это одна картина, нарисованная или собранная владельцем или по его образцу, в размере около 512×448, растянутая билинейно; поверх в реальном времени стоят столб с проводами, солнце и блики воды, то есть всё, что должно двигаться («хотя бы один движущийся элемент на экране», FFX, раздел 3.2). Для окна подсказки с разным светом и цветом нужны либо несколько картин (день, закат, ночь), либо одна картина с подкраской через цвет вершин. Цена для видеокарты почти нулевая: один текстурированный четырёхугольник. Это самый большой сдвиг картинки за самую малую цену, но картину кто-то должен нарисовать, и это слово владельца.
- **Путь GTA: текстурированная сцена в реальном времени.** Столб с текстурой дерева и трансформатором, вода из прокручиваемой тайловой текстуры со вторым проходом отражения неба и дорожкой солнца (как Jak, разделы 4.1–4.2), небо из малой полосовой текстуры градиента с полосой дымки (как Jak, 32×32, раздел 4.5), солнце ядром и короной, 2–3 дальних столба и тёмный силуэт берега для глубины, туман цвета неба. Текстуры малые (64–256), билинейные, с мип-уровнями; откуда они берутся (рисует владелец, процедурные, фото), решает владелец. Цена невелика (сцена всё ещё крошечная), работы больше: оценка 3–5 дней сверх таблицы 8.1.

Общее для обоих путей и уже в коде: материал умеет текстуру (`PS1_MAP` в `src/display/ps1.ts`, пока с фильтром «ближайшая точка», для PS2 нужны билинейность и мип-уровни), туман, свет по вершинам; небо как геометрия легко берёт текстуру вместо двух цветов. Пустота передач как принцип при этом не отменяется сама собой: кадры владельца обжитые, а нужна ли обжитость сюжетным сценам VI, вопрос к нему, не к технике.

### 7.2. Путь владельца: генеративная сцена «3D тех времён»

Слово владельца на два пути из 7.1: «точно не текстурированное что-то, скорее генеративное. не смотри на текущий визуал, из текущего можно взять композицию и модели, подумай как о 3д тех времён с вайбом playstation 2». Ниже предложение словами, для его правки; вид выбирает он.

**Принцип.** На PS2 детали нёс не полигон, а малая текстура и дешёвые проходы поверх (раздел 2). «Генеративно» значит: всё, что там было текстурой, у нас считается кодом при сборке карточки с её сидом (`context.stream`, как уже делают волны и провода), в малых размерах 32–128 точек, билинейно и с мип-уровнями, а не нарисовано и не загружено. Это не натяжка под PS2, а её родной способ: Jak and Daxter рисовал текстуру океана 128×128 и карту окружения 64×64 прямо на приставке каждый кадр, небо собирал из градиента 32×32 и облаков 64×64, смешивая до восьми небес по часу (разделы 4.1, 4.2, 4.5). В коде уже есть генератор текстур на холсте (`canvasTexture` в `src/render/textures.ts`) и материал с текстурой (`PS1_MAP`, `src/display/ps1.ts`); для PS2 материалу нужны билинейность, мип-уровни, перспективные координаты, цвет по вершинам и второй слой координат с прокруткой.

**Сцена слоями, от дальнего к ближнему.**

| Слой | Как на PS2 | Что генерируем | Что берём из текущей сцены |
|---|---|---|---|
| Кадр и вывод | 512×448, растянуто билинейно, 16 бит с лёгким дизером, свечение из копии 64×64 | слой 448 строк, дизер 0,3, ореол с порогом, без строк и зерна (по желанию очень лёгкое смешение строк) | слой передачи, проход `present.ts` |
| Небо | полосовой градиент текстурой, облака двумя слоями, цвета по часу | текстура градиента 8×64 из 4–6 остановок (верх, зенитная полоса, горизонт, полоса дымки у самой воды); один-два слоя облаков из тайлового шума 64×64 с альфой, дрейф в разные стороны; набор остановок по часу или палитре карточки | стена `skyGeometry` (`open.ts`), палитры `HINT_SCENE` |
| Солнце | диск плюс корона спрайтом, аддитивно; цвет ядра и короны врозь (GTA `timecyc`) | диск как сейчас; корона: радиальная текстура 64×64 с мягким спадом, аддитивно, переярка до ×2, питает ореол; цвет короны подмешан в полосу неба вокруг солнца и в воду под ним | вещь `sun` (`things/sky.ts`), положение из композиции карточки |
| Вода | плоскость до горизонта цвета неба; текстура волн прокруткой, второй проход отражения неба; туман в цвет неба (Jak) | цвет по вершинам: у горизонта цвет полосы дымки, к камере темнее и холоднее; текстура волн из тайлового шума 64×64 или 128×128, два слоя разного масштаба и направления, второй слой умножением; блики не клетками, а третьей маской шума, мягкой, сильнее к солнцу и у горизонта, рассыпанной по всей воде (как Wave Rally, 10.1) или без бликов (как GTA, 10.1); туман к цвету горизонта, чтобы линия растворилась; по желанию отражение столба зеркальной копией с затуханием книзу | веер `groundFan` с волнами по вершинам (`open.ts:107-185`), `glintSoft` как запасной путь |
| Столб и провода | текстура дерева, свет по вершинам запечён, провода тёмными полосами | дерево: вертикальные полосы шума 32×128 с лёгкой неровностью, билинейно; свет по вершинам считается один раз при сборке: тёплый ключ от солнца, холодное заполнение от верха неба, тёплый отскок от воды снизу; провода лентами 1,5–2 точки слоя с мягким краем; изоляторы остаются коробками, так делала и PS2 | модель `pole` целиком (`things/pole.ts`), её провода и дрожь |
| Глубина | 3–5 планов, дымка | полоса дымки у горизонта (туман плюс полупрозрачная полоса на небе); дальше по слову владельца: второй и третий столб вдаль по линии проводов, тёмный силуэт берега | композиция карточки (`hintComposition`) |
| Движение | «хотя бы один движущийся элемент» | облака дрейфуют, волны идут, провода дрожат, солнце пульсирует, камера дрейфует | всё уже есть |

**Чего не делаем**, по списку «не берём» части 5 [VI_Visual_Language.md](VI_Visual_Language.md): лесенок на рёбрах (мягкий вывод или сглаживание на слое), мутных текстур ради мутности (шум мелкий и чистый, размытие только билинейное), бурой палитры (палитры задаёт владелец), дрожи вершин.

**Цена.** Текстуры считаются один раз при сборке карточки на холсте: миллисекунды процессора, не каждый кадр. Видеокарта: сцена остаётся крошечной (около 5 вызовов рисования), добавляются вторая текстура на точку воды, корона и ореол; класс по-прежнему умеренный, 0,2–1 мс на ноутбуке (оценка по 8.1), телефон не мерили. **Работа** (оценка): материал PS2 с двумя слоями координат и цветом по вершинам 1 день; генераторы шума, градиента, дерева, короны 1 день; небо, вода и свет сцены 1–2 дня; провода-ленты, ореол, флаг, замер 1 день; итого 4–5 дней без кругов показа владельцу.

**Вопросы к владельцу перед спекой.** 1) Дальние столбы по линии проводов и силуэт берега, или пустота, как у передач. 2) Блики на воде рассыпанные мягкие или вовсе без бликов, только залитая цветом вода. 3) Палитры: тёплая линия Boku и GTA (оранжевый и лиловый), тёмно-красная линия окна подсказки, или обе по часу. 4) Поверх PS2-картинки ничего от трубки (строк, зерна) по умолчанию нет; так ли.

## 8. Как собрать PS2-вариант сцены

### 8.1. Черта за чертой

Часы и классы цены это оценки по коду и по прошлым замерам проекта: вода +0,39–0,64 мс на 1920×1080 и +0,21–0,24 мс на 540×960 ([спека воды](../superpowers/specs/2026-10-13-vi-water-backdrop-probe.md), 7.1); ореол поля +0,6–1,0 мс на холсте 562×1218 ([VI_Visual_Language.md](VI_Visual_Language.md), 7.3); фон уровня 120 → 105–112 кадров на 2565×1401 ([VI_World_Logic.md](VI_World_Logic.md)). «Дёшево» значит меньше 0,2 мс, «умеренно» 0,2–1 мс.

| Черта | Что сделать | Файлы | Часы | Цена: телефон 540×960 / ноутбук 1920×1080 | Риск |
|---|---|---|---|---|---|
| Значения эпохи | `snap` 0, `lines` 448, `depth` 6, `dither` 0,35, `noise` 0, `scanlines` 0, `chroma` 0,2 или 0, `glow` 0, `blur`/`smear` пересчитать под строки | `src/signal/scene.ts:64-89`, `src/signal/hintFrame.ts` | 0,5–1 | видеопроход читает в 3,5 раза больше точек: дёшево–умеренно / умеренно | композиция подсказки настроена на 240 строк (`hintFrame.ts:62-73`); на портрете 360×640 слой около 280×448 |
| Свечение солнца и неба | ореол с порогом для слоя передачи: порог читает картинку после цвета и дизера, или отдельный кодированный слой; поля `halo`, `haloThreshold`, `haloReach`, `haloOver` с умолчанием 0; уменьшение меньше постоянного `BRIGHT_SHRINK = 4` | `src/display/present.ts:315, 517-531, 669-670`, `src/signal/scene.ts:92-120` | 2–4 | умеренно (переключения целей) / дёшево–умеренно | дизер до свечения может дать ползающие края; встать в очередь регулятора качества; брать источник до свечения, иначе разгон |
| Солнце | аддитивный спрайт: горячее ядро, мягкий спад, переярка ×1,5–2, питает свечение; столб режет его силуэтом | `src/signal/things/sky.ts:38-74` (и пути `flare`, `live.sun`) | 1–2 | дёшево / дёшево | вещь `sun` общая с фоном уровня и `glare_sun`; только за флагом |
| Провода с весом | ленты 1,5–2 точки слоя с мягким краем: `LineSegments2` или свои четырёхугольники в материале проекта с туманом | `src/signal/things/pole.ts:92-162` | 3–5 | дёшево / дёшево (около 512 треугольников) | `pole` общий с фоном и Endless; у `LineMaterial` нет тумана и привязки проекта |
| Отражение столба и солнца | (а) зеркальная копия столба и вытянутый «столб» солнца под горизонтом, вода чуть прозрачна; (б) зеркальная камера в цель 1/4 стороны, вода берёт её со смещением по нормалям волн | `src/signal/compose.ts`, `src/signal/places/open.ts:160-185`, `src/display/ps1.ts:167`, образец `src/render/water.ts:625-660` | (а) 2–3; (б) 4–8 | (а) дёшево; (б) дёшево–умеренно / дёшево | материал воды общий для открытых мест; по слову владельца о воде поля отражения тусклые и уходят в темноту |
| Мягкость вывода | вертикальное смягчение строк в `soft()` (новая ручка, умолчание 0); при желании строки трубки с шагом около 240 поверх 448 | `src/display/present.ts:127`, `src/signal/scene.ts:106-120` | 1–1,5 | дёшево / дёшево | общий видеошейдер; при 0 остальные слои не меняются; муар, если шаг около 2 точек экрана |
| Свет | 2–3 лампы по Гуро: ключ от солнца, тёплый контур на столбе, холодная подсветка от верха неба | `src/signal/places/open.ts:241`, `src/signal/surface.ts:106-149` | 1–2 | дёшево / дёшево | меняет все открытые места, если не за флагом |
| Вода у горизонта | плотнее сетка дальних рядов, чтобы ряды бликов не читались полосами | `src/signal/places/open.ts:9-14, 107-158` | в заметках не оценено | дёшево (оценка: геометрия) | общий веер для всех открытых мест |
| Вода: дорожка солнца | вместо клеток взгляда: (а) `glintSoft` с крупной клеткой и медленной сменой; (б) второй проход воды с картой окружения из неба и полосы дымки, как в Jak II, яркость по углу к солнцу | `src/display/ps1.ts:17-41, 118-160`, `src/signal/places/open.ts:160-185` | (а) 0,5; (б) 4–6 | (а) дёшево; (б) дёшево–умеренно (вторая текстура на точку воды) / дёшево | материал воды общий для открытых мест и фона уровня; вид дорожки выбирает владелец |
| Сглаживание | ×2–4 на отдельном слое PS2 | `src/display/layer.ts:80-81, 351-357` | 0,5 + слой | дёшево–умеренно / дёшево–умеренно | `setSamples` пересоздаёт цель: переключать на каждое окно, не на кадр |
| След | слабое послесвечение бликов и проводов | `src/display/present.ts:575-577` | 2–3 | дёшево / дёшево | общий проход экрана; сцена медленная, польза мала |
| Текстуры | перспективные координаты, мип-уровни | `src/display/ps1.ts:103-105, 179-184` | 1–2 | дёшево | **в этой сцене не нужно**: текстур нет |

### 8.2. Как запереть опыт в одном месте

1. В `LOOK_PARAMS` (`src/signal/scene.ts`) завести `generation: choice('ps1', 'ps2')` с умолчанием `'ps1'`. Параметр появится во всех местах (`open.ts:361`, `room.ts:234`, `corridor.ts:242`, `roof.ts:117`) и в лаборатории сам (`src/lab/panel.ts:113-119`), но по умолчанию ничего не меняет; `blendValues` переключает выбор на середине смешения, так что смешение настроений безопасно (`scene.ts:194-196`).
2. `open.ts`, `pole.ts` и `sky.ts` читают его и выбирают PS2-варианты геометрии и материала.
3. `signalLook` переводит `'ps2'` в поля ореола (или ореол получает свои явные параметры).
4. `hintCard` ставит PS2-набор значений только при флаге `?ps2` в адресе, по образцу `?hint=chain` (`src/app/hint.ts:49`) и флагов `quality.ts` (`src/display/quality.ts:52-66`). Сохранения он не трогает.
5. Если нужны кодированный слой или сглаживание, а они задаются только при создании слоя (`src/display/layer.ts:200, 230-231`), плеер заводит второй слой `signal-ps2` и выбирает его по карточке.
6. Тест `src/signal/scene.test.ts:171-184` сравнивает выход `signalLook({})` целиком через `toEqual`: новые поля требуют его правки (умолчания 0 сохраняют поведение). Не проверено, сравнивают ли тесты `hintCard` объекты значений целиком.
7. Фон уровня `generation` не ставит и остаётся как есть; меню эти сцены не использует. Новый элемент вида получает строку в [VI_World_Logic.md](VI_World_Logic.md) в том же коммите.

### 8.3. Как мерить

Метод проекта ([спека воды](../superpowers/specs/2026-10-13-vi-water-backdrop-probe.md), раздел 5 и 7.1): видеокарта через `EXT_disjoint_timer_query_webgl2`, 4 кадра на запрос, 40 кругов, варианты чередуются, медианы парных разностей; процессор через CDP в отдельном Chrome, троттлинг ×4, холст 540×960, 300 кадров, медиана и p95. Не в панели предпросмотра Claude; в отдельном Chrome или с `?auto=off`. Где: окно подсказки `?hint=chain&auto=off` (настоящий путь, поле не рисуется) и лаборатория `?lab=frame&place=sea&things=pole,sun&ui=0`. Варианты парами против A: A сегодняшний PS1; B только значения; C = B + ореол; D = C + солнце-спрайт + провода-ленты; E = D + отражение. Холсты 1920×1080 и 540×960. Порог (оценка по аналогии с водой): весь прирост PS2 не больше 1 мс на 1920×1080 и 0,5 мс на 540×960. Телефон мерить на телефоне: пути замера на устройстве в документах нет.

### 8.4. Объём: минимум и полный

**Шаг 0, без кода (0,5–1 ч).** Сделан пробой 18 октября; осталось снять оба размера 360×640 и 1920×1080 для владельца.

**Шаг 1, минимальный прототип (около дня, 6–9 ч, оценка).** Параметр и флаг `?ps2` (2–3 ч), ореол для слоя передачи (2–4 ч), солнце-спрайт (1–2 ч), замер A/B/C/D (1–2 ч). Файлы: `src/signal/scene.ts`, `src/signal/hintFrame.ts` или `player.ts`, `src/display/present.ts`, `src/signal/things/sky.ts`, `src/signal/scene.test.ts`, строка в [VI_World_Logic.md](VI_World_Logic.md). Даёт: нет дрожи, тонкий градиент, солнце со свечением, которое заходит на столб.

**Шаг 2, полный вид (ещё 2–3 дня, оценка).** Провода-ленты (3–5 ч), отражение: копия (2–3 ч) или зеркало (4–8 ч), свет 2–3 лампами (1–2 ч), мягкость вывода (1–1,5 ч), плотнее вода у горизонта, по желанию след (2–3 ч) и таблица настроений PS2 (1–2 ч), замеры и круги показа владельцу.

## 9. Насколько это сложно и ресурсоёмко: вывод

Шаг значений бесплатный и уже показывает направление. Пробой 18 октября кадр без единой строки кода ушёл от «передачи на кассете» к «чистому 3D начала 2000-х»: столб стоит, небо ровное, нет зерна и строк. Но это ещё не PS2, а скорее «просто чистая картинка». Ровно то, что по разделу 2 отличает PS2 от сегодняшней отрисовки (мягкий вывод, свечение из малой копии, слои), значения дать не могут.

Настоящее чтение «PS2» держится на четырёх кусках, и каждый требует кода: свечение, доведённое до слоя передачи; провода лентами, чтобы они не превращались в волоски; отражение столба и солнца в воде; мягкость вывода. Ни один не трудный: ореол уже написан для поля, зеркало уже написано для воды под полем, материал проекта уже считает туман и свет. Трудность в другом: сцена общая для подсказки, фона уровня и Endless, поэтому всё нужно за флагом и с правкой тестов. Оценка: **около дня на минимальный прототип и ещё 2–3 дня на полный вид**.

По видеокарте это **умеренный класс**: по оценке 0,2–1 мс на ноутбуке. Сцена геометрически крошечная; цена в том, что видеопроход при 448 строках читает в 3,5 раза больше точек, и в лишних переключениях целей для ореола и отражения. Отказ от расхождения цветов (тройное размытие) и короткого свечения (16 чтений на точку) в пользу ореола по расчёту возвращает чтения примерно к 0,8 от сегодняшних (оценка). Во время окна подсказки поле не рисуется, так что бюджет там почти свободен. **Телефон неизвестен**: ни этого слоя, ни чего-либо в проекте на настоящем телефоне не мерили. Ореол обязан встать в очередь регулятора качества, как требует 7.3 [VI_Visual_Language.md](VI_Visual_Language.md).

Что решает владелец, а не исполнитель:

- **Уместно ли окно подсказки в PS2 рядом с передачами в PS1.** Передачи утверждены как есть. PS2-подсказка может читаться как «другой канал той же стороны» или как разнобой; это вопрос смысла в мире, не техники. Варианты: А) PS2 только в окне подсказки и будущих сюжетных сценах; Б) PS2 как ещё одна «эпоха» передач, которую выбирает режиссёр сигнала; В) оставить всё в PS1, а PS2-приёмы (свечение, солнце-спрайт) взять как улучшение внутри PS1-вида.
- **Остаются ли зерно и строки трубки программы поверх PS2-картинки.** А) снять полностью, как PS2 через компонентный кабель; Б) очень лёгкие строки с шагом около 240 поверх 448 точек, как 480i на трубке; В) зерно только как регулятор состояния, как шум SH3 растёт у города.
- **Палитра.** А) тёмная «moody» линия: красное солнце над тёмным морем, как в ориентире владельца; Б) тёплая ясная «пляжная» линия; В) белёсое небо SotC. Эпоха допускает все три.
- **Мягкость против резкости.** Лесенки на рёбрах уже в списке «не берём», значит сглаживание или мягкий вывод допустимы и «честные» зубцы не цель.

Фон уровня в этом опыте не участвует. Если когда-нибудь PS2 дойдёт и до него, свечение с обратной связью и любое мерцание строк противоречат слову владельца о вязком спокойном фоне, и их там быть не должно.

## 10. Референсы

Все ссылки ниже проверены 18 октября (ответ 200, у видео название и канал по oEmbed). Видео не смотрели: известны только названия и главы.

**Оригиналы PS2: море, небо, туман, свечение** (малые кадры Wikipedia шириной 300–420 точек ближе всего к тому, что выдавала приставка):

- Jak and Daxter, синее море до дымного горизонта, бледный градиент неба: [JakAndDaxterPrecursorGameplay.png](https://en.wikipedia.org/wiki/File:JakAndDaxterPrecursorGameplay.png). Лучший проверенный кадр «моря и горизонта PS2».
- Ico, сепийная дымка и мягкое свечение за камнем: [Ico_gameplay.jpg](https://en.wikipedia.org/wiki/File:Ico_gameplay.jpg).
- Shadow of the Colossus, белое свечение святилища поверх фигур: [Mono and Wander](https://en.wikipedia.org/wiki/File:Shadow_of_the_Colossus_(2005)_-_Mono_and_Wander.jpg); бледное дымное небо: [Valus fight](https://en.wikipedia.org/wiki/File:Shadow_of_the_Colossus_(2005)_-_Valus_fight.jpg).
- Silent Hill 2, улица в сером тумане: [Jamesvspatient.jpg](https://en.wikipedia.org/wiki/File:Jamesvspatient.jpg).
- Ace Combat 04, синяя дымка над морем: [screenshot](https://en.wikipedia.org/wiki/File:Ace_Combat_04_Shattered_Skies_screenshot.png); Ace Combat 5: [screenshot](https://en.wikipedia.org/wiki/File:Ace_Combat_5_-_The_Unsung_War_screenshot.jpg); Ace Combat Zero: [screenshot](https://en.wikipedia.org/wiki/File:Ace_Combat_Zero_screenshot.png).
- Final Fantasy X, бой под оранжевым небом (не Бесайд): [FFXbattleexample.png](https://en.wikipedia.org/wiki/File:FFXbattleexample.png).
- Fatal Frame, тёмный зернистый мягкий кадр: [Battle](https://en.wikipedia.org/wiki/File:Fatal_Frame_(Project_Zero)_Gameplay_-_Battle.jpg).
- Видео воды PS2: [Splashdown, PS2](https://www.youtube.com/watch?v=1tU6bykLCnU); [Wave Rally, PS2](https://www.youtube.com/watch?v=c7BjDZEPf9Y); [Everblue 2, PS2](https://www.youtube.com/watch?v=50Kn7N79GXE); [Ace Combat 04, лонгплей](https://www.youtube.com/watch?v=3-KQvFT1mt8); [GT4, Costa di Amalfi](https://www.youtube.com/watch?v=80LuVto_kiU); [MGS2, танкер, PS2](https://www.youtube.com/watch?v=iLlpgb9Cs0g).

**HD-порты** (тот же арт, но резкие; мягкость по ним не судить): Okami HD, берег и горизонт: [Steam #2](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/587620/ss_71f6af1f989df2aa6bc4e07a9ae407609c264b2e.1920x1080.jpg); MGS2 Master Collection, ливень: [Steam #1](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2131640/ss_725e2d7b84306460abab6f82b964ff9a9abcdaf9.1920x1080.jpg); Beyond Good & Evil 20th Anniversary, ночное море с луной: [Steam #9](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2556990/ss_0155b257c6feb12bc1c23aac9535f18a906c692f.1920x1080.jpg); FFX HD, золотое низкое солнце: [Steam #2](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/359870/ss_6c7ece776d88f1a7252a08321dbdf1c9ee0e48e9.1920x1080.jpg).

**Пары PS1 и PS2:** Silent Hill [SH1_rifle.jpg](https://en.wikipedia.org/wiki/File:SH1_rifle.jpg) и [Jamesvspatient.jpg](https://en.wikipedia.org/wiki/File:Jamesvspatient.jpg); Metal Gear Solid [MGS_screen_psx.jpg](https://en.wikipedia.org/wiki/File:MGS_screen_psx.jpg) и [MGS2](https://en.wikipedia.org/wiki/File:MetalGearSolid2-Substance_screenshot1.jpg) (одинаковая поза у угла, самая ровная пара); Final Fantasy [IX, бой](https://en.wikipedia.org/wiki/File:Ff9_screenshot_bossbattle.png) и [X, бой](https://en.wikipedia.org/wiki/File:FFXbattleexample.png); Resident Evil [3](https://en.wikipedia.org/wiki/File:Resident_Evil_3_Nemesis_Gameplay.png) и [Code: Veronica](https://en.wikipedia.org/wiki/File:Code_Veronica_screenshot.png) (платформа кадра не указана); Tomb Raider [Chronicles](https://en.wikipedia.org/wiki/File:TR_Chronicles_gameplay.jpg) и [Angel of Darkness](https://en.wikipedia.org/wiki/File:Tomb_Raider_AoD_screenshot.jpg) (рекламный кадр). Общее видео: [PS1 vs PS2, Retro Bird](https://www.youtube.com/watch?v=KG7D37jdvnU).

**Современные инди «под PS2»:** Hollowbody, туман над открытой землёй: [Steam #11](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2123640/ss_31fa11ad253c48ff7f08962c7eb94bbd4b62e85f.1920x1080.jpg), [#19](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2123640/ss_31d680baf85eec4557a692b258adf8914ac64e9f.1920x1080.jpg); Anemoiapolis, небо и горизонт: [Steam #4](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1522960/ss_f4b867b46abbc7c71a4dc9ad94d9e8615d40b707.1920x1080.jpg); Sorry We're Closed, бледная дымка неба: [Steam #4](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1796580/ss_51baefc9613aaa46ea274db0b34fdeba86f2295b.1920x1080.jpg); Heartworm, лавандовый туман: [Steam #3](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1257030/ss_d403f3ab56553bbad65bf58c81fcf07e7b39afeb.1920x1080.jpg). Для контраста PS1-стиль: [SIGNALIS #10](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1262350/ss_af2cb31dc253d739c3ce2f6930be5d339e199be2.1920x1080.jpg). Моря на закате нет ни у одного.

**Разборы:** [DF Retro: Shadow of the Colossus](https://www.youtube.com/watch?v=FAQjESB4WOk); [DF Retro: Ico](https://www.youtube.com/watch?v=QCOAqyOE_V4); [DF о ремейке SotC](https://www.youtube.com/watch?v=faMkcZ6z1Ww); [DF: SotC PS2 и PS3, частота кадров](https://www.youtube.com/watch?v=V_GLmE7ZBPE); [DF Retro: запуск PS2](https://www.youtube.com/watch?v=DqtLH0MOkgI); [SotC PS2/PS3/PS4, Pixel Análise](https://www.youtube.com/watch?v=rywHNk394Ps).

**Полукадры и родное против апскейла:** [Bob vs QTGMC, полукадры PS2](https://www.youtube.com/watch?v=2ca5PsPZKaM) (главы: Crash, Ridge Racer V, Tekken 4, Rez, DOA2); [Tekken 5, чересстрочно и прогрессивно](https://www.youtube.com/watch?v=YLBihsPlzsQ); [PCSX2 #1717, размытие самих игр](https://github.com/PCSX2/pcsx2/issues/1717); [PS2 через RetroTINK 4K против PCSX2](https://www.youtube.com/watch?v=YSBv9UrFE0Y) (одна сторона настоящее железо); [PS2 родное против 8K, 12 игр](https://www.youtube.com/watch?v=BCTtgZc28Hc); общие иллюстрации чересстрочности: [колесо](https://commons.wikimedia.org/wiki/File:Interlaced_video_frame_(car_wheel).jpg), [Handbrake](https://commons.wikimedia.org/wiki/File:Deinterlaced_vs_interlaced_image.gif).

**Не нашли проверенного кадра:** закат или фотомод Gran Turismo 4 (ни картинки, ни видео заката); Бесайд FFX с PS2; палуба танкера MGS2 с PS2 (только HD-ливень); озеро или горизонт SotC с PS2; закат Ace Combat; закат на островах Kingdom Hearts; открытый горизонт Dragon Quest VIII; Aquanaut's Holiday на PS2; **солнечная дорожка на воде ни в одной игре PS2**. Страницы PCSX2 wiki, digitalfoundry.net и MobyGames закрыты для инструмента.

### 10.1. Вода PS2 под низким солнцем: что нашли 18 октября

По слову владельца («референсы воды ищи сам») отдельный поиск: 28 картинок с водой, каждая скачана и просмотрена; описания ниже по самим картинкам, не по подписям. Снимки в репозиторий не кладём (чужие), они в чате. Честность источников: кадры с psxdatacenter.com это захваты с дисков PS2, 320×240, ближе всего к настоящему выводу приставки; картинки с вики Fandom (GTA, Final Fantasy, Team Ico, Jak) отдались по прямым ссылкам на файлы, а страницы `File:` ответили 403; большинство из них это PC-сборки, HD-переиздания или OpenGOAL в 4K, что отмечено.

| Игра, сцена | Что делает вода (по картинке) | Источник, платформа |
|---|---|---|
| GTA San Andreas, залив Сан-Фиерро в золотой час | весь залив один бледно-золотой лист того же цвета, что небо; горизонт стёрт дымкой; ряби почти нет. Ближе всего к нашей бледной воде под низким солнцем | GTA Wiki, PC-сборка (по разрешению) |
| GTA San Andreas, мост Гант на восходе | под мягким белым диском солнца вода широкое кремовое сияние без дорожки; дымка кремовая, небо голубое выше | GTA Wiki, PC |
| GTA San Andreas, пляж Верона на закате | море светится тем же оранжевым, что небо; пирс и колесо силуэтом; левая половина сравнения, правая GTA V | GTA Wiki, платформа не указана |
| GTA San Andreas, пляж с низкой точки (gif, первый кадр) | тёмно-бирюзовая тайловая плоскость с жёсткой линией горизонта на фоне голубого неба | GTA Wiki |
| Wave Rally, закатная трасса | сланцевая тёмная вода, цвет неба приходит в неё множеством мелких рассыпанных оранжевых бликов, не полосой; у горизонта бледная мутная полоса | psxdatacenter, PS2 320×240 |
| Wave Rally, Splashdown, открытая вода | бирюза или сланец с сильной текстурой волн вблизи, к горизонту светлеет и тонет в дымке | psxdatacenter, PS2 320×240 |
| Shadow of the Colossus, озеро Гидруса | вода и небо один молочно-зелёный тон, граница почти не читается; по воде лишь белые вспышки колосса | Team Ico Wiki, PS2 (разрешение не указано) |
| Final Fantasy X, Килика на закате | тусклая лиловая вода с мягкими вертикальными отражениями свай, небо полосами от жёлтого к лиловому | FF Wiki, HD-переиздание |
| Final Fantasy X, пирс Килики | яркая прозрачная бирюза с каустикой | psxdatacenter, PS2 |
| Boku no Natsuyasumi 2, набережная, ночная хижина | вода **нарисована** в фоне: рябь мазками, мягкие вертикальные отражения; трёхмерна только вода в режиме плавания, и там это тусклая плоская плоскость | psxdatacenter, PS2 |
| Jak and Daxter, пляж Сентинел и Гейзер-Рок | бирюзовая вода с растянутой полосчатой текстурой, к горизонту темнеет в лилово-розовую дымку | Jak Wiki, OpenGOAL 4K |

Что общего (вывод по просмотренным картинкам). В закатах эпохи PS2 **цвет солнца заливает всю поверхность воды целиком**, а дымка растворяет горизонт; узкой солнечной дорожки из бликов нет ни на одной проверенной картинке. Там, где блики есть (Wave Rally), они рассыпаны по всей воде, а не собраны в полосу. Вода почти всегда того же цвета, что небо у горизонта, и отличается от него только текстурой и тоном. Это прямо противоположно сегодняшней дорожке передач VI: узкая полоса жёстких клеток под солнцем на воде другого цвета. Для PS2-варианта это значит: вода берёт цвет неба у горизонта, дорожка либо широкая и мягкая, либо рассыпана, либо её нет вовсе, а горизонт смягчён дымкой.

Видео, где вода движется (название и канал подтверждены, сами видео не смотрели): [GTA SA, миссия Life's a Beach, PS2](https://www.youtube.com/watch?v=VfAwYlvvcdU) (ClassicGTAGuides); [Everything WRONG With The Sun In San Andreas](https://www.youtube.com/watch?v=AvkuZTezDas) (TJGM; лучшая зацепка о солнце PS2-версии); [Boku no Natsuyasumi 2, прохождение, часть 1](https://www.youtube.com/watch?v=fpy3fK7GWLQ) (DANNY__JK); [Wave Rally, PCSX2 HD](https://www.youtube.com/watch?v=RU-gTDFxUR4) и [Splashdown, PCSX2 HD](https://www.youtube.com/watch?v=s-oUKr63m9U) (xTimelessGaming; эмулятор, резче приставки); [SotC, Гидрус, PS2 Classics](https://www.youtube.com/watch?v=GRYCFPyEcwg) (Avenger-senpai); [Ico, концовка 1/3](https://www.youtube.com/watch?v=SNvGULY3xO0) (youtubehost).

Не нашли: озеро или море SotC кроме Гидруса; море и пляж Ico; побережье Okami; Everblue 2 (страница есть, снимки не открывали); Aquanaut's Holiday на PS2; Jet X2O; океан Vice City на закате; Паноптикум GTA SA в сумерках; море DQ VIII с корабля на PS2; подтверждение отражения солнца в воде именно в PS2-версии GTA SA.

## 11. Чего не нашли и что не проверено

- Как именно сделана вода FFX, MGS2, Ico, Everblue, Wave Rally, Ace Combat, GT4, Okami, Kingdom Hearts, BG&E: ни слов разработчиков, ни разбора эмулятора. Числа есть только у Jak (код) и у свечения SotC.
- Текст доклада о море Primal закрыт: размер карты окружения, плотность сетки, число проходов неизвестны.
- Как игры PS2 рисовали провода и линии, как использовали бит AA1: источника нет. Солнечные блики на воде без света по точкам: источника нет, только выводы.
- Аппаратный фильтр против мерцания у GS не подтверждён; «боб ближе всего к приставке» известен по пересказу поиска. Матрица дизера GS не подтверждена.
- Доли игр с 16- и 32-битным кадром, с полукадрами и кадрами, с выводом 480p: опросов нет.
- Расхождения источников: ширина GT4 (576×480 у Copetti, 640×540 у libretro); «нет буфера глубины» у Godbolt против всех остальных; Dot3 в списке Wikipedia против «нет расчёта на точку» у Godbolt.
- Типичные размеры текстур 64–256 и типичный бюджет полигонов на сцену: только форумные правила.
- Сколько стоит GPU слой передачи при любом числе строк: не мерили. Проба 18 октября мерила только `requestAnimationFrame` и упёрлась в частоту экрана.
- Телефон: ни одного настоящего замера в проекте.
- Как выглядит 448 строк на портрете 360×640 (слой около 280×448): композицию подсказки настраивали на 240 строк, глазами на телефоне не смотрели.
- Даст ли ореол поверх дизера 5–6 бит ползающие края; сдвинется ли цвет, если сделать слой PS2 кодированным (8-битный sRGB против половинной точности, `src/display/layer.ts:536-555`).
- Хватит ли проводов в одну точку при 448 строках без лент: по пробе нет, но в движении на телефоне не смотрели.
- Блики в движении при 448 строках видел только координатор; владелец снимков ещё не видел.
- Решения владельца о PS2 для передач нет ни в одном документе.
- Видео-эссе о PS2 и треды Reddit прочитаны только по описаниям. Инди Lunacid, Dread Delusion, Crisol, Mouthwashing по настройкам вывода не изучены.

## 12. Источники

Железо и конвейер:
- [Wikipedia: Graphics Synthesizer](https://en.wikipedia.org/wiki/Graphics_Synthesizer)
- [Wikipedia: Emotion Engine](https://en.wikipedia.org/wiki/Emotion_Engine)
- [Copetti: PlayStation 2 Architecture](https://www.copetti.org/writings/consoles/playstation-2/)
- [Copetti: PlayStation Architecture](https://www.copetti.org/writings/consoles/playstation/)
- [Themaister: PS2 GS emulation, 2024](https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation)
- [Themaister: Graphics programming like it's 2000, 2025](https://themaister.net/blog/2025/03/20/graphics-programming-like-its-2000-an-esoteric-introduction-to-playstation-2-graphics-part-1/)
- [ps2tek](https://psi-rockin.github.io/ps2tek/)
- [Godbolt: Rendering in SWAT, PS2](https://xania.org/201003/swat-ps2-renderer)
- [libretro: field rendering](https://www.libretro.com/?p=50686)
- [PCSX2 PR #6106](https://github.com/PCSX2/pcsx2/pull/6106)
- [PCSX2 issue #1717](https://github.com/PCSX2/pcsx2/issues/1717)
- [PCSX2, June 2015 progress report](https://pcsx2.net/blog/2015/june-2015-progress-report)
- [PCSX2, July–August 2015 progress report](https://pcsx2.net/blog/2015/july-august-2015-progress-report)
- [PCSX2, Q2 2016 progress report](https://pcsx2.net/blog/2016/q2-2016-progress-report/)
- [Persona 3 FES modding guide, PCSX2 setup](https://persona-3-fes-modding-guide.readthedocs.io/en/latest/_sources/pcsx2setup.rst)
- [AnandTech 2001, GameCube](https://www.anandtech.com/show/858)
- [PlayStation LifeStyle, SotC remake facts](https://www.playstationlifestyle.net/2018/01/25/things-you-may-not-know-shadow-of-the-colossus-ps4-remake/)
- [Polycount](https://polycount.com/discussion/comment/872947)
- [shmups.system11, PS2 dithering](https://shmups.system11.org/viewtopic.php?t=72897)

Море, небо, солнце:
- [OpenGOAL: jak1 ocean source](https://github.com/open-goal/jak-project/tree/master/goal_src/jak1/engine/gfx/ocean)
- [OpenGOAL: ocean docs](https://opengoal.dev/docs/source-docs/jak1/packages/engine/gfx/ocean/)
- [OpenGOAL: jak1 sky source](https://github.com/open-goal/jak-project/tree/master/goal_src/jak1/engine/gfx/sky)
- [OpenGOAL: Jak 2 sky docs](https://opengoal.dev/docs/source-docs/jak2/packages/engine/gfx/sky/)
- [OceanTexture.h](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/OceanTexture.h)
- [CommonOceanRenderer.cpp](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/CommonOceanRenderer.cpp)
- [OceanEnvmap.h](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/OceanEnvmap.h)
- [OceanEnvmap.cpp](https://github.com/open-goal/jak-project/blob/master/game/graphics/opengl_renderer/ocean/OceanEnvmap.cpp)
- [OpenGOAL, Q2 2026 progress report](https://opengoal.dev/blog/progress-report-q2-2026/)
- [SIGGRAPH 2003, The Primal seas](https://history.siggraph.org/learning/the-primal-seas-water-on-playstation2)
- [Making of Shadow of the Colossus, PDF](https://lukasz.dk/files/making_of_sotc.pdf)
- [GBAtemp Tech Talks, SotC](https://gbatemp.net/blogs/tech-talks-shadow-of-the-colossus-all-3-versions-ps2-ps3-ps4-analysed-and-compared.14075/)
- [PCSX2 issue #12313](https://github.com/PCSX2/pcsx2/issues/12313)
- [PCSX2 issue #883](https://github.com/PCSX2/pcsx2/issues/883)
- [PPSSPP issue #15923](https://github.com/hrydgard/ppsspp/issues/15923)
- [SH2 Enhanced Edition config](https://enhanced.townofsilenthill.com/SH2/config.htm)

Визуальный язык:
- [ResetEra 2026: visual characteristics of DC/PS2/XB/GC](https://www.resetera.com/threads/what-do-you-consider-to-be-the-recognisable-visual-characteristics-of-the-dc-ps2-xb-gc.1497903/)
- [ResetEra 2023: fondness for PS2 image quality](https://www.resetera.com/threads/anyone-else-have-a-fondness-for-the-objectively-poor-image-quality-output-of-the-ps2.776270/)
- [Unity Discussions: Making a game look like a PS2 title](https://discussions.unity.com/t/making-a-game-look-like-a-ps2-title/917427)
- [GlitterBerri: The Graphic Designers Tell It Straight, part 3](https://glitterberri.com/extended-developer-interview/the-graphic-designers-tell-it-straight-3/)
- [Blue Aurochs: Creator's Salon, FFX graphics team](https://blueaurochs.substack.com/p/creators-salon-graphics-team-part-d50)
- [Silent Hill Memories: Sato, IGN 2001](https://www.silenthillmemories.net/creators/interviews/2001.08.17_sato_ign_en.htm)
- [GameSpot: Silent Hill 2 impressions](https://gamespot.com/articles/silent-hill-2-impressions/1100-2662590/)
- [Wikipedia: Ico](https://en.wikipedia.org/wiki/Ico)
- [Wikipedia: Silent Hill HD Collection](https://en.wikipedia.org/wiki/Silent_Hill_HD_Collection)
- [Flying Omelette: Silent Hill 2 Restless Dreams](https://www.flyingomelette.com/reviews/xbox/silenthill2.html)
- [Silent Hill 2 Enhancements](https://github.com/elishacloud/Silent-Hill-2-Enhancements)
- [Codex Gamicus: Light Bloom](https://gamicus.fandom.com/wiki/Light_Bloom)
- [Scanlines' Journal: The PS2's Foreboding Aesthetic](https://scanlines.substack.com/p/the-ps2s-foreboding-aesthetic)
- [80.lv: Hollowbody](https://80.lv/articles/how-hollowbody-blends-silent-hill-inspirations-with-cyberpunk-horror)

Сегодняшние приёмы и цена:
- [Daniel Ilett: Retro Shaders Pro 1.5.1](https://danielilett.com/2026-01-27-article-retro-1-5-1-update/)
- [Borz Blade: Ultimate PSX Retro Shader](https://borzblade.itch.io/psx-shader)
- [VNTG](https://github.com/Colby-O2/VNTG)
- [godotshaders, psx](https://godotshaders.com/shader-tag/psx)
- [libretro interlacing.glsl](https://raw.githubusercontent.com/libretro/glsl-shaders/master/misc/shaders/interlacing.glsl)
- [Blender 2.79 manual, Fields](https://docs.blender.org/manual/en/2.79/render/blender_render/post_processing/fields.html)
- [Форум PCSX2, motion handling](https://forums.pcsx2.net/Thread-PCSX2-motion-handling?pid=252055)
- [Форум PCSX2, Shadow of the Colossus](https://forums.pcsx2.net/Thread-Shadow-of-the-Colossus--4737?page=16)
- [GameFAQs, SotC bloom](https://gamefaqs.gamespot.com/boards/998181-the-ico-and-shadow-of-the-colossus-collection/60571808)
- [Форум libretro, crt-guest-advanced](https://forums.libretro.com/t/new-crt-shader-from-guest-crt-guest-advanced-updates/25444/4942)
- [Форум libretro, ReShade](https://forums.libretro.com/t/crt-guest-advanced-hd-and-ntsc-for-reshade/41880/79)
- [Unity Manual: Mobile optimisation](https://docs.unity3d.com/2017.3/Documentation/Manual/MobileOptimisation.html)
- [Vulkan guide: tile-based rendering](https://docs.vulkan.org/guide/latest/tile_based_rendering_best_practices.html)
- [Vulkanised 2023: mobile optimisations](https://dev.vulkan.org/user/pages/09.events/vulkanised-2023/vulkanised_2023_battle_tested_optimisations_for_mobile_v2.pdf)
- [three.js docs: UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html)
- [Форум three.js: UnrealBloomPass и HalfFloat](https://discourse.threejs.org/t/using-unrealbloompass-causes-shadow-acne/52790.md)
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)

Референсы: все ссылки раздела 10.

Документы проекта: [VI_PS2_Effects_Research.md](VI_PS2_Effects_Research.md), [VI_Visual_Language.md](VI_Visual_Language.md) (части 5 и 7.3), [VI_World_Logic.md](VI_World_Logic.md) (строка о фоне уровня), [VI_Owner_Words.md](../VI_Owner_Words.md) (раздел 4, строки 106, 112), [спека воды](../superpowers/specs/2026-10-13-vi-water-backdrop-probe.md), [спека окна подсказки](../superpowers/specs/2026-10-15-vi-hint-transmission-design.md).
