// Console log (logcat tag ReactNativeJS). To debug on a device without ADB,
// the `spike-final` git tag has a version that also writes a file in EXPORT.
export const TAG = 'ImagePlacer';

export function log(message: string): void {
  console.log(`[${TAG}] ${new Date().toISOString().slice(11, 23)} ${message}`);
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
