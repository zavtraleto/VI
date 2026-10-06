import type { LanguageCode } from './i18n';

/**
 * The note that came with the program: what the file `README` of the menu shows, a page to a
 * window and a paragraph to a line. It is the department's own note to its staff, written the
 * day before the last start, and knows nothing of what came after: it says what the program
 * is for, why the device is made of dice, what the institute was, how a session goes and where
 * it ends. Its footnotes are a paragraph of their own, under the one they belong to.
 *
 * It is lore: every line of it is in the log of claims, docs/art/VI_Claims.md, and nothing in
 * it answers what docs/art/VI_Lore.md lists as never answered. The name of the institute and
 * the number of the department are blacked out.
 *
 * A draft the owner has not read yet. It is in Russian and in English; the other languages
 * read the English until the words are settled.
 */
const RU: readonly (readonly string[])[] = [
  [
    'VI, редакция 2.06. Программа сопровождения сеансов. Отдел ■■, институт ■■■■■■. Для внутреннего пользования: если вы читаете это не в отделе, то либо вы у нас работаете, либо кто-то об этом пожалеет.',
    'Программа ведёт стол. Стол — прибор: поверхность, кости, шесть каналов, по одному на грань, и шесть мест вокруг. Программа не бросает костей и ничего не решает. Она считает, записывает и, когда приходит время, пишет «принято».',
    'Без стола программа переходит в режим эмуляции. Режим предусмотрен для проверки оборудования и к сеансам не допускается.*',
    '* Кем предусмотрен, в отделе вспомнить не смогли. Вопрос передали разработчику. Разработчик передал его обратно.',
  ],
  [
    'Почему кости. В 1934 году в университете Дьюка людей сажали перед жёлобом, по которому скатывались кости, и просили хотеть шестёрку. Просто хотеть. Шестёрок выпало больше, чем полагалось, и немало лет ушло на то, чтобы заметить: на шестёрке высверлено больше точек, она легче и ложится наверх сама.*',
    'В 1979-м в Принстоне кости заменили генератором случайных чисел: у него нет точек. В 1998-м такие генераторы расставили по всей планете и стали ждать, не дрогнет ли случайность, когда очень много людей разом чувствуют одно и то же.',
    'Отдел изучил все три отчёта и сделал вывод, которого в них нет. Ошибкой было хотеть. Кость не нужно уговаривать. Её нужно положить.',
    '* Что не объясняет остального. Но об остальном в отчётах не пишут.',
  ],
  [
    'Об институте. В девяностые такие отделы были у многих. Один токийский производитель магнитофонов семь лет держал лабораторию, которая изучала то, чего нет, и закрыл её с формулировкой, достойной камня: явление есть, применения нет.',
    'Наш отдел занимает половину третьего этажа, между бухгалтерией и комнатой, где хранят то, что жалко выбросить. Бюджет проходит по статье «измерительное оборудование», и это не совсем неправда: стол измеряет. Вопроса «что именно» в заявке не было, и отдел благодарен каждому, кто его не задал.',
    'Сеансы идут с осени H10. Испытуемых шесть.',
  ],
  [
    'Сеанс. Испытуемый не бросает кости: он их раскладывает. Столько одинаковых граней рядом, сколько на грани точек, — и стол их забирает. В документах отдела это называется «принято». Слов «исчезли», «утонули» и «ушли» просим избегать, особенно при испытуемых.',
    'Поверхность стола — граница. Что опускается — отправлено. Что поднимается — получено. Отдел не утверждает, что знает, куда и откуда. Отдел утверждает, что ведёт учёт.',
    'Шум на каналах — рабочее состояние линии. Не вслушивайтесь. Человек устроен так, что в любом шуме расслышит, как его зовут.*',
    '* Трое сотрудников расслышали. Имя во всех трёх случаях было чужое.',
  ],
  [
    'Места. За столом шесть мест, в программе шесть записей. Файл 07 заведён, но ни за кем не числится: UNREGISTERED. Увидев его на экране, не беспокойтесь: это ничего не значит. Регистрация выполняется автоматически.',
    'Окончание. Сеанс окончен, когда оператор внёс запись «конец». До этой записи программу не выключать, из-за стола не вставать, с испытуемыми о постороннем не говорить.',
    'Изменения в редакции 2.06, H13.03.20: число мест 6 → 7.',
    'Вопросы — оператору стола.',
  ],
];

const EN: readonly (readonly string[])[] = [
  [
    'VI, revision 2.06. A program for the conduct of sessions. Department ■■, ■■■■■■ Institute. For internal use: if you are reading this outside the department, then either you work for us or somebody is going to regret it.',
    'The program runs the table. The table is an instrument: a surface, dice, six channels, one to a face, and six seats around it. The program throws no dice and decides nothing. It counts, it keeps the record and, when the time comes, it writes "accepted".',
    'Without a table the program goes into emulation mode. The mode is provided for testing the equipment and is not to be used for sessions.*',
    '* Provided by whom, nobody in the department could recall. The question was passed to the developer. The developer passed it back.',
  ],
  [
    'Why dice. In 1934, at Duke University, people were sat in front of a chute that dice rolled down and asked to want a six. Just to want it. More sixes came up than should have, and it took a good many years to notice that a six has more pips drilled out of it, is the lighter side, and comes up on top by itself.*',
    'In 1979, at Princeton, the dice were replaced by a random number generator: it has no pips. In 1998 such generators were set out all over the planet, to wait and see whether chance would flinch when a great many people felt the same thing at once.',
    'The department studied all three reports and drew a conclusion that is in none of them. Wanting was the mistake. A die is not to be persuaded. A die is to be placed.',
    '* Which does not account for the rest. But the reports do not write about the rest.',
  ],
  [
    'About the institute. In the nineties a good many places had a department like ours. A Tokyo maker of tape recorders kept a laboratory for seven years to study what is not there, and closed it with a finding fit to be cut in stone: the phenomenon exists, there is no use for it.',
    'Our department has half of the third floor, between the accounts office and the room for things nobody can bring themselves to throw away. The budget goes under "measuring equipment", which is not altogether untrue: the table measures. The application never asked what, and the department is grateful to everyone who did not ask.',
    'Sessions have been held since the autumn of H10. There are six subjects.',
  ],
  [
    'The session. A subject does not throw the dice: a subject lays them out. As many faces alike, side by side, as the face has pips, and the table takes them. The department\'s papers call this "accepted". Please avoid "vanished", "sank" and "gone", above all in front of the subjects.',
    'The surface of the table is a border. What goes down has been sent. What comes up has been received. The department does not claim to know where to, or where from. The department claims to keep the record.',
    'Noise on the channels is the working state of the line. Do not listen to it closely. People are so made that in any noise they will hear their name called.*',
    '* Three members of staff did. In all three cases the name was somebody else\'s.',
  ],
  [
    'Seats. There are six seats at the table and six records in the program. File 07 exists and belongs to no one: UNREGISTERED. Should you see it on the screen, do not be concerned: it means nothing. Registration is carried out automatically.',
    'Ending. A session is over once the operator has entered "end". Until that entry the program is not to be switched off, nobody leaves the table, and nothing but the session is spoken of with the subjects.',
    'Changes in revision 2.06, H13.03.20: number of seats 6 → 7.',
    'Questions go to the operator of the table.',
  ],
];

const PAGES: Partial<Record<LanguageCode, readonly (readonly string[])[]>> = { ru: RU, en: EN };

/**
 * The pages of the note in a language of the player; the English ones where the note is not
 * written in it yet. With `most`, a page is cut into windows of no more signs than that, a
 * paragraph never broken: a screen that is low holds less than a page.
 */
export function readmePages(language: LanguageCode, most = Infinity): readonly (readonly string[])[] {
  const windows: string[][] = [];
  for (const page of PAGES[language] ?? EN) {
    let window: string[] | null = null;
    let held = 0;
    for (const paragraph of page) {
      if (!window || held + paragraph.length > most) {
        window = [];
        windows.push(window);
        held = 0;
      }
      window.push(paragraph);
      held += paragraph.length;
    }
  }
  return windows;
}
