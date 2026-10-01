import { Game } from './app/game';
import '@fontsource/forum/latin-400.css';
import '@fontsource/forum/cyrillic-400.css';
import './ui/styles.css';

const game = new Game(document.getElementById('app')!);

// Handle for poking at the running game from the console during development.
if (import.meta.env.DEV) (window as unknown as { vi: Game }).vi = game;
