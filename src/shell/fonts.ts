import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import '@fontsource/dotgothic16/cyrillic-400.css';
import './fonts/jp.css';
import { PROGRAM_FONT } from './theme';

/** A sign of every script the program writes in: each script is a file of its own, fetched only when asked for. */
const SAMPLE = 'VI 07 Жя 記録 プロトコル';
/** A font that has not come by then is not waited for: the screen is drawn with what there is. */
const PATIENCE_MS = 3000;

/**
 * Brings in the font of the program. A canvas draws with a stand-in while a font is on its
 * way and does not draw again by itself when it arrives: whoever calls this draws again once
 * the promise is kept.
 */
export function loadShellFonts(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  const loaded = fonts.load(`16px ${PROGRAM_FONT}`, SAMPLE).then(
    () => undefined,
    () => undefined,
  );
  const patience = new Promise<void>((resolve) => window.setTimeout(resolve, PATIENCE_MS));
  return Promise.race([loaded, patience]);
}
