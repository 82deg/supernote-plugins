import {croppedPlacement, fullEdges, isFull, moveCorner, moveEdge, originalPlacement} from '../src/image/crop';

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
