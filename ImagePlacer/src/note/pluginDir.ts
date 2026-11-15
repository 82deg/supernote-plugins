// Folders inside the plugin's own private directory (never the user's files).
import {FileUtils, PluginManager} from 'sn-plugin-lib';

export async function pluginDir(sub: string): Promise<string> {
  const dir = `${(await PluginManager.getPluginDirPath()) ?? ''}/${sub}`;
  await FileUtils.makeDir(dir);
  return dir;
}

/** Throwaway renders. */
export const outDir = () => pluginDir('out');
/** Uncropped originals, for non-destructive crop / corners / rotate. */
export const originalsDir = () => pluginDir('originals');
/** Settings, stored as folder names (the SDK has no file write). */
export const settingsDir = () => pluginDir('settings');
