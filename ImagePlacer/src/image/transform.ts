// Pure layout maths for the render stage: rotate, then crop, then scale.
// The stage is an overflow:hidden box the size of the crop; the source image
// sits inside it, rotated about its own centre and offset so the crop region
// fills the box. view-shot then captures the box at the output size.
import type {Size} from '../note/geometry';

export type Rotation = 0 | 90 | 180 | 270;

/** A crop in the *rotated* image's pixel space (what the user sees). */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StageLayout {
  /** Box size in layout units (dp). */
  box: Size;
  /** Absolute position + size of the (unrotated) image inside the box, in dp. */
  image: {left: number; top: number; width: number; height: number};
  rotation: Rotation;
  /** Final PNG size in pixels. */
  output: Size;
}

export function rotatedSize(src: Size, rotation: Rotation): Size {
  return rotation % 180 === 0 ? src : {width: src.height, height: src.width};
}

export function rotateBy(rotation: Rotation, delta: 90 | -90): Rotation {
  return (((rotation + delta) % 360) + 360) % 360 as Rotation;
}

export function fullCrop(src: Size, rotation: Rotation): Crop {
  const r = rotatedSize(src, rotation);
  return {x: 0, y: 0, width: r.width, height: r.height};
}

/**
 * Where a region of the source (edges in source px) ends up after rotating
 * the whole image clockwise by `rotation`, as a crop in rotated space.
 */
export function rotatedRegion(
  region: {left: number; top: number; right: number; bottom: number},
  src: Size,
  rotation: Rotation,
): Crop {
  const {left: l, top: t, right: r, bottom: b} = region;
  switch (rotation) {
    case 90: // (x, y) → (H − y, x)
      return {x: src.height - b, y: l, width: b - t, height: r - l};
    case 180: // (x, y) → (W − x, H − y)
      return {x: src.width - r, y: src.height - b, width: r - l, height: b - t};
    case 270: // (x, y) → (y, W − x)
      return {x: t, y: src.width - r, width: b - t, height: r - l};
    default:
      return {x: l, y: t, width: r - l, height: b - t};
  }
}

/**
 * @param maxSide longest output side in px (e.g. the page's long side), so
 *   large photos are downscaled before they reach the note.
 * @param pixelRatio PixelRatio.get(): dp → px factor of the device.
 */
export function stageLayout(
  src: Size,
  rotation: Rotation,
  crop: Crop,
  maxSide: number,
  pixelRatio: number,
): StageLayout {
  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  const output = {width: Math.round(crop.width * scale), height: Math.round(crop.height * scale)};
  const d = scale / pixelRatio; // source px → dp
  const r = rotatedSize(src, rotation);
  // Centre of the rotated image, in box coordinates.
  const cx = (r.width / 2 - crop.x) * d;
  const cy = (r.height / 2 - crop.y) * d;
  const width = src.width * d;
  const height = src.height * d;
  return {
    box: {width: crop.width * d, height: crop.height * d},
    image: {left: cx - width / 2, top: cy - height / 2, width, height},
    rotation,
    output,
  };
}
