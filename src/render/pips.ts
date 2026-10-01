import * as THREE from 'three';
import type { FaceColors } from './theme';

/** Pip centres on a 3x3 grid, as [column, row] with 0..2. */
export const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

export function drawFace(
  ctx: CanvasRenderingContext2D,
  value: number,
  size: number,
  colors: FaceColors,
  options: { border?: string; transparent?: boolean } = {},
): void {
  ctx.clearRect(0, 0, size, size);
  if (!options.transparent) {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, size, size);
  }
  if (options.border) {
    ctx.strokeStyle = options.border;
    ctx.lineWidth = size * 0.045;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
  }
  ctx.fillStyle = colors.pip;
  const step = size * 0.27;
  const radius = size * 0.1;
  for (const [col, row] of PIP_LAYOUT[value]) {
    ctx.beginPath();
    ctx.arc(size / 2 + (col - 1) * step, size / 2 + (row - 1) * step, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makeFaceTexture(
  value: number,
  colors: FaceColors,
  options: { border?: string; transparent?: boolean } = {},
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawFace(canvas.getContext('2d')!, value, size, colors, options);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
