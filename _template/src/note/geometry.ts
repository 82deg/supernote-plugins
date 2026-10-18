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

/** Grow a rect by `pad` on every side, clamped to the page. */
export function padRect(r: Rect, pad: number, page: Size): Rect {
  return {
    left: Math.max(0, r.left - pad),
    top: Math.max(0, r.top - pad),
    right: Math.min(page.width, r.right + pad),
    bottom: Math.min(page.height, r.bottom + pad),
  };
}
