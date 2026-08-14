/**
 * A unified diff between two texts.
 *
 * This is the reading the app's own two views cannot give: File renders the
 * document, Changes renders the document with insertions and deletions marked
 * in place, and both therefore contain everything that did not change. A spec
 * running to pages is the case this exists for. spec: DIFF
 */

export type LineKind = 'context' | 'add' | 'remove'

export interface DiffLine {
  kind: LineKind
  text: string
}

export interface Hunk {
  /** 1-based first line of the hunk on each side, as a unified diff counts. */
  beforeStart: number
  beforeCount: number
  afterStart: number
  afterCount: number
  /** The heading this hunk falls under, or null above the first one. */
  heading: string | null
  lines: DiffLine[]
}

/** Lines of unchanged text kept either side of a change. */
export const CONTEXT = 3

/**
 * Cells the alignment table may occupy.
 *
 * The table is quadratic, and while an artefact is usually small nothing
 * guarantees it. Past this the changed region is reported as a removal followed
 * by an addition, which is a true diff and a worse presentation — the tradeoff
 * being that a pathological file renders coarsely rather than hanging the page.
 */
const MAX_CELLS = 4_000_000

/** Split into lines, treating a trailing newline as a terminator not a line. */
export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** A markdown ATX heading's text, or null when the line is not one. */
function headingText(line: string): string | null {
  const match = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
  if (!match) return null
  return `${match[1]} ${match[2]}`.trim()
}

/**
 * The heading a line falls under: the nearest heading at or above it.
 *
 * Searched on the before side, which is what git does — the pre-image is the
 * text the reader is orienting against. A file with no version on the base
 * branch has no before side, so the after side stands in.
 */
function headingAbove(lines: string[], index: number): string | null {
  for (let i = Math.min(index, lines.length - 1); i >= 0; i -= 1) {
    const heading = headingText(lines[i]!)
    if (heading !== null) return heading
  }
  return null
}

interface Op {
  kind: LineKind
  text: string
}

/** Longest common subsequence of two line arrays, as an edit script. */
function lcsOps(before: string[], after: string[]): Op[] {
  const n = before.length
  const m = after.length
  if (n === 0 && m === 0) return []
  if (n === 0) return after.map((text) => ({ kind: 'add' as const, text }))
  if (m === 0) return before.map((text) => ({ kind: 'remove' as const, text }))

  if ((n + 1) * (m + 1) > MAX_CELLS) {
    return [
      ...before.map((text) => ({ kind: 'remove' as const, text })),
      ...after.map((text) => ({ kind: 'add' as const, text })),
    ]
  }

  const width = m + 1
  const table = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + (j + 1)]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + (j + 1)]!)
    }
  }

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ kind: 'context', text: before[i]! })
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j]! >= table[i * width + (j + 1)]!) {
      ops.push({ kind: 'remove', text: before[i]! })
      i += 1
    } else {
      ops.push({ kind: 'add', text: after[j]! })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ kind: 'remove', text: before[i]! })
    i += 1
  }
  while (j < m) {
    ops.push({ kind: 'add', text: after[j]! })
    j += 1
  }
  return ops
}

/**
 * The edit script, with the common head and tail trimmed before aligning.
 *
 * An edit to a long document usually leaves both ends untouched, and trimming
 * them is what keeps the quadratic step off the whole file.
 */
function editScript(before: string[], after: string[]): Op[] {
  let head = 0
  const limit = Math.min(before.length, after.length)
  while (head < limit && before[head] === after[head]) head += 1

  let tail = 0
  while (
    tail < limit - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1
  }

  const middle = lcsOps(
    before.slice(head, before.length - tail),
    after.slice(head, after.length - tail),
  )

  return [
    ...before.slice(0, head).map((text) => ({ kind: 'context' as const, text })),
    ...middle,
    ...before.slice(before.length - tail).map((text) => ({ kind: 'context' as const, text })),
  ]
}

/**
 * Group an edit script into hunks, each carrying up to `context` unchanged
 * lines either side. Unchanged stretches between hunks are dropped, which is
 * the whole point of the view.
 */
function toHunks(ops: Op[], before: string[], after: string[], context: number): Hunk[] {
  const changed = ops
    .map((op, index) => (op.kind === 'context' ? -1 : index))
    .filter((index) => index !== -1)
  if (changed.length === 0) return []

  // Ranges of op indices to render, merged where their context overlaps.
  const ranges: { from: number; to: number }[] = []
  for (const index of changed) {
    const from = Math.max(0, index - context)
    const to = Math.min(ops.length - 1, index + context)
    const last = ranges[ranges.length - 1]
    if (last && from <= last.to + 1) last.to = Math.max(last.to, to)
    else ranges.push({ from, to })
  }

  // Line numbers advance across the whole script, so they are counted from the
  // start rather than derived per range.
  const beforeAt: number[] = []
  const afterAt: number[] = []
  let b = 1
  let a = 1
  for (const op of ops) {
    beforeAt.push(b)
    afterAt.push(a)
    if (op.kind !== 'add') b += 1
    if (op.kind !== 'remove') a += 1
  }

  return ranges.map(({ from, to }) => {
    const lines = ops.slice(from, to + 1).map((op) => ({ kind: op.kind, text: op.text }))
    const beforeCount = lines.filter((line) => line.kind !== 'add').length
    const afterCount = lines.filter((line) => line.kind !== 'remove').length
    const beforeStart = beforeAt[from]!
    const afterStart = afterAt[from]!
    // An empty side starts at 0 by unified-diff convention, not at 1.
    return {
      beforeStart: beforeCount === 0 ? beforeStart - 1 : beforeStart,
      beforeCount,
      afterStart: afterCount === 0 ? afterStart - 1 : afterStart,
      afterCount,
      heading:
        before.length > 0
          ? headingAbove(before, beforeStart - 1)
          : headingAbove(after, afterStart - 1),
      lines,
    }
  })
}

/** The hunks between two texts. Empty when they are identical. */
export function unifiedDiff(base: string, current: string, context = CONTEXT): Hunk[] {
  if (base === current) return []
  const before = splitLines(base)
  const after = splitLines(current)
  return toHunks(editScript(before, after), before, after, context)
}

/** The `@@` line for a hunk, with the heading it falls under. */
export function hunkHeader(hunk: Hunk): string {
  const range = (start: number, count: number) => (count === 1 ? `${start}` : `${start},${count}`)
  const at = `@@ -${range(hunk.beforeStart, hunk.beforeCount)} +${range(hunk.afterStart, hunk.afterCount)} @@`
  return hunk.heading ? `${at} ${hunk.heading}` : at
}
