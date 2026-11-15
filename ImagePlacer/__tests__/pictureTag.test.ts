import {decodeTag, encodeTag} from '../src/note/pictureTag';
import {rotatedRect} from '../src/note/geometry';

describe('picture tag', () => {
  const tag = {o: 'orig-1.png', w: 426, h: 614, e: {left: 0, top: 10, right: 400, bottom: 600}};

  it('round-trips', () => {
    expect(decodeTag(encodeTag(tag))).toEqual({v: 1, ...tag});
  });

  it('ignores foreign or broken userData', () => {
    expect(decodeTag('')).toBeNull();
    expect(decodeTag(undefined)).toBeNull();
    expect(decodeTag('someotherplugin:{}')).toBeNull();
    expect(decodeTag('imageplacer:{not json')).toBeNull();
  });

  it('keeps a valid corner style and rejects unknown ones', () => {
    expect(decodeTag(encodeTag({...tag, r: 'medium'}))?.r).toBe('medium');
    expect(decodeTag(encodeTag({...tag, r: 'blobby' as any}))).toBeNull();
  });

  it('rejects paths in the original name', () => {
    expect(decodeTag(encodeTag({...tag, o: '../../Note/x.note'}))).toBeNull();
    expect(decodeTag(encodeTag({...tag, o: '..'}))).toBeNull();
  });
});

describe('rotatedRect', () => {
  const page = {width: 1404, height: 1872};

  it('swaps sides around the same centre', () => {
    expect(rotatedRect({left: 100, top: 200, right: 500, bottom: 400}, page)).toEqual({
      left: 200,
      top: 100,
      right: 400,
      bottom: 500,
    });
  });

  it('stays on the page', () => {
    const r = rotatedRect({left: 0, top: 0, right: 1000, bottom: 200}, page);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.right - r.left).toBe(200);
    expect(r.bottom - r.top).toBe(1000);
  });

  it('shrinks evenly instead of stretching when too big once turned', () => {
    const r = rotatedRect({left: 252, top: 86, right: 1152, bottom: 1786}, page); // 900 × 1700
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    expect(w).toBeLessThanOrEqual(page.width);
    expect(h / w).toBeCloseTo(900 / 1700, 2);
  });
});
