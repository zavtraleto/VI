/**
 * The pictures on the buttons of a level, drawn on the grid of the letters (`pixelFont.ts`):
 * one dot of a picture is one dot of a letter, uprights are two dots wide and crossbars one,
 * corners are cut, and the heads of the arrows are the font's diagonals. The pictures on the
 * square buttons are twelve dots tall, half the button; the arrow beside the word that takes a
 * move back is as tall as a capital and stands on its rows, as a letter of the line.
 */

/** A picture as rows of dots, `#` lit. Every row is as wide. */
export type Icon = readonly string[];

/** The row of a line of the font a capital starts on (`pixelFont.ts`): where a picture that stands in a line as a letter starts. */
export const CAPITAL_TOP = 3;

/** The arrow that turns back: its head points left at the top, its tail comes round to the bottom. As tall as a capital. */
export const ICON_UNDO: Icon = [
  '..##.......',
  '.##........',
  '#########..',
  '.##.....##.',
  '..##.....##',
  '.........##',
  '.........##',
  '.........##',
  '........##.',
  '..#######..',
];

/** The arrow that goes round, clockwise, its head at the top: the level from the start. */
export const ICON_RESTART: Icon = [
  '......##...',
  '.......##..',
  '..#########',
  '.##.....##.',
  '##.....##..',
  '##.........',
  '##.........',
  '##.......##',
  '##.......##',
  '##.......##',
  '.##.....##.',
  '..#######..',
];

/** Two uprights of the font, a gap of three between them. */
export const ICON_PAUSE: Icon = Array.from({ length: 12 }, () => '##...##');

/** A loudspeaker and the two waves that come out of it. */
export const ICON_SOUND: Icon = [
  '......##........',
  '.....###........',
  '....####.....##.',
  '...#####......##',
  '########.##...##',
  '########..##..##',
  '########..##..##',
  '########.##...##',
  '...#####......##',
  '....####.....##.',
  '.....###........',
  '......##........',
];

/** With the sound off: the loudspeaker alone, drawn dim, and a cross where the waves were, drawn lit. Both as wide as the picture of the sound. */
export const ICON_MUTE_SPEAKER: Icon = ICON_SOUND.map((row) => row.slice(0, 8) + '.'.repeat(8));
export const ICON_MUTE_CROSS: Icon = [
  '................',
  '................',
  '................',
  '..........##..##',
  '...........####.',
  '............##..',
  '............##..',
  '...........####.',
  '..........##..##',
  '................',
  '................',
  '................',
];

export function iconWidth(icon: Icon): number {
  return icon[0].length;
}

export function iconHeight(icon: Icon): number {
  return icon.length;
}

/**
 * The same pictures fourteen dots tall, half of a button 28 tall: on a tall picture, where the
 * buttons stand beside the large number (word of the owner, 30 October 2026: on the phone they
 * were small beside it; a step of the grid up, «на совсем чуточку»). Drawn by the same rules as
 * the twelve-dot ones, two rows longer.
 */
export const ICON_RESTART_TALL: Icon = [
  '........##...',
  '.........##..',
  '..###########',
  '.##.......##.',
  '##.......##..',
  '##...........',
  '##...........',
  '##...........',
  '##.........##',
  '##.........##',
  '##.........##',
  '##.........##',
  '.##.......##.',
  '..#########..',
];

export const ICON_PAUSE_TALL: Icon = Array.from({ length: 14 }, () => '##...##');

export const ICON_SOUND_TALL: Icon = [
  '......##........',
  '.....###........',
  '....####.....##.',
  '...#####......##',
  '########.##...##',
  '########..##..##',
  '########..##..##',
  '########..##..##',
  '########..##..##',
  '########.##...##',
  '...#####......##',
  '....####.....##.',
  '.....###........',
  '......##........',
];

export const ICON_MUTE_SPEAKER_TALL: Icon = ICON_SOUND_TALL.map((row) => row.slice(0, 8) + '.'.repeat(8));
export const ICON_MUTE_CROSS_TALL: Icon = ICON_SOUND_TALL.map((_row, r) => '.'.repeat(10) + (['##..##', '.####.', '..##..', '..##..', '.####.', '##..##'][r - 4] ?? '......'));
