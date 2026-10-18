import {fullCrop, rotateBy, rotatedRegion, rotatedSize, stageLayout} from '../src/image/transform';

const SRC = {width: 4000, height: 3000};

describe('rotation helpers', () => {
  it('swaps sides for quarter turns', () => {
    expect(rotatedSize(SRC, 90)).toEqual({width: 3000, height: 4000});
    expect(rotatedSize(SRC, 180)).toEqual(SRC);
  });

  it('wraps rotation both ways', () => {
    expect(rotateBy(270, 90)).toBe(0);
    expect(rotateBy(0, -90)).toBe(270);
  });
});

describe('rotatedRegion', () => {
  // 100×50 image, region = everything except a 5px margin.
  const src = {width: 100, height: 50};
  const inner = {left: 5, top: 5, right: 95, bottom: 45};

  it('keeps the margin trimmed for every quarter turn', () => {
    expect(rotatedRegion(inner, src, 0)).toEqual({x: 5, y: 5, width: 90, height: 40});
    expect(rotatedRegion(inner, src, 90)).toEqual({x: 5, y: 5, width: 40, height: 90});
    expect(rotatedRegion(inner, src, 180)).toEqual({x: 5, y: 5, width: 90, height: 40});
    expect(rotatedRegion(inner, src, 270)).toEqual({x: 5, y: 5, width: 40, height: 90});
  });

  it('maps an off-centre region correctly at 90°', () => {
    // Top-left 10×10 corner of the source lands at the top-right after a clockwise turn.
    expect(rotatedRegion({left: 0, top: 0, right: 10, bottom: 10}, src, 90)).toEqual({
      x: 40,
      y: 0,
      width: 10,
      height: 10,
    });
  });
});

describe('stageLayout', () => {
  it('downscales a full photo to the max side', () => {
    const l = stageLayout(SRC, 0, fullCrop(SRC, 0), 1872, 1);
    expect(l.output).toEqual({width: 1872, height: 1404});
    expect(l.image).toEqual({left: 0, top: 0, width: 1872, height: 1404});
    expect(l.box).toEqual({width: 1872, height: 1404});
  });

  it('never upscales small images', () => {
    const small = {width: 400, height: 300};
    expect(stageLayout(small, 0, fullCrop(small, 0), 1872, 1).output).toEqual(small);
  });

  it('centres a 90° rotated image in a portrait box', () => {
    const l = stageLayout(SRC, 90, fullCrop(SRC, 90), 4000, 1);
    expect(l.box).toEqual({width: 3000, height: 4000});
    // Unrotated 4000×3000 image centred on the box centre (1500, 2000).
    expect(l.image).toEqual({left: -500, top: 500, width: 4000, height: 3000});
  });

  it('offsets the image so the crop region fills the box', () => {
    const l = stageLayout(SRC, 0, {x: 1000, y: 500, width: 2000, height: 1000}, 4000, 2);
    expect(l.box).toEqual({width: 1000, height: 500});
    expect(l.image.left).toBe(-500);
    expect(l.image.top).toBe(-250);
    expect(l.output).toEqual({width: 2000, height: 1000});
  });
});
