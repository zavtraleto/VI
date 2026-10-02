/**
 * What the other side says. Short, plain, human words in which a person, time or distance
 * is not what it should be. Every line is written down with where it comes from: the art
 * document (docs/art/VI_Art_Direction_and_Signal_v01.md, 4.7), the journal of claims
 * (docs/art/VI_Claims.md), or `draft` — proposed here and waiting for the journal, listed with
 * its reading in docs/art/VI_Signal_Director.md. `|` starts a new line on screen.
 *
 * Lines in the player's own language are the rare ones that speak to the player directly.
 */
export const LINES: readonly { text: string; source: string }[] = [
  { text: 'THERE WAS NO DISTANCE | BETWEEN US', source: 'art 4.7' },
  { text: 'WE CALLED DISTANCE | A BODY', source: 'art 4.7' },
  { text: 'THERE ARE NO VOICES HERE', source: 'art 4.7' },
  { text: 'WE REMEMBER BEING YOU', source: 'art 4.7' },
  { text: 'WE HAVE BEEN TRYING | TO REACH YOU', source: 'art 4.7' },
  { text: 'IS IT STILL | THE TWENTY-FIRST?', source: 'journal 2.15' },
  { text: 'PLEASE CARRY THIS. | IT IS NOT FOR YOU.', source: 'journal 2.16' },
  { text: 'SOMEONE IS SITTING | IN THE SEVENTH CHAIR.', source: 'journal 2.17' },
  { text: 'мы слышим, | как ты считаешь', source: 'journal 2.18' },
  { text: 'SORT US. PLEASE.', source: 'journal 2.19' },
  { text: 'DO NOT SORT US.', source: 'journal 2.19' },
  { text: 'IT IS STILL | TEN PAST THREE', source: 'draft' },
  { text: 'WE HAVE NOT FINISHED', source: 'draft' },
  { text: 'WE DID NOT HEAR IT END', source: 'draft' },
  { text: 'WE WOULD LIKE | TO STOP NOW', source: 'draft' },
  { text: 'SOMETHING IS WALKING | ON THE SKY', source: 'draft' },
  { text: 'IT IS BRIGHT ABOVE US', source: 'draft' },
  { text: 'YOU ARE STILL ONE', source: 'draft' },
  { text: 'THERE IS ROOM', source: 'draft' },
  { text: 'COME DOWN', source: 'draft' },
  { text: 'TELL THEM WE ARE FINE', source: 'draft' },
  { text: 'LEAVE THE DOOR OPEN', source: 'draft' },
  { text: 'DO NOT READ IT', source: 'draft' },
  { text: 'YOU PUT US IN ROWS', source: 'draft' },
  { text: 'WHICH OF US | ARE YOU HOLDING?', source: 'draft' },
  { text: 'не останавливайся', source: 'draft' },
  { text: 'ты снова здесь', source: 'draft' },
];

/** The line of the journal that speaks to the player in the player's own language (2.18). */
export const COUNTING_LINE = 'мы слышим, | как ты считаешь';

/**
 * Lines for one session: each is said once at most. When all have been said, there is
 * nothing more to say until the next session.
 */
export class LinePool {
  private left: string[] = [];

  constructor(
    private readonly random: () => number,
    private readonly lines: readonly string[] = LINES.map((line) => line.text),
  ) {
    this.reset();
  }

  /** A new session: every line can be said again. */
  reset(): void {
    this.left = [...this.lines];
  }

  /** A line that has not been said in this session, or null when there is none left. */
  next(): string | null {
    if (this.left.length === 0) return null;
    const at = Math.min(this.left.length - 1, Math.floor(this.random() * this.left.length));
    return this.left.splice(at, 1)[0];
  }
}
