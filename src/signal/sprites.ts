import voiceUrl from './people/voice.webp';
import alarmUrl from './people/voice-alarm.webp';
import calmUrl from './people/voice-calm.webp';
import emptyUrl from './people/voice-empty.webp';
import listenUrl from './people/voice-listen.webp';
import longingUrl from './people/voice-longing.webp';
import recallUrl from './people/voice-recall.webp';
import smileUrl from './people/voice-smile.webp';
import stareUrl from './people/voice-stare.webp';
import { Lazy } from './lazy';

/**
 * The pictures of the voice of the other side. The eight of her moods are named by the list of the
 * idea of the story (docs/superpowers/specs/2026-11-05-vi-story-idea-design.md, section 11). The
 * records of act II give every line a mood (`RECORD_MOODS`, the owner, 6 November 2026: wire them);
 * act I is a silhouette and shows the one picture it had, `voice.webp`. The files go into the build
 * as files and are fetched only when a record asks for them.
 */
export type VoiceMood = 'alarm' | 'calm' | 'empty' | 'listen' | 'longing' | 'recall' | 'smile' | 'stare';

export const MOOD_SPRITES: Readonly<Record<VoiceMood, string>> = {
  alarm: alarmUrl,
  calm: calmUrl,
  empty: emptyUrl,
  listen: listenUrl,
  longing: longingUrl,
  recall: recallUrl,
  smile: smileUrl,
  stare: stareUrl,
};

/**
 * The mood of her face on every line of a record, by its code: the lines the operator says too, as
 * she listens to them. The same in every language: the lines of a record are as many in each.
 * A record not here shows `voice.webp` on every line.
 */
export const RECORD_MOODS: Readonly<Record<string, readonly VoiceMood[]>> = {
  // "Face": the silhouette, then her face; she asks, forgets, and he says she looks right at him.
  n04: ['calm', 'calm', 'listen', 'listen', 'longing', 'listen', 'stare', 'stare'],
  // "Room": she remembers, and it was warm.
  n05: ['recall', 'calm', 'recall', 'recall', 'listen', 'smile', 'smile', 'stare'],
  // "Water": she sinks when he leaves.
  n06: ['longing', 'recall', 'longing', 'longing', 'stare', 'stare', 'calm'],
  // "We": her voice is his.
  n07: ['recall', 'listen', 'stare', 'stare', 'smile', 'smile', 'stare', 'stare'],
  // Act III "Voices": the others behind her, and the pull.
  n08: ['listen', 'alarm', 'listen', 'recall', 'listen', 'calm', 'longing', 'longing'],
  n09: ['calm', 'stare', 'stare', 'listen', 'stare', 'longing', 'alarm', 'alarm'],
  n10: ['recall', 'listen', 'stare', 'stare', 'stare', 'listen', 'longing', 'alarm'],
  n11: ['alarm', 'alarm', 'longing', 'stare', 'listen', 'longing', 'listen', 'alarm'],
  // Act IV "Bridge": she has the capitals now; in 15 the picture is the others, and he is among them.
  n12: ['calm', 'smile', 'smile', 'listen', 'listen', 'longing', 'calm', 'stare'],
  n13: ['stare', 'listen', 'calm', 'stare', 'recall', 'listen', 'smile', 'smile'],
  n14: ['calm', 'stare', 'listen', 'calm', 'listen', 'stare', 'listen', 'smile'],
  n15: ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
};

/** The mood of a line of a record; none where the record says none. */
export function moodAt(code: string, line: number): VoiceMood | undefined {
  const moods = RECORD_MOODS[code];
  return moods?.[Math.max(0, Math.min(moods.length - 1, line))];
}

/** The file of a mood; the one picture there is now where none is said. */
export function spriteOf(mood?: VoiceMood): string {
  return mood ? MOOD_SPRITES[mood] : voiceUrl;
}

const pictures = new Map<string, Lazy<HTMLImageElement>>();

/** A picture, fetched once; null if it could not be, and asked for again the next time. */
export function loadPicture(url: string): Promise<HTMLImageElement | null> {
  let picture = pictures.get(url);
  if (!picture) {
    picture = new Lazy(
      () =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = url;
        }),
    );
    pictures.set(url, picture);
  }
  return picture.get();
}

/** Fetches the pictures of these moods before they are wanted, each once; no mood said is the one picture there is now. */
export function warmSprites(moods: readonly (VoiceMood | undefined)[]): void {
  for (const url of new Set(moods.map((mood) => spriteOf(mood)))) void loadPicture(url);
}
