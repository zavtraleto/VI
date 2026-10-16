import type { RunState } from '../rules/types';
import { playRecordOf, type PlayRecord } from './playLog';

/**
 * Watching a board played in the lab, to write the play down when it is over: the workshop of
 * the levels (`?lab=workshop`) puts a board on the board of the game (`Game.playBoard`) and
 * watches it with this.
 */

/** What the lab reaches inside the game. These are private to it: the lab is a tool and looks inside. */
export interface Inside {
  readonly state: RunState;
  /** Moves taken back since the board was put on. */
  readonly undosMade: number;
  readonly audio: { setAway(away: boolean): void };
}

/** What a play is a play of: the board by its name and the hash of its version, the fewest moves known, and what was known of it. */
export interface PlayOf {
  name: string;
  hash: string;
  par: number | null;
  measures: Record<string, number>;
  /** The order the board was laid for. */
  order?: string;
}

/** A play of the board that is being watched: the run as it was last seen, when it began, and what it is a play of. */
interface Watched extends PlayOf {
  state: RunState;
  undos: number;
  startedAt: number;
  /** The play has been written down: one that clears the board is, at once. */
  told: boolean;
}

/** A play written down: the record, and what it was a play of. */
export type ToldPlay = PlayRecord & Pick<PlayOf, 'measures' | 'order'>;

/**
 * Watches the play of the board, frame by frame, to write it down when it is over. A play is
 * over when the board is cleared, which is written at once; when the board is started over;
 * and when the watch is stopped. A move taken back puts another run in the game's hand and is
 * no new play: the count of moves taken back tells the two apart. A play with no move made is
 * not written.
 */
export class PlayWatch {
  private watched: Watched | null = null;
  /** The watch that runs: a new one stops the frames of the one before. */
  private round = 0;

  constructor(
    private readonly inside: Inside,
    private readonly told: (record: ToldPlay, of: PlayOf) => void,
  ) {}

  /** Begins to watch the plays of a board: the play before, if one was watched, is ended first. */
  start(of: PlayOf): void {
    this.end();
    const round = ++this.round;
    const begin = (): Watched => ({ ...of, state: this.inside.state, undos: this.inside.undosMade, startedAt: Date.now(), told: false });
    const frame = (): void => {
      if (round !== this.round) return;
      window.requestAnimationFrame(frame);
      const { state, undosMade } = this.inside;
      // The board is put on when the game has opened: until then the run in hand is no level.
      if (!state.levelRun) return;
      const play = this.watched;
      if (!play) {
        this.watched = begin();
        return;
      }
      if (state !== play.state && undosMade <= play.undos) {
        this.end();
        this.watched = begin();
        return;
      }
      play.state = state;
      play.undos = undosMade;
      if (state.endReason === 'passed' && !play.told) this.tell(play);
    };
    window.requestAnimationFrame(frame);
  }

  /** Stops watching: the play in hand is written down, unless it was already or nothing was done in it. */
  stop(): void {
    this.end();
    this.round++;
  }

  /** The play in hand is over: it is written down, unless it was already, or nothing was done in it. */
  private end(): void {
    const play = this.watched;
    this.watched = null;
    if (play && !play.told && (play.state.levelRun?.moves ?? 0) > 0) this.tell(play);
  }

  private tell(play: Watched): void {
    play.told = true;
    const { name, hash, par, measures, order } = play;
    this.told({ ...playRecordOf(play.state, play.startedAt, Date.now(), play.undos, play), measures, ...(order ? { order } : {}) }, { name, hash, par, measures, ...(order ? { order } : {}) });
  }
}
