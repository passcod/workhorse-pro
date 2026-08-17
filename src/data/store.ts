import { reportOnce } from '../log.ts'

/**
 * A TTL cache the whole extension reads through.
 *
 * Reads are synchronous because reconcile passes are: a feature asks for what
 * is known now and renders that, and the store schedules another pass when
 * more becomes known. A miss therefore renders nothing for one frame rather
 * than blocking, and the value appears when it lands.
 *
 * The same map is written by two paths — the extension's own fetches and
 * responses observed from the app. That is what makes observation an
 * optimisation rather than a mode: there is one read path, and it does not
 * know or care which populated it. spec: DATA
 */

interface Entry {
  value: unknown
  /** When the value landed. Zero when nothing has. */
  at: number
  /** When this key was last asked for, so idle keys stop refreshing. */
  lastReadAt: number
  inflight: Promise<unknown> | null
  /** When the last fetch failed, and how long to wait before trying again. */
  failedAt: number
  retryDelay: number
}

export interface ReadOptions {
  /** How long a value stays fresh. Past this a refresh is scheduled. */
  ttl: number
  /** How often to refresh while the key is being read. Absent means never. */
  poll?: number
}

/** A key not read for this long stops refreshing in the background. */
const ACTIVE_WINDOW = 30_000
const TICK = 1_000
const RETRY_BASE = 2_000
const RETRY_CEILING = 60_000

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
const options = new Map<string, ReadOptions>()
const fetchers = new Map<string, () => Promise<unknown>>()
let ticker: ReturnType<typeof setInterval> | null = null

function now(): number {
  return Date.now()
}

function emptyEntry(): Entry {
  return { value: null, at: 0, lastReadAt: 0, inflight: null, failedAt: 0, retryDelay: RETRY_BASE }
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch (error) {
      reportOnce('store.notify', error)
    }
  }
}

/** Whether a background refresh should run at all right now. */
function documentVisible(): boolean {
  return typeof document === 'undefined' || !document.hidden
}

function shouldFetch(entry: Entry, opts: ReadOptions): boolean {
  if (entry.inflight) return false
  const age = now() - entry.at
  if (entry.at === 0) {
    // Nothing known yet. A failed attempt still backs off, so a dead endpoint
    // is not hammered once per reconcile pass.
    return entry.failedAt === 0 || now() - entry.failedAt >= entry.retryDelay
  }
  if (age < opts.ttl) return false
  if (entry.failedAt !== 0 && now() - entry.failedAt < entry.retryDelay) return false
  return true
}

function startFetch(key: string, entry: Entry, fetcher: () => Promise<unknown>): void {
  const promise = fetcher().then(
    (value) => {
      entry.value = value
      entry.at = now()
      entry.failedAt = 0
      entry.retryDelay = RETRY_BASE
      entry.inflight = null
      notify()
      return value
    },
    (error) => {
      entry.inflight = null
      entry.failedAt = now()
      entry.retryDelay = Math.min(entry.retryDelay * 2, RETRY_CEILING)
      // A read that fails leaves the last known value in place and the row
      // rendering from it; only a key that never resolved renders nothing.
      reportOnce(`store.fetch:${key}`, error)
      return null
    },
  )
  entry.inflight = promise
}

function ensureTicker(): void {
  if (ticker !== null || typeof setInterval === 'undefined') return
  ticker = setInterval(() => {
    if (!documentVisible()) return
    const cutoff = now() - ACTIVE_WINDOW
    let active = false
    for (const [key, entry] of entries) {
      if (entry.lastReadAt < cutoff) continue
      active = true
      const opts = options.get(key)
      const fetcher = fetchers.get(key)
      if (!opts?.poll || !fetcher) continue
      if (now() - entry.at < opts.poll) continue
      if (!shouldFetch(entry, { ...opts, ttl: opts.poll })) continue
      startFetch(key, entry, fetcher)
    }
    if (!active) stopTicker()
  }, TICK)
}

function stopTicker(): void {
  if (ticker === null) return
  clearInterval(ticker)
  ticker = null
}

/**
 * The last known value for a key, fetching in the background when it is stale
 * or absent. Returns null only when nothing has ever landed.
 *
 * A stale value is served rather than withheld: the alternative is a row
 * blinking out every time its data ages, which is worse than a value a few
 * seconds old.
 */
export function read<T>(key: string, fetcher: () => Promise<T>, opts: ReadOptions): T | null {
  const entry = entries.get(key) ?? emptyEntry()
  entries.set(key, entry)
  options.set(key, opts)
  fetchers.set(key, fetcher as () => Promise<unknown>)
  entry.lastReadAt = now()
  ensureTicker()

  if (shouldFetch(entry, opts) && documentVisible()) {
    startFetch(key, entry, fetcher as () => Promise<unknown>)
  }
  return entry.value as T | null
}

/** The last known value without scheduling anything. */
export function peek<T>(key: string): T | null {
  return (entries.get(key)?.value ?? null) as T | null
}

/**
 * Record a value the extension did not fetch — an observed response.
 *
 * Treated exactly as a fetched value, including cancelling the staleness that
 * would have triggered a request. This is the whole of what observation does.
 */
export function put(key: string, value: unknown): void {
  const entry = entries.get(key) ?? emptyEntry()
  entry.value = value
  entry.at = now()
  entry.failedAt = 0
  entry.retryDelay = RETRY_BASE
  entries.set(key, entry)
  notify()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Test seam: drop everything. */
export function reset(): void {
  entries.clear()
  options.clear()
  fetchers.clear()
  listeners.clear()
  stopTicker()
}
