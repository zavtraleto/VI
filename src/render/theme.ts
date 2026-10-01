export interface FaceColors {
  bg: string;
  pip: string;
}

export interface Theme {
  void: number;
  voidFinal: number;
  slabTop: string;
  slabGroove: string;
  slabHighlight: string;
  slabSide: number;
  /** Colour code of the six faces, index 0 = the 1. */
  faces: readonly FaceColors[];
  cubeEdge: string;
  carmine: string;
  ivory: number;
  ivoryCss: string;
  ink: string;
}

/**
 * Occult tabletop instrument: black void, ash plate, carmine light. Each face value has
 * its own colour, chosen to differ in brightness as well as hue; the 1 is a red pip on white.
 */
export const OCCULT_THEME: Theme = {
  void: 0x050506,
  voidFinal: 0x14060a,
  slabTop: '#a8a39a',
  slabGroove: '#5f5b55',
  slabHighlight: '#c4bfb5',
  slabSide: 0x3b3936,
  faces: [
    { bg: '#ece3cf', pip: '#b3122f' }, // 1: ivory, carmine pip
    { bg: '#2c3f8c', pip: '#ece3cf' }, // 2: indigo
    { bg: '#1d7468', pip: '#ece3cf' }, // 3: verdigris
    { bg: '#9a6418', pip: '#ece3cf' }, // 4: ochre
    { bg: '#6a2c78', pip: '#ece3cf' }, // 5: plum
    { bg: '#2b2827', pip: '#ece3cf' }, // 6: charcoal
  ],
  cubeEdge: 'rgba(0, 0, 0, 0.35)',
  carmine: '#b3122f',
  ivory: 0xefe6d2,
  ivoryCss: '#efe6d2',
  ink: '#2a2624',
};
