import type { LanguageCode } from './i18n';

/**
 * What the records of the link say (docs/superpowers/specs/2026-11-04-vi-star-novel-design.md,
 * section 3): a title, and the lines of two voices one after another. The operator is our side, a
 * person at the desk; the voice is the other side, says "we", and is written in small letters.
 *
 * This is act I of variant A "Link" (docs/superpowers/specs/2026-11-05-vi-story-idea-design.md,
 * section 9). The voice lines are recorded in docs/art/VI_Claims.md, "Новелла, вариант А, акт I".
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
};

const EPISODES: Record<LanguageCode, Record<string, NovelEpisode>> = { ru: RU, en: EN, es: EN, pt: EN, tr: EN, de: EN, fr: EN };

/** A record of the link in a language of the player, by its code; undefined for a code there is none of. */
export function novelEpisode(code: string, language: LanguageCode): NovelEpisode | undefined {
  return EPISODES[language][code];
}
