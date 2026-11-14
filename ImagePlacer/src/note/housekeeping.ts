// Keeps the plugin's private folders from growing forever. Everything here
// lives in the plugin's own directory, never in the user's files.
import {FileUtils} from 'sn-plugin-lib';
import {log} from '../log';

/** Uncropped originals kept for re-cropping (newest first). Older ones re-crop from the picture as shown. */
export const MAX_ORIGINALS = 50;

/**
 * Which files to delete so only the newest `keep` matching `pattern` remain.
 * Names embed a millisecond timestamp (e.g. `orig-1792354409004.png`), so
 * newest = largest number.
 */
export function filesToPrune(names: string[], pattern: RegExp, keep: number): string[] {
  const stamp = (n: string) => Number(/(\d{10,})/.exec(n)?.[1] ?? 0);
  const matching = names.filter(n => pattern.test(n)).sort((a, b) => stamp(b) - stamp(a));
  return matching.slice(keep);
}

/** listFiles has returned both plain paths and {path} objects across SDK versions. */
async function listNames(dir: string): Promise<string[]> {
  const entries = ((await FileUtils.listFiles(dir)) ?? []) as unknown[];
  return entries
    .map(e => (typeof e === 'string' ? e : (e as {path?: string})?.path ?? ''))
    .map(p => p.split('/').pop() ?? '')
    .filter(Boolean);
}

async function remove(dir: string, names: string[]): Promise<void> {
  for (const n of names) {
    await FileUtils.deleteFile(`${dir}/${n}`);
  }
  if (names.length) {
    log(`housekeeping: removed ${names.length} file(s) from ${dir.split('/').pop()}`);
  }
}

/** Keep only the newest MAX_ORIGINALS uncropped originals. Never throws. */
export async function pruneOriginals(dir: string): Promise<void> {
  try {
    await remove(dir, filesToPrune(await listNames(dir), /^orig-\d+\.png$/, MAX_ORIGINALS));
  } catch (e) {
    log(`housekeeping (originals) skipped: ${e}`);
  }
}

/** Throwaway renders from earlier edits. Never throws. */
export async function clearRenders(dir: string): Promise<void> {
  try {
    await remove(dir, (await listNames(dir)).filter(n => /^lasso-\d+\.png$/.test(n)));
  } catch (e) {
    log(`housekeeping (renders) skipped: ${e}`);
  }
}
