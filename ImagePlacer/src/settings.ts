// Plugin settings. The SDK can't write files, but it can make and remove
// folders, so each setting is an empty folder whose name holds the value:
// <pluginDir>/settings/corners-medium, <pluginDir>/settings/images-layer-on.
import {FileUtils} from 'sn-plugin-lib';
import {log} from './log';
import {isCorners, type Corners} from './image/corners';
import {settingsDir} from './note/pluginDir';
import {listNames} from './note/housekeeping';

export interface Settings {
  /** Corners new pictures get. */
  corners: Corners;
  /** Put new pictures on an "Images" layer instead of the main layer. Off by default. */
  imagesLayer: boolean;
}

export const DEFAULT_SETTINGS: Settings = {corners: 'none', imagesLayer: false};

const CORNERS = /^corners-([a-z]+)$/;
const IMAGES_LAYER = 'images-layer-on';

/** Pure: settings from a settings folder listing. */
export function settingsFromNames(names: string[]): Settings {
  const corners = names.map(n => CORNERS.exec(n)?.[1]).find(isCorners) ?? DEFAULT_SETTINGS.corners;
  return {corners, imagesLayer: names.includes(IMAGES_LAYER)};
}

/** Never throws: falls back to the defaults. */
export async function loadSettings(): Promise<Settings> {
  try {
    return settingsFromNames(await listNames(await settingsDir()));
  } catch (e) {
    log(`settings: could not read (${e}); using defaults`);
    return DEFAULT_SETTINGS;
  }
}

async function setFolder(dir: string, name: string, on: boolean): Promise<void> {
  const path = `${dir}/${name}`;
  if (on) {
    await FileUtils.makeDir(path);
  } else {
    await FileUtils.deleteDir(path);
  }
  if ((await FileUtils.exists(path)) !== on) {
    throw new Error('Could not save the setting. Please try again.');
  }
}

export async function saveSettings(next: Settings): Promise<void> {
  const dir = await settingsDir();
  for (const n of await listNames(dir)) {
    if (CORNERS.test(n) && n !== `corners-${next.corners}`) {
      await FileUtils.deleteDir(`${dir}/${n}`);
    }
  }
  await setFolder(dir, `corners-${next.corners}`, true);
  await setFolder(dir, IMAGES_LAYER, next.imagesLayer);
  log(`settings: ${JSON.stringify(next)}`);
}
