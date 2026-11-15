jest.mock('sn-plugin-lib', () => ({PluginFileAPI: {}}));

import {orderWithLayerAtBottom, planPictureLayer, type Layer} from '../src/note/layers';

const layer = (layerId: number, name: string): Layer => ({layerId, name, isCurrentLayer: false, isVisible: true});
const MAIN = layer(0, 'Main Layer');
const BG = layer(-1, 'Background');

describe('planPictureLayer', () => {
  it('creates layer 1 on a page with only main + background', () => {
    expect(planPictureLayer([MAIN, BG])).toEqual({id: 1, create: true});
  });

  it('reuses an existing Images layer', () => {
    expect(planPictureLayer([layer(2, 'Images'), MAIN, layer(1, 'Sketch'), BG])).toEqual({id: 2, create: false});
  });

  it('takes the first free custom id', () => {
    expect(planPictureLayer([layer(1, 'A'), layer(3, 'C'), MAIN, BG])).toEqual({id: 2, create: true});
  });

  it('gives up when all custom layers are used', () => {
    expect(planPictureLayer([layer(1, 'A'), layer(2, 'B'), layer(3, 'C'), MAIN, BG])).toBeNull();
  });
});

describe('orderWithLayerAtBottom', () => {
  it('puts the Images layer last, keeps the rest, drops the background', () => {
    expect(orderWithLayerAtBottom([layer(1, 'A'), MAIN, BG], 2)).toEqual([1, 0, 2]);
    expect(orderWithLayerAtBottom([layer(2, 'Images'), MAIN, BG], 2)).toEqual([0, 2]);
  });
});
