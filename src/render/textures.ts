import * as THREE from 'three';
import type { Theme } from './theme';

/** Pip centres on a 3x3 grid, as [column, row] with 0..2. */
export const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

type Draw = (ctx: CanvasRenderingContext2D, size: number) => void;

function canvasTexture(size: number, draw: Draw, srgb = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Cheap repeatable noise so the textures look the same on every load. */
function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, light: string, dark: string): void {
  let seed = 1234567;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rand() > 0.5 ? light : dark;
    ctx.globalAlpha = 0.04 + rand() * 0.08;
    const r = 0.5 + rand() * 1.6;
    ctx.fillRect(rand() * size, rand() * size, r, r);
  }
  ctx.globalAlpha = 1;
}

function eachPip(value: number, size: number, fn: (x: number, y: number, r: number) => void): void {
  const step = size * 0.26;
  for (const [col, row] of PIP_LAYOUT[value]) {
    fn(size / 2 + (col - 1) * step, size / 2 + (row - 1) * step, size * 0.098);
  }
}

/** Colour-coded die face with pips set slightly into the surface. */
export function cubeFaceTexture(value: number, theme: Theme): THREE.CanvasTexture {
  const colors = theme.faces[value - 1];
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, size, size);
    const shade = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.75);
    shade.addColorStop(0, 'rgba(255,255,255,0.08)');
    shade.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 900, '#ffffff', '#000000');
    ctx.strokeStyle = theme.cubeEdge;
    ctx.lineWidth = size * 0.02;
    ctx.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);
    // A single pip is drawn larger, like the 1 on a real die.
    const scale = value === 1 ? 1.5 : 1;
    eachPip(value, size, (x, y, radius) => {
      const r = radius * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.12, r * 1.1, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.45, colors.pip);
      g.addColorStop(1, colors.pip);
      ctx.fillStyle = colors.pip;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  });
}

/** White pips on black: where a face glows. */
export function pipMaskTexture(value: number): THREE.CanvasTexture {
  return canvasTexture(128, (ctx, size) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    const scale = value === 1 ? 1.5 : 1;
    eachPip(value, size, (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r * scale * 1.05, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

/** Mark shown on a cell where a cube is about to rise. */
export function warningTexture(color: string): THREE.CanvasTexture {
  return canvasTexture(128, (ctx, size) => {
    const c = size / 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size * 0.05;
    ctx.shadowColor = color;
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
export function faceFrameTexture(color: string): THREE.CanvasTexture {
  return canvasTexture(256, (ctx, size) => {
    const inset = size * 0.085;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
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
export function chainMarkTexture(value: number, color: string, face: number): THREE.CanvasTexture {
  return canvasTexture(256, (ctx, size) => {
    const inset = size * 0.032;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.04;
    ctx.lineWidth = size * 0.034;
    // Twice, so the glow gathers around a solid shape.
    for (let i = 0; i < 2; i++) ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);

    const edge = (size * (1 - face)) / 2;
    ctx.translate(edge, edge);
    const scale = value === 1 ? 1.5 : 1;
    eachPip(value, size * face, (x, y, radius) => {
      const r = radius * scale;
      ctx.shadowBlur = size * 0.07;
      ctx.fillStyle = color;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // A small hot core makes the pip read as a light, not as paint.
      ctx.shadowBlur = 0;
      const core = ctx.createRadialGradient(x, y, 0, x, y, r);
      core.addColorStop(0, 'rgba(255, 214, 204, 0.85)');
      core.addColorStop(0.5, 'rgba(255, 214, 204, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

/** Chevron pointing to the right, for the arrows that show a move. */
export function chevronTexture(color: string): THREE.CanvasTexture {
  return canvasTexture(128, (ctx, size) => {
    ctx.strokeStyle = color;
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
export function ghostFaceTexture(value: number, color: string): THREE.CanvasTexture {
  return canvasTexture(128, (ctx, size) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.03;
    ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
    ctx.fillStyle = color;
    eachPip(value, size, (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

export interface SlabLayout {
  /** Cells per side. */
  cells: number;
  /** Width of the rim around the cells, in cells. */
  rim: number;
}

function slabMetrics(size: number, layout: SlabLayout): { cell: number; origin: number } {
  const cell = size / (layout.cells + layout.rim * 2);
  return { cell, origin: cell * layout.rim };
}

/** Ash plate with an engraved grid. */
export function slabTexture(theme: Theme, layout: SlabLayout): THREE.CanvasTexture {
  return canvasTexture(1024, (ctx, size) => {
    const { cell, origin } = slabMetrics(size, layout);
    ctx.fillStyle = theme.slabTop;
    ctx.fillRect(0, 0, size, size);
    const shade = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.8);
    shade.addColorStop(0, 'rgba(255,255,255,0.10)');
    shade.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 9000, '#ffffff', '#000000');

    const groove = (x0: number, y0: number, x1: number, y1: number, width: number) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = theme.slabGroove;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.slabHighlight;
      ctx.beginPath();
      ctx.moveTo(x0 + (y0 === y1 ? 0 : width * 0.6 + 0.5), y0 + (y0 === y1 ? width * 0.6 + 0.5 : 0));
      ctx.lineTo(x1 + (y0 === y1 ? 0 : width * 0.6 + 0.5), y1 + (y0 === y1 ? width * 0.6 + 0.5 : 0));
      ctx.stroke();
    };
    const end = origin + cell * layout.cells;
    for (let i = 0; i <= layout.cells; i++) {
      const v = origin + i * cell;
      const edge = i === 0 || i === layout.cells;
      groove(v, origin, v, end, edge ? 4 : 2);
      groove(origin, v, end, v, edge ? 4 : 2);
    }
  });
}

/** Stage 1: ritual marking along the rim. */
export function perimeterTexture(theme: Theme, layout: SlabLayout): THREE.CanvasTexture {
  return canvasTexture(1024, (ctx, size) => {
    const { cell, origin } = slabMetrics(size, layout);
    const mid = origin / 2;
    ctx.strokeStyle = theme.ink;
    ctx.fillStyle = theme.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(mid * 0.45, mid * 0.45, size - mid * 0.9, size - mid * 0.9);
    ctx.strokeRect(mid * 1.55, mid * 1.55, size - mid * 3.1, size - mid * 3.1);

    // Marks along each side: a tick at every cell boundary, a small sign at every cell centre.
    const side = (transform: (along: number, across: number) => [number, number]) => {
      for (let i = 0; i <= layout.cells * 2; i++) {
        const along = origin + (i * cell) / 2;
        const [x0, y0] = transform(along, mid * 0.45);
        const [x1, y1] = transform(along, i % 2 === 0 ? mid * 1.55 : mid * 0.95);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      for (let i = 0; i < layout.cells; i++) {
        const [x, y] = transform(origin + (i + 0.25) * cell, mid * 1.22);
        ctx.beginPath();
        if (i % 3 === 0) ctx.arc(x, y, mid * 0.16, 0, Math.PI * 2);
        else if (i % 3 === 1) {
          ctx.moveTo(x - mid * 0.18, y);
          ctx.lineTo(x + mid * 0.18, y);
          ctx.moveTo(x, y - mid * 0.18);
          ctx.lineTo(x, y + mid * 0.18);
        } else {
          ctx.moveTo(x, y - mid * 0.18);
          ctx.lineTo(x + mid * 0.18, y + mid * 0.14);
          ctx.lineTo(x - mid * 0.18, y + mid * 0.14);
          ctx.closePath();
        }
        ctx.stroke();
      }
    };
    side((a, c) => [a, c]);
    side((a, c) => [a, size - c]);
    side((a, c) => [c, a]);
    side((a, c) => [size - c, a]);

    ctx.fillStyle = theme.carmine;
    for (const [x, y] of [[mid, mid], [size - mid, mid], [mid, size - mid], [size - mid, size - mid]]) {
      ctx.beginPath();
      ctx.arc(x, y, mid * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Stage 2: faint carmine lines between the cells. */
export function cellLinesTexture(theme: Theme, layout: SlabLayout): THREE.CanvasTexture {
  return canvasTexture(1024, (ctx, size) => {
    const { cell, origin } = slabMetrics(size, layout);
    ctx.strokeStyle = theme.carmine;
    ctx.lineWidth = 3;
    ctx.shadowColor = theme.carmine;
    ctx.shadowBlur = 8;
    const end = origin + cell * layout.cells;
    for (let i = 1; i < layout.cells; i++) {
      const v = origin + i * cell;
      ctx.beginPath();
      ctx.moveTo(v, origin);
      ctx.lineTo(v, end);
      ctx.moveTo(origin, v);
      ctx.lineTo(end, v);
      ctx.stroke();
    }
  });
}

/** Stage 5: the lines close into a seal with six-fold symmetry. */
export function sealTexture(theme: Theme): THREE.CanvasTexture {
  return canvasTexture(1024, (ctx, size) => {
    const c = size / 2;
    const radius = size * 0.4;
    ctx.strokeStyle = theme.carmine;
    ctx.shadowColor = theme.carmine;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 5;
    for (const r of [radius, radius * 0.94, radius * 0.5]) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const point = (i: number, r: number): [number, number] => {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      return [c + Math.cos(a) * r, c + Math.sin(a) * r];
    };
    for (const start of [0, 1]) {
      ctx.beginPath();
      for (let k = 0; k <= 3; k++) {
        const [x, y] = point(start + k * 2, radius * 0.94);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = theme.carmine;
    for (let i = 0; i < 6; i++) {
      const [x, y] = point(i, radius * 0.94);
      ctx.beginPath();
      ctx.arc(x, y, size * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Stage 4: a geometric ring that hangs around the plate. */
export function ringTexture(theme: Theme): THREE.CanvasTexture {
  return canvasTexture(1024, (ctx, size) => {
    const c = size / 2;
    const outer = size * 0.49;
    const inner = size * 0.465;
    ctx.strokeStyle = theme.carmine;
    ctx.fillStyle = theme.carmine;
    ctx.shadowColor = theme.carmine;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2.5;
    for (const r of [outer, inner]) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 72; i++) {
      const a = (i * Math.PI * 2) / 72;
      const long = i % 6 === 0;
      const r0 = long ? inner - size * 0.012 : inner;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer);
      ctx.stroke();
      if (i % 12 === 0) {
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * (inner - size * 0.022), c + Math.sin(a) * (inner - size * 0.022), size * 0.006, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Danger frame, drawn on the rim so the dice never hide it on the near sides. */
export function frameTexture(theme: Theme, layout: SlabLayout): THREE.CanvasTexture {
  return canvasTexture(512, (ctx, size) => {
    const { origin } = slabMetrics(size, layout);
    const inset = origin * 0.5;
    ctx.strokeStyle = theme.carmine;
    ctx.lineWidth = origin * 0.55;
    ctx.shadowColor = theme.carmine;
    ctx.shadowBlur = 8;
    ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  });
}
