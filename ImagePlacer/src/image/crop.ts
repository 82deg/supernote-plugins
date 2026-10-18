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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
