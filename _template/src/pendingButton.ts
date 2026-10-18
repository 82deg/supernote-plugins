// Holds the last toolbar button press until the UI consumes it. The listener
// lives in index.js because a press can arrive before App has mounted.
type Listener = (id: number) => void;

let pending: number | null = null;
let listener: Listener | null = null;

export function setPendingButton(id: number): void {
  if (listener) {
    listener(id);
  } else {
    pending = id;
  }
}

/** Subscribe; any press that arrived before subscribing is delivered at once. */
export function onButton(fn: Listener): () => void {
  listener = fn;
  if (pending !== null) {
    const id = pending;
    pending = null;
    fn(id);
  }
  return () => {
    if (listener === fn) {
      listener = null;
    }
  };
}
