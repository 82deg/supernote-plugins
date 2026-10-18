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
 * staying inside `bounds` (the usable part of the image, in source px).
 */
export function moveEdge(edges: Edges, edge: Edge, delta: number, bounds: Edges, minSize = 40): Edges {
  const e = {...edges};
  switch (edge) {
    case 'left':
      e.left = clamp(edges.left + delta, bounds.left, edges.right - minSize);
      break;
    case 'right':
      e.right = clamp(edges.right + delta, edges.left + minSize, bounds.right);
      break;
    case 'top':
      e.top = clamp(edges.top + delta, bounds.top, edges.bottom - minSize);
      break;
    case 'bottom':
      e.bottom = clamp(edges.bottom + delta, edges.top + minSize, bounds.bottom);
      break;
  }
  return e;
}

export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/** Move a corner: its horizontal edge by `dy`, its vertical edge by `dx`. */
export function moveCorner(edges: Edges, corner: Corner, dx: number, dy: number, bounds: Edges, minSize = 40): Edges {
  const h: Edge = corner === 'topLeft' || corner === 'bottomLeft' ? 'left' : 'right';
  const v: Edge = corner === 'topLeft' || corner === 'topRight' ? 'top' : 'bottom';
  return moveEdge(moveEdge(edges, h, dx, bounds, minSize), v, dy, bounds, minSize);
}

/** Drag the whole crop box, keeping its size, inside `bounds`. */
export function moveBox(edges: Edges, dx: number, dy: number, bounds: Edges): Edges {
  const w = edges.right - edges.left;
  const h = edges.bottom - edges.top;
  const left = clamp(edges.left + dx, bounds.left, bounds.right - w);
  const top = clamp(edges.top + dy, bounds.top, bounds.bottom - h);
  return {left, top, right: left + w, bottom: top + h};
}

/**
 * The largest box with aspect `ratio` (width / height) inside `bounds`,
 * centred on `around` as far as the bounds allow.
 */
export function fitRatio(ratio: number, bounds: Edges, around: Edges = bounds): Edges {
  const bw = bounds.right - bounds.left;
  const bh = bounds.bottom - bounds.top;
  const w = Math.min(bw, bh * ratio);
  const h = w / ratio;
  const cx = (around.left + around.right) / 2;
  const cy = (around.top + around.bottom) / 2;
  const left = clamp(cx - w / 2, bounds.left, bounds.right - w);
  const top = clamp(cy - h / 2, bounds.top, bounds.bottom - h);
  return {left, top, right: left + w, bottom: top + h};
}

/**
 * Corner drag with a locked aspect `ratio`: the opposite corner stays put and
 * the box keeps its shape, clamped to `bounds` and a minimum size.
 */
export function moveCornerLocked(
  edges: Edges,
  corner: Corner,
  dx: number,
  dy: number,
  bounds: Edges,
  ratio: number,
  minSize = 40,
): Edges {
  const right = corner === 'topRight' || corner === 'bottomRight';
  const bottom = corner === 'bottomLeft' || corner === 'bottomRight';
  // Anchor: the opposite corner.
  const ax = right ? edges.left : edges.right;
  const ay = bottom ? edges.top : edges.bottom;
  const w0 = edges.right - edges.left;
  // Follow whichever axis the finger moved further, in width terms.
  const dw = right ? dx : -dx;
  const dh = bottom ? dy : -dy;
  let w = w0 + (Math.abs(dw) >= Math.abs(dh * ratio) ? dw : dh * ratio);
  const roomW = right ? bounds.right - ax : ax - bounds.left;
  const roomH = bottom ? bounds.bottom - ay : ay - bounds.top;
  w = clamp(w, Math.max(minSize, minSize * ratio), Math.min(roomW, roomH * ratio));
  const h = w / ratio;
  return {
    left: right ? ax : ax - w,
    right: right ? ax + w : ax,
    top: bottom ? ay : ay - h,
    bottom: bottom ? ay + h : ay,
  };
}

export function isFull(edges: Edges, bounds: Edges): boolean {
  return (
    edges.left <= bounds.left && edges.top <= bounds.top && edges.right >= bounds.right && edges.bottom >= bounds.bottom
  );
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
