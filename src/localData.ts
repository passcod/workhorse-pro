import { ext } from './ext.ts'
import { reportOnce } from './log.ts'
import { appendHistory, migrateLegacyHistory, MAX_HISTORY } from './lib/history.ts'
import { record as recordSample, type Sample } from './lib/usageHistory.ts'

/**
 * Input history, stashed drafts, and recorded usage readings.
 *
 * Device-local rather than synced: they are working state at a scale the
 * synced area is not sized for, and they are tied to what the user was doing
 * on that machine. spec: PREF
 *
 * Held in memory as well as in storage because the composer's key handler has
 * to decide what to do within the keystroke — an await there would let the
 * arrow key move the caret before the decision landed. Storage is the record;
 * memory is what the handler reads.
 *
 * The usage readings are here for a second reason: the stack is a record built
 * up over hours, and the half hours it most needs to cover are the ones where
 * the tab was closed. An in-memory series would reset at exactly the wrong
 * moment. spec: UHST
 */

const HISTORY_KEY = 'inputHistory'
const STASH_KEY = 'composerStash'
const USAGE_KEY = 'usageSamples'
const MIGRATED_KEY = 'legacyHistoryMigrated'
/** The app's own per-conversation history, adopted once. */
const LEGACY_KEY = 'workhorse:input-history'

let history: string[] = []
let stash: string[] = []
let usage: readonly Sample[] = []

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * Readings out of storage, dropping anything that is not one.
 *
 * Checked rather than trusted: this is the extension's own storage, but a build
 * that wrote a different shape leaves it behind, and a malformed entry would
 * otherwise render as a row at NaN percent.
 */
function asSamples(value: unknown): Sample[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is Sample =>
      typeof v === 'object' &&
      v !== null &&
      Number.isFinite((v as Sample).window) &&
      Number.isFinite((v as Sample).at) &&
      Number.isFinite((v as Sample).percent),
  )
}

export async function loadLocalData(): Promise<void> {
  try {
    const stored = await ext.storage.local.get([
      HISTORY_KEY,
      STASH_KEY,
      USAGE_KEY,
      MIGRATED_KEY,
    ])
    history = asStrings(stored[HISTORY_KEY])
    stash = asStrings(stored[STASH_KEY])
    usage = asSamples(stored[USAGE_KEY])

    // Adopt whatever the app recorded before this extension existed, once.
    // Its store is left in place; nothing clears it. spec: HIST
    if (!stored[MIGRATED_KEY]) {
      const legacy = migrateLegacyHistory(readLegacy())
      if (legacy.length > 0) {
        const merged = [...legacy, ...history]
        history = merged.length > MAX_HISTORY ? merged.slice(merged.length - MAX_HISTORY) : merged
      }
      await ext.storage.local.set({ [MIGRATED_KEY]: true, [HISTORY_KEY]: history })
    }
  } catch (error) {
    reportOnce('localData.load', error)
  }
}

function readLegacy(): string | null {
  try {
    return localStorage.getItem(LEGACY_KEY)
  } catch {
    return null
  }
}

function persist(key: string, value: unknown): void {
  void ext.storage.local.set({ [key]: value }).catch((error: unknown) => {
    reportOnce(`localData.persist:${key}`, error)
  })
}

export function getHistory(): readonly string[] {
  return history
}

/** Record a sent message. No-op when it changes nothing. */
export function recordSent(text: string): void {
  const next = appendHistory(history, text)
  if (next === history) return
  history = [...next]
  persist(HISTORY_KEY, history)
}

export function getStash(): readonly string[] {
  return stash
}

export function setStash(next: readonly string[]): void {
  stash = [...next]
  persist(STASH_KEY, stash)
}

export function getUsageSamples(): readonly Sample[] {
  return usage
}

/**
 * Record a reading. No-op when it changes nothing, which is the common case:
 * the browser polls the endpoint far more often than the device refreshes it,
 * so most reads see a reading already held.
 */
export function recordUsage(sample: Sample): void {
  const next = recordSample(usage, sample)
  if (next === usage) return
  usage = next
  persist(USAGE_KEY, usage)
}

export async function clearHistory(): Promise<void> {
  history = []
  await ext.storage.local.set({ [HISTORY_KEY]: [] })
}

export async function clearUsage(): Promise<void> {
  usage = []
  await ext.storage.local.set({ [USAGE_KEY]: [] })
}

export async function clearStash(): Promise<void> {
  stash = []
  await ext.storage.local.set({ [STASH_KEY]: [] })
}
