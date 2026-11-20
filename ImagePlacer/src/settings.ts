// Plugin settings. The SDK can't write files, but it can make and remove
// folders, so each setting is an empty folder whose name holds the value:
// <pluginDir>/settings/corners-medium, <pluginDir>/settings/images-layer-on.
import {FileUtils} from 'sn-plugin-lib';
import {log} from './log';
import {isCorners, type Corners} from './image/corners';
import {decodeBorder, encodeBorder, NO_BORDER, type Border} from './image/border';
import {settingsDir} from './note/pluginDir';
import {listNames} from './note/housekeeping';

export interface Settings {
  /** Corners new pictures get. */
  corners: Corners;
  /** Put new pictures on an "Images" layer instead of the main layer. Off by default. */
  imagesLayer: boolean;
  /** The border last applied, offered first for pictures without one. */
  lastBorder: Border;
}

export const DEFAULT_SETTINGS: Settings = {corners: 'none', imagesLayer: false, lastBorder: NO_BORDER};

const CORNERS = /^corners-([a-z]+)$/;
const IMAGES_LAYER = 'images-layer-on';
const LAST_BORDER = /^lastborder-(.+)$/;

/** Pure: settings from a settings folder listing. */
export function settingsFromNames(names: string[]): Settings {
  const corners = names.map(n => CORNERS.exec(n)?.[1]).find(isCorners) ?? DEFAULT_SETTINGS.corners;
  const lastBorder = decodeBorder(names.map(n => LAST_BORDER.exec(n)?.[1]).find(Boolean));
  return {corners, imagesLayer: names.includes(IMAGES_LAYER), lastBorder};
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
  const border = next.lastBorder.kind === 'none' ? null : `lastborder-${encodeBorder(next.lastBorder)}`;
  for (const n of await listNames(dir)) {
    const stale =
      (CORNERS.test(n) && n !== `corners-${next.corners}`) || (LAST_BORDER.test(n) && n !== border);
    if (stale) {
      await FileUtils.deleteDir(`${dir}/${n}`);
    }
  }
  await setFolder(dir, `corners-${next.corners}`, true);
  await setFolder(dir, IMAGES_LAYER, next.imagesLayer);
  if (border) {
    await setFolder(dir, border, true);
  }
  log(`settings: ${JSON.stringify(next)}`);
}
