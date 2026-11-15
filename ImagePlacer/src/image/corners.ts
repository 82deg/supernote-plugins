// Rounded corners. Each picture keeps its own style (in its tag); new pictures
// get the default from Settings. Pure maths only, so it is unit-tested.
import type {Size} from '../note/geometry';

export type Corners = 'none' | 'small' | 'medium' | 'large' | 'circle';

export const CORNER_STYLES: {id: Corners; label: string}[] = [
  {id: 'none', label: 'None'},
  {id: 'small', label: 'Small'},
  {id: 'medium', label: 'Medium'},
  {id: 'large', label: 'Large'},
  {id: 'circle', label: 'Circle'},
];

/**
 * Radii in dp, like the rest of the UI, so they look like 8/16/24 in a design
 * tool. On the page that's dp × PixelRatio (about 1.4 / 2.7 / 4 mm on a Nomad).
 */
export const CORNER_DP: Record<'small' | 'medium' | 'large', number> = {small: 8, medium: 16, large: 24};

export function isCorners(v: unknown): v is Corners {
  return typeof v === 'string' && CORNER_STYLES.some(c => c.id === v);
}

/**
 * Corner radius in page px for a picture shown `placed` page px big. Never
 * more than half the short side; "circle" is exactly that (a circle on a
 * square picture, a pill on any other).
 */
export function cornerRadius(corners: Corners, placed: Size, pixelRatio: number): number {
  const half = Math.min(placed.width, placed.height) / 2;
  if (corners === 'none' || half <= 0) {
    return 0;
  }
  if (corners === 'circle') {
    return half;
  }
  return Math.min(CORNER_DP[corners] * pixelRatio, half);
}

/** The same radius as a share of the picture's width (what the render step takes). */
export function cornerShare(corners: Corners, placed: Size, pixelRatio: number): number {
  return placed.width > 0 ? cornerRadius(corners, placed, pixelRatio) / placed.width : 0;
}
