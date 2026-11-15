// Plugin settings. The SDK can't write files, but it can make and remove
// folders, so each setting is one empty folder whose name holds the value,
// e.g. <pluginDir>/settings/corners-medium.
import {FileUtils} from 'sn-plugin-lib';
import {log} from './log';
import {isCorners, type Corners} from './image/corners';
import {settingsDir} from './note/pluginDir';
import {listNames} from './note/housekeeping';

const CORNERS = /^corners-([a-z]+)$/;

/** Pure: the corner style stored in a settings folder listing. */
export function cornersFromNames(names: string[]): Corners {
  for (const n of names) {
    const value = CORNERS.exec(n)?.[1];
    if (isCorners(value)) {
      return value;
    }
  }
  return 'none';
}

/** Corner style for new pictures. Never throws: falls back to square corners. */
export async function loadDefaultCorners(): Promise<Corners> {
  try {
    return cornersFromNames(await listNames(await settingsDir()));
  } catch (e) {
    log(`settings: could not read corners (${e}); using none`);
    return 'none';
  }
}

export async function saveDefaultCorners(corners: Corners): Promise<void> {
  const dir = await settingsDir();
  for (const n of await listNames(dir)) {
    if (CORNERS.test(n)) {
      await FileUtils.deleteDir(`${dir}/${n}`);
    }
  }
  const path = `${dir}/corners-${corners}`;
  await FileUtils.makeDir(path);
  if (!(await FileUtils.exists(path))) {
    throw new Error('Could not save the setting. Please try again.');
  }
  log(`settings: corners = ${corners}`);
}
