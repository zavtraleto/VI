import * as THREE from 'three';
import type { ParamValues } from '../signal/scene';
import { mixHex, type Palette } from '../shell/theme';

/** Pip centres on a 3x3 grid, as [column, row] with 0..2. */
export const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

/** Distance between two neighbouring pips, as a share of the face. */
export const PIP_STEP = 0.26;

/** The six faces of a die lie in one picture: three across, two down, the face `value` in tile `value - 1`. */
export const ATLAS_COLUMNS = 3;
export const ATLAS_ROWS = 2;
/**
 * Share of a tile that a face leaves out along each edge. Drawn small, a face would otherwise
 * take colour from the tile next to it.
 */
export const ATLAS_INSET = 0.03;
const TILE = 256;
/** How far in from the side of a tile the dark of an edge reaches: it lies on the rounding of the die. */
const EDGE_SHARE = 0.065;

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

function canvasTexture(width: number, height: number, draw: Draw): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const square = (size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture =>
  canvasTexture(size, size, (ctx) => draw(ctx, size));

/** Radius of the pips of a face as a share of it. The single pip of the one is larger, as on a real die. */
export function pipRadius(value: number, values: ParamValues): number {
  return Number(values.pipSize) * (value === 1 ? Number(values.pipOne) : 1);
}

function eachPip(value: number, size: number, values: ParamValues, fn: (x: number, y: number, r: number) => void): void {
  const step = size * PIP_STEP;
  const radius = size * pipRadius(value, values);
  for (const [col, row] of PIP_LAYOUT[value]) fn(size / 2 + (col - 1) * step, size / 2 + (row - 1) * step, radius);
}

/**
 * The colour of a face. Light is the colour of a channel as it is; matter is duller, and each
 * face is darker than the one before, so a face is read by how light it is as well as by its
 * hue. The one stays white.
 */
export function faceColour(value: number, palette: Palette, values: ParamValues): string {
  const channel = palette.channels[value - 1];
  if (value === 1) return channel;
  const mute = Number(values.faceMute) + (Number(values.faceFall) * (value - 2)) / 4;
  return mixHex(channel, '#000000', Math.min(0.95, Math.max(0, mute)));
}

/** The colour the pips of a face light up with: its channel, or the red of the one. */
export function pipGlow(value: number, palette: Palette): string {
  return value === 1 ? palette.signal : mixHex(palette.channels[value - 1], '#ffffff', 0.5);
}

export interface DieTextures {
  /** The six faces: the colour of the channel, dulled, and its pips. */
  map: THREE.CanvasTexture;
  /** The pips alone, in the colour they light up with, on black. */
  glow: THREE.CanvasTexture;
}

/**
 * The faces of a die in the colours of the six channels: bars of a test card, each darker than
 * the one before. The one is a large red pip on white.
 */
/** How much darker a face that does not work is: enough to go out, not enough to lose its colour. */
const CROSSED_DIM = 0.3;

export function dieTextures(palette: Palette, values: ParamValues, crossed: readonly number[] = []): DieTextures {
  const tiles = (draw: (ctx: CanvasRenderingContext2D, value: number) => void): THREE.CanvasTexture =>
    canvasTexture(TILE * ATLAS_COLUMNS, TILE * ATLAS_ROWS, (ctx) => {
      for (let value = 1; value <= 6; value++) {
        ctx.save();
        ctx.translate(((value - 1) % ATLAS_COLUMNS) * TILE, Math.floor((value - 1) / ATLAS_COLUMNS) * TILE);
        ctx.beginPath();
        ctx.rect(0, 0, TILE, TILE);
        ctx.clip();
        draw(ctx, value);
        ctx.restore();
      }
    });

  const map = tiles((ctx, value) => {
    const size = TILE;
    ctx.fillStyle = faceColour(value, palette, values);
    ctx.fillRect(0, 0, size, size);
    const shade = Number(values.faceShade);
    if (shade > 0) {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.75);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(0,0,0,${shade})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    // A dark line where the face rounds over into the next one: the edges of the die, and no
    // frame on the face itself.
    ctx.strokeStyle = `rgba(0,0,0,${Number(values.faceEdge)})`;
    ctx.lineWidth = size * EDGE_SHARE * 2;
    ctx.strokeRect(0, 0, size, size);
    const pip = value === 1 ? palette.signal : String(value >= Number(values.pipLightFrom) ? values.pipLight : values.pipDark);
    eachPip(value, size, values, (x, y, r) => {
      // A pip is set slightly into the surface.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.12, r * 1.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pip;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    // A face that does not work on the level in hand has gone out a little, and is crossed out
    // quietly: its colour still says which face it is, and the cross does not draw the eye. The
    // cross is a dark line with a pale one in it, so that it reads on a light face and a dark one.
    if (crossed.includes(value)) {
      ctx.fillStyle = `rgba(0,0,0,${CROSSED_DIM})`;
      ctx.fillRect(0, 0, size, size);
      const line = (width: number, style: string): void => {
        ctx.strokeStyle = style;
        ctx.lineWidth = size * width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(size * 0.2, size * 0.2);
        ctx.lineTo(size * 0.8, size * 0.8);
        ctx.moveTo(size * 0.8, size * 0.2);
        ctx.lineTo(size * 0.2, size * 0.8);
        ctx.stroke();
      };
      line(0.055, 'rgba(0,0,0,0.3)');
      line(0.022, 'rgba(255,255,255,0.22)');
    }
  });

  const glow = tiles((ctx, value) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, TILE, TILE);
    // A face that is crossed out does not light up.
    if (crossed.includes(value)) return;
    ctx.fillStyle = pipGlow(value, palette);
    eachPip(value, TILE, values, (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  return { map, glow };
}

/** Mark shown on a cell where a cube is about to rise. */
export function warningTexture(): THREE.CanvasTexture {
  return square(128, (ctx, size) => {
    const c = size / 2;
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = size * 0.05;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.moveTo(c, size * 0.2);
    ctx.lineTo(size * 0.8, c);
    ctx.lineTo(c, size * 0.8);
    ctx.lineTo(size * 0.2, c);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Thin outline laid over a die face the tutorial points at. */
export function faceFrameTexture(): THREE.CanvasTexture {
  return square(256, (ctx, size) => {
    const inset = size * 0.085;
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = size * 0.03;
    ctx.lineWidth = size * 0.022;
    // Twice, so a faint glow gathers around a solid line.
    for (let i = 0; i < 2; i++) ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  });
}

/**
 * A face left on the floor of a cell: a frame along the cell's edge and lit pips, laid out
 * as on a die that covers `face` of the cell's width.
 */
export function chainMarkTexture(value: number, face: number, values: ParamValues): THREE.CanvasTexture {
  return square(256, (ctx, size) => {
    const inset = size * 0.032;
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = size * 0.04;
    ctx.lineWidth = size * 0.034;
    // Twice, so the glow gathers around a solid shape.
    for (let i = 0; i < 2; i++) ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);

    const edge = (size * (1 - face)) / 2;
    ctx.translate(edge, edge);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = size * 0.07;
    eachPip(value, size * face, values, (x, y, r) => {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
}

/** The frame of a cell a die can be brought to: thinner than a mark, and empty. */
export function dockTexture(): THREE.CanvasTexture {
  return square(128, (ctx, size) => {
    const inset = size * 0.09;
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = size * 0.05;
    ctx.lineWidth = size * 0.045;
    for (let i = 0; i < 2; i++) ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  });
}

/** Chevron pointing to the right, for the arrows that show a move. */
export function chevronTexture(): THREE.CanvasTexture {
  return square(128, (ctx, size) => {
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = size * 0.17;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(size * 0.32, size * 0.16);
      ctx.lineTo(size * 0.7, size * 0.5);
      ctx.lineTo(size * 0.32, size * 0.84);
      ctx.stroke();
    }
  });
}

/** Ghost of a face for the on-board preview: pips and a thin frame on transparent. */
export function ghostFaceTexture(value: number, values: ParamValues): THREE.CanvasTexture {
  return square(128, (ctx, size) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = size * 0.03;
    ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
    ctx.fillStyle = '#fff';
    eachPip(value, size, values, (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

export interface GridLayout {
  /** Cells per side. */
  cells: number;
  /** Width of the margin around the cells that the picture also covers, in cells. */
  rim: number;
}

function gridMetrics(size: number, layout: GridLayout): { cell: number; origin: number } {
  const cell = size / (layout.cells + layout.rim * 2);
  return { cell, origin: cell * layout.rim };
}

/** The surface of the board: lines between the cells and a heavier one around them. Widths are in cells. */
export function gridTexture(layout: GridLayout, line: number, edge: number): THREE.CanvasTexture {
  return square(1024, (ctx, size) => {
    const { cell, origin } = gridMetrics(size, layout);
    const end = origin + cell * layout.cells;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, line * cell);
    ctx.beginPath();
    for (let i = 1; i < layout.cells; i++) {
      const v = origin + i * cell;
      ctx.moveTo(v, origin);
      ctx.lineTo(v, end);
      ctx.moveTo(origin, v);
      ctx.lineTo(end, v);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1, edge * cell);
    ctx.strokeRect(origin, origin, end - origin, end - origin);
  });
}

/** Danger frame, drawn around the cells so the dice never hide it on the near sides. */
export function frameTexture(layout: GridLayout): THREE.CanvasTexture {
  return square(512, (ctx, size) => {
    const { origin } = gridMetrics(size, layout);
    const inset = origin * 0.5;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = origin * 0.55;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  });
}
