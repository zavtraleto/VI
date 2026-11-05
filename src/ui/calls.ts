import type { LanguageCode } from './i18n';

/**
 * What the caller says after a call seen to its end (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md,
 * sections 8 and 9): a title, and the lines of the caller with a line of the program at either end.
 * The caller is a voice on the line, not the girl of the novel and not the operator (the owner,
 * 5 November 2026: «дополнительный голос… кто, непонятно, но он может раскрывать детали лора»):
 * he says "I", calmly, a little too familiar; knows the table, the institute and "her", and names
 * none of them. Who and where he is, is a dark place.
 *
 * Talks 1 to 3 are the draft of the spec; 4 to 7 are written once the owner has read these. Every
 * line is in docs/art/VI_Claims.md, "Звонки". Russian and English; the other five languages say the
 * English for now, as the novel does.
 */

/** Who says a line: the caller, or the program, which writes its own lines with no name. */
export type CallWho = 'caller' | 'program';

export interface CallLine {
  who: CallWho;
  text: string;
}

export interface CallEpisode {
  title: string;
  lines: readonly CallLine[];
}

const ca = (text: string): CallLine => ({ who: 'caller', text });
const pr = (text: string): CallLine => ({ who: 'program', text });

const RU: Record<number, CallEpisode> = {
  1: {
    title: 'Проверка линии',
    lines: [
      pr('ВХОДЯЩИЙ · ЛИНИЯ 2'),
      ca('Слышно? Хорошо. Я думал, этот номер давно не отвечает.'),
      ca('Ты быстро учишься. Кости любят, когда их не торопят.'),
      ca('Не говори, кто ты. Здесь всё равно не держатся имена.'),
      ca('Этот стол раньше был настоящий. Дерево, лак, шесть мест.'),
      ca('Теперь только программа помнит, как он стоял.'),
      ca('Я ещё позвоню. Держи линию чистой.'),
      pr('ЛИНИЯ ЗАКРЫТА'),
    ],
  },
  2: {
    title: 'Шесть',
    lines: [
      ca('Это снова я. У тебя ровнее, чем в прошлый раз.'),
      ca('Знаешь, почему граней шесть? Не из-за кости. Каналов было шесть.'),
      ca('На каждом кто-то сидел. Не спрашивай кто. Я и сам не всех помню.'),
      ca('Она тоже слушает. Не пугайся, если линия зашумит.'),
      ca('Шум — не помеха. Это те, кто говорит все сразу.'),
      ca('Мне пора. Хотя здесь неважно, сколько времени.'),
      pr('ЛИНИЯ ЗАКРЫТА'),
    ],
  },
  3: {
    title: 'Тихое событие',
    lines: [
      ca('Видел, куда уходят кости, когда их собрали?'),
      ca('Под воду. Говорят, оттуда это похоже на небо.'),
      ca('В две тысячи первом решили, что ничего не вышло. Никто ничего не заметил.'),
      ca('Это было очень тихое событие. Самое большое и самое тихое.'),
      ca('Не спрашивай, где я. Я не уверен, что это «где».'),
      ca('В следующий раз будет громче.'),
      pr('ЛИНИЯ ЗАКРЫТА'),
    ],
  },
};

const EN: Record<number, CallEpisode> = {
  1: {
    title: 'Line check',
    lines: [
      pr('INCOMING · LINE 2'),
      ca('Can you hear me? Good. I thought this number stopped answering long ago.'),
      ca("You learn fast. Dice like it when you don't rush them."),
      ca("Don't tell me who you are. Names don't keep here anyway."),
      ca('This table used to be real. Wood, lacquer, six seats.'),
      ca('Now only the program remembers how it stood.'),
      ca("I'll call again. Keep the line clean."),
      pr('LINE CLOSED'),
    ],
  },
  2: {
    title: 'Six',
    lines: [
      ca("It's me again. You're steadier than last time."),
      ca('Do you know why there are six faces? Not because of the die. There were six channels.'),
      ca("Someone sat at each one. Don't ask who. I don't remember them all myself."),
      ca("She's listening too. Don't be scared if the line gets noisy."),
      ca("The noise isn't interference. It's the ones who all talk at once."),
      ca("I have to go. Though here it doesn't matter what time it is."),
      pr('LINE CLOSED'),
    ],
  },
  3: {
    title: 'A quiet event',
    lines: [
      ca("Did you see where the dice go once you've gathered them?"),
      ca('Under the water. They say from there it looks like the sky.'),
      ca('In two thousand one they decided nothing had come of it. Nobody noticed a thing.'),
      ca('It was a very quiet event. The biggest and the quietest.'),
      ca("Don't ask where I am. I'm not sure it's a “where”."),
      ca("Next time it'll be louder."),
      pr('LINE CLOSED'),
    ],
  },
};

/** The talk after a call of this step, in this language; null where it has not been written yet. */
export function callEpisode(step: number, language: LanguageCode): CallEpisode | null {
  return (language === 'ru' ? RU : EN)[step] ?? null;
}

/** The steps whose talks are written, in order. */
export const CALL_TALKS: readonly number[] = Object.keys(EN).map(Number);
