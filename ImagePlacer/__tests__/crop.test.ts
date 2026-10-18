import {
  croppedPlacement,
  fitRatio,
  fullEdges,
  isFull,
  moveBox,
  moveCorner,
  moveCornerLocked,
  moveEdge,
  originalPlacement,
} from '../src/image/crop';

const SIZE = {width: 426, height: 614};

describe('moveEdge', () => {
  it('moves an edge inward', () => {
    expect(moveEdge(fullEdges(SIZE), 'top', 100, fullEdges(SIZE)).top).toBe(100);
    expect(moveEdge(fullEdges(SIZE), 'right', -26, fullEdges(SIZE)).right).toBe(400);
  });

  it('never goes outside the image', () => {
    expect(moveEdge(fullEdges(SIZE), 'left', -50, fullEdges(SIZE)).left).toBe(0);
    expect(moveEdge(fullEdges(SIZE), 'bottom', 50, fullEdges(SIZE)).bottom).toBe(614);
  });

  it('keeps a minimum kept size', () => {
    const e = moveEdge(fullEdges(SIZE), 'left', 1000, fullEdges(SIZE), 40);
    expect(e.right - e.left).toBe(40);
  });
});

describe('moveCorner', () => {
  it('moves both edges of a corner', () => {
    expect(moveCorner(fullEdges(SIZE), 'bottomRight', -26, -14, fullEdges(SIZE))).toEqual({
      left: 0,
      top: 0,
      right: 400,
      bottom: 600,
    });
    expect(moveCorner(fullEdges(SIZE), 'topLeft', 10, 20, fullEdges(SIZE))).toEqual({left: 10, top: 20, right: 426, bottom: 614});
  });
});

describe('bounds', () => {
  it('stops edges at the bounds, not the image edge', () => {
    const bounds = {left: 5, top: 5, right: 421, bottom: 609};
    expect(moveEdge(bounds, 'left', -50, bounds).left).toBe(5);
    expect(moveCorner(bounds, 'bottomRight', 50, 50, bounds)).toEqual(bounds);
  });
});

describe('fitRatio', () => {
  const b = fullEdges(SIZE); // 426×614, portrait

  it('fits a square across the full width, centred', () => {
    expect(fitRatio(1, b)).toEqual({left: 0, top: 94, right: 426, bottom: 520});
  });

  it('fits 16:9 across the width', () => {
    const r = fitRatio(16 / 9, b);
    expect(r.right - r.left).toBeCloseTo(426);
    expect((r.right - r.left) / (r.bottom - r.top)).toBeCloseTo(16 / 9);
  });

  it('fits 9:16 by height when the image is not tall enough', () => {
    const r = fitRatio(9 / 16, b);
    expect(r.bottom - r.top).toBeCloseTo(614);
    expect((r.right - r.left) / (r.bottom - r.top)).toBeCloseTo(9 / 16);
  });

  it('stays centred on the current box where possible, inside bounds', () => {
    const r = fitRatio(1, b, {left: 0, top: 0, right: 100, bottom: 100});
    expect(r.top).toBe(0); // clamped: can't centre on y=50 with a 426 square
  });
});

describe('moveBox', () => {
  it('moves without resizing and stays inside', () => {
    const box = {left: 100, top: 100, right: 200, bottom: 200};
    expect(moveBox(box, 50, -500, fullEdges(SIZE))).toEqual({left: 150, top: 0, right: 250, bottom: 100});
    expect(moveBox(box, 1000, 0, fullEdges(SIZE)).right).toBe(426);
  });
});

describe('moveCornerLocked', () => {
  const b = fullEdges(SIZE);
  const sq = {left: 100, top: 100, right: 300, bottom: 300};

  it('keeps the ratio and the opposite corner', () => {
    const r = moveCornerLocked(sq, 'bottomRight', 50, 10, b, 1);
    expect(r).toEqual({left: 100, top: 100, right: 350, bottom: 350});
  });

  it('shrinks from the top-left corner', () => {
    const r = moveCornerLocked(sq, 'topLeft', 40, 40, b, 1);
    expect(r).toEqual({left: 140, top: 140, right: 300, bottom: 300});
  });

  it('stops at the bounds while keeping the ratio', () => {
    const r = moveCornerLocked(sq, 'bottomRight', 1000, 1000, b, 1);
    expect(r.right).toBeLessThanOrEqual(426);
    expect(r.right - r.left).toBeCloseTo(r.bottom - r.top);
  });

  it('works for wide ratios', () => {
    const wide = {left: 0, top: 0, right: 160, bottom: 90};
    const r = moveCornerLocked(wide, 'bottomRight', 32, 0, b, 16 / 9);
    expect(r).toEqual({left: 0, top: 0, right: 192, bottom: 108});
  });
});

describe('isFull', () => {
  it('detects an untouched crop', () => {
    expect(isFull(fullEdges(SIZE), fullEdges(SIZE))).toBe(true);
    expect(isFull(moveEdge(fullEdges(SIZE), 'top', 1, fullEdges(SIZE)), fullEdges(SIZE))).toBe(false);
  });
});

describe('croppedPlacement', () => {
  it('keeps the kept part exactly where it was (1:1 scale)', () => {
    const placed = {left: 116, top: 122, right: 542, bottom: 736};
    const edges = {left: 20, top: 100, right: 400, bottom: 500};
    expect(croppedPlacement(placed, SIZE, edges)).toEqual({left: 136, top: 222, right: 516, bottom: 622});
  });

  it('round-trips through originalPlacement', () => {
    const placed = {left: 116, top: 122, right: 542, bottom: 736};
    const edges = {left: 20, top: 100, right: 400, bottom: 500};
    const cropped = croppedPlacement(placed, SIZE, edges);
    expect(originalPlacement(cropped, SIZE, edges)).toEqual(placed);
  });

  it('scales edges when the placement is scaled', () => {
    const placed = {left: 0, top: 0, right: 213, bottom: 307}; // half size
    const edges = {left: 0, top: 0, right: 213, bottom: 307};
    expect(croppedPlacement(placed, SIZE, edges)).toEqual({left: 0, top: 0, right: 107, bottom: 154});
  });
});
