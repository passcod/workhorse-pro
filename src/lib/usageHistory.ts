/**
 * The recorded series behind the sidebar's usage stack, and everything derived
 * from it.
 *
 * Pure: no DOM, no storage, no clock of its own. `now` is passed in, because the
 * feature re-renders on a timer and the tests need a fixed one.
 *
 * The whole feature is a discretisation of a reading the app already draws as a
 * single point. Par is not invented here — it is the app's clock mark, the
 * fraction of the window elapsed — so a row is over par when its total has
 * reached the share of the allowance the clock has reached. spec: UHST
 */

/** The plan window the bar reads. */
export const WINDOW_MS = 5 * 60 * 60_000
/** One row. Ten of them reach exactly one window back. */
export const ROW_MS = 30 * 60_000
export const ROWS = 10

/**
 * Windows kept. Two is every window ten rows can reach, so a third would be
 * data nothing can display. spec: UHST
 */
export const MAX_WINDOWS = 2

/**
 * How far back the runout estimate averages over.
 *
 * The device reads every five minutes and the endpoint rounds to whole
 * percents, so a short mean is mostly quantisation noise and jumps about; too
 * long and it keeps quoting a burst that has already stopped. Open question in
 * the plan — this is a starting value, not a settled one.
 */
export const ESTIMATE_MS = 45 * 60_000

export interface Sample {
  /** The window this belongs to, as its reset time in epoch ms. */
  window: number
  /** When the reading was taken, epoch ms. */
  at: number
  /** Utilisation of that window, 0-100. */
  percent: number
}

/**
 * Add a reading, and drop windows past the retention limit.
 *
 * Returns the input unchanged when nothing was added, so a caller can skip
 * persisting on the many reads that tell us nothing new — the browser polls the
 * endpoint far more often than the device refreshes it.
 */
export function record(samples: readonly Sample[], next: Sample): readonly Sample[] {
  if (!Number.isFinite(next.percent) || !Number.isFinite(next.at)) return samples
  // Identified by the moment it was taken, not by its value: the same reading is
  // served to every poll until the device takes another, and a reading that
  // genuinely repeats a percentage is still a new data point.
  if (samples.some((s) => s.window === next.window && s.at === next.at)) return samples
  return prune([...samples, next])
}

/** The retained window resets, newest first. */
export function windowsOf(samples: readonly Sample[]): number[] {
  return [...new Set(samples.map((s) => s.window))].sort((a, b) => b - a)
}

function prune(samples: readonly Sample[]): Sample[] {
  const keep = new Set(windowsOf(samples).slice(0, MAX_WINDOWS))
  return samples.filter((s) => keep.has(s.window)).sort((a, b) => a.at - b.at)
}

export interface Row {
  /**
   * Total spent as at the end of this row's half hour, 0-100, or null when
   * nothing was ever recorded for its window before that point.
   */
  percent: number | null
  /** How far through its window the clock was at that point, 0-100. */
  par: number
  /** At or past par — spending faster than the window refills. */
  over: boolean
  /** Belongs to a window that has already reset. */
  past: boolean
}

/**
 * Where a window's clock mark runs, as fractions of the stack's width.
 *
 * One segment per window on screen. The jump between two segments is the reset,
 * and is the only thing marking it: the fill collapsing and the mark returning
 * to the left edge already say where the window turned over. spec: UHST
 */
export interface MarkSegment {
  /** First row this covers, inclusive. */
  from: number
  /** Last row this covers, inclusive. */
  to: number
  /** Centre of the line at the top edge of `from`, 0-1. */
  topAt: number
  /** Centre of the line at the bottom edge of `to`, 0-1. */
  bottomAt: number
}

export interface Stack {
  /** Ten rows, oldest first. The last is the live bar. */
  rows: Row[]
  segments: MarkSegment[]
}

/** The latest recorded total for a window at or before `at`. */
function totalAt(samples: readonly Sample[], window: number, at: number): number | null {
  let best: Sample | null = null
  for (const s of samples) {
    if (s.window !== window || s.at > at) continue
    if (best === null || s.at > best.at) best = s
  }
  return best?.percent ?? null
}

function rowFor(
  samples: readonly Sample[],
  window: number,
  open: number,
  end: number,
  past: boolean,
): Row {
  // Clamped because the endpoint's own figure can exceed 100 and because a
  // window's last row ends exactly at its reset.
  const par = Math.min(100, Math.max(0, ((end - open) / WINDOW_MS) * 100))
  const percent = totalAt(samples, window, end)
  return {
    percent,
    par,
    // Nothing to be ahead of at zero, and an untouched window would otherwise
    // read as over the instant it opens. The app's own rule. spec: UHST
    over: percent !== null && percent > 0 && percent >= par,
    past,
  }
}

/**
 * Build the ten rows and the clock mark, given the current window's reset.
 *
 * The current window takes as many rows as it has half hours behind it, and the
 * window before it fills the rest from its own tail — so the reset climbs the
 * stack as the window runs.
 */
export function buildStack(
  samples: readonly Sample[],
  resetsAt: number,
  now: number,
): Stack {
  const open = resetsAt - WINDOW_MS
  const elapsed = Math.max(0, now - open)
  const liveRows = Math.min(ROWS, Math.max(1, Math.ceil(elapsed / ROW_MS)))
  const pastRows = ROWS - liveRows

  // Whichever retained window is not the live one. Absent on a first run, which
  // leaves the top rows as empty track rather than shortening the stack.
  const previous = windowsOf(samples).find((w) => w !== resetsAt) ?? null
  const prevOpen = previous === null ? 0 : previous - WINDOW_MS

  const rows: Row[] = []

  for (let k = 0; k < pastRows; k++) {
    // The tail of that window: its last `pastRows` buckets, in order.
    const bucket = ROWS - pastRows + k
    const end = prevOpen + (bucket + 1) * ROW_MS
    rows.push(
      previous === null
        ? { percent: null, par: 0, over: false, past: true }
        : rowFor(samples, previous, prevOpen, end, true),
    )
  }

  for (let j = 0; j < liveRows; j++) {
    // The last row ends now rather than at its half hour's close, so the bar it
    // corresponds to is the live one.
    const end = j === liveRows - 1 ? now : open + (j + 1) * ROW_MS
    rows.push(rowFor(samples, resetsAt, open, end, false))
  }

  const segments: MarkSegment[] = []
  if (pastRows > 0 && previous !== null) {
    const firstBucket = ROWS - pastRows
    segments.push({
      from: 0,
      to: pastRows - 1,
      topAt: firstBucket / ROWS,
      bottomAt: 1,
    })
  }
  segments.push({
    from: pastRows,
    to: ROWS - 1,
    topAt: 0,
    bottomAt: Math.min(1, elapsed / WINDOW_MS),
  })

  return { rows, segments }
}

/**
 * The mask's shape for one segment.
 *
 * The mark is 4px measured across the line rather than horizontally: the notch
 * is upright on a horizontal bar, so a slanted mark of the same horizontal
 * width reads as narrower than it is. The shallower the line runs, the wider it
 * has to be — hence derived from the segment rather than fixed.
 *
 * Edges stay vertical, so the gap spans a row's full height wherever the line
 * crosses it. A perpendicular stroke of the same weight would not: at these
 * angles it covers about four of a row's five pixels, leaving slivers of fill
 * above and below.
 */
export function markGeometry(
  spanPx: number,
  heightPx: number,
  thicknessPx: number,
): { widthPx: number; skewDeg: number } {
  if (heightPx <= 0) return { widthPx: thicknessPx, skewDeg: 0 }
  const hypotenuse = Math.hypot(spanPx, heightPx)
  return {
    widthPx: (thicknessPx * hypotenuse) / heightPx,
    skewDeg: (Math.atan2(spanPx, heightPx) * 180) / Math.PI,
  }
}

/**
 * When the allowance is expected to run out, or null when it is not expected to
 * before the window resets.
 *
 * Null is the ordinary answer, and is what leaves the head row stating the
 * reset. Once the allowance is going to be gone first, when it runs out is the
 * actionable time and the reset is not. spec: UHST
 */
export function runoutAt(
  samples: readonly Sample[],
  window: number,
  now: number,
): number | null {
  const recent = samples
    .filter((s) => s.window === window && s.at <= now && s.at >= now - ESTIMATE_MS)
    .sort((a, b) => a.at - b.at)
  if (recent.length < 2) return null

  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last) return null
  const span = last.at - first.at
  if (span <= 0) return null

  const rate = (last.percent - first.percent) / span
  if (rate <= 0) return null

  const remaining = 100 - last.percent
  if (remaining <= 0) return null

  const at = now + remaining / rate
  // Past the reset there is no runout: the allowance returns before it is gone.
  return at >= window ? null : at
}
