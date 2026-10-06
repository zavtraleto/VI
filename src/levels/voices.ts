/**
 * What is said before a level, a message at a time. The one who speaks is the assistant of the
 * laboratory: a record the program prints. In some messages a word or two are not the
 * laboratory's: in the texts they stand between square brackets, which are not shown. They are
 * heard instead: the program clicks what it prints, and the other side sings what is its own.
 */
export interface Said {
  /** The message as it is shown. */
  text: string;
  /** For every sign of it, whether it is the other side's. */
  other: readonly boolean[];
}

/** A blank line parts two messages. */
const BREAK = /\n[ \t]*\n/;

/** A message as it is written in the texts, with its marks taken out and remembered. */
export function partVoices(marked: string): Said {
  let text = '';
  const other: boolean[] = [];
  let inside = false;
  for (const sign of marked) {
    if (sign === '[' || sign === ']') {
      inside = sign === '[';
      continue;
    }
    text += sign;
    // A sign may take two places of the text; each of them is marked.
    for (let i = 0; i < sign.length; i++) other.push(inside);
  }
  return { text, other };
}

/** The messages of the text of a level, in the order they are said. */
export function messagesOf(marked: string): Said[] {
  return marked
    .split(BREAK)
    .map((message) => message.trim())
    .filter((message) => message.length > 0)
    .map(partVoices);
}
