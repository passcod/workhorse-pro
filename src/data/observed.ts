import { keyForUrl } from './keys.ts'
import { put } from './store.ts'
import { OBSERVED_MESSAGE } from '../lib/messages.ts'

/**
 * Receives responses the page-world wrapper captured and files them in the
 * cache under the same key the extension's own reads use.
 *
 * Everything arriving here came through the page, so it is treated as
 * untrusted: the origin and source are checked, the URL must map to a key the
 * extension actually reads, and the payload must have the shape that key
 * implies. A payload that fails any of those is dropped, and the ordinary read
 * path fetches the data itself. spec: DATA
 */

type Validator = (body: unknown) => boolean

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Shape checks are deliberately shallow — enough to reject a payload that
 * would render as a blank row, not a schema. A deeper check would fail closed
 * on a field Workhorse adds, which is exactly when the fallback is least
 * needed.
 */
const VALIDATORS: { prefix: string; check: Validator }[] = [
  {
    prefix: 'branch-status:',
    check: (body) => isObject(body) && 'branch' in body && 'loop' in body,
  },
  {
    // Both keys are always present and exactly one is set, so their presence is
    // the shape. This is also what rejects the refresh POST's own response,
    // which carries neither. spec: DATA
    prefix: 'subscription-usage',
    check: (body) => isObject(body) && 'report' in body && 'unavailable' in body,
  },
]

function validFor(key: string, body: unknown): boolean {
  const validator = VALIDATORS.find((entry) => key.startsWith(entry.prefix))
  return validator ? validator.check(body) : false
}

export function startObserving(): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return
    const data = event.data as { source?: unknown; url?: unknown; body?: unknown }
    if (!isObject(data) || data.source !== OBSERVED_MESSAGE) return
    if (typeof data.url !== 'string') return

    const key = keyForUrl(data.url, window.location.origin)
    if (!key) return
    if (!validFor(key, data.body)) return
    put(key, data.body)
  }

  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
