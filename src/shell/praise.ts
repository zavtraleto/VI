/**
 * What is said over a chain of a level when it grows, where a session shows its multiplier: a
 * level has no points to multiply. One word, in the hand of the program and in English whatever
 * the language of the player, like its commands; the longer the chain, the higher the word. A
 * step of the ladder has many words, some cold and some of the arcade, and any of them is said.
 * None is longer than nine signs: it is written large over a board a phone shows.
 */
export const PRAISE: readonly (readonly string[])[] = [
  // The second link of a chain.
  ['NICE', 'GOOD', 'OK', 'FINE', 'NEAT', 'CLEAN', 'TIDY', 'SOLID', 'SMOOTH', 'STEADY', 'LINKED', 'CLEAR', 'RIGHT', 'YES'],
  // The third.
  ['COOL', 'GREAT', 'SWEET', 'SLICK', 'CRISP', 'SHARP', 'SMART', 'DEFT', 'STRONG', 'BRIGHT', 'PRECISE', 'EXACT', 'ON POINT', 'WELL DONE'],
  // The fourth.
  ['SUPER', 'SUPERB', 'AWESOME', 'AMAZING', 'STELLAR', 'BRILLIANT', 'EXCELLENT', 'RADICAL', 'WICKED', 'PRISTINE', 'SPLENDID', 'TERRIFIC', 'ELEGANT', 'RARE'],
  // The fifth.
  ['EPIC', 'FANTASTIC', 'MASTERFUL', 'SUBLIME', 'DAZZLING', 'STUNNING', 'INSANE', 'UNREAL', 'PERFECT', 'OPTIMAL', 'FLAWLESS', 'WONDROUS', 'FIERCE', 'MAJESTIC'],
  // The sixth and every one after it.
  ['LEGENDARY', 'ULTIMATE', 'ABSOLUTE', 'SUPREME', 'PEERLESS', 'MAXIMUM', 'TOTAL', 'UNMATCHED', 'LIMITLESS', 'ULTRA', 'COSMIC', 'INFINITE', 'UNBROKEN', 'ZENITH'],
];

/**
 * A word for a chain of `chain` links, from the step of the ladder it has reached: any of that
 * step but `last`, the word said over the chain before. `random` is a number from 0 up to 1.
 */
export function praiseWord(chain: number, random: number, last: string | null = null): string {
  const step = PRAISE[Math.min(PRAISE.length - 1, Math.max(0, Math.floor(chain) - 2))];
  const words = step.filter((word) => word !== last);
  return words[Math.min(words.length - 1, Math.floor(Math.max(0, random) * words.length))];
}
