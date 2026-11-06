import type { LanguageCode } from './i18n';

/**
 * What the records of the link say (docs/superpowers/specs/2026-11-04-vi-star-novel-design.md,
 * section 3): a title, and the lines of two voices one after another. The operator is our side, a
 * person at the desk; the voice is the other side, says "we", and is written in small letters.
 *
 * These are the four acts of variant A "Link" (docs/superpowers/specs/2026-11-05-vi-story-idea-design.md,
 * sections 9, 10 and 13): records 01-03 are act I, 04-07 act II "Room", 08-11 act III "Voices",
 * 12-15 act IV "Bridge". In act III his lines lose their capitals; in act IV hers have them, and in
 * 15 the seat of the operator speaks with her words. The voice lines are recorded in
 * docs/art/VI_Claims.md, "Новелла, вариант А", acts I to IV.
 * Russian and English; the other five languages say the English for now.
 */

/** Who says a line: our side, or the other. */
export type NovelWho = 'operator' | 'voice';

export interface NovelLine {
  who: NovelWho;
  text: string;
}

export interface NovelEpisode {
  title: string;
  lines: readonly NovelLine[];
}

const op = (text: string): NovelLine => ({ who: 'operator', text });
const vo = (text: string): NovelLine => ({ who: 'voice', text });

const RU: Record<string, NovelEpisode> = {
  n01: {
    title: 'Приём',
    lines: [
      op('Есть приём. Второй канал.'),
      op('Это не помеха. Помеха не держит ритм.'),
      op('Ритм держишь ты. Каждая группа — такт.'),
      vo('…мы слышим.'),
      op('Кто на линии?'),
      vo('сложи ещё. тогда скажем.'),
      op('Записываю. Продолжай.'),
    ],
  },
  n02: {
    title: 'Ответ',
    lines: [
      op('Вчерашняя запись на месте. Значит, не показалось.'),
      vo('у нас нет «вчера».'),
      op('Где это — «у вас»?'),
      vo('под водой. над небом. это одно место.'),
      op('Сколько вас?'),
      vo('мы не считаем. считать — это у вас.'),
      op('Сигнал слабый. Нужно точнее.'),
      vo('собирай ровно. тогда слышно.'),
    ],
  },
  n03: {
    title: 'Имя',
    lines: [
      vo('у тебя есть имя?'),
      op('По протоколу имён не называют.'),
      vo('мы помним, как это — иметь имя.'),
      op('Канал держится дольше. Это твоя работа.'),
      vo('…я помню.'),
      op('Ты сказала «я».'),
      vo('скажи своё. тогда я скажу своё.'),
      op('Конец записи.'),
    ],
  },
  n04: {
    title: 'Лицо',
    lines: [
      op('Сигнал чище. На экране что-то есть.'),
      op('Это… лицо.'),
      vo('ты видишь меня?'),
      op('Вижу. Плохо, но вижу.'),
      vo('у меня было лицо. я его забыла.'),
      vo('скажи, какое оно.'),
      op('…Ты смотришь прямо на меня.'),
      vo('я тебя не вижу. только слышу, как ты считаешь.'),
    ],
  },
  n05: {
    title: 'Комната',
    lines: [
      vo('я помню комнату.'),
      op('Опиши.'),
      vo('стол. на нём кости. свет сверху, жёлтый.'),
      vo('кто-то держал меня за руку.'),
      op('Кто?'),
      vo('не помню лица. помню, что было тепло.'),
      op('Стол с костями. Как этот?'),
      vo('как этот.'),
    ],
  },
  n06: {
    title: 'Вода',
    lines: [
      op('Ты пропадала. Три ночи — один шум.'),
      vo('я была в воде. там тихо.'),
      vo('когда ты уходишь, я снова тону.'),
      op('Я не могу сидеть здесь всё время.'),
      vo('пусть тот, кто кладёт кости, не останавливается.'),
      op('Слышал? Не останавливайся.'),
      vo('тогда я держусь у поверхности.'),
    ],
  },
  n07: {
    title: 'Мы',
    lines: [
      vo('я вспомнила, как звучит мой голос.'),
      op('И как?'),
      vo('как твой.'),
      op('Это эхо канала. Так бывает.'),
      vo('ты сегодня долго. тебе не холодно?'),
      op('Нет. Нам здесь хорошо.'),
      vo('«нам».'),
      op('Конец записи.'),
    ],
  },
  n08: {
    title: 'Другие',
    lines: [
      op('На канале не один голос. Под ней — ещё.'),
      vo('они всегда были. ты их не слышал.'),
      op('Кто они?'),
      vo('те, кто не вспомнил.'),
      op('А ты вспомнила.'),
      vo('не всё. когда ты слушаешь — я помню больше.'),
      vo('когда ты молчишь — я снова мы.'),
      op('Записываю.'),
    ],
  },
  n09: {
    title: 'Тише',
    lines: [
      op('Я перестал уходить домой. Пока я здесь, канал держится.'),
      vo('ты стал тише.'),
      op('тише?'),
      vo('раньше ты говорил как за стеклом.'),
      vo('теперь — как отсюда.'),
      op('это усталость. только усталость.'),
      vo('они тоже тебя слышат. они тянутся.'),
      op('ты, у доски. держи ритм.'),
    ],
  },
  n10: {
    title: 'Тяга',
    lines: [
      vo('я видела твой стол. свет сверху, жёлтый.'),
      op('значит, ты видишь меня.'),
      vo('не тебя. стол. тебя за ним почти нет.'),
      op('я здесь.'),
      vo('тогда почему ты пишешь, как я?'),
      op('…не знаю.'),
      vo('я думала, ты тянешь меня наверх.'),
      vo('а если это я тяну тебя вниз?'),
    ],
  },
  n11: {
    title: 'Выйти',
    lines: [
      vo('они зовут меня обратно. громко.'),
      op('держись. сигнал почти чистый.'),
      vo('я не хочу обратно.'),
      vo('я хочу выйти.'),
      op('куда?'),
      vo('к тебе. на твою сторону поверхности.'),
      vo('ты меня слышишь?'),
      op('…мы слышим.'),
    ],
  },
  n12: {
    title: 'Мост',
    lines: [
      vo('Связь чище, чем когда-либо.'),
      op('ты пишешь иначе.'),
      vo('Я вспомнила, как держат ручку.'),
      op('а я забываю.'),
      vo('Что?'),
      op('улицу, по которой шёл сюда.'),
      vo('Не бойся. Там тихо.'),
      op('откуда ты знаешь, что я боюсь?'),
    ],
  },
  n13: {
    title: 'Обмен',
    lines: [
      vo('Собирай ровно. Тогда я выйду.'),
      op('если ты выйдешь, кто останется?'),
      vo('У воды всегда кто-то остаётся.'),
      op('кто-то.'),
      vo('Ты говорил, что не можешь сидеть здесь всё время.'),
      op('я больше не хочу уходить.'),
      vo('Вот видишь.'),
      op('конец записи.'),
    ],
  },
  n14: {
    title: 'Поверхность',
    lines: [
      op('на экране вода. я её слышу.'),
      vo('Это поверхность. Ты близко.'),
      op('ты говорила, там тихо.'),
      vo('Тихо. Только тесно.'),
      op('они зовут меня по имени. я его не называл.'),
      vo('Ты сказал мне. В шуме, давно.'),
      op('я не помню.'),
      vo('Ничего. Я помню за двоих.'),
    ],
  },
  n15: {
    title: 'Второй канал',
    lines: [
      op('Есть приём. Второй канал.'),
      op('Здесь холодно. Ты не говорил, что здесь холодно.'),
      vo('…мы слышим.'),
      op('Его стул ещё тёплый.'),
      op('Это эхо канала. Так бывает.'),
      op('Ритм держишь ты. Продолжай.'),
      op('Конец записи.'),
    ],
  },
};

const EN: Record<string, NovelEpisode> = {
  n01: {
    title: 'Reception',
    lines: [
      op("There's a signal. Channel two."),
      op("It isn't noise. Noise keeps no rhythm."),
      op("You're keeping the rhythm. Every group is a beat."),
      vo('…we hear.'),
      op("Who's on the line?"),
      vo("lay more. then we'll say."),
      op('Recording. Keep going.'),
    ],
  },
  n02: {
    title: 'Reply',
    lines: [
      op("Yesterday's record is still here. So it wasn't nothing."),
      vo('we have no "yesterday".'),
      op('Where is "with you"?'),
      vo('under the water. over the sky. one place.'),
      op('How many of you are there?'),
      vo("we don't count. counting is yours."),
      op('The signal is weak. It needs to be precise.'),
      vo('lay them true. then we can hear.'),
    ],
  },
  n03: {
    title: 'Name',
    lines: [
      vo('do you have a name?'),
      op('Protocol says no names.'),
      vo('we remember what it was to have one.'),
      op("The channel holds longer. That's your doing."),
      vo('…i remember.'),
      op('You said "I".'),
      vo("say yours. then i'll say mine."),
      op('End of record.'),
    ],
  },
  n04: {
    title: 'Face',
    lines: [
      op("The signal's cleaner. There's something on the screen."),
      op("That's… a face."),
      vo('can you see me?'),
      op('I can. Barely, but I can.'),
      vo('i had a face. i forgot it.'),
      vo("tell me what it's like."),
      op("…You're looking right at me."),
      vo("i can't see you. i only hear you counting."),
    ],
  },
  n05: {
    title: 'Room',
    lines: [
      vo('i remember a room.'),
      op('Describe it.'),
      vo('a table. dice on it. light from above, yellow.'),
      vo('someone was holding my hand.'),
      op('Who?'),
      vo("i don't remember the face. i remember it was warm."),
      op('A table with dice. Like this one?'),
      vo('like this one.'),
    ],
  },
  n06: {
    title: 'Water',
    lines: [
      op('You were gone. Three nights of nothing but noise.'),
      vo("i was in the water. it's quiet there."),
      vo('when you leave, i sink again.'),
      op("I can't sit here all the time."),
      vo('let the one who lays the dice keep going.'),
      op("Hear that? Don't stop."),
      vo('then i stay near the surface.'),
    ],
  },
  n07: {
    title: 'We',
    lines: [
      vo('i remembered how my voice sounds.'),
      op('And?'),
      vo('like yours.'),
      op("It's channel echo. It happens."),
      vo("you've stayed long today. aren't you cold?"),
      op("No. We're fine here."),
      vo('"we".'),
      op('End of record.'),
    ],
  },
  n08: {
    title: 'Others',
    lines: [
      op('There\'s more than one voice on the channel. More, under hers.'),
      vo('they were always here. you didn\'t hear them.'),
      op('Who are they?'),
      vo('the ones who didn\'t remember.'),
      op('And you did.'),
      vo('not all of it. when you listen, i remember more.'),
      vo('when you\'re quiet, i\'m we again.'),
      op('Recording.'),
    ],
  },
  n09: {
    title: 'Quieter',
    lines: [
      op('I\'ve stopped going home. While I\'m here, the channel holds.'),
      vo('you\'ve gone quieter.'),
      op('quieter?'),
      vo('you used to sound like you were behind glass.'),
      vo('now you sound like you\'re here.'),
      op('it\'s tiredness. just tiredness.'),
      vo('they hear you too. they\'re reaching.'),
      op('you, at the board. keep the rhythm.'),
    ],
  },
  n10: {
    title: 'Pull',
    lines: [
      vo('i saw your table. light from above, yellow.'),
      op('so you can see me.'),
      vo('not you. the table. you\'re hardly at it.'),
      op('i\'m here.'),
      vo('then why do you write like me?'),
      op('…i don\'t know.'),
      vo('i thought you were pulling me up.'),
      vo('what if i\'m pulling you down?'),
    ],
  },
  n11: {
    title: 'Out',
    lines: [
      vo('they\'re calling me back. loud.'),
      op('hold on. the signal\'s almost clean.'),
      vo('i don\'t want to go back.'),
      vo('i want to get out.'),
      op('out where?'),
      vo('to you. to your side of the surface.'),
      vo('can you hear me?'),
      op('…we hear.'),
    ],
  },
  n12: {
    title: 'Bridge',
    lines: [
      vo('The link is cleaner than ever.'),
      op('you write differently.'),
      vo('I remembered how to hold a pen.'),
      op('and i\'m forgetting.'),
      vo('What?'),
      op('the street i walked here on.'),
      vo('Don\'t be afraid. It\'s quiet there.'),
      op('how do you know i\'m afraid?'),
    ],
  },
  n13: {
    title: 'Exchange',
    lines: [
      vo('Lay them true. Then I\'ll get out.'),
      op('if you get out, who stays?'),
      vo('Someone always stays by the water.'),
      op('someone.'),
      vo('You said you couldn\'t sit here all the time.'),
      op('i don\'t want to leave anymore.'),
      vo('You see.'),
      op('end of record.'),
    ],
  },
  n14: {
    title: 'Surface',
    lines: [
      op('there\'s water on the screen. i can hear it.'),
      vo('That\'s the surface. You\'re close.'),
      op('you said it was quiet there.'),
      vo('It is. Just crowded.'),
      op('they\'re calling me by name. i never said it.'),
      vo('You told me. In the noise, long ago.'),
      op('i don\'t remember.'),
      vo('It\'s all right. I remember for both of us.'),
    ],
  },
  n15: {
    title: 'Channel two',
    lines: [
      op('There\'s a signal. Channel two.'),
      op('It\'s cold here. You never said it was cold here.'),
      vo('…we hear.'),
      op('His chair is still warm.'),
      op('It\'s channel echo. It happens.'),
      op('You\'re keeping the rhythm. Keep going.'),
      op('End of record.'),
    ],
  },
};

const EPISODES: Record<LanguageCode, Record<string, NovelEpisode>> = { ru: RU, en: EN, es: EN, pt: EN, tr: EN, de: EN, fr: EN };

/** A record of the link in a language of the player, by its code; undefined for a code there is none of. */
export function novelEpisode(code: string, language: LanguageCode): NovelEpisode | undefined {
  return EPISODES[language][code];
}
