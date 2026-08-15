/**
 * A unified diff between two texts.
 *
 * This is the reading the app's own two views cannot give: File renders the
 * document, Changes renders the document with insertions and deletions marked
 * in place, and both therefore contain everything that did not change. A spec
 * running to pages is the case this exists for. spec: DIFF
 */

export type LineKind = 'context' | 'add' | 'remove'

/**
 * A run of a changed line's text, marked by whether it is part of what changed.
 *
 * A line replaced by a similar one carries these so the words that differ can be
 * drawn apart from the words that carry through: `changed` runs are the edit,
 * the rest is the line either side held in common. Concatenating every
 * segment's text reproduces the line exactly.
 */
export interface DiffSegment {
  text: string
  changed: boolean
}

export interface DiffLine {
  kind: LineKind
  text: string
  /**
   * Word-level segments, present only on a removed or added line paired with
   * its counterpart across a change. Absent when the line stands alone or when
   * the pair shares no meaningful words, in which case it reads as changed
   * whole.
   */
  segments?: DiffSegment[]
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
 * A line split into word-level tokens: runs of whitespace, runs of letters and
 * digits, and every other character on its own. Every character lands in
 * exactly one token, so joining them back yields the line unchanged.
 */
function tokenize(line: string): string[] {
  return line.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? []
}

/** Gather one side's tokens from a token edit script into merged segments. */
function toSegments(ops: Op[], side: 'before' | 'after'): DiffSegment[] {
  const skip = side === 'before' ? 'add' : 'remove'
  const changedKind = side === 'before' ? 'remove' : 'add'
  const segments: DiffSegment[] = []
  for (const op of ops) {
    if (op.kind === skip) continue
    const changed = op.kind === changedKind
    const last = segments[segments.length - 1]
    if (last && last.changed === changed) last.text += op.text
    else segments.push({ text: op.text, changed })
  }
  return segments
}

/**
 * Word-level segments for a removed line and the added line replacing it, or
 * null when the pair shares nothing worth singling out.
 *
 * The two lines are compared as token sequences, so an edit to part of a long
 * line reads as that edit rather than as the whole line changing. A pair with
 * no shared word carries no segments, and reads as changed whole — there is
 * nothing within it to draw apart. The token alignment is the same quadratic
 * step the line diff runs, guarded the same way against a pathologically long
 * line.
 */
function wordSegments(
  before: string,
  after: string,
): { before: DiffSegment[]; after: DiffSegment[] } | null {
  const beforeTokens = tokenize(before)
  const afterTokens = tokenize(after)
  if ((beforeTokens.length + 1) * (afterTokens.length + 1) > MAX_CELLS) return null

  const ops = lcsOps(beforeTokens, afterTokens)
  // A pair whose only common tokens are whitespace is two different lines that
  // happen to be spaced alike, not an edit — leave it marked whole.
  if (!ops.some((op) => op.kind === 'context' && /\S/.test(op.text))) return null

  return { before: toSegments(ops, 'before'), after: toSegments(ops, 'after') }
}

/**
 * Mark the words that changed within each removed line paired against the added
 * line that replaces it.
 *
 * A change that replaces lines emits its removals then its additions, so a run
 * of removed lines followed by a run of added lines is one such replacement;
 * the lines are paired by position within it, as far as the shorter run
 * reaches. Lines with no counterpart, and pairs sharing no word, keep no
 * segments and read as changed whole.
 */
function annotateWords(lines: DiffLine[]): void {
  let i = 0
  while (i < lines.length) {
    if (lines[i]!.kind !== 'remove') {
      i += 1
      continue
    }
    let removeEnd = i
    while (removeEnd < lines.length && lines[removeEnd]!.kind === 'remove') removeEnd += 1
    let addEnd = removeEnd
    while (addEnd < lines.length && lines[addEnd]!.kind === 'add') addEnd += 1

    const pairs = Math.min(removeEnd - i, addEnd - removeEnd)
    for (let p = 0; p < pairs; p += 1) {
      const removed = lines[i + p]!
      const added = lines[removeEnd + p]!
      const segments = wordSegments(removed.text, added.text)
      if (segments) {
        removed.segments = segments.before
        added.segments = segments.after
      }
    }
    i = Math.max(addEnd, i + 1)
  }
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
    const lines: DiffLine[] = ops
      .slice(from, to + 1)
      .map((op) => ({ kind: op.kind, text: op.text }))
    annotateWords(lines)
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
