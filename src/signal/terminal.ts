/** What the game knows of a session at a moment, as far as the transmissions care. */
export interface SessionReading {
  /** How strong the link is, 0..1. */
  contact: number;
  /** How full the board is, 0..1: the noise of the channel. */
  noise: number;
  /** The face most groups have been sent by, 1..6; 0 before the first. */
  channel: number;
}

/** The hour, minute and second on the player's clock. */
export interface ClockTime {
  h: number;
  m: number;
  s: number;
}

/** The steps of the link, as the program counts them. */
const LINK_STEPS = 7;

/**
 * Lines of the program's own log that are not about this session: what it says when it starts
 * (journal 1.1 to 1.3), what the art document has it say as the contact grows (6.2), and one
 * line of the log of its last session (journal 2.6; the label is in English because the font
 * of the program has no sign for it yet).
 */
const STALE: readonly string[] = [
  'LINK DEVICE ... NOT FOUND',
  'EMULATION MODE',
  '被験者 07 UNREGISTERED',
  '前回起動 H13.03.21',
  'RECEIVED',
  '15:10 NOISE 0%',
];

const two = (value: number): string => String(Math.floor(value)).padStart(2, '0');
const hex = (value: number, digits: number): string =>
  Math.floor(value).toString(16).toUpperCase().padStart(digits, '0').slice(-digits);

/**
 * A burst of the program's log, as it runs past behind the board: the readings of this very
 * moment in the dry voice of the program, and now and then a line that is not about now.
 * `pattern` marks a burst set off by a chain.
 */
export function terminalLines(random: () => number, reading: SessionReading, time: ClockTime, pattern: boolean): string[] {
  const stamp = `${two(time.h)}:${two(time.m)}:${two(time.s)}`;
  const link = Math.round(Math.min(1, Math.max(0, reading.contact)) * LINK_STEPS);
  const noise = Math.round(Math.min(1, Math.max(0, reading.noise)) * 100);
  const lines = [`${stamp} 接続 ${link}/${LINK_STEPS}`, `${stamp} NOISE ${noise}%`];
  if (reading.channel > 0) lines.push(`${stamp} CH${reading.channel} 開始`);
  // What is in the buffer: the readings again, as the bytes the program keeps them in.
  const address = 0x700 + Math.floor(random() * 0x80) * 8;
  lines.push(`${hex(address, 4)}  07 ${hex(link, 2)} ${hex(noise, 2)} ${hex(reading.channel, 2)} ${hex(random() * 256, 2)} ${hex(random() * 256, 2)}`);
  if (pattern) lines.push(`${stamp} PATTERN DETECTED`, `${stamp} 記録中`);
  else if (random() < 0.5) lines.push(STALE[Math.min(STALE.length - 1, Math.floor(random() * STALE.length))]);
  return lines;
}
