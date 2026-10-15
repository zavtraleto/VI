import type { LevelSpec } from '../rules/types';
import { fileBoard } from './boardFiles';
import { CAMPAIGN } from './campaign';

/**
 * The boards the code of the game held until the row moved to files (15 October 2026), now read from
 * their files by code: the tests and the scripts that went over all of them still do. For the tests and
 * the labs only, as `boardFiles.ts` is: the game reads its row from `row.gen.ts`.
 */

/** The levels of the probe and the acts that were parked: played by the tests, not by the game. */
export const PARKED_CODES: readonly string[] = [
  'P10', 'P18', 'P21', 'P22', 'P23', 'P25', 'P26', 'P27', 'P28', 'P29', 'P30', 'P13', 'P04', 'P14', 'P01', 'P17', 'P31', 'P19',
  'K17', 'P03', 'P16', 'K21', 'K23', 'P20', 'K25', 'P05', 'K28', 'C1-04', 'K22', 'P15',
];

/** The reserve of the places of the probe, under the code of the place and the seed it was laid from. */
export const SPARE_NAMES: readonly string[] = [
  'P01_s30512', 'P01_s30192', 'P02_s31295', 'P02_s30214', 'P03_s30146', 'P04_s31783', 'P04_s30207', 'P05_s30158', 'P05_s30236',
  'P06_s30377', 'P06_s30399', 'P07_s31151', 'P07_s32873', 'P08_s30006', 'P08_s30370', 'P09_s30009', 'P09_s30848', 'P10_s30582',
  'P10_s30882', 'P12_s30002', 'P12_s30376', 'P13_s30460', 'P13_s30065', 'P14_s30615', 'P14_s30797', 'P15_s31571', 'P15_s30402',
  'P16_s31722', 'P16_s31055', 'P17_s30075', 'P17_s31123', 'P17_s30072', 'P18_s30105', 'P18_s30824', 'P19_s30721', 'P19_s30263',
  'P20_s30220', 'P20_s30054', 'P21_s30482', 'P21_s30392', 'P22_s34545', 'P22_s30785', 'P23_s30060', 'P24_s30485', 'P24_s30074',
  'P25_s30744', 'P25_s30431', 'P26_s30605', 'P26_s30141', 'P27_s30633', 'P27_s30653', 'P28_s30007', 'P28_s30061', 'P29_s30038',
  'P29_s30663', 'P30_s30012', 'P30_s30121',
];

/** The boards of the row as they are played. */
export function rowBoards(): LevelSpec[] {
  return CAMPAIGN.map((place) => place.spec);
}

export function parkedBoards(): LevelSpec[] {
  return PARKED_CODES.map(fileBoard);
}

export function spareBoards(): LevelSpec[] {
  return SPARE_NAMES.map(fileBoard);
}

/** A board of the row as it is played, or else its file: by its code. */
export function boardOf(code: string): LevelSpec {
  return CAMPAIGN.find((place) => place.code === code)?.spec ?? fileBoard(code);
}
