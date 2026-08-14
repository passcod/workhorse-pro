/**
 * The extension API, under whichever name this browser publishes it.
 *
 * Firefox provides `browser` with promise-returning methods and a
 * callback-style `chrome` for compatibility. Chrome MV3 provides only
 * `chrome`, but its methods return promises when no callback is passed. So
 * preferring `browser` and falling back to `chrome` yields a promise-based API
 * in both, across the small surface this extension uses — storage, runtime,
 * and permissions — without a polyfill.
 */
const global = globalThis as unknown as {
  browser?: typeof browser
  chrome?: typeof browser
}

export const ext = (global.browser ?? global.chrome)!
