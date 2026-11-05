import { novelEpisode } from '../ui/novel';
import { warmSprites } from './sprites';

/**
 * What the records of the link need and nothing else does: their words, the voice of the other side
 * and the bands over her, the look of their places. It is a part of the code of its own, fetched
 * by `import()` in the pause between boards once the sum of the stars comes near a record, or when
 * a record is opened, so it is not in the code the game opens with.
 */
export { novelEpisode } from '../ui/novel';
export { RecordBands } from './bands';
export { VoiceFigure } from './figure';
export { NOVEL_LOOK, faceAt, novelCard, novelScene } from './record';

/** The part as it comes. */
export type NovelKit = typeof import('./novelKit');

/** Fetches the pictures of a record before it opens: those of the moods of its lines (none is said yet, so the one picture there is). */
export function warmNovel(code: string): void {
  const episode = novelEpisode(code, 'en');
  if (episode) warmSprites([undefined]);
}
