export interface Theme {
  void: number;
  voidFinal: number;
  slabTop: string;
  slabGroove: string;
  slabHighlight: string;
  slabSide: number;
  cube: string;
  cubeEdge: string;
  pip: string;
  carmine: string;
  ivory: number;
  ink: string;
}

/** Occult tabletop instrument: black void, ash plate, charcoal dice with ivory pips, carmine light. */
export const OCCULT_THEME: Theme = {
  void: 0x050506,
  voidFinal: 0x14060a,
  slabTop: '#a8a39a',
  slabGroove: '#5f5b55',
  slabHighlight: '#c4bfb5',
  slabSide: 0x3b3936,
  cube: '#2b2827',
  cubeEdge: '#5a544f',
  pip: '#ece3cf',
  carmine: '#b3122f',
  ivory: 0xefe6d2,
  ink: '#2a2624',
};
