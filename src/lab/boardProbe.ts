import { boardNameOf } from '../app/boardProbe';
import type { Game } from '../app/game';
import { parseBoard } from '../levels/boardFile';

/**
 * Plays the board the address names, `?board=H01`, in the game itself: the file `boards/H01.txt`
 * is read from the dev server, which serves the files of the project as they lie, and put on
 * the board by the rules as they are. What goes wrong, no such file or a file that is no board,
 * is said in the console and the game opens as it always does. A tool of development: it is
 * loaded only in a dev build.
 */
export async function playBoardOfAddress(game: Game): Promise<void> {
  const name = boardNameOf(window.location.search);
  if (name === null) return;
  try {
    const answer = await fetch(`/boards/${name}.txt`);
    const text = await answer.text();
    // The dev server answers a path it has no file for with the page itself.
    if (!answer.ok || text.trimStart().startsWith('<')) throw new Error(`board ${name}: no file boards/${name}.txt`);
    game.playBoard(parseBoard(text, name));
  } catch (error) {
    console.error(error);
  }
}
