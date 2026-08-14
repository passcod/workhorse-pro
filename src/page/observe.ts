import { OBSERVED_PATHS } from '../data/keys.ts'
import { OBSERVED_MESSAGE } from '../lib/messages.ts'

/**
 * Runs in the page's own world, at document start, so it wraps `fetch` before
 * the app's bundle loads.
 *
 * Declared as a MAIN-world content script rather than injected as a script
 * tag: the page's content security policy does not apply to it, where it would
 * to a tag. spec: DATA
 *
 * The wrapper's only obligation is to be invisible. It returns the original
 * promise untouched, reads the body from a clone so it never consumes the one
 * the app receives, and does all of its own work inside a `try` — a failure
 * here must cost the app nothing.
 */

function interesting(url: string): boolean {
  // A cheap substring test before any URL parsing: this runs on every fetch
  // the app makes, and the great majority are of no interest.
  for (const path of OBSERVED_PATHS) {
    if (url.includes(path)) return true
  }
  return false
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function install(): void {
  const original = window.fetch
  // Re-running would wrap the wrapper. Nothing should inject this twice, but a
  // doubled side-channel is silent and would be tedious to diagnose.
  if ((original as { __whp?: boolean }).__whp) return

  const wrapped: typeof window.fetch = function (this: unknown, input, init) {
    const promise = original.call(this as never, input as never, init as never)
    try {
      const url = urlOf(input as RequestInfo | URL)
      if (interesting(url)) {
        promise
          .then((response) => {
            if (!response.ok) return
            return response
              .clone()
              .json()
              .then((body: unknown) => {
                window.postMessage(
                  { source: OBSERVED_MESSAGE, url: response.url || url, body },
                  window.location.origin,
                )
              })
          })
          .catch(() => {
            // The app owns this request's failure handling. Ours ends here.
          })
      }
    } catch {
      // Never let the side-channel affect the call itself.
    }
    return promise
  }
  ;(wrapped as { __whp?: boolean }).__whp = true
  window.fetch = wrapped
}

install()
