import {centeredRect, padRect} from '../src/note/geometry';

const NOMAD = {width: 1404, height: 1872};

describe('centeredRect', () => {
  it('places a landscape image at half page width, centred', () => {
    const r = centeredRect(NOMAD, {width: 800, height: 400});
    expect(r).toEqual({left: 351, top: 761, right: 1053, bottom: 1112});
  });

  it('keeps the aspect ratio', () => {
    const r = centeredRect(NOMAD, {width: 300, height: 900});
    expect((r.bottom - r.top) / (r.right - r.left)).toBeCloseTo(3, 1);
  });

  it('shrinks very tall images to fit 90% of the page height', () => {
    const r = centeredRect(NOMAD, {width: 100, height: 5000}, 0.9);
    expect(r.bottom - r.top).toBeLessThanOrEqual(Math.ceil(NOMAD.height * 0.9));
    expect(r.top).toBeGreaterThanOrEqual(0);
  });
});

describe('padRect', () => {
  it('clamps to the page', () => {
    expect(padRect({left: 2, top: 2, right: 1400, bottom: 1870}, 10, NOMAD)).toEqual({
      left: 0,
      top: 0,
      right: 1404,
      bottom: 1872,
    });
  });
});
