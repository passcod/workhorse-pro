import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, installExtStub, setBody } from './dom.ts'
import { usageMeter, usageUnavailable } from './fixtures/app.ts'

const dom = installDom()
installExtStub()

// jsdom does not lay out, so the bar reports no width and the mask's geometry —
// which is derived from it — would have nothing to work from. A fixed width
// stands in for layout, and is settable so the unmeasurable case can be driven:
// that is the state the real page was found in, and the one that used to leave
// the app's bar hidden with nothing drawn over it.
const BAR_W = 228
let width = BAR_W
Object.defineProperty(dom.window.HTMLElement.prototype, 'clientWidth', {
  get: () => width,
  configurable: true,
})

const { usageHistory } = await import('../src/features/usageHistory.ts')
const { anchors } = await import('../src/content/anchors.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const { put, reset: resetStore } = await import('../src/data/store.ts')
const { subscriptionUsageKey } = await import('../src/data/keys.ts')
const { clearUsage, recordUsage } = await import('../src/localData.ts')

const feature = usageHistory()

const MIN = 60_000
/** Three hours ten into a five-hour window, so seven rows are this window's. */
const NOW = Date.now()
const RESET = NOW + 110 * MIN
const OPEN = RESET - 300 * MIN

function serve(overrides: Record<string, unknown> = {}): void {
  put(subscriptionUsageKey(), {
    report: { percent: 78, resetsAt: new Date(RESET).toISOString(), windowMinutes: 300 },
    unavailable: null,
    readAt: new Date(NOW).toISOString(),
    ...overrides,
  })
}

function reconcile(overrides: Partial<typeof PREF_DEFAULTS> = {}): void {
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS, ...overrides },
    route: { workspace: 'workhorse', card: null },
    schedule: () => {},
  })
}

/** The app's own block, and the bar inside it. */
function slot(): HTMLElement {
  return document.querySelector<HTMLElement>('.group')!
}

function appBar(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.group > [role="meter"]:not([data-whp] *)')
}

function stack(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.whp-usage')
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.whp-usage-row')]
}

beforeEach(async () => {
  resetStore()
  await clearUsage()
  width = BAR_W
  setBody(`<aside>${usageMeter()}</aside>`)
  serve()
})

// ── The anchor ───────────────────────────────────────────────────────────

test('the bar resolves by its meter role and name', () => {
  const bar = anchors.usageBar()
  assert.ok(bar)
  assert.equal(bar.getAttribute('aria-valuenow'), '78')
})

test('the block holding the bar resolves through it', () => {
  assert.equal(anchors.usageSlot(), slot())
})

test('the extension does not resolve its own bottom row as the bar', () => {
  // The live row carries the same role and name, because it takes over the
  // reading the app's meter announced. An anchor returning it would have the
  // feature hiding its own bar. spec: INJ
  const before = anchors.usageBar()
  reconcile()
  assert.ok(document.querySelector('.whp-usage-live[role="meter"]'))
  assert.equal(anchors.usageBar(), before)
})

test('a footer with no reading has no bar to resolve', () => {
  setBody(`<aside>${usageUnavailable()}</aside>`)
  assert.equal(anchors.usageBar(), null)
  assert.equal(anchors.usageSlot(), null)
})

// ── Injection ────────────────────────────────────────────────────────────

test('a pass draws ten rows', () => {
  reconcile()
  assert.equal(rows().length, 10)
})

test('the stack sits immediately before the app bar', () => {
  reconcile()
  assert.equal(stack()?.nextElementSibling, appBar())
})

test('the app bar and head row are hidden in place, not removed', () => {
  const bar = anchors.usageBar()!
  const head = anchors.usageHead()!
  reconcile()

  // Still on the page: detaching a node React holds makes the app throw when it
  // later unmounts it.
  assert.ok(bar.isConnected)
  assert.ok(head.isConnected)
  // `visibility`, so both keep the space they occupy and the bar does not move.
  assert.equal(bar.style.visibility, 'hidden')
  assert.equal(head.style.visibility, 'hidden')
  assert.equal(bar.style.display, '')
  assert.equal(head.style.display, '')
})

test("the app's tooltip is blanked and recorded for later", () => {
  const original = slot().getAttribute('title')
  assert.ok(original && original.length > 0)
  reconcile()
  assert.equal(slot().getAttribute('title'), '')
  assert.equal(slot().getAttribute('data-whp-usage-title'), original)
})

test('the live row announces the reading the app bar did', () => {
  reconcile()
  const live = document.querySelector<HTMLElement>('.whp-usage-live')!
  assert.equal(live.getAttribute('aria-valuenow'), '78')
  assert.equal(live.getAttribute('aria-label'), 'Claude plan usage')
})

test('the mark carries a geometry per row', () => {
  reconcile()
  const mark = rows()[9]!.querySelector<HTMLElement>('.whp-usage-mark')!
  // The live window's line ends on the clock, which at 190 of 300 minutes is
  // 63.3% across the bar.
  const x = Number.parseFloat(mark.style.getPropertyValue('--x'))
  assert.ok(Math.abs(x - (190 / 300) * BAR_W) < 0.5, `got ${x}`)
  // Wider than the notch, because it is measured across the leaning line.
  assert.ok(Number.parseFloat(mark.style.getPropertyValue('--w')) > 4)
  assert.ok(Number.parseFloat(mark.style.getPropertyValue('--a')) > 0)
  // Closed, the bottom row's slice is already on the pivot.
  assert.equal(Number.parseFloat(mark.style.getPropertyValue('--dx')), 0)
})

test('rows with nothing recorded for their window are blank', () => {
  reconcile()
  // Only this window has been recorded, so the previous window's rows are bare
  // track rather than a fill of zero.
  assert.ok(rows()[0]!.classList.contains('whp-usage-blank'))
  assert.ok(rows()[0]!.classList.contains('whp-usage-past'))
  assert.equal(rows()[9]!.classList.contains('whp-usage-blank'), false)
})

test('a row turns on its own crossing', () => {
  recordUsage({ window: RESET, resetsAt: RESET, at: at(30), percent: 2 })
  recordUsage({ window: RESET, resetsAt: RESET, at: at(180), percent: 62 })
  reconcile()
  // 2% against 10% of the window elapsed is under; 62% against 60% is over.
  assert.equal(rows()[3]!.classList.contains('whp-usage-over'), false)
  assert.ok(rows()[8]!.classList.contains('whp-usage-over'))
})

function at(minutes: number): number {
  return OPEN + minutes * MIN
}

// ── An unmeasurable footer ───────────────────────────────────────────────

test('the app bar is never hidden without a stack drawn over it', () => {
  // The failure this guards is the worst one available: the app's own bar hidden
  // and nothing in its place, so the footer reads as empty. spec: WXP
  width = 0
  reconcile()
  const bar = anchors.usageBar()!
  assert.equal(bar.style.visibility === 'hidden' && stack() === null, false)
})

test('rows still stand when the bar cannot be measured', () => {
  width = 0
  reconcile()
  // The rows are proportional, so only the mask needs a pixel width.
  assert.equal(rows().length, 10)
  const head = document.querySelector<HTMLElement>('.whp-usage-label')
  assert.match(head?.textContent ?? '', /Claude usage/)
})

test('the mask is left off rather than drawn at a bad angle', () => {
  width = 0
  reconcile()
  const mark = rows()[9]!.querySelector<HTMLElement>('.whp-usage-mark')!
  // An angle derived from no width would put every slice in one place, which
  // reads as a fault in the bar rather than as a clock.
  assert.equal(mark.style.getPropertyValue('--a'), '')
})

test('another pass is asked for once there is no width', () => {
  width = 0
  let scheduled = 0
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS },
    route: { workspace: 'workhorse', card: null },
    schedule: () => {
      scheduled++
    },
  })
  assert.equal(scheduled, 1)
})

test('a later pass with a width finishes the mark', () => {
  width = 0
  reconcile()
  width = BAR_W
  reconcile()
  const mark = rows()[9]!.querySelector<HTMLElement>('.whp-usage-mark')!
  assert.ok(Number.parseFloat(mark.style.getPropertyValue('--a')) > 0)
})

// ── Reconciling ──────────────────────────────────────────────────────────

test('the stack survives a second pass', () => {
  // The stack is inserted immediately before the bar, so the app's head row is
  // no longer the bar's previous sibling. Reaching for it that way hid the stack
  // itself from the second pass on: the bars appeared once and then vanished.
  reconcile()
  reconcile()
  reconcile()
  assert.equal(stack()!.style.visibility, '')
  assert.equal(anchors.usageHead()!.style.visibility, 'hidden')
})

test('the head row anchor steps over the injected stack', () => {
  const head = anchors.usageHead()!
  reconcile()
  assert.equal(anchors.usageHead(), head)
  // Which is precisely what a bare sibling walk would get wrong.
  assert.equal(anchors.usageBar()!.previousElementSibling, stack())
})

test('a second pass changes nothing', () => {
  reconcile()
  const first = stack()!
  const firstRows = rows()
  reconcile()

  // The same nodes, not equivalents: hover and a click in progress are held by
  // the node itself, and a pass runs on every change the app makes. spec: INJ
  assert.equal(stack(), first)
  assert.deepEqual(rows(), firstRows)
  assert.equal(document.querySelectorAll('.whp-usage').length, 1)
})

test('the tooltip is recorded once, not overwritten by the blank', () => {
  const original = slot().getAttribute('title')
  reconcile()
  reconcile()
  assert.equal(slot().getAttribute('data-whp-usage-title'), original)
})

test('the app rebuilding its footer gets the stack back', () => {
  reconcile()
  assert.ok(stack())
  // A soft navigation, or any re-render that replaces the block.
  setBody(`<aside>${usageMeter()}</aside>`)
  assert.equal(stack(), null)
  reconcile()
  assert.equal(rows().length, 10)
})

// ── Turning it off ───────────────────────────────────────────────────────

test('the switch removes the stack and restores the app bar', () => {
  reconcile()
  const bar = anchors.usageBar()!
  const head = bar.previousElementSibling as HTMLElement
  const original = slot().getAttribute('data-whp-usage-title')

  reconcile({ usageHistory: false })

  assert.equal(stack(), null)
  assert.equal(bar.style.visibility, '')
  assert.equal(head.style.visibility, '')
  assert.equal(slot().getAttribute('title'), original)
  assert.equal(slot().hasAttribute('data-whp-usage-title'), false)
  assert.equal(slot().classList.contains('whp-usage-slot'), false)
})

test('a reading with no figure leaves the app footer alone', () => {
  reconcile()
  assert.ok(stack())
  serve({ report: { percent: null, resetsAt: new Date(RESET).toISOString(), windowMinutes: 300 } })
  reconcile()
  assert.equal(stack(), null)
  assert.equal(anchors.usageBar()!.style.visibility, '')
})

test('a footer with no reading at all is not touched', () => {
  setBody(`<aside>${usageUnavailable()}</aside>`)
  reconcile()
  assert.equal(stack(), null)
})

test('no reading yet is not an error', () => {
  resetStore()
  reconcile()
  assert.equal(stack(), null)
})
