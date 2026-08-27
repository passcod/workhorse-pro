import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStack,
  RESET_DRIFT_MS,
  windowKeyFor,
  markGeometry,
  record,
  ROW_MS,
  ROWS,
  runoutAt,
  WINDOW_MS,
  windowsOf,
  type Sample,
} from '../src/lib/usageHistory.ts'

const MIN = 60_000

/** A window resetting at 17:00, so it opened at 12:00. */
const RESET = 17 * 60 * MIN
const OPEN = RESET - WINDOW_MS
/** The window before it, contiguous. */
const PREV = OPEN
const PREV_OPEN = PREV - WINDOW_MS

function at(open: number, minutes: number): number {
  return open + minutes * MIN
}

/** `[minutes after open, percent]` pairs. */
function samplesFor(window: number, open: number, pairs: [number, number][]): Sample[] {
  return pairs.map(([minutes, percent]) => ({
    window,
    resetsAt: window,
    at: at(open, minutes),
    percent,
  }))
}

/** The run the mockups draw: quiet for five half hours, then a burst. */
const LIVE: [number, number][] = [
  [30, 2],
  [60, 5],
  [90, 9],
  [120, 14],
  [150, 30],
  [180, 62],
  [190, 78],
]

/** The previous window's tail: over par throughout, spent in full. */
const PAST: [number, number][] = [
  [240, 88],
  [270, 97],
  [300, 100],
]

const NOW = at(OPEN, 190)

function series(): Sample[] {
  return [...samplesFor(PREV, PREV_OPEN, PAST), ...samplesFor(RESET, OPEN, LIVE)]
}

test('a reading is recorded', () => {
  const one = record([], { window: RESET, resetsAt: RESET, at: NOW, percent: 78 })
  assert.deepEqual(one, [{ window: RESET, resetsAt: RESET, at: NOW, percent: 78 }])
})

test('the same moment is not recorded twice', () => {
  // The browser polls far more often than the device refreshes, so the same
  // reading is served repeatedly and must not accumulate.
  const one = record([], { window: RESET, resetsAt: RESET, at: NOW, percent: 78 })
  assert.equal(record(one, { window: RESET, resetsAt: RESET, at: NOW, percent: 78 }), one)
  assert.equal(record(one, { window: RESET, resetsAt: RESET, at: NOW, percent: 79 }), one)
})

test('a repeated percentage at a new moment is still recorded', () => {
  const one = record([], { window: RESET, resetsAt: RESET, at: NOW, percent: 78 })
  const two = record(one, { window: RESET, resetsAt: RESET, at: NOW + 5 * MIN, percent: 78 })
  assert.equal(two.length, 2)
})

test('an unreadable figure is ignored', () => {
  assert.deepEqual(record([], { window: RESET, resetsAt: RESET, at: NOW, percent: Number.NaN }), [])
})

test('only the two newest windows are kept', () => {
  const older = PREV_OPEN
  let all: readonly Sample[] = [
    { window: older, resetsAt: older, at: at(older - WINDOW_MS, 10), percent: 40 },
    ...series(),
  ]
  all = record(all, { window: RESET, resetsAt: RESET, at: NOW + MIN, percent: 79 })
  assert.deepEqual(windowsOf(all), [RESET, PREV])
})

test('the stack is always ten rows', () => {
  for (const minutes of [1, 45, 190, 299, 400]) {
    const stack = buildStack(series(), RESET, RESET, at(OPEN, minutes))
    assert.equal(stack.rows.length, ROWS, `at ${minutes}m`)
  }
})

test('the reset climbs the stack as the window runs', () => {
  const past = (minutes: number) =>
    buildStack(series(), RESET, RESET, at(OPEN, minutes)).rows.filter((r) => r.past).length

  // One hour in: two rows of this window, eight of the one before.
  assert.equal(past(60), 8)
  assert.equal(past(190), 3)
  // Full window: nothing left of the previous one.
  assert.equal(past(300), 0)
})

test('the bottom row is the live reading', () => {
  const stack = buildStack(series(), RESET, RESET, NOW)
  const bottom = stack.rows[ROWS - 1]!
  assert.equal(bottom.percent, 78)
  assert.equal(bottom.past, false)
  // Par is the clock, not the row's half hour: 190 of 300 minutes.
  assert.ok(Math.abs(bottom.par - (190 / 300) * 100) < 1e-9)
})

test('each row turns on its own crossing', () => {
  const stack = buildStack(series(), RESET, RESET, NOW)
  // Three faded rows from a spent window, then five quiet, then the burst.
  assert.deepEqual(
    stack.rows.map((r) => r.over),
    [true, true, true, false, false, false, false, false, true, true],
  )
})

test('an untouched window is not over par', () => {
  const stack = buildStack([{ window: RESET, resetsAt: RESET, at: at(OPEN, 5), percent: 0 }], RESET, RESET, at(OPEN, 6))
  assert.equal(stack.rows[ROWS - 1]!.over, false)
})

test('a half hour with no reading carries the last total forward', () => {
  // The tab was closed over the 150-minute mark, so that row has no reading of
  // its own and shows the 120-minute total instead — understating, deliberately.
  const gapped = series().filter((s) => s.at !== at(OPEN, 150))
  const stack = buildStack(gapped, RESET, RESET, NOW)
  const row = stack.rows[7]!
  assert.equal(row.percent, 14)
  assert.equal(row.over, false)
})

test('rows before anything was recorded for their window are blank', () => {
  const stack = buildStack(samplesFor(RESET, OPEN, LIVE), RESET, RESET, NOW)
  assert.deepEqual(
    stack.rows.slice(0, 3).map((r) => r.percent),
    [null, null, null],
  )
})

test('the clock mark is one segment per window on screen', () => {
  const stack = buildStack(series(), RESET, RESET, NOW)
  assert.equal(stack.segments.length, 2)

  const previous = stack.segments[0]!
  const live = stack.segments[1]!
  assert.deepEqual({ from: previous.from, to: previous.to }, { from: 0, to: 2 })
  // The previous window's tail runs from 70% of its allowance to its reset.
  assert.ok(Math.abs(previous.topAt - 0.7) < 1e-9)
  assert.equal(previous.bottomAt, 1)

  assert.deepEqual({ from: live.from, to: live.to }, { from: 3, to: 9 })
  assert.equal(live.topAt, 0)
  assert.ok(Math.abs(live.bottomAt - 190 / 300) < 1e-9)
})

test('with no previous window there is one segment covering the stack', () => {
  const stack = buildStack(samplesFor(RESET, OPEN, LIVE), RESET, RESET, NOW)
  assert.equal(stack.segments.length, 1)
  const only = stack.segments[0]!
  assert.deepEqual({ from: only.from, to: only.to }, { from: 3, to: 9 })
})

test('the mark widens as the line runs shallower', () => {
  // 4px across a line travelling 144.4px over 59px needs about 10.6px of
  // horizontal width, and leans about 68 degrees off upright.
  const steep = markGeometry(144.4, 59, 4)
  assert.ok(Math.abs(steep.widthPx - 10.578) < 0.01, `got ${steep.widthPx}`)
  assert.ok(Math.abs(steep.skewDeg - 67.77) < 0.01, `got ${steep.skewDeg}`)

  // The same 4px across a shallower two-row span needs more.
  const shallow = markGeometry(45.6, 14, 4)
  assert.ok(shallow.widthPx > steep.widthPx)
  assert.ok(shallow.skewDeg > steep.skewDeg)
})

test('a mark with no height to lean over stays upright', () => {
  assert.deepEqual(markGeometry(100, 0, 4), { widthPx: 4, skewDeg: 0 })
})

test('the runout is estimated from the recent rate', () => {
  // 30% at 150 minutes to 78% at 190 is 1.2% a minute, so the last 22% goes in
  // a little over eighteen minutes.
  const runout = runoutAt(series(), RESET, RESET, NOW)
  assert.ok(runout !== null)
  assert.ok(Math.abs(runout - at(OPEN, 190 + 22 / 1.2)) < 1000, `got ${runout}`)
})

test('there is no runout when the allowance outlasts the window', () => {
  const gentle = samplesFor(RESET, OPEN, [
    [150, 30],
    [190, 31],
  ])
  assert.equal(runoutAt(gentle, RESET, RESET, NOW), null)
})

test('there is no runout without a rate to read', () => {
  assert.equal(runoutAt(samplesFor(RESET, OPEN, [[190, 78]]), RESET, RESET, NOW), null)
  // Flat, and going backwards, are both no answer rather than a wrong one.
  const flat = samplesFor(RESET, OPEN, [
    [150, 78],
    [190, 78],
  ])
  assert.equal(runoutAt(flat, RESET, RESET, NOW), null)
})

test('readings older than the averaging window do not drag the rate', () => {
  // A burst four hours ago must not still be predicting a runout now.
  const stale = samplesFor(RESET, OPEN, [
    [10, 1],
    [20, 40],
    [190, 41],
  ])
  assert.equal(runoutAt(stale, RESET, RESET, NOW), null)
})

test('a row ending exactly on its window reset sits at full par', () => {
  const stack = buildStack(series(), RESET, RESET, NOW)
  assert.equal(stack.rows[2]!.par, 100)
})

test('half-hour rows land on half-hour boundaries', () => {
  const stack = buildStack(series(), RESET, RESET, at(OPEN, 90))
  // Three rows of this window at ninety minutes, the last ending now.
  const live = stack.rows.filter((r) => !r.past)
  assert.equal(live.length, 3)
  assert.ok(Math.abs(live[0]!.par - (ROW_MS / WINDOW_MS) * 100) < 1e-9)
})

// ── A window's identity, against a reset that moves ──────────────────────

test('the first reading names its own window', () => {
  assert.equal(windowKeyFor([], RESET), RESET)
})

test('a drifting reset stays the same window', () => {
  // Observed in the browser: the stated reset moved by a minute mid-window.
  // Keying identity on it made that look like a turnover, which orphaned the
  // whole session into a "previous window" and restarted the live one empty.
  const drifted = RESET + MIN
  const key = windowKeyFor(samplesFor(RESET, OPEN, LIVE), drifted)
  assert.equal(key, RESET)
})

test('drift cannot accumulate its way into a new window', () => {
  // Compared between consecutive readings, so many small steps stay one window
  // however far they add up to.
  let all: readonly Sample[] = []
  let stated = RESET
  for (let i = 0; i < 40; i++) {
    all = record(all, {
      window: windowKeyFor(all, stated),
      resetsAt: stated,
      at: at(OPEN, i * 5),
      percent: i,
    })
    // The device reads every five minutes, so that is the largest step a drift
    // can take between two readings.
    stated += 5 * MIN
  }
  assert.deepEqual(windowsOf(all), [RESET])
  // Well past the drift limit in total, and still one window.
  assert.ok(stated - RESET > RESET_DRIFT_MS)
})

test('a reset jumping clear of the drift limit is a new window', () => {
  const turnover = RESET + WINDOW_MS
  assert.equal(windowKeyFor(samplesFor(RESET, OPEN, LIVE), turnover), turnover)
})

test('a window is drawn against the reset it last stated, not its key', () => {
  // The key is the first reset seen; the window has since slid an hour. Par has
  // to follow the real reset or the clock mark would sit an hour behind.
  const stated = RESET + 60 * MIN
  const samples: Sample[] = [
    { window: RESET, resetsAt: RESET, at: at(OPEN, 10), percent: 3 },
    { window: RESET, resetsAt: stated, at: at(OPEN, 190), percent: 78 },
  ]
  const stack = buildStack(samples, RESET, stated, at(OPEN, 190))
  const bottom = stack.rows[ROWS - 1]!
  const open = stated - WINDOW_MS
  assert.ok(Math.abs(bottom.par - ((at(OPEN, 190) - open) / WINDOW_MS) * 100) < 1e-9)
})

test('a previous window is drawn against its own last stated reset', () => {
  const prevStated = PREV + 20 * MIN
  const samples: Sample[] = [
    { window: PREV, resetsAt: prevStated, at: at(PREV_OPEN, 290), percent: 96 },
    { window: RESET, resetsAt: RESET, at: at(OPEN, 190), percent: 78 },
  ]
  const stack = buildStack(samples, RESET, RESET, at(OPEN, 190))
  // The tail row of that window ends on its stated reset, so it sits at full par.
  assert.equal(stack.rows[2]!.par, 100)
  assert.equal(stack.rows[2]!.percent, 96)
})

test('no previous window means blank rows, not a borrowed one', () => {
  // The ordinary state for the first five hours after switching the feature on,
  // and what a phantom previous window looked like before identity was fixed.
  const stack = buildStack(samplesFor(RESET, OPEN, LIVE), RESET, RESET, NOW)
  assert.deepEqual(
    stack.rows.filter((r) => r.past).map((r) => r.percent),
    [null, null, null],
  )
  assert.equal(stack.segments.length, 1)
})
