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
 * idea of the story (docs/superpowers/specs/2026-11-05-vi-story-idea-design.md, section 11); the
 * lines of a record do not say a mood yet, so every record shows the one picture, `voice.webp`.
 * The files go into the build as files and are fetched only when a record asks for them.
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
