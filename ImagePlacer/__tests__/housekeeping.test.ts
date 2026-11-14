jest.mock('sn-plugin-lib', () => ({FileUtils: {}}));

import {filesToPrune} from '../src/note/housekeeping';

const ORIG = /^orig-\d+\.png$/;

describe('filesToPrune', () => {
  it('keeps the newest N and returns the rest, oldest last', () => {
    const names = ['orig-1792354409004.png', 'orig-1792354409010.png', 'orig-1792354409002.png'];
    expect(filesToPrune(names, ORIG, 1)).toEqual(['orig-1792354409004.png', 'orig-1792354409002.png']);
  });

  it('ignores files that do not match', () => {
    const names = ['orig-1792354409004.png', 'notes.txt', 'lasso-1792354409009.png'];
    expect(filesToPrune(names, ORIG, 0)).toEqual(['orig-1792354409004.png']);
  });

  it('removes nothing when under the limit', () => {
    expect(filesToPrune(['orig-1792354409004.png'], ORIG, 50)).toEqual([]);
  });
});
