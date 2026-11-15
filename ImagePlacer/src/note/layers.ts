// Optional (Settings, off by default): new pictures are grouped on their own
// "Images" layer, one per page (layers are per page), created on first use and
// reused after that. It goes below the main layer, so handwriting stays on top
// (device-checked, b30). The lasso only reaches the current layer, which is why
// this is off by default. The template shows through pictures on any layer.
// Real-time recognition notes have no layers; there, or if all three custom
// layers are taken, or if anything about layers fails, pictures go on the
// main layer.
import {PluginFileAPI} from 'sn-plugin-lib';
import {call} from '../sdk';
import {log, fmt} from '../log';
import type {CurrentPage} from './page';

export const PICTURE_LAYER_NAME = 'Images';
export const MAIN_LAYER = 0;

export interface Layer {
  layerId: number; // -1 background (template), 0 main, 1–3 custom
  name: string;
  isCurrentLayer: boolean;
  isVisible: boolean;
}

const isCustom = (id: number) => id >= 1 && id <= 3;

/** Pure: the Images layer to use, whether it must be created, or null if none is free. */
export function planPictureLayer(layers: Layer[]): {id: number; create: boolean} | null {
  const existing = layers.find(l => isCustom(l.layerId) && l.name === PICTURE_LAYER_NAME);
  if (existing) {
    return {id: existing.layerId, create: false};
  }
  const used = new Set(layers.map(l => l.layerId));
  const free = [1, 2, 3].find(id => !used.has(id));
  return free === undefined ? null : {id: free, create: true};
}

/** Pure: layer order (top first, ids 0–3) with `id` at the bottom, just above the template. */
export function orderWithLayerAtBottom(layers: Layer[], id: number): number[] {
  const others = layers.map(l => l.layerId).filter(i => i >= 0 && i <= 3 && i !== id);
  return [...others, id];
}

/** The layer new pictures go on for this page, creating it if needed. Never throws. */
export async function pictureLayer({notePath, page}: CurrentPage): Promise<number> {
  try {
    const layers = ((await call<Layer[]>('getLayers', PluginFileAPI.getLayers(notePath, page))) ?? []) as Layer[];
    log(`layers: ${fmt(layers)}`);
    const plan = planPictureLayer(layers);
    if (!plan) {
      log('layers: all custom layers are in use; using the main layer');
      return MAIN_LAYER;
    }
    if (plan.create) {
      const layer: Layer = {layerId: plan.id, name: PICTURE_LAYER_NAME, isCurrentLayer: false, isVisible: true};
      if ((await call<boolean>('insertLayer', PluginFileAPI.insertLayer(notePath, page, layer))) !== true) {
        throw new Error('insertLayer was not applied');
      }
      await call('sortLayers', PluginFileAPI.sortLayers(notePath, page, orderWithLayerAtBottom(layers, plan.id)));
      log(`layers: created "${PICTURE_LAYER_NAME}" as layer ${plan.id}`);
    }
    return plan.id;
  } catch (e) {
    log(`layers: ${e}; using the main layer`);
    return MAIN_LAYER;
  }
}
