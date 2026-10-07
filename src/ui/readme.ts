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
 * The Russian wording was approved on 7 October 2026; translations follow its five pages.
 */
const RU: readonly (readonly string[])[] = [
  [
    'VI · редакция 2.06 · H13.03.20. Отдел ■■, институт ■■■■■■. Для внутреннего пользования.',
    'VI сопровождает сеанс за столом. У стола есть поверхность, кости, шесть каналов — по одному на каждую грань — и шесть мест. Программа не бросает кости и не решает, какие из них принять. Она считает, ведёт запись и выводит «ПРИНЯТО», когда стол принимает группу.',
    'При отсутствии стола VI переходит в режим эмуляции. Режим предназначен для проверки оборудования. Сеансы в нём не допускаются.*',
    '* В документации не указано, кем предусмотрен режим эмуляции. Запрос разработчику вернулся в отдел без разъяснения.',
  ],
  [
    'О костях. В 1934 году в Дьюке испытуемых просили желать шестёрку. Кости скатывались по жёлобу; от человека требовалось только желание. Шестёрок выпадало больше ожидаемого. Позже внимание обратили на сами кости: на шестой грани высверлено больше точек, и её вес отличается от веса остальных граней.*',
    'В Принстоне в 1979 году вместо костей стали использовать генераторы случайных чисел. С 1998 года такие генераторы размещают в разных частях света и сравнивают их показания в минуты, когда множество людей переживает одно событие.',
    'Отдел изучил эти работы. Вывод, ради которого здесь стоит стол, ни в одной из них не содержится: кость не нужно просить лечь нужной гранью. Её нужно положить.',
    '* Разница в весе не объяснила всех результатов. Причины остальных расхождений в отчётах названы по-разному.',
  ],
  [
    'Об отделе. В девяностые подобные исследования вели и в других учреждениях. Один токийский производитель магнитофонов семь лет содержал лабораторию, изучавшую явления, для которых ещё не находилось применения. При закрытии лаборатории это выразили короче: «явление есть, применения нет».',
    'Наш отдел занимает половину третьего этажа, между бухгалтерией и комнатой для вещей, которые пока не решились списать. Расходы на стол проходят как «измерительное оборудование». Это название подходит прибору. Измеряемая величина в заявке не названа.',
    'Сеансы идут с осени H10. Испытуемых шесть.',
  ],
  [
    'Порядок сеанса. Испытуемый не бросает кости. Он раскладывает их рядом: две двойки, три тройки, четыре четвёрки, пять пятёрок, шесть шестёрок. Стол принимает собранную группу. VI записывает: «ПРИНЯТО».',
    'Сохраняйте это слово и в разговоре с испытуемыми. «Исчезли», «утонули» и «ушли» — не слова протокола.',
    'Поверхность стола служит границей. Что опускается — отправлено. Что поднимается — получено. Направления записываются; адреса — нет.',
    'Шум в каналах считается рабочим состоянием линии. Не вслушивайтесь в него дольше, чем требуется для проверки: в случайном звуке человеку легко расслышать обращение.*',
    '* Трое сотрудников сообщили, что услышали имя. Во всех трёх случаях имя было чужим.',
  ],
  [
    'Места и окончание. За столом шесть мест. В программе шесть записей.',
    'Файл 07 заведён, но не закреплён за испытуемым. Поле имени содержит UNREGISTERED. Заполнять его вручную не требуется. Регистрация выполняется автоматически.',
    'Сеанс окончен, когда оператор внесёт запись «КОНЕЦ». До появления этой записи программу не выключать, из-за стола не вставать, с испытуемыми о постороннем не говорить. Устное сообщение об окончании записью не считается.',
    'Вопросы по порядку окончания — оператору стола.',
    'Изменения в редакции 2.06: число мест 6 → 7.',
  ],
];

const EN: readonly (readonly string[])[] = [
  [
    'VI · revision 2.06 · H13.03.20. Department ■■, ■■■■■■ Institute. For internal use.',
    'VI accompanies the session at the table. The table has a surface, dice, six channels — one for each face — and six seats. The program does not throw the dice or decide which of them to accept. It counts, keeps the record and displays "ACCEPTED" when the table accepts a group.',
    'Without the table, VI enters emulation mode. This mode is intended for equipment checks. Sessions are not permitted in it.*',
    '* The documentation does not say who provided for emulation mode. The inquiry sent to the developer came back to the department without clarification.',
  ],
  [
    'On dice. In 1934, subjects at Duke were asked to wish for a six. The dice rolled down a chute; all that was required of a person was the wish. Sixes appeared more often than expected. Attention later turned to the dice themselves: the six face has more pips drilled into it and weighs differently from the other faces.*',
    'At Princeton, random number generators replaced dice in 1979. Since 1998, such generators have been placed in different parts of the world, their readings compared when large numbers of people experience the same event.',
    'The department studied this work. None of it contains the conclusion for which this table stands here: there is no need to ask a die to land on the desired face. It must be placed.',
    '* The difference in weight did not account for every result. The reports give different reasons for the remaining discrepancies.',
  ],
  [
    'On the department. Other institutions conducted similar research in the nineties. One Tokyo manufacturer of tape recorders kept a laboratory for seven years to study phenomena for which no use had yet been found. When it closed the laboratory, the finding was shorter: "The phenomenon exists. There is no application."',
    'Our department occupies half of the third floor, between the accounts office and the room for things no one has quite decided to discard. The table is charged to "measuring equipment". The description fits the instrument. The quantity being measured is not named on the requisition.',
    'Sessions have been held since the autumn of H10. There are six subjects.',
  ],
  [
    'Session procedure. The subject does not throw the dice. They set them side by side: two twos, three threes, four fours, five fives, six sixes. The table accepts the completed group. VI records: "ACCEPTED".',
    'Keep to this word when speaking with subjects. "Vanished", "sank" and "went away" are not terms of the record.',
    'The table surface is a boundary. What goes down is sent. What rises is received. Directions are recorded; addresses are not.',
    'Noise in the channels is considered the line\'s working state. Do not listen longer than the check requires: it is easy to hear someone calling in random sound.*',
    '* Three members of staff reported hearing a name. In all three cases, it belonged to someone else.',
  ],
  [
    'Seats and closing. There are six seats at the table. There are six records in the program.',
    'File 07 exists but is assigned to no subject. The name field reads UNREGISTERED. It need not be filled in by hand. Registration is automatic.',
    'A session ends when the operator enters "END". Until that entry appears, do not switch off the program, leave the table or discuss anything else with the subjects. An oral announcement that the session is over does not count as an entry.',
    'Questions about closing procedure go to the table operator.',
    'Changes in revision 2.06: number of seats 6 → 7.',
  ],
];

const ES: readonly (readonly string[])[] = [
  [
    'VI · revisión 2.06 · H13.03.20. Departamento ■■, Instituto ■■■■■■. Uso interno.',
    'VI acompaña la sesión ante la mesa. La mesa tiene una superficie, dados, seis canales —uno por cada cara— y seis puestos. El programa no tira los dados ni decide cuáles aceptar. Cuenta, lleva el registro y muestra «ACEPTADO» cuando la mesa acepta un grupo.',
    'Sin la mesa, VI pasa al modo de emulación. Ese modo sirve para comprobar el equipo. No se permiten sesiones en él.*',
    '* La documentación no indica quién dispuso el modo de emulación. La consulta enviada al desarrollador volvió al departamento sin aclaración.',
  ],
  [
    'Sobre los dados. En 1934, en Duke, se pidió a los sujetos que desearan un seis. Los dados bajaban por un canal; de la persona solo se requería el deseo. Salían más seises de los esperados. Más tarde se examinó el dado mismo: la cara del seis tiene más puntos perforados y un peso distinto del de las demás caras.*',
    'En Princeton, en 1979, se empezaron a usar generadores de números aleatorios en lugar de dados. Desde 1998 se distribuyen por distintas partes del mundo y se comparan sus lecturas cuando muchas personas viven un mismo acontecimiento.',
    'El departamento estudió esos trabajos. Ninguno contiene la conclusión por la que está aquí esta mesa: no hay que pedirle al dado que caiga sobre una cara determinada. Hay que colocarlo.',
    '* La diferencia de peso no explicó todos los resultados. Los informes atribuyen las demás discrepancias a causas distintas.',
  ],
  [
    'Sobre el departamento. En los noventa, otras instituciones llevaron a cabo investigaciones semejantes. Un fabricante de grabadoras de Tokio mantuvo siete años un laboratorio sobre fenómenos sin aplicación conocida. Al cerrarlo, lo expresaron con menos palabras: «El fenómeno existe; no tiene aplicación».',
    'Nuestro departamento ocupa media tercera planta, entre contabilidad y el cuarto de las cosas que todavía no se han decidido desechar. Los gastos de la mesa figuran como «equipo de medición». La denominación corresponde al instrumento. La magnitud medida no consta en la solicitud.',
    'Las sesiones se celebran desde el otoño de H10. Hay seis sujetos.',
  ],
  [
    'Procedimiento de la sesión. El sujeto no tira los dados. Los coloca juntos: dos dados con el dos, tres con el tres, cuatro con el cuatro, cinco con el cinco, seis con el seis. La mesa acepta el grupo completo. VI anota: «ACEPTADO».',
    'Empleen esta misma palabra al hablar con los sujetos. «Desaparecieron», «se hundieron» y «se fueron» no son términos del protocolo.',
    'La superficie de la mesa es el límite. Lo que baja se envía. Lo que sube se recibe. Se registran los sentidos del movimiento; los destinos, no.',
    'El ruido de los canales se considera el estado normal de la línea. No lo escuchen más tiempo del necesario para la comprobación: en un sonido casual es fácil oír que alguien nos llama.*',
    '* Tres empleados dijeron haber oído un nombre. En los tres casos era el de otra persona.',
  ],
  [
    'Puestos y cierre. Hay seis puestos en la mesa. Hay seis registros en el programa.',
    'El archivo 07 existe, pero no está asignado a ningún sujeto. El campo del nombre dice UNREGISTERED. No hace falta rellenarlo a mano. El registro se realiza automáticamente.',
    'La sesión termina cuando el operador introduce «FIN». Hasta que aparezca esa anotación, no apaguen el programa, no se levanten de la mesa ni hablen con los sujetos de otros asuntos. Anunciar de palabra el fin de la sesión no equivale a anotarlo.',
    'Las preguntas sobre el cierre se dirigirán al operador de la mesa.',
    'Cambios de la revisión 2.06: número de puestos 6 → 7.',
  ],
];

const PT: readonly (readonly string[])[] = [
  [
    'VI · revisão 2.06 · H13.03.20. Departamento ■■, Instituto ■■■■■■. Uso interno.',
    'VI acompanha a sessão à mesa. A mesa tem uma superfície, dados, seis canais — um para cada face — e seis lugares. O programa não lança os dados nem decide quais aceitar. Ele conta, mantém o registro e mostra «ACEITO» quando a mesa aceita um grupo.',
    'Sem a mesa, VI entra em modo de emulação. Esse modo serve para verificar o equipamento. Não é permitido realizar sessões nele.*',
    '* A documentação não informa quem incluiu o modo de emulação. A consulta enviada ao desenvolvedor voltou ao departamento sem esclarecimento.',
  ],
  [
    'Sobre os dados. Em 1934, em Duke, pediram aos participantes que desejassem um seis. Os dados desciam por uma canaleta; da pessoa, exigia-se apenas o desejo. O seis saía mais vezes do que o esperado. Mais tarde, a atenção voltou-se aos próprios dados: a face do seis tem mais pontos perfurados e um peso diferente das demais.*',
    'Em Princeton, a partir de 1979, geradores de números aleatórios passaram a ser usados no lugar de dados. Desde 1998, esses geradores são instalados em várias partes do mundo; suas leituras são comparadas quando muitas pessoas vivem o mesmo acontecimento.',
    'O departamento estudou esses trabalhos. Nenhum deles contém a conclusão que justifica esta mesa: não é preciso pedir ao dado que caia sobre a face desejada. É preciso colocá-lo.',
    '* A diferença de peso não explicou todos os resultados. Os relatórios dão causas diferentes para as demais divergências.',
  ],
  [
    'Sobre o departamento. Nos anos noventa, outras instituições faziam pesquisas semelhantes. Um fabricante de gravadores de Tóquio manteve por sete anos um laboratório dedicado a fenômenos para os quais ainda não havia aplicação. Ao fechá-lo, resumiu a conclusão: «O fenômeno existe; não há aplicação».',
    'Nosso departamento ocupa metade do terceiro andar, entre a contabilidade e a sala das coisas que ainda não decidiram descartar. As despesas da mesa entram como «equipamento de medição». O nome cabe ao instrumento. A grandeza medida não consta do pedido.',
    'As sessões são realizadas desde o outono de H10. Há seis participantes.',
  ],
  [
    'Procedimento da sessão. O participante não lança os dados. Ele os põe lado a lado: dois dados mostrando 2, três mostrando 3, quatro mostrando 4, cinco mostrando 5, seis mostrando 6. A mesa aceita o grupo completo. VI registra: «ACEITO».',
    'Usem essa mesma palavra ao falar com os participantes. «Desapareceram», «afundaram» e «foram embora» não são termos do protocolo.',
    'A superfície da mesa é a fronteira. O que desce é enviado. O que sobe é recebido. Registram-se os sentidos do movimento; os destinos, não.',
    'O ruído nos canais é considerado o estado normal da linha. Não o escutem além do necessário para a verificação: é fácil ouvir um chamado em um som aleatório.*',
    '* Três funcionários relataram ter ouvido um nome. Nos três casos, era o nome de outra pessoa.',
  ],
  [
    'Lugares e encerramento. Há seis lugares à mesa. Há seis registros no programa.',
    'O arquivo 07 existe, mas não foi atribuído a nenhum participante. O campo do nome mostra UNREGISTERED. Não é necessário preenchê-lo à mão. O registro é automático.',
    'A sessão termina quando o operador insere «FIM». Até que essa anotação apareça, não desliguem o programa, não se levantem da mesa nem conversem com os participantes sobre outros assuntos. Anunciar o encerramento em voz alta não equivale a registrá-lo.',
    'Perguntas sobre o encerramento devem ser dirigidas ao operador da mesa.',
    'Alterações na revisão 2.06: número de lugares 6 → 7.',
  ],
];

const TR: readonly (readonly string[])[] = [
  [
    'VI · sürüm 2.06 · H13.03.20. Bölüm ■■, ■■■■■■ Enstitüsü. Kurum içi kullanım içindir.',
    'VI, masada yürütülen oturuma eşlik eder. Masanın bir yüzeyi, zarları, her yüz için bir tane olmak üzere altı kanalı ve altı yeri vardır. Program zar atmaz, hangilerinin kabul edileceğine de karar vermez. Sayar, kayıt tutar ve masa bir grubu kabul ettiğinde «KABUL EDİLDİ» yazar.',
    'Masa olmadan VI, emülasyon moduna geçer. Bu mod ekipmanı kontrol etmek içindir. Bu modda oturum yapılmasına izin verilmez.*',
    '* Belgeler, emülasyon moduna kimin karar verdiğini belirtmiyor. Geliştiriciye gönderilen soru açıklama olmadan bölüme geri döndü.',
  ],
  [
    'Zarlar üzerine. 1934 yılında Duke Üniversitesinde deneklerden zarın altı gelmesini dilemeleri istendi. Zarlar bir oluktan aşağı yuvarlanıyordu; kişiden istenen tek şey buydu. Beklenenden fazla altı geldi. Daha sonra zarların kendisi incelendi: altı yüzünde daha çok oyuk vardır ve ağırlığı öteki yüzlerden farklıdır.*',
    "Princeton'da 1979 yılında zarların yerini rastgele sayı üreteçleri aldı. 1998'den beri bu üreteçler dünyanın farklı yerlerine kuruluyor; çok sayıda insan aynı olayı yaşadığında ölçümleri karşılaştırılıyor.",
    'Bölüm bu çalışmaları inceledi. Hiçbirinde, bu masanın burada olma nedeni olan sonuç yoktur: zardan istenen yüzün gelmesini dilemeye gerek yoktur. Zarı o yüzüyle koymak gerekir.',
    '* Ağırlık farkı bütün sonuçları açıklamadı. Raporlar kalan sapmalar için farklı nedenler gösteriyor.',
  ],
  [
    "Bölüm üzerine. 1990'larda başka kurumlar da benzer araştırmalar yürüttü. Tokyo'da bir kayıt cihazı üreticisi, henüz kullanım alanı bulunmayan olguları inceleyen bir laboratuvarı yedi yıl açık tuttu. Laboratuvar kapanırken varılan sonuç daha kısaydı: «Olgu var; kullanım alanı yok».",
    'Bölümümüz üçüncü katın yarısını kaplar; muhasebe ile henüz atılmasına karar verilmemiş eşyaların odası arasındadır. Masanın giderleri «ölçüm ekipmanı» olarak kaydedilir. Bu ad, cihaza uygundur. Ölçülen büyüklük başvuruda belirtilmemiştir.',
    'Oturumlar H10 sonbaharından beri sürüyor. Altı denek var.',
  ],
  [
    'Oturum düzeni. Denek zar atmaz. Zarları yan yana dizer: iki tane 2, üç tane 3, dört tane 4, beş tane 5, altı tane 6. Masa tamamlanan grubu kabul eder. VI kayda geçirir: «KABUL EDİLDİ».',
    'Deneklerle konuşurken de bu sözü kullanın. «Kayboldular», «battılar» ve «gittiler» protokolün sözcükleri değildir.',
    'Masanın yüzeyi sınırdır. Aşağı inen gönderilmiştir. Yukarı çıkan alınmıştır. Yönler kaydedilir; adresler kaydedilmez.',
    'Kanallardaki gürültü hattın olağan çalışma durumu sayılır. Kontrol için gerekenden uzun süre dinlemeyin: rastgele bir seste size seslenildiğini duymak kolaydır.*',
    '* Üç çalışan bir isim duyduğunu bildirdi. Üçünde de isim bir başkasına aitti.',
  ],
  [
    'Yerler ve bitiş. Masada altı yer var. Programda altı kayıt var.',
    '07 numaralı dosya var, ama hiçbir deneğe atanmış değil. Ad alanında UNREGISTERED yazıyor. Elle doldurulması gerekmiyor. Kayıt otomatik yapılır.',
    'Oturum, operatör «BİTTİ» kaydını girdiğinde sona erer. Bu kayıt görünene kadar programı kapatmayın, masadan kalkmayın, deneklerle oturum dışı konuları konuşmayın. Bittiğinin sözlü olarak bildirilmesi kayıt sayılmaz.',
    'Bitiş düzenine ilişkin sorular masa operatörüne yöneltilmelidir.',
    'Sürüm 2.06 değişiklikleri: yer sayısı 6 → 7.',
  ],
];

const DE: readonly (readonly string[])[] = [
  [
    'VI · Fassung 2.06 · H13.03.20. Abteilung ■■, Institut ■■■■■■. Nur für den internen Gebrauch.',
    'VI begleitet die Sitzung am Tisch. Der Tisch hat eine Oberfläche, Würfel, sechs Kanäle — einen für jede Würfelseite — und sechs Plätze. Das Programm wirft keine Würfel und entscheidet nicht, welche angenommen werden. Es zählt, führt Protokoll und zeigt „ANGENOMMEN“ an, wenn der Tisch eine Gruppe annimmt.',
    'Ohne Tisch wechselt VI in den Emulationsmodus. Dieser Modus dient zur Prüfung der Geräte. Sitzungen sind darin nicht zugelassen.*',
    '* Aus den Unterlagen geht nicht hervor, wer den Emulationsmodus vorgesehen hat. Die Anfrage an den Entwickler kam ohne Erläuterung an die Abteilung zurück.',
  ],
  [
    'Über die Würfel. 1934 wurden Versuchspersonen in Duke gebeten, sich eine Sechs zu wünschen. Die Würfel rollten durch eine Rinne; der Wunsch war alles, was von ihnen verlangt wurde. Es fielen mehr Sechsen als erwartet.',
    'Später richtete sich der Blick auf die Würfel selbst: Auf der Sechs sind mehr Augen ausgebohrt, und ihr Gewicht unterscheidet sich von dem der anderen Seiten.*',
    'In Princeton verwendete man ab 1979 statt Würfeln Zufallszahlengeneratoren. Seit 1998 werden solche Geräte an verschiedenen Orten der Welt aufgestellt und ihre Messwerte verglichen, wenn viele Menschen dasselbe Ereignis erleben.',
    'Die Abteilung hat diese Arbeiten geprüft. Keine enthält die Folgerung, deretwegen dieser Tisch hier steht: Man muss einen Würfel nicht bitten, auf der gewünschten Seite zu landen. Man muss ihn hinlegen.',
    '* Der Gewichtsunterschied erklärte nicht alle Ergebnisse. Für die übrigen Abweichungen nennen die Berichte unterschiedliche Ursachen.',
  ],
  [
    'Über die Abteilung. In den Neunzigerjahren wurde auch an anderen Einrichtungen ähnlich geforscht. Ein Tokioter Tonbandhersteller unterhielt sieben Jahre lang ein Labor für Phänomene, für die sich noch keine Anwendung fand. Bei seiner Schließung lautete das Ergebnis knapper: „Das Phänomen existiert; eine Anwendung gibt es nicht.“',
    'Unsere Abteilung belegt die Hälfte des dritten Stocks, zwischen der Buchhaltung und dem Raum für Dinge, über deren Entsorgung noch niemand entschieden hat. Die Ausgaben für den Tisch laufen unter „Messgeräte“. Die Bezeichnung passt zum Gerät. Die gemessene Größe steht nicht im Antrag.',
    'Seit dem Herbst H10 werden Sitzungen abgehalten. Es gibt sechs Versuchspersonen.',
  ],
  [
    'Ablauf der Sitzung. Die Versuchsperson wirft die Würfel nicht. Sie legt sie nebeneinander: zwei mit der 2, drei mit der 3, vier mit der 4, fünf mit der 5, sechs mit der 6. Der Tisch nimmt die vollständige Gruppe an. VI protokolliert: „ANGENOMMEN“.',
    'Verwenden Sie dieses Wort auch im Gespräch mit den Versuchspersonen. „Verschwunden“, „versunken“ und „fortgegangen“ sind keine Wörter des Protokolls.',
    'Die Tischoberfläche ist die Grenze. Was hinabgeht, gilt als gesendet. Was aufsteigt, gilt als empfangen. Die Richtungen werden vermerkt, die Adressen nicht.',
    'Rauschen in den Kanälen gilt als normaler Betriebszustand der Leitung. Hören Sie nicht länger hin, als die Prüfung verlangt: In zufälligen Geräuschen hört man leicht, dass jemand einen anspricht.*',
    '* Drei Mitarbeiter meldeten, einen Namen gehört zu haben. In allen drei Fällen gehörte er jemand anderem.',
  ],
  [
    'Plätze und Abschluss. Am Tisch gibt es sechs Plätze. Im Programm gibt es sechs Einträge.',
    'Datei 07 ist angelegt, aber keiner Versuchsperson zugeordnet. Im Namensfeld steht UNREGISTERED. Es muss nicht von Hand ausgefüllt werden. Die Registrierung erfolgt automatisch.',
    'Eine Sitzung endet, wenn der Bediener „ENDE“ eingetragen hat. Bis dieser Eintrag erscheint, das Programm nicht ausschalten, den Tisch nicht verlassen und mit den Versuchspersonen über nichts anderes sprechen. Eine mündliche Mitteilung über das Ende gilt nicht als Eintrag.',
    'Fragen zum Abschluss sind an den Bediener des Tisches zu richten.',
    'Änderungen in Fassung 2.06: Anzahl der Plätze 6 → 7.',
  ],
];

const FR: readonly (readonly string[])[] = [
  [
    'VI · révision 2.06 · H13.03.20. Département ■■, institut ■■■■■■. Usage interne.',
    'VI accompagne la séance à la table. La table comprend une surface, des dés, six canaux — un par face — et six places. Le programme ne lance pas les dés et ne décide pas lesquels accepter. Il compte, tient le registre et affiche « ACCEPTÉ » lorsque la table accepte un groupe.',
    'Sans la table, VI passe en mode émulation. Ce mode sert à vérifier le matériel. Aucune séance ne peut y être tenue.*',
    '* La documentation ne précise pas qui a prévu le mode émulation. La demande adressée au développeur est revenue au département sans explication.',
  ],
  [
    'À propos des dés. En 1934, à Duke, on demandait aux sujets de souhaiter un six. Les dés descendaient une goulotte ; on ne demandait rien de plus à la personne. Le six sortait trop souvent. Plus tard, on a examiné les dés eux-mêmes : la face du six porte davantage de points creusés et son poids diffère de celui des autres faces.*',
    'À Princeton, en 1979, des générateurs de nombres aléatoires ont remplacé les dés. Depuis 1998, on en installe dans différentes régions du monde et l’on compare leurs relevés lorsque beaucoup de personnes vivent le même événement.',
    'Le département a étudié ces travaux. Aucun ne contient la conclusion qui justifie la présence de cette table : il ne faut pas demander au dé de tomber sur la face voulue. Il faut le poser.',
    '* La différence de poids n’expliquait pas tous les résultats. Les rapports attribuent les autres écarts à des causes diverses.',
  ],
  [
    'À propos du département. Dans les années quatre-vingt-dix, d’autres établissements menaient des recherches semblables.',
    'Un fabricant de magnétophones de Tokyo a entretenu pendant sept ans un laboratoire consacré à des phénomènes auxquels on ne trouvait pas encore d’application. À sa fermeture, la conclusion fut plus brève : « Le phénomène existe ; il n’a pas d’application. »',
    'Notre département occupe la moitié du troisième étage, entre la comptabilité et la pièce des objets qu’on n’a pas encore décidé de jeter. Les dépenses de la table sont classées parmi les « appareils de mesure ». Le terme convient à l’instrument. La grandeur mesurée n’est pas indiquée sur la demande.',
    'Les séances ont lieu depuis l’automne H10. Il y a six sujets.',
  ],
  [
    'Déroulement de la séance. Le sujet ne lance pas les dés. Il les dispose côte à côte : deux dés portant le 2, trois portant le 3, quatre portant le 4, cinq portant le 5, six portant le 6. La table accepte le groupe formé. VI inscrit : « ACCEPTÉ ».',
    'Conservez ce mot lorsque vous parlez aux sujets. « Disparus », « coulés » et « partis » ne sont pas des termes du protocole.',
    'La surface de la table est une frontière. Ce qui descend est envoyé. Ce qui monte est reçu. Les directions sont consignées ; les adresses ne le sont pas.',
    'Le bruit dans les canaux est considéré comme l’état normal de la ligne. Ne l’écoutez pas plus longtemps que ne l’exige la vérification : dans un son aléatoire, on croit facilement entendre qu’on nous appelle.*',
    '* Trois employés ont déclaré avoir entendu un nom. Dans les trois cas, ce nom appartenait à quelqu’un d’autre.',
  ],
  [
    'Places et clôture. Il y a six places à la table. Il y a six fiches dans le programme.',
    'Le fichier 07 existe, mais n’est attribué à aucun sujet. Le champ du nom indique UNREGISTERED. Il n’est pas nécessaire de le remplir à la main. L’enregistrement se fait automatiquement.',
    'La séance prend fin lorsque l’opérateur inscrit « FIN ». Tant que cette mention n’apparaît pas, ne coupez pas le programme, ne quittez pas la table et ne parlez pas d’autre chose avec les sujets. Une annonce orale de la fin ne tient pas lieu d’inscription.',
    'Toute question sur la clôture doit être adressée à l’opérateur de la table.',
    'Modifications de la révision 2.06 : nombre de places 6 → 7.',
  ],
];

const PAGES: Record<LanguageCode, readonly (readonly string[])[]> = { ru: RU, en: EN, es: ES, pt: PT, tr: TR, de: DE, fr: FR };

/**
 * The pages of the note in a language of the player. With `most`, a page is cut into windows
 * of no more signs than that, each paragraph kept whole: a low screen holds less than a page.
 */
export function readmePages(language: LanguageCode, most = Infinity): readonly (readonly string[])[] {
  const windows: string[][] = [];
  for (const page of PAGES[language]) {
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
