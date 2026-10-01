export interface FaceColors {
  bg: string;
  pip: string;
}

export interface Theme {
  background: number;
  slab: number;
  slabSide: number;
  grid: number;
  idle: FaceColors;
  rising: FaceColors;
  sinking: FaceColors;
  player: number;
  ghost: string;
  hint: number;
  ambient: number;
  key: number;
}

/** Plain look for the first playable: grey board, light dice, red for sinking. */
export const PROTOTYPE_THEME: Theme = {
  background: 0x1b1c20,
  slab: 0x8d8f96,
  slabSide: 0x5d5f66,
  grid: 0x6f7178,
  idle: { bg: '#ece8de', pip: '#141414' },
  rising: { bg: '#a9a69d', pip: '#3a3a3a' },
  sinking: { bg: '#c8443a', pip: '#fff3ec' },
  player: 0xffb020,
  ghost: '#ffffff',
  hint: 0xff5040,
  ambient: 0xffffff,
  key: 0xffffff,
};
