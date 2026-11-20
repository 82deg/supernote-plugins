// Pure geometry helpers. All note-side rects are Android pixel coordinates
// (sn-plugin-lib > 0.1.65), matching PluginFileAPI.getPageSize.

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * A rect for an image of `image` size, `widthFraction` of the page wide,
 * aspect-correct and centred on the page. Shrinks to fit if too tall.
 */
export function centeredRect(page: Size, image: Size, widthFraction = 0.5): Rect {
  const aspect = image.height / image.width;
  let width = page.width * widthFraction;
  let height = width * aspect;
  if (height > page.height * 0.9) {
    height = page.height * 0.9;
    width = height / aspect;
  }
  const left = (page.width - width) / 2;
  const top = (page.height - height) / 2;
  return roundRect({left, top, right: left + width, bottom: top + height});
}

export function roundRect(r: Rect): Rect {
  return {
    left: Math.round(r.left),
    top: Math.round(r.top),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom),
  };
}

/**
 * The rect of a picture after a quarter turn: same centre, sides swapped, kept
 * on the page. Too big for the page once turned, it shrinks evenly, so it never
 * gets stretched.
 */
export function rotatedRect(r: Rect, page: Size): Rect {
  const w0 = r.bottom - r.top;
  const h0 = r.right - r.left;
  const fit = Math.min(1, page.width / w0, page.height / h0);
  const w = w0 * fit;
  const h = h0 * fit;
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  const left = Math.min(Math.max(0, cx - w / 2), page.width - w);
  const top = Math.min(Math.max(0, cy - h / 2), page.height - h);
  return roundRect({left, top, right: left + w, bottom: top + h});
}

/** Grow a rect by `pad` on every side, clamped to the page. */
export function padRect(r: Rect, pad: number, page: Size): Rect {
  return {
    left: Math.max(0, r.left - pad),
    top: Math.max(0, r.top - pad),
    right: Math.min(page.width, r.right + pad),
    bottom: Math.min(page.height, r.bottom + pad),
  };
}

/** Insets as shares of a rect's width (l, r) and height (t, b). */
export interface Fractions {
  l: number;
  t: number;
  r: number;
  b: number;
}

/**
 * The photo inside a picture that has a border: strip the border's share on
 * each side. Shares, not pixels, so it still fits after a lasso resize.
 */
export function photoRect(rect: Rect, f: Fractions | undefined): Rect {
  if (!f) {
    return rect;
  }
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  return {left: rect.left + f.l * w, top: rect.top + f.t * h, right: rect.right - f.r * w, bottom: rect.bottom - f.b * h};
}

/**
 * The picture rect for a photo plus its border insets (page px), kept on the
 * page: moved inside it, and shrunk evenly (never stretched) if too big.
 */
export function frameRect(photo: Rect, insets: {l: number; t: number; r: number; b: number}, page: Size): Rect {
  let left = photo.left - insets.l;
  let top = photo.top - insets.t;
  let w = photo.right - photo.left + insets.l + insets.r;
  let h = photo.bottom - photo.top + insets.t + insets.b;
  const fit = Math.min(1, page.width / w, page.height / h);
  if (fit < 1) {
    const cx = left + w / 2;
    const cy = top + h / 2;
    w *= fit;
    h *= fit;
    left = cx - w / 2;
    top = cy - h / 2;
  }
  left = Math.min(Math.max(0, left), page.width - w);
  top = Math.min(Math.max(0, top), page.height - h);
  return roundRect({left, top, right: left + w, bottom: top + h});
}
