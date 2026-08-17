import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'
import { branding as brandingFixture } from './fixtures/app.ts'

installDom()
const { branding } = await import('../src/features/branding.ts')
const { anchors } = await import('../src/content/anchors.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')

const feature = branding()

function reconcile(overrides: Partial<typeof PREF_DEFAULTS> = {}): void {
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS, ...overrides },
    route: { workspace: 'workhorse', card: null },
    schedule: () => {},
  })
}

/** The app's own mark in the header, hidden or not. */
function appMark(): SVGElement {
  return document.querySelector<SVGElement>('.flex svg.logo')!
}

/** The extension's mark, or null when it has not injected one. */
function ourMark(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.whp-brand-mark')
}

// ── The header lockup ────────────────────────────────────────────────────

beforeEach(() => {
  setBody(brandingFixture())
})

test('the wordmark reads Prohorse', () => {
  assert.equal(anchors.wordmark()?.textContent, 'Workhorse')
  reconcile()
  assert.equal(anchors.wordmark()?.textContent, 'Prohorse')
})

test('the mark carries a horse and stands where the app’s stood', () => {
  reconcile()
  const ours = ourMark()
  assert.equal(ours?.textContent, '🐴')
  // Ahead of the wordmark, exactly where the app puts its own.
  assert.equal(ours?.nextElementSibling, appMark())
  assert.equal(appMark().nextElementSibling, anchors.wordmark())
})

test('the app’s mark is hidden rather than removed', () => {
  reconcile()
  // Detaching a node React still holds makes React throw when it unmounts it.
  assert.ok(appMark().isConnected)
  assert.equal(appMark().style.display, 'none')
})

test('the extension’s mark is decorative, as the app’s is', () => {
  reconcile()
  assert.equal(ourMark()?.getAttribute('aria-hidden'), 'true')
})

test('the controls beside the wordmark are untouched', () => {
  reconcile()
  assert.ok(document.querySelector('button[title="Hide sidebar"]'))
})

// ── Reconciliation ───────────────────────────────────────────────────────

test('a pass over a page already branded changes nothing', () => {
  reconcile()
  const row = ourMark()!.parentElement!
  const observer = new MutationObserver(() => {})
  observer.observe(row, { childList: true, subtree: true, attributes: true })
  reconcile()
  // A write is a mutation, and a mutation schedules another pass. Without this
  // the loop never settles.
  assert.deepEqual(observer.takeRecords(), [])
  observer.disconnect()
})

test('the mark is not rebuilt on a later pass', () => {
  reconcile()
  const first = ourMark()
  reconcile()
  assert.equal(ourMark(), first, 'the mark was replaced by an equivalent')
})

test('the wordmark is rewritten again after the app rebuilds it', () => {
  reconcile()
  // React re-creating the sidebar brings the app's own name back with it.
  setBody(brandingFixture())
  assert.equal(anchors.wordmark()?.textContent, 'Workhorse')
  reconcile()
  assert.equal(anchors.wordmark()?.textContent, 'Prohorse')
})

// ── The switch ───────────────────────────────────────────────────────────

test('the switch off leaves the app’s own branding alone', () => {
  reconcile({ proWordmark: false })
  assert.equal(anchors.wordmark()?.textContent, 'Workhorse')
  assert.equal(ourMark(), null)
  assert.equal(appMark().style.display, '')
})

test('turning the switch off puts the app’s branding back', () => {
  reconcile()
  reconcile({ proWordmark: false })
  assert.equal(anchors.wordmark()?.textContent, 'Workhorse')
  assert.equal(ourMark(), null)
  assert.equal(appMark().style.display, '')
})

test('turning it off and on again restores the same wordmark', () => {
  reconcile()
  reconcile({ proWordmark: false })
  reconcile()
  assert.equal(anchors.wordmark()?.textContent, 'Prohorse')
  assert.equal(ourMark()?.textContent, '🐴')
})

// ── The retracted rail ───────────────────────────────────────────────────

test('the rail’s mark is swapped too', () => {
  setBody(brandingFixture({ collapsed: true }))
  reconcile()
  const ours = ourMark()
  assert.equal(ours?.textContent, '🐴')
  // Collapsing the sidebar must not bring the app's own mark back into view.
  assert.equal(document.querySelector<SVGElement>('svg.logo')!.style.display, 'none')
  assert.equal(ours?.nextElementSibling, document.querySelector('svg.logo'))
})

test('the rail keeps the control that reveals the sidebar', () => {
  setBody(brandingFixture({ collapsed: true }))
  reconcile()
  assert.ok(document.querySelector('button[title="Show sidebar"]'))
})

test('turning the switch off puts the rail’s mark back', () => {
  setBody(brandingFixture({ collapsed: true }))
  reconcile()
  reconcile({ proWordmark: false })
  assert.equal(ourMark(), null)
  assert.equal(document.querySelector<SVGElement>('svg.logo')!.style.display, '')
})

// ── Anchors ──────────────────────────────────────────────────────────────

test('the attribute is preferred over the label fallback', () => {
  setBody(`
    <aside>
      <div class="lockup">
        <svg class="logo" data-wh-brand-mark></svg>
        <span data-wh-wordmark>Wörkhorse</span>
      </div>
      <span>Workhorse</span>
    </aside>
  `)
  reconcile()
  assert.equal(document.querySelector('[data-wh-wordmark]')?.textContent, 'Prohorse')
  // The decoy carries the label the fallback matches on, and is not the anchor.
  assert.equal(document.querySelectorAll('aside > span')[0]?.textContent, 'Workhorse')
})

test('a workspace named Workhorse is not mistaken for the wordmark', () => {
  setBody(`
    <aside>
      <div class="lockup">
        <svg class="logo"></svg>
        <span>Workhorse</span>
      </div>
      <button type="button"><span>Workhorse</span><span><svg></svg></span></button>
    </aside>
  `)
  reconcile()
  assert.equal(document.querySelector('.lockup > span:not([data-whp])')?.textContent, 'Prohorse')
  assert.equal(document.querySelector('button > span')?.textContent, 'Workhorse')
})

test('the rail’s hook does not resolve as the header’s mark', () => {
  setBody(`
    <div class="rail">
      <svg class="logo" data-wh-rail-mark></svg>
      <button type="button" title="Show sidebar"></button>
    </div>
  `)
  reconcile()
  // One attribute covering both placements would have the rail's mark resolve
  // as the header's too, and land two horses on the one node.
  assert.equal(document.querySelectorAll('.whp-brand-mark').length, 1)
})

test('a page with no branding is not an error', () => {
  setBody('<div></div>')
  reconcile()
  assert.equal(anchors.wordmark(), null)
  assert.equal(anchors.brandMark(), null)
  assert.equal(anchors.railBrandMark(), null)
})

test('a wordmark with no mark beside it is still rewritten', () => {
  setBody('<aside><span>Workhorse</span></aside>')
  reconcile()
  assert.equal(anchors.wordmark()?.textContent, 'Prohorse')
  assert.equal(ourMark(), null)
})

test('the extension’s own mark is never mistaken for the app’s', () => {
  reconcile()
  reconcile()
  // `brandMark` reads the wordmark's previous sibling, which is the app's svg;
  // resolving to the injected span instead would hide the horse behind itself.
  assert.equal(anchors.brandMark(), appMark())
  assert.equal(document.querySelectorAll('.whp-brand-mark').length, 1)
})
