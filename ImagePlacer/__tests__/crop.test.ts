import {croppedPlacement, fullEdges, isFull, moveEdge} from '../src/image/crop';

const SIZE = {width: 426, height: 614};

describe('moveEdge', () => {
  it('moves an edge inward', () => {
    expect(moveEdge(fullEdges(SIZE), 'top', 100, SIZE).top).toBe(100);
    expect(moveEdge(fullEdges(SIZE), 'right', -26, SIZE).right).toBe(400);
  });

  it('never goes outside the image', () => {
    expect(moveEdge(fullEdges(SIZE), 'left', -50, SIZE).left).toBe(0);
    expect(moveEdge(fullEdges(SIZE), 'bottom', 50, SIZE).bottom).toBe(614);
  });

  it('keeps a minimum kept size', () => {
    const e = moveEdge(fullEdges(SIZE), 'left', 1000, SIZE, 40);
    expect(e.right - e.left).toBe(40);
  });
});

describe('isFull', () => {
  it('detects an untouched crop', () => {
    expect(isFull(fullEdges(SIZE), SIZE)).toBe(true);
    expect(isFull(moveEdge(fullEdges(SIZE), 'top', 1, SIZE), SIZE)).toBe(false);
  });
});

describe('croppedPlacement', () => {
  it('keeps the kept part exactly where it was (1:1 scale)', () => {
    const placed = {left: 116, top: 122, right: 542, bottom: 736};
    const edges = {left: 20, top: 100, right: 400, bottom: 500};
    expect(croppedPlacement(placed, SIZE, edges)).toEqual({left: 136, top: 222, right: 516, bottom: 622});
  });

  it('scales edges when the placement is scaled', () => {
    const placed = {left: 0, top: 0, right: 213, bottom: 307}; // half size
    const edges = {left: 0, top: 0, right: 213, bottom: 307};
    expect(croppedPlacement(placed, SIZE, edges)).toEqual({left: 0, top: 0, right: 107, bottom: 154});
  });
});
