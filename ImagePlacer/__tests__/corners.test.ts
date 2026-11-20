jest.mock('sn-plugin-lib', () => ({FileUtils: {}, PluginManager: {}}));

import {cornerRadius, cornerShare, isCorners} from '../src/image/corners';
import {settingsFromNames} from '../src/settings';

describe('cornerRadius', () => {
  const placed = {width: 1264, height: 948};

  it('is the dp size times the pixel ratio', () => {
    expect(cornerRadius('small', placed, 2)).toBe(16);
    expect(cornerRadius('medium', placed, 2)).toBe(32);
    expect(cornerRadius('large', placed, 2)).toBe(48);
  });

  it('is zero for none', () => {
    expect(cornerRadius('none', placed, 2)).toBe(0);
  });

  it('circle is half the short side; never more than that', () => {
    expect(cornerRadius('circle', placed, 2)).toBe(474);
    expect(cornerRadius('large', {width: 60, height: 40}, 2)).toBe(20);
  });

  it('as a share of the width', () => {
    expect(cornerShare('medium', {width: 640, height: 480}, 2)).toBeCloseTo(0.05);
    expect(cornerShare('medium', {width: 0, height: 0}, 2)).toBe(0);
  });
});

describe('settings', () => {
  it('reads settings from folder names', () => {
    expect(settingsFromNames(['corners-medium'])).toMatchObject({corners: 'medium', imagesLayer: false});
    expect(settingsFromNames(['other', 'corners-large', 'images-layer-on'])).toMatchObject({
      corners: 'large',
      imagesLayer: true,
    });
  });

  it('falls back to the defaults: square corners, main layer', () => {
    expect(settingsFromNames([])).toEqual({corners: 'none', imagesLayer: false, lastBorder: {kind: 'none'}});
    expect(settingsFromNames(['corners-huge'])).toMatchObject({corners: 'none', imagesLayer: false});
  });

  it('remembers the last border', () => {
    expect(settingsFromNames(['lastborder-t.stars.slim.corners']).lastBorder).toEqual({
      kind: 'tape',
      pattern: 'stars',
      width: 'slim',
      placement: 'corners',
    });
    expect(settingsFromNames(['lastborder-junk']).lastBorder).toEqual({kind: 'none'});
  });

  it('knows its styles', () => {
    expect(isCorners('circle')).toBe(true);
    expect(isCorners('round')).toBe(false);
    expect(isCorners(undefined)).toBe(false);
  });
});
