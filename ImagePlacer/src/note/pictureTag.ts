// Tag stored in a picture element's `userData`, pointing at the uncropped
// original we keep in the plugin folder. Makes crop non-destructive: a later
// crop reopens the full original with the previous crop edges.
import type {Edges} from '../image/crop';

export const TAG_PREFIX = 'imageplacer:';

export interface PictureTag {
  v: 1;
  /** File name of the original inside <pluginDir>/originals/. */
  o: string;
  /** Original size in px. */
  w: number;
  h: number;
  /** Current crop edges, in original px. */
  e: Edges;
}

export function encodeTag(tag: Omit<PictureTag, 'v'>): string {
  return TAG_PREFIX + JSON.stringify({v: 1, ...tag});
}

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
      /^[\w.-]+$/.test(t.o) && // a bare file name, never a path
      t.w > 0 &&
      t.h > 0 &&
      t.e &&
      ['left', 'top', 'right', 'bottom'].every(k => typeof t.e[k] === 'number');
    return ok ? (t as PictureTag) : null;
  } catch {
    return null;
  }
}
