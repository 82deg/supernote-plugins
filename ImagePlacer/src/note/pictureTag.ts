// Tag stored in a picture element's `userData`, pointing at the uncropped
// original we keep in the plugin folder. Makes crop non-destructive: a later
// crop reopens the full original with the previous crop edges.
import type {Edges} from '../image/crop';
import {isCorners, type Corners} from '../image/corners';

export const TAG_PREFIX = 'imageplacer:';

export interface PictureTag {
  v: 1;
  /** File name of the original inside <pluginDir>/originals/. */
  o: string;
  /** Original size in px. */
  w: number;
  h: number;
  /** Usable part of the original (excludes the lasso margin), in original px. */
  b?: Edges;
  /** Current crop edges, in original px. */
  e: Edges;
  /** Rounded corners; absent means none. */
  r?: Corners;
  /** Border code (see image/border.ts); absent means none. */
  d?: string;
  /** Border insets as shares of the picture: [left, top, right, bottom]. */
  i?: [number, number, number, number];
}

export function encodeTag(tag: Omit<PictureTag, 'v'>): string {
  return TAG_PREFIX + JSON.stringify({v: 1, ...tag});
}

function isEdges(e: unknown): e is Edges {
  return !!e && ['left', 'top', 'right', 'bottom'].every(k => typeof (e as Record<string, unknown>)[k] === 'number');
}

function isInsets(i: unknown): boolean {
  return (
    Array.isArray(i) &&
    i.length === 4 &&
    i.every(v => typeof v === 'number' && v >= 0) &&
    i[0] + i[2] < 0.9 &&
    i[1] + i[3] < 0.9
  );
}

/** Tag insets → fractions (and back, rounded to keep the tag short). */
export const tagFractions = (i: PictureTag['i']) => (i ? {l: i[0], t: i[1], r: i[2], b: i[3]} : undefined);
export const fractionsTag = (f: {l: number; t: number; r: number; b: number}): PictureTag['i'] => {
  const q = (v: number) => Math.round(v * 10000) / 10000;
  return f.l || f.t || f.r || f.b ? [q(f.l), q(f.t), q(f.r), q(f.b)] : undefined;
};

export function decodeTag(userData: unknown): PictureTag | null {
  if (typeof userData !== 'string' || !userData.startsWith(TAG_PREFIX)) {
    return null;
  }
  try {
    const t = JSON.parse(userData.slice(TAG_PREFIX.length));
    const ok =
      t &&
      t.v === 1 &&
      typeof t.o === 'string' &&
      /^[\w-][\w.-]*$/.test(t.o) && // a bare file name: no path, no leading dot
      t.w > 0 &&
      t.h > 0 &&
      isEdges(t.e) &&
      (t.b === undefined || isEdges(t.b)) &&
      (t.r === undefined || isCorners(t.r)) &&
      (t.d === undefined || typeof t.d === 'string') &&
      (t.i === undefined || isInsets(t.i));
    return ok ? (t as PictureTag) : null;
  } catch {
    return null;
  }
}
