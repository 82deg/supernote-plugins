// Development switches. BOTH must be false in a published build
// (see docs/PUBLISHING.md): reviewers check for unexpected file writes, and
// users should never see the test bench.

/** Mirror the log to EXPORT/ImagePlacer/log-*.txt so it can be pulled over USB. */
export const DEBUG_FILE_LOG = true;

/** Open the numbered test bench (src/spike) instead of the real plugin. */
export const DEBUG_SPIKE_SCREEN = false;
