import type { LanguageCode } from './i18n';

/**
 * What the records of the link say (docs/superpowers/specs/2026-11-04-vi-star-novel-design.md,
 * section 3): a title, and the lines of two voices one after another. The operator is our side, a
 * person at the desk; the voice is the other side, says "we", and is written in small letters.
 *
 * These are acts I and II of variant A "Link" (docs/superpowers/specs/2026-11-05-vi-story-idea-design.md,
 * sections 9 and 10): records 01-03 are act I, 04-07 act II "Room". The voice lines are recorded in
 * docs/art/VI_Claims.md, "Новелла, вариант А, акт I" and "акт II".
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
};

const EPISODES: Record<LanguageCode, Record<string, NovelEpisode>> = { ru: RU, en: EN, es: EN, pt: EN, tr: EN, de: EN, fr: EN };

/** A record of the link in a language of the player, by its code; undefined for a code there is none of. */
export function novelEpisode(code: string, language: LanguageCode): NovelEpisode | undefined {
  return EPISODES[language][code];
}
