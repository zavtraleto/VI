import { Game } from './app/game';
import { quality } from './display/quality';
import { initPlatform, platformLanguage } from './platform/bridge';
import { SETTINGS_KEY } from './platform/settings';
import { openStorage } from './platform/storage';
import { setLanguage } from './ui/i18n';
import '@fontsource/forum/latin-400.css';
import '@fontsource/forum/cyrillic-400.css';
import './ui/styles.css';

// The platform comes first: what it keeps for the player and the language it names are read
// before anything of the game is built.
await initPlatform();
await openStorage([SETTINGS_KEY]);
const language = platformLanguage();
if (language) setLanguage(language);

// Lines of measurements over the game, in any build: `?perf` in the address. They stand
// between the game and the frames of the browser, so they come before the game is built.
if (new URLSearchParams(window.location.search).has('perf')) (await import('./ui/perf')).startPerf(quality());

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
} else if (lab === 'sound') {
  // The lab for the sound: no game, a button for everything that can be heard and a panel of its parameters.
  void import('./lab/soundLab').then(({ startSoundLab }) => startSoundLab());
} else if (lab !== null) {
  // The lab for the transmissions takes the page instead of the game. It is loaded only here,
  // with its panel, so the game does not carry it.
  void import('./lab/lab').then(({ startLab }) => startLab());
} else {
  const game = new Game(document.getElementById('app')!);

  // Handle for poking at the running game from the console during development.
  if (import.meta.env.DEV) (window as unknown as { vi: Game }).vi = game;
}
