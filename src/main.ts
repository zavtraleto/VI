import { Game } from './app/game';
import '@fontsource/forum/latin-400.css';
import '@fontsource/forum/cyrillic-400.css';
import './ui/styles.css';

if (new URLSearchParams(window.location.search).has('lab')) {
  // The lab for the transmissions takes the page instead of the game. It is loaded only here,
  // with its panel, so the game does not carry it.
  void import('./lab/lab').then(({ startLab }) => startLab());
} else {
  const game = new Game(document.getElementById('app')!);

  // Handle for poking at the running game from the console during development.
  if (import.meta.env.DEV) (window as unknown as { vi: Game }).vi = game;
}
