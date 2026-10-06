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
 * The colour of a face: the colour of its channel as it is. A face is a screen, and gives its
 * own light; the look can take all six down together, and no face more than another.
 */
export function faceColour(value: number, palette: Palette, values: ParamValues): string {
  return mixHex(palette.channels[value - 1], '#000000', Math.min(0.95, Math.max(0, Number(values.faceMute))));
}

/** The colour of the pips of a face: places of the screen that are not lit. The pip of the one is lit, and red. */
export function pipColour(value: number, palette: Palette, values: ParamValues): string {
  return value === 1 ? palette.signal : String(values.pipDark);
}

/** The colour the light of a face is thrown about with: its channel, or the red of the one. */
export function pipGlow(value: number, palette: Palette): string {
  return value === 1 ? palette.signal : mixHex(palette.channels[value - 1], '#ffffff', 0.5);
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

/**
 * The sign of a cell a die can be brought to: four corners, a socket. Not a frame: the frame
 * is the shelf above it, and the two are told apart by their shape.
 */
export function socketTexture(): THREE.CanvasTexture {
  return square(128, (ctx, size) => {
    const inset = size * 0.09;
    const arm = size * 0.2;
    const far = size - inset;
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = size * 0.05;
    ctx.lineWidth = size * 0.05;
    ctx.lineCap = 'square';
    // Twice, so a faint glow gathers around a solid line.
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      for (const [x, y, dx, dy] of [
        [inset, inset, 1, 1],
        [far, inset, -1, 1],
        [inset, far, 1, -1],
        [far, far, -1, -1],
      ]) {
        ctx.moveTo(x + dx * arm, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * arm);
      }
      ctx.stroke();
    }
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
