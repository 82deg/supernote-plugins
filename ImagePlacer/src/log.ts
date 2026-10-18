// Log that goes to logcat (tag ReactNativeJS), an in-memory buffer the UI can
// show, and optionally a file in shared storage. The Nomad has no ADB, so the
// file (pulled over MTP with tools/mtp.sh) is how we read logs after a crash.
import RNFS from 'react-native-fs';

export const TAG = 'ImagePlacer';

type Sink = (lines: string[]) => void;

const MAX_LINES = 300;
const lines: string[] = [];
let sink: Sink | null = null;

let filePath: string | null = null;
let fileChain: Promise<void> = Promise.resolve();
let fileBroken = false;
let scanTimer: ReturnType<typeof setTimeout> | null = null;

// MTP serves files from Android's media index, so a file we append to stays
// stale (old size/content) over USB until it is rescanned. Debounced.
function scheduleScan(): void {
  if (scanTimer) {
    clearTimeout(scanTimer);
  }
  scanTimer = setTimeout(() => {
    scanTimer = null;
    const path = filePath;
    if (path) {
      fileChain = fileChain.then(() => RNFS.scanFile(path).then(() => undefined, () => undefined));
    }
  }, 500);
}

export function log(message: string): void {
  const time = new Date().toISOString().slice(11, 23);
  const line = `${time} ${message}`;
  console.log(`[${TAG}] ${line}`);
  lines.push(line);
  if (lines.length > MAX_LINES) {
    lines.shift();
  }
  sink?.([...lines]);
  if (filePath && !fileBroken) {
    const target = filePath;
    // Chained so lines land in order; a failed write disables the file sink.
    fileChain = fileChain
      .then(() => RNFS.appendFile(target, `${line}\n`, 'utf8'))
      .catch(e => {
        fileBroken = true;
        console.log(`[${TAG}] file log disabled: ${e}`);
      });
    scheduleScan();
  }
}

/**
 * Start mirroring the log to a new `dir/log-YYYYMMDD-HHMMSS.txt` (needs
 * FILE:WRITE for shared folders such as EXPORT). One file per session, never
 * renamed or deleted: that would need FILE:DELETE (build 5/6 rotation failed
 * silently without it), and fresh files also sidestep MTP's stale-size cache.
 */
export async function enableFileLog(dir: string): Promise<string | null> {
  if (filePath && filePath.startsWith(`${dir}/`)) {
    return filePath; // already logging this session
  }
  try {
    await RNFS.mkdir(dir);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const path = `${dir}/log-${stamp}.txt`;
    await RNFS.writeFile(path, '', 'utf8');
    filePath = path;
    fileBroken = false;
    log(`file log → ${path}`);
    return path;
  } catch (e) {
    log(`file log unavailable: ${e}`);
    return null;
  }
}

/** Wait until every line so far is on disk; call before a risky native call. */
export function flushLog(): Promise<void> {
  return fileChain;
}

/** Write + rescan now, so the latest lines are visible over USB immediately. */
export function syncLog(): Promise<void> {
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  const path = filePath;
  if (path) {
    fileChain = fileChain.then(() => RNFS.scanFile(path).then(() => undefined, () => undefined));
  }
  return fileChain;
}

export function subscribeLog(fn: Sink): () => void {
  sink = fn;
  fn([...lines]);
  return () => {
    if (sink === fn) {
      sink = null;
    }
  };
}

/** Stringify an SDK response compactly for the log. */
export function fmt(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  } catch {
    return String(value);
  }
}
