/**
 * Input history logic, with no dependency on the DOM or storage so it can be
 * exercised directly. Entries are newest-last. spec: HIST
 */

export const MAX_HISTORY = 200

/**
 * Append a sent message. Consecutive identical messages are recorded once,
 * which is what makes double-recording harmless: the extension cannot see
 * whether the app accepted a send, so a refused send records text that stays
 * in the composer and is recorded again when it really goes.
 *
 * Returns the same array reference when nothing changed, so callers can skip
 * a write.
 */
export function appendHistory(
  entries: readonly string[],
  text: string,
  max = MAX_HISTORY,
): readonly string[] {
  const trimmed = text.trim()
  if (!trimmed) return entries
  if (entries[entries.length - 1] === trimmed) return entries
  const next = [...entries, trimmed]
  return next.length > max ? next.slice(next.length - max) : next
}

export type Step =
  /** Show this entry and remember the position. */
  | { kind: 'entry'; index: number; value: string }
  /** Stepped past the newest message — put the held draft back. */
  | { kind: 'restore' }

/**
 * Move one step through history. `index` is the current position, null when
 * not navigating.
 *
 * Returns null when the step is a no-op that should fall through to the
 * browser's own arrow-key handling.
 */
export function stepHistory(
  entries: readonly string[],
  index: number | null,
  direction: 'older' | 'newer',
): Step | null {
  if (direction === 'older') {
    if (entries.length === 0) return null
    const next = index === null ? entries.length - 1 : Math.max(0, index - 1)
    return { kind: 'entry', index: next, value: entries[next]! }
  }
  if (index === null) return null
  const next = index + 1
  if (next >= entries.length) return { kind: 'restore' }
  return { kind: 'entry', index: next, value: entries[next]! }
}

/**
 * Whether an arrow key should step through history rather than move the caret.
 *
 * One rule, applied whether or not recall is already under way: up steps when
 * there is no line break before the caret, down when there is none after it.
 * A selection suppresses recall entirely, so the arrow keys keep their normal
 * meaning while text is selected. spec: HIST
 */
export function caretAllowsStep(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'older' | 'newer',
): boolean {
  if (selectionStart !== selectionEnd) return false
  return direction === 'older'
    ? !value.slice(0, selectionStart).includes('\n')
    : !value.slice(selectionStart).includes('\n')
}

/**
 * Flatten the app's own per-conversation history into one global list, oldest
 * conversation first, so history recorded before this extension existed is not
 * lost. Malformed input yields an empty list rather than throwing. spec: HIST
 */
export function migrateLegacyHistory(raw: string | null): string[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []

  const buckets: { updatedAt: number; entries: string[] }[] = []
  for (const value of Object.values(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const record = value as { entries?: unknown; updatedAt?: unknown }
    if (!Array.isArray(record.entries)) continue
    buckets.push({
      updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
      entries: record.entries.filter((entry): entry is string => typeof entry === 'string'),
    })
  }

  buckets.sort((a, b) => a.updatedAt - b.updatedAt)
  const flat: string[] = []
  for (const bucket of buckets) {
    for (const entry of bucket.entries) flat.push(entry)
  }
  return flat.length > MAX_HISTORY ? flat.slice(flat.length - MAX_HISTORY) : flat
}
