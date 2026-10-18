// Tiny log that goes to logcat (tag ReactNativeJS) and to an in-memory buffer
// the UI can show, for when ADB isn't available on the device.
export const TAG = '__NAME__';

type Sink = (lines: string[]) => void;

const MAX_LINES = 300;
const lines: string[] = [];
let sink: Sink | null = null;

export function log(message: string): void {
  const time = new Date().toISOString().slice(11, 19);
  const line = `${time} ${message}`;
  console.log(`[${TAG}] ${line}`);
  lines.push(line);
  if (lines.length > MAX_LINES) {
    lines.shift();
  }
  sink?.([...lines]);
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
