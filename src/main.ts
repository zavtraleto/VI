import { Game } from './app/game';
import '@fontsource/forum/latin-400.css';
import '@fontsource/forum/cyrillic-400.css';
import './ui/styles.css';

// The labs are tools of development: a production build has none of them.
const lab = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('lab') : null;
if (lab === 'shell') {
  // The lab for the shell of the program: its screens with a panel of their look.
  void import('./lab/shellLab').then(({ startShellLab }) => startShellLab());
} else if (lab === 'board') {
  // The lab for the board: the real view over a sample state, with a panel of its look.
  void import('./lab/boardLab').then(({ startBoardLab }) => startBoardLab());
} else if (lab === 'juice') {
  // The lab for what the game answers with: the game itself, with a panel that fires every beat.
  const game = new Game(document.getElementById('app')!);
  (window as unknown as { vi: Game }).vi = game;
  void import('./lab/juiceLab').then(({ startJuiceLab }) => startJuiceLab(game));
} else if (lab !== null) {
  // The lab for the transmissions takes the page instead of the game. It is loaded only here,
  // with its panel, so the game does not carry it.
  void import('./lab/lab').then(({ startLab }) => startLab());
} else {
  const game = new Game(document.getElementById('app')!);

  // Handle for poking at the running game from the console during development.
  if (import.meta.env.DEV) (window as unknown as { vi: Game }).vi = game;
}
