// Pure crop maths for the edge-bar crop screen. Crops are edge positions in
// source-image pixels; nothing here ever changes the image's aspect: cropping
// only trims, and the kept part keeps its place and scale on the page.
import type {Rect, Size} from '../note/geometry';

export type Edge = 'left' | 'top' | 'right' | 'bottom';

/** Crop as the kept region's edges, in source pixels. */
export type Edges = Rect;

export function fullEdges(size: Size): Edges {
  return {left: 0, top: 0, right: size.width, bottom: size.height};
}

/**
 * Move one edge by `delta` source px, keeping at least `minSize` px kept and
 * staying inside the image.
 */
export function moveEdge(edges: Edges, edge: Edge, delta: number, size: Size, minSize = 40): Edges {
  const e = {...edges};
  switch (edge) {
    case 'left':
      e.left = clamp(edges.left + delta, 0, edges.right - minSize);
      break;
    case 'right':
      e.right = clamp(edges.right + delta, edges.left + minSize, size.width);
      break;
    case 'top':
      e.top = clamp(edges.top + delta, 0, edges.bottom - minSize);
      break;
    case 'bottom':
      e.bottom = clamp(edges.bottom + delta, edges.top + minSize, size.height);
      break;
  }
  return e;
}

export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/** Move a corner: its horizontal edge by `dy`, its vertical edge by `dx`. */
export function moveCorner(edges: Edges, corner: Corner, dx: number, dy: number, size: Size, minSize = 40): Edges {
  const h: Edge = corner === 'topLeft' || corner === 'bottomLeft' ? 'left' : 'right';
  const v: Edge = corner === 'topLeft' || corner === 'topRight' ? 'top' : 'bottom';
  return moveEdge(moveEdge(edges, h, dx, size, minSize), v, dy, size, minSize);
}

export function isFull(edges: Edges, size: Size): boolean {
  return edges.left <= 0 && edges.top <= 0 && edges.right >= size.width && edges.bottom >= size.height;
}

/**
 * Where the cropped picture goes on the page: the same scale as the original
 * placement, shifted so the kept part stays exactly where it was.
 */
export function croppedPlacement(placed: Rect, size: Size, edges: Edges): Rect {
  const sx = (placed.right - placed.left) / size.width;
  const sy = (placed.bottom - placed.top) / size.height;
  return {
    left: Math.round(placed.left + edges.left * sx),
    top: Math.round(placed.top + edges.top * sy),
    right: Math.round(placed.left + edges.right * sx),
    bottom: Math.round(placed.top + edges.bottom * sy),
  };
}

/**
 * Inverse of croppedPlacement: where the uncropped original would sit, given
 * the cropped picture's rect and the edges it was cut with. Lets a re-crop
 * start from the full original (non-destructive crop).
 */
export function originalPlacement(cropped: Rect, size: Size, edges: Edges): Rect {
  const sx = (cropped.right - cropped.left) / (edges.right - edges.left);
  const sy = (cropped.bottom - cropped.top) / (edges.bottom - edges.top);
  const left = cropped.left - edges.left * sx;
  const top = cropped.top - edges.top * sy;
  return {left, top, right: left + size.width * sx, bottom: top + size.height * sy};
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
