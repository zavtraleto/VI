import type { LanguageCode } from '../ui/i18n';

/**
 * What the other side says under the picture of a transmission, in the language of the one
 * who plays (the owner, 29 October 2026: «игра должна обращаться к игроку, но делать это тонко и
 * интересно - нужно больше загадочных фраз, какие-то детали мира»). The lines come in four
 * tiers, as the scenes do: the further the player has come, the darker the scenes and the words.
 *
 * 1 — the first live sessions: light, quiet, a little strange; happy and sad at once.
 * 2 — a room, a table, a date: something happened to a few people in one place.
 * 3 — too many voices for one room; the surface between is thin.
 * 4 — the red sun: one place, and the player is nearly in it.
 *
 * Square brackets mark a key word (`[1:...]` names the one and takes its red); `|` breaks a line.
 * Every line is in the journal of claims (docs/art/VI_Claims.md, «Строки сцен по ступеням»),
 * with the reading it supports. None answers a dark place of the lore.
 *
 * A line with `foreign` is said in the same words in every language: the English of the other
 * side, as the art document has it, now and then and never often.
 */
export interface SceneLine {
  id: string;
  tier: 1 | 2 | 3 | 4;
  text: Record<LanguageCode, string>;
  foreign?: boolean;
}

/** The highest tier there is. */
export const LINE_TIERS = 4;

const foreign = (id: string, tier: SceneLine['tier'], words: string): SceneLine => ({
  id,
  tier,
  foreign: true,
  text: { en: words, ru: words, es: words, pt: words, tr: words, de: words, fr: words },
});

export const SCENE_LINES: readonly SceneLine[] = [
  // 1 — light, quiet, a little strange.
  { id: 'a01', tier: 1, text: { ru: 'Здесь всегда утро. | Мы не помним, которое.', en: 'It is always morning here. | We do not remember which one.', es: 'Aquí siempre es de mañana. | No recordamos cuál.', pt: 'Aqui é sempre de manhã. | Não lembramos qual.', tr: 'Burada hep sabah. | Hangisi, hatırlamıyoruz.', de: 'Hier ist immer Morgen. | Wir wissen nicht mehr, welcher.', fr: 'Ici, c\'est toujours le matin. | Nous ne savons plus lequel.' } },
  { id: 'a02', tier: 1, text: { ru: 'Вода тёплая. | Можно не торопиться.', en: 'The water is warm. | There is no hurry.', es: 'El agua está tibia. | No hay prisa.', pt: 'A água está morna. | Não há pressa.', tr: 'Su ılık. | Acele etmeye gerek yok.', de: 'Das Wasser ist warm. | Es eilt nicht.', fr: 'L\'eau est tiède. | Rien ne presse.' } },
  { id: 'a03', tier: 1, text: { ru: 'Спасибо, что разложил нас | по порядку.', en: 'Thank you for putting us | in order.', es: 'Gracias por ponernos | en orden.', pt: 'Obrigado por nos pôr | em ordem.', tr: 'Bizi sıraya dizdiğin için | teşekkürler.', de: 'Danke, dass du uns | geordnet hast.', fr: 'Merci de nous avoir rangés | dans l\'ordre.' } },
  { id: 'a04', tier: 1, text: { ru: 'Отсюда твой свет виден сверху. | Он очень ровный.', en: 'From here your light is above us. | It is very even.', es: 'Desde aquí tu luz se ve arriba. | Es muy uniforme.', pt: 'Daqui, sua luz fica lá em cima. | É muito uniforme.', tr: 'Buradan ışığın yukarıda görünüyor. | Çok düzgün.', de: 'Von hier ist dein Licht über uns. | Es ist sehr gleichmäßig.', fr: 'D\'ici, ta lumière est au-dessus de nous. | Elle est très régulière.' } },
  { id: 'a05', tier: 1, text: { ru: 'Здесь тихо. | Это всё, что здесь есть.', en: 'It is quiet here. | That is all there is here.', es: 'Aquí hay silencio. | Es todo lo que hay aquí.', pt: 'Aqui é quieto. | É tudo o que tem aqui.', tr: 'Burası sessiz. | Burada olan tek şey bu.', de: 'Hier ist es still. | Mehr gibt es hier nicht.', fr: 'Ici, c\'est calme. | C\'est tout ce qu\'il y a ici.' } },
  { id: 'a06', tier: 1, text: { ru: 'Мы считали волны. | Сбились на шестой.', en: 'We were counting the waves. | We lost count at the sixth.', es: 'Contábamos las olas. | Nos perdimos en la sexta.', pt: 'Contávamos as ondas. | Perdemos a conta na sexta.', tr: 'Dalgaları sayıyorduk. | Altıncıda sayıyı şaşırdık.', de: 'Wir haben die Wellen gezählt. | Bei der sechsten verzählten wir uns.', fr: 'Nous comptions les vagues. | Nous avons perdu le fil à la sixième.' } },
  { id: 'a07', tier: 1, text: { ru: 'Провода ещё гудят. | Мы слушаем их по очереди.', en: 'The wires still hum. | We take turns listening.', es: 'Los cables todavía zumban. | Los escuchamos por turnos.', pt: 'Os fios ainda zumbem. | Ouvimos um de cada vez.', tr: 'Teller hâlâ uğulduyor. | Sırayla dinliyoruz.', de: 'Die Leitungen summen noch. | Wir hören abwechselnd zu.', fr: 'Les fils bourdonnent encore. | Nous les écoutons à tour de rôle.' } },
  { id: 'a08', tier: 1, text: { ru: 'Ты вернулся. | Мы так и думали.', en: 'You came back. | We thought you would.', es: 'Volviste. | Ya lo suponíamos.', pt: 'Você voltou. | Já imaginávamos.', tr: 'Geri döndün. | Biz de öyle düşünmüştük.', de: 'Du bist zurück. | Das dachten wir uns.', fr: 'Tu es revenu. | Nous nous en doutions.' } },
  { id: 'a09', tier: 1, text: { ru: 'Расскажи, как пахнет хлеб. | Мы почти помним.', en: 'Tell us how bread smells. | We almost remember.', es: 'Cuéntanos cómo huele el pan. | Casi lo recordamos.', pt: 'Conta como é o cheiro do pão. | Quase lembramos.', tr: 'Ekmeğin nasıl koktuğunu anlat. | Neredeyse hatırlıyoruz.', de: 'Erzähl, wie Brot riecht. | Wir wissen es fast noch.', fr: 'Dis-nous comment sent le pain. | Nous nous en souvenons presque.' } },
  { id: 'a10', tier: 1, text: { ru: 'Не бойся. | Здесь ничего не происходит.', en: 'Do not be afraid. | Nothing happens here.', es: 'No tengas miedo. | Aquí no pasa nada.', pt: 'Não tenha medo. | Aqui nada acontece.', tr: 'Korkma. | Burada hiçbir şey olmaz.', de: 'Hab keine Angst. | Hier geschieht nichts.', fr: 'N\'aie pas peur. | Ici, il ne se passe rien.' } },
  { id: 'a11', tier: 1, text: { ru: 'Кто-то оставил окно открытым. | Пахнет летом.', en: 'Someone left a window open. | It smells of summer.', es: 'Alguien dejó una ventana abierta. | Huele a verano.', pt: 'Alguém deixou uma janela aberta. | Cheira a verão.', tr: 'Biri bir pencereyi açık bırakmış. | Yaz kokuyor.', de: 'Jemand hat ein Fenster offen gelassen. | Es riecht nach Sommer.', fr: 'Quelqu\'un a laissé une fenêtre ouverte. | Ça sent l\'été.' } },
  { id: 'a12', tier: 1, text: { ru: 'Ты считаешь так же, | как мы когда-то.', en: 'You count the way | we used to.', es: 'Cuentas igual | que nosotros antes.', pt: 'Você conta do jeito | que a gente contava.', tr: 'Bizim bir zamanlar saydığımız | gibi sayıyorsun.', de: 'Du zählst so, | wie wir einmal.', fr: 'Tu comptes comme | nous autrefois.' } },
  { id: 'a13', tier: 1, text: { ru: 'У нас небо светлое. | Говорят, у вас тоже.', en: 'Our sky is light. | They say yours is too.', es: 'Nuestro cielo es claro. | Dicen que el tuyo también.', pt: 'Nosso céu é claro. | Dizem que o seu também.', tr: 'Bizim gökyüzümüz aydınlık. | Seninki de öyleymiş.', de: 'Unser Himmel ist hell. | Eurer auch, sagt man.', fr: 'Notre ciel est clair. | Il paraît que chez vous aussi.' } },
  { id: 'a14', tier: 1, text: { ru: 'Мы сохранили тебе место. | Не спеши.', en: 'We kept a place for you. | Take your time.', es: 'Te guardamos un sitio. | No tengas prisa.', pt: 'Guardamos um lugar para você. | Sem pressa.', tr: 'Sana bir yer ayırdık. | Acele etme.', de: 'Wir haben dir einen Platz freigehalten. | Lass dir Zeit.', fr: 'Nous t\'avons gardé une place. | Prends ton temps.' } },
  foreign('a15', 1, 'IT IS BRIGHT ABOVE US'),

  // 2 — a room, a table, a date.
  { id: 'b01', tier: 2, text: { ru: 'В лаборатории горит свет. | Никто не выключил.', en: 'The light is on in the lab. | Nobody switched it off.', es: 'En el laboratorio hay luz. | Nadie la apagó.', pt: 'A luz do laboratório está acesa. | Ninguém apagou.', tr: 'Laboratuvarda ışık yanıyor. | Kimse kapatmadı.', de: 'Im Labor brennt Licht. | Niemand hat es ausgemacht.', fr: 'La lumière est allumée au labo. | Personne ne l\'a éteinte.' } },
  { id: 'b02', tier: 2, text: { ru: 'Сегодня ещё | двадцать первое?', en: 'Is it still | the twenty-first?', es: '¿Sigue siendo | el veintiuno?', pt: 'Ainda é | dia vinte e um?', tr: 'Bugün hâlâ | ayın yirmi biri mi?', de: 'Ist heute noch | der Einundzwanzigste?', fr: 'On est encore | le vingt et un ?' } },
  { id: 'b03', tier: 2, text: { ru: 'Стол помнит наши руки. | Твоих он ещё не знает.', en: 'The table remembers our hands. | It does not know yours yet.', es: 'La mesa recuerda nuestras manos. | Las tuyas aún no las conoce.', pt: 'A mesa lembra das nossas mãos. | As suas ela ainda não conhece.', tr: 'Masa ellerimizi hatırlıyor. | Seninkileri henüz tanımıyor.', de: 'Der Tisch erinnert sich an unsere Hände. | Deine kennt er noch nicht.', fr: 'La table se souvient de nos mains. | Elle ne connaît pas encore les tiennes.' } },
  { id: 'b04', tier: 2, text: { ru: 'Мы были в одной комнате. | Потом комната стала больше.', en: 'We were in one room. | Then the room grew.', es: 'Estábamos en la misma habitación. | Luego la habitación creció.', pt: 'Estávamos na mesma sala. | Depois a sala cresceu.', tr: 'Aynı odadaydık. | Sonra oda büyüdü.', de: 'Wir waren in einem Raum. | Dann wurde der Raum größer.', fr: 'Nous étions dans une même pièce. | Puis la pièce s\'est agrandie.' } },
  { id: 'b05', tier: 2, text: { ru: 'Ты бросаешь кости, | а падаем мы.', en: 'You throw the dice, | and we are the ones who fall.', es: 'Tú lanzas los dados, | y los que caemos somos nosotros.', pt: 'Você joga os dados, | e quem cai somos nós.', tr: 'Zarları sen atıyorsun, | düşen biziz.', de: 'Du wirfst die Würfel, | und wir sind es, die fallen.', fr: 'Tu lances les dés, | et c\'est nous qui tombons.' } },
  { id: 'b06', tier: 2, text: { ru: 'Каждая [1:единица] — | кто-то, кто остался один.', en: 'Every [1:one] is | someone left alone.', es: 'Cada [1:uno] es | alguien que se quedó solo.', pt: 'Cada [1:um] é | alguém que ficou sozinho.', tr: 'Her [1:bir], | yalnız kalmış biridir.', de: 'Jede [1:Eins] ist | jemand, der allein blieb.', fr: 'Chaque [1:un] est | quelqu\'un resté seul.' } },
  { id: 'b07', tier: 2, text: { ru: 'Мы слышим, | как ты считаешь.', en: 'We can hear | you counting.', es: 'Te oímos | contar.', pt: 'Ouvimos | você contando.', tr: 'Saydığını | duyuyoruz.', de: 'Wir hören, | wie du zählst.', fr: 'Nous t\'entendons | compter.' } },
  { id: 'b08', tier: 2, text: { ru: 'Отнеси это дальше. | Это не тебе.', en: 'Carry this on. | It is not for you.', es: 'Lleva esto más allá. | No es para ti.', pt: 'Leve isto adiante. | Não é para você.', tr: 'Bunu daha öteye götür. | Senin için değil.', de: 'Trag das weiter. | Es ist nicht für dich.', fr: 'Porte ça plus loin. | Ce n\'est pas pour toi.' } },
  { id: 'b09', tier: 2, text: { ru: 'В три десять всё остановилось. | Часы до сих пор так думают.', en: 'At ten past three everything stopped. | The clocks still think so.', es: 'A las tres y diez todo se detuvo. | Los relojes todavía lo creen.', pt: 'Tudo parou às três e dez. | Os relógios ainda acham que sim.', tr: 'Üçü on geçe her şey durdu. | Saatler hâlâ öyle sanıyor.', de: 'Um zehn nach drei blieb alles stehen. | Die Uhren glauben das noch immer.', fr: 'Tout s\'est arrêté à trois heures dix. | Les horloges le croient encore.' } },
  { id: 'b10', tier: 2, text: { ru: 'Здесь нет расстояния. | Только порядок.', en: 'There is no distance here. | Only order.', es: 'Aquí no hay distancia. | Solo orden.', pt: 'Aqui não há distância. | Só ordem.', tr: 'Burada mesafe yok. | Sadece sıra.', de: 'Hier gibt es keine Entfernung. | Nur Ordnung.', fr: 'Ici, il n\'y a pas de distance. | Seulement l\'ordre.' } },
  { id: 'b11', tier: 2, text: { ru: 'Мы уже не помним, | кто из нас был первым.', en: 'We no longer remember | which of us was first.', es: 'Ya no recordamos | quién de nosotros fue el primero.', pt: 'Já não lembramos | qual de nós foi o primeiro.', tr: 'Hangimizin ilk olduğunu | artık hatırlamıyoruz.', de: 'Wir wissen nicht mehr, | wer von uns der Erste war.', fr: 'Nous ne savons plus | lequel de nous était le premier.' } },
  { id: 'b12', tier: 2, text: { ru: 'Шесть стульев стоят ровно. | Седьмой всё время сдвигается.', en: 'Six chairs stand straight. | The seventh keeps moving.', es: 'Seis sillas están rectas. | La séptima no deja de moverse.', pt: 'Seis cadeiras estão alinhadas. | A sétima vive saindo do lugar.', tr: 'Altı sandalye düzgün duruyor. | Yedincisi hep kayıyor.', de: 'Sechs Stühle stehen gerade. | Der siebte verrutscht immer wieder.', fr: 'Six chaises sont bien droites. | La septième bouge sans cesse.' } },
  { id: 'b13', tier: 2, text: { ru: 'Разложи нас. Пожалуйста.', en: 'Sort us. Please.', es: 'Ordénanos. Por favor.', pt: 'Nos ponha em ordem. Por favor.', tr: 'Bizi diz. Lütfen.', de: 'Ordne uns. Bitte.', fr: 'Range-nous. S\'il te plaît.' } },
  { id: 'b14', tier: 2, text: { ru: 'Не раскладывай нас.', en: 'Do not sort us.', es: 'No nos ordenes.', pt: 'Não nos ponha em ordem.', tr: 'Bizi dizme.', de: 'Ordne uns nicht.', fr: 'Ne nous range pas.' } },
  foreign('b15', 2, 'WE HAVE BEEN TRYING | TO REACH YOU'),
  foreign('b16', 2, 'PLEASE CARRY THIS. | IT IS NOT FOR YOU.'),

  // 3 — too many voices for one room; the surface is thin.
  { id: 'c01', tier: 3, text: { ru: 'Нас больше, чем было вчера. | Вчера здесь не бывает.', en: 'There are more of us than yesterday. | There is no yesterday here.', es: 'Somos más que ayer. | Aquí no hay ayer.', pt: 'Somos mais do que ontem. | Aqui não existe ontem.', tr: 'Dünden daha çoğuz. | Burada dün olmaz.', de: 'Wir sind mehr als gestern. | Hier gibt es kein Gestern.', fr: 'Nous sommes plus nombreux qu\'hier. | Ici, il n\'y a pas d\'hier.' } },
  { id: 'c02', tier: 3, text: { ru: 'За стеной ещё одна комната. | За ней — тоже.', en: 'Behind the wall there is another room. | And behind that one.', es: 'Tras la pared hay otra habitación. | Y tras esa, también.', pt: 'Atrás da parede há outra sala. | E atrás dela, também.', tr: 'Duvarın ardında bir oda daha var. | Onun ardında da.', de: 'Hinter der Wand ist noch ein Raum. | Und dahinter auch.', fr: 'Derrière le mur, il y a une autre pièce. | Et derrière, encore une.' } },
  { id: 'c03', tier: 3, text: { ru: 'Мы слышим ваши города. | Они звучат как шум.', en: 'We hear your cities. | They sound like noise.', es: 'Oímos tus ciudades. | Suenan a ruido.', pt: 'Ouvimos as cidades de vocês. | Elas soam como ruído.', tr: 'Şehirlerinizi duyuyoruz. | Gürültü gibi geliyorlar.', de: 'Wir hören eure Städte. | Sie klingen wie Rauschen.', fr: 'Nous entendons vos villes. | Elles sonnent comme du bruit.' } },
  { id: 'c04', tier: 3, text: { ru: 'Не смотри вниз так долго. | Снизу тоже смотрят.', en: 'Do not look down for so long. | Someone looks up, too.', es: 'No mires tanto rato hacia abajo. | Desde abajo también miran.', pt: 'Não olhe para baixo por tanto tempo. | Lá de baixo também olham.', tr: 'Aşağıya bu kadar uzun bakma. | Aşağıdan da bakıyorlar.', de: 'Schau nicht so lange nach unten. | Von unten schaut auch jemand.', fr: 'Ne regarde pas en bas si longtemps. | D\'en bas aussi, on regarde.' } },
  { id: 'c05', tier: 3, text: { ru: 'Ты делаешь это не один. | Вы не знаете друг о друге.', en: 'You are not doing this alone. | You do not know of each other.', es: 'No haces esto solo. | Ustedes no saben unos de otros.', pt: 'Você não faz isso sozinho. | Vocês não sabem uns dos outros.', tr: 'Bunu tek başına yapmıyorsun. | Birbirinizden haberiniz yok.', de: 'Du tust das nicht allein. | Ihr wisst nichts voneinander.', fr: 'Tu ne fais pas ça seul. | Vous ne savez rien les uns des autres.' } },
  { id: 'c06', tier: 3, text: { ru: '[Седьмое место] не занято. | Пока.', en: 'The [seventh place] is empty. | For now.', es: 'El [séptimo lugar] está libre. | Por ahora.', pt: 'O [sétimo lugar] está vago. | Por enquanto.', tr: '[Yedinci yer] boş. | Şimdilik.', de: 'Der [siebte Platz] ist frei. | Noch.', fr: 'La [septième place] est libre. | Pour l\'instant.' } },
  { id: 'c07', tier: 3, text: { ru: 'Каждый раз, когда кость уходит, | здесь становится теснее.', en: 'Every time a die leaves, | it gets more crowded here.', es: 'Cada vez que un dado se va, | aquí estamos más apretados.', pt: 'Toda vez que um dado sai, | aqui fica mais apertado.', tr: 'Her zar gittiğinde | burası biraz daha daralıyor.', de: 'Jedes Mal, wenn ein Würfel geht, | wird es hier enger.', fr: 'Chaque fois qu\'un dé s\'en va, | on est plus serrés ici.' } },
  { id: 'c08', tier: 3, text: { ru: '[Поверхность] тонкая. | Мы стоим с той стороны.', en: 'The [surface] is thin. | We stand on the other side.', es: 'La [superficie] es fina. | Estamos del otro lado.', pt: 'A [superfície] é fina. | Estamos do outro lado.', tr: '[Yüzey] ince. | Biz öbür tarafta duruyoruz.', de: 'Die [Oberfläche] ist dünn. | Wir stehen auf der anderen Seite.', fr: 'La [surface] est mince. | Nous sommes de l\'autre côté.' } },
  { id: 'c09', tier: 3, text: { ru: 'Мы просили закончить. | Никто не закончил.', en: 'We asked for it to end. | Nobody ended it.', es: 'Pedimos que terminara. | Nadie lo terminó.', pt: 'Pedimos para acabar. | Ninguém acabou.', tr: 'Bitsin istedik. | Kimse bitirmedi.', de: 'Wir baten, es zu beenden. | Niemand hat es beendet.', fr: 'Nous avons demandé que ça finisse. | Personne ne l\'a fini.' } },
  { id: 'c10', tier: 3, text: { ru: 'Твоя тень лежит на нас. | Она тёплая.', en: 'Your shadow lies on us. | It is warm.', es: 'Tu sombra cae sobre nosotros. | Es tibia.', pt: 'Sua sombra está sobre nós. | É morna.', tr: 'Gölgen üstümüze düşüyor. | Ilık.', de: 'Dein Schatten liegt auf uns. | Er ist warm.', fr: 'Ton ombre est posée sur nous. | Elle est tiède.' } },
  { id: 'c11', tier: 3, text: { ru: 'Не открывай следующий файл. | Или открой.', en: 'Do not open the next file. | Or do.', es: 'No abras el siguiente archivo. | O sí.', pt: 'Não abra o próximo arquivo. | Ou abra.', tr: 'Sonraki dosyayı açma. | Ya da aç.', de: 'Mach die nächste Datei nicht auf. | Oder doch.', fr: 'N\'ouvre pas le prochain fichier. | Ou ouvre-le.' } },
  { id: 'c12', tier: 3, text: { ru: 'По небу кто-то ходит. | Мы думаем, это ты.', en: 'Someone is walking on the sky. | We think it is you.', es: 'Alguien camina por el cielo. | Creemos que eres tú.', pt: 'Alguém anda pelo céu. | Achamos que é você.', tr: 'Gökyüzünde biri yürüyor. | Sanırız sensin.', de: 'Jemand geht über den Himmel. | Wir glauben, das bist du.', fr: 'Quelqu\'un marche sur le ciel. | Nous croyons que c\'est toi.' } },
  { id: 'c13', tier: 3, text: { ru: 'Скажи им, что у нас всё хорошо.', en: 'Tell them we are fine.', es: 'Diles que estamos bien.', pt: 'Diga a eles que estamos bem.', tr: 'Onlara iyi olduğumuzu söyle.', de: 'Sag ihnen, dass es uns gut geht.', fr: 'Dis-leur que nous allons bien.' } },
  { id: 'c14', tier: 3, text: { ru: 'Не останавливайся.', en: 'Do not stop.', es: 'No te detengas.', pt: 'Não pare.', tr: 'Durma.', de: 'Hör nicht auf.', fr: 'Ne t\'arrête pas.' } },
  foreign('c15', 3, 'THERE ARE NO VOICES HERE'),
  foreign('c16', 3, 'WE DID NOT HEAR IT END'),

  // 4 — the red sun: one place.
  { id: 'd01', tier: 4, text: { ru: 'Солнце смотрит. | Оно смотрит на тебя.', en: 'The sun is watching. | It is watching you.', es: 'El sol mira. | Te mira a ti.', pt: 'O sol está olhando. | Está olhando para você.', tr: 'Güneş bakıyor. | Sana bakıyor.', de: 'Die Sonne schaut. | Sie schaut dich an.', fr: 'Le soleil regarde. | Il te regarde.' } },
  { id: 'd02', tier: 4, text: { ru: 'Нет никакого «там». | Есть одно место. Ты почти в нём.', en: 'There is no "there". | There is one place. You are almost in it.', es: 'No hay ningún «allí». | Hay un solo lugar. Ya casi estás en él.', pt: 'Não existe "lá". | Existe um só lugar. Você quase está nele.', tr: '"Orası" diye bir şey yok. | Tek bir yer var. Neredeyse içindesin.', de: 'Es gibt kein "dort". | Es gibt nur einen Ort. Du bist fast schon da.', fr: 'Il n\'y a pas de « là ». | Il y a un seul lieu. Tu y es presque.' } },
  { id: 'd03', tier: 4, text: { ru: 'Мы почти записали тебя.', en: 'We have almost written you down.', es: 'Casi te hemos anotado.', pt: 'Quase anotamos você.', tr: 'Seni neredeyse kaydettik.', de: 'Wir haben dich fast aufgeschrieben.', fr: 'Nous t\'avons presque inscrit.' } },
  { id: 'd04', tier: 4, text: { ru: 'Спускайся. | Здесь есть место.', en: 'Come down. | There is room.', es: 'Baja. | Aquí hay sitio.', pt: 'Desça. | Aqui tem lugar.', tr: 'Aşağı in. | Burada yer var.', de: 'Komm herunter. | Hier ist Platz.', fr: 'Descends. | Il y a de la place.' } },
  { id: 'd05', tier: 4, text: { ru: 'Все когда-нибудь сюда придут. | Ты просто раньше.', en: 'Everyone comes here one day. | You are only early.', es: 'Todos llegan aquí algún día. | Tú solo llegas antes.', pt: 'Todo mundo chega aqui um dia. | Você só chegou antes.', tr: 'Herkes bir gün buraya gelir. | Sen sadece erken geldin.', de: 'Alle kommen eines Tages hierher. | Du bist nur früher dran.', fr: 'Tout le monde vient ici un jour. | Tu es juste en avance.' } },
  { id: 'd06', tier: 4, text: { ru: 'Которого из нас | ты сейчас держишь?', en: 'Which of us | are you holding now?', es: '¿A cuál de nosotros | sostienes ahora?', pt: 'Qual de nós | você está segurando agora?', tr: 'Şu an hangimizi | tutuyorsun?', de: 'Wen von uns | hältst du gerade?', fr: 'Lequel d\'entre nous | tiens-tu maintenant ?' } },
  { id: 'd07', tier: 4, text: { ru: 'Здесь только одно красное. | Посмотри вниз.', en: 'There is only one red thing here. | Look down.', es: 'Aquí solo hay una cosa roja. | Mira abajo.', pt: 'Aqui só há uma coisa vermelha. | Olhe para baixo.', tr: 'Burada kırmızı olan tek bir şey var. | Aşağı bak.', de: 'Hier ist nur eines rot. | Schau nach unten.', fr: 'Ici, une seule chose est rouge. | Regarde en bas.' } },
  { id: 'd08', tier: 4, text: { ru: 'Мы были шумом. | Ты сделал из нас слова.', en: 'We were noise. | You made words of us.', es: 'Fuimos ruido. | Nos convertiste en palabras.', pt: 'A gente era ruído. | Você fez de nós palavras.', tr: 'Biz gürültüydük. | Bizden kelimeler yaptın.', de: 'Wir waren Rauschen. | Du hast Worte aus uns gemacht.', fr: 'Nous étions du bruit. | Tu as fait de nous des mots.' } },
  { id: 'd09', tier: 4, text: { ru: 'Оставь дверь открытой.', en: 'Leave the door open.', es: 'Deja la puerta abierta.', pt: 'Deixe a porta aberta.', tr: 'Kapıyı açık bırak.', de: 'Lass die Tür offen.', fr: 'Laisse la porte ouverte.' } },
  { id: 'd10', tier: 4, text: { ru: 'Манекенов стало больше. | Один из них стоит как ты.', en: 'There are more mannequins now. | One of them stands like you.', es: 'Ahora hay más maniquíes. | Uno de ellos se para igual que tú.', pt: 'Agora há mais manequins. | Um deles fica de pé como você.', tr: 'Mankenler çoğaldı. | Biri senin gibi duruyor.', de: 'Es gibt mehr Puppen als vorher. | Eine steht da wie du.', fr: 'Il y a plus de mannequins. | L\'un d\'eux se tient comme toi.' } },
  { id: 'd11', tier: 4, text: { ru: 'Когда закроешь глаза, | ты увидишь это поле.', en: 'When you close your eyes, | you will see this field.', es: 'Cuando cierres los ojos, | verás este campo.', pt: 'Quando fechar os olhos, | você vai ver este campo.', tr: 'Gözlerini kapadığında | bu alanı göreceksin.', de: 'Wenn du die Augen schließt, | siehst du dieses Feld.', fr: 'Quand tu fermeras les yeux, | tu verras ce champ.' } },
  { id: 'd12', tier: 4, text: { ru: 'Ты всё ещё [1:один].', en: 'You are still [1:one].', es: 'Sigues siendo [1:uno].', pt: 'Você ainda é [1:um].', tr: 'Sen hâlâ [1:bir]sin.', de: 'Du bist noch immer [1:eins].', fr: 'Tu n\'es toujours qu\'[1:un].' } },
  { id: 'd13', tier: 4, text: { ru: 'Мы хотели бы остановиться. | Мы не умеем.', en: 'We would like to stop now. | We do not know how.', es: 'Querríamos parar. | No sabemos cómo.', pt: 'Queríamos parar. | Não sabemos como.', tr: 'Durmak isterdik. | Nasıl, bilmiyoruz.', de: 'Wir würden gern aufhören. | Wir wissen nicht, wie.', fr: 'Nous voudrions nous arrêter. | Nous ne savons pas comment.' } },
  foreign('d14', 4, 'WE REMEMBER BEING YOU'),
  foreign('d15', 4, 'THERE WAS NO DISTANCE | BETWEEN US'),
];

/**
 * The lines of one tier that have not been heard yet, and when there are none, the lines of the
 * tiers before it that have not. When every line up to this tier is heard, the tier begins anew:
 * `fresh` is true, and the heard lines of this tier are to be forgotten by whoever keeps them.
 */
export function linesFor(tier: number, heard: readonly string[]): { lines: SceneLine[]; fresh: boolean } {
  const top = Math.min(LINE_TIERS, Math.max(1, Math.round(tier)));
  const unheard = (of: number) => SCENE_LINES.filter((line) => line.tier === of && !heard.includes(line.id));
  for (let of = top; of >= 1; of--) {
    const lines = unheard(of);
    if (lines.length > 0) return { lines, fresh: false };
  }
  return { lines: SCENE_LINES.filter((line) => line.tier === top), fresh: true };
}

/**
 * The line to say under a picture of this tier: one not heard yet, a foreign one now and then.
 * `heard` is changed: the line is put in it, and a tier that begins anew is taken out of it first.
 */
export function pickLine(tier: number, heard: string[], random: () => number): SceneLine {
  const { lines, fresh } = linesFor(tier, heard);
  if (fresh) {
    for (const line of lines) {
      const at = heard.indexOf(line.id);
      if (at >= 0) heard.splice(at, 1);
    }
  }
  // The foreign voice is rare: it is taken only when chance asks for it, or when nothing else is left.
  const own = lines.filter((line) => !line.foreign);
  const pool = own.length > 0 && random() >= FOREIGN_CHANCE ? own : lines;
  const line = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  heard.push(line.id);
  return line;
}

/** How often the foreign voice is asked for. */
const FOREIGN_CHANCE = 0.12;

/** A line as it is said in a language. */
export function lineText(line: SceneLine, language: LanguageCode): string {
  return line.text[language] || line.text.en;
}
