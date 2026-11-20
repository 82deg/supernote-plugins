import {decodeTag, encodeTag, fractionsTag, tagFractions} from '../src/note/pictureTag';
import {frameRect, photoRect, rotatedRect} from '../src/note/geometry';

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

  it('keeps a border and its insets, and rejects silly insets', () => {
    const t = decodeTag(encodeTag({...tag, d: 'l.dash.med.dark', i: [0.02, 0.03, 0.02, 0.03]}));
    expect(t?.d).toBe('l.dash.med.dark');
    expect(tagFractions(t?.i)).toEqual({l: 0.02, t: 0.03, r: 0.02, b: 0.03});
    expect(decodeTag(encodeTag({...tag, i: [0.5, 0, 0.5, 0]}))).toBeNull();
    expect(decodeTag(encodeTag({...tag, i: [-0.1, 0, 0, 0]}))).toBeNull();
  });

  it('writes no insets for no border, and rounds them short', () => {
    expect(fractionsTag({l: 0, t: 0, r: 0, b: 0})).toBeUndefined();
    expect(fractionsTag({l: 0.123456, t: 0, r: 0, b: 0})).toEqual([0.1235, 0, 0, 0]);
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

describe('photoRect / frameRect', () => {
  const page = {width: 1404, height: 1872};
  const f = {l: 0.1, t: 0.05, r: 0.1, b: 0.05};

  it('strips the border share, also after a resize or stretch', () => {
    expect(photoRect({left: 0, top: 0, right: 1000, bottom: 400}, f)).toEqual({left: 100, top: 20, right: 900, bottom: 380});
    expect(photoRect({left: 0, top: 0, right: 500, bottom: 400}, f)).toEqual({left: 50, top: 20, right: 450, bottom: 380});
    expect(photoRect({left: 1, top: 2, right: 3, bottom: 4}, undefined)).toEqual({left: 1, top: 2, right: 3, bottom: 4});
  });

  it('grows around the photo', () => {
    expect(frameRect({left: 200, top: 300, right: 600, bottom: 600}, {l: 10, t: 20, r: 10, b: 0}, page)).toEqual({
      left: 190,
      top: 280,
      right: 610,
      bottom: 600,
    });
  });

  it('moves inside the page at an edge', () => {
    const r = frameRect({left: 0, top: 0, right: 400, bottom: 300}, {l: 20, t: 20, r: 20, b: 20}, page);
    expect(r.left).toBe(0);
    expect(r.top).toBe(0);
    expect(r.right - r.left).toBe(440);
  });

  it('shrinks evenly when bigger than the page', () => {
    const r = frameRect({left: 0, top: 0, right: 1404, bottom: 1000}, {l: 100, t: 0, r: 100, b: 0}, page);
    expect(r.right - r.left).toBe(1404);
    expect((r.bottom - r.top) / (r.right - r.left)).toBeCloseTo(1000 / 1604, 2);
  });
});

