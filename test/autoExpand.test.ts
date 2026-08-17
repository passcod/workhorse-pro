import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'
import { prSection } from './fixtures/app.ts'

const dom = installDom()
const { autoExpand, resetAutoExpand } = await import('../src/features/autoExpand.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const { anchors } = await import('../src/content/anchors.ts')

const feature = autoExpand()

/**
 * Stand in for the app's own disclosure behaviour: a click flips the row's
 * expanded state. The real thing is React state, which is exactly what these
 * tests cannot reach — see the caveat below.
 */
function makeRowsClickable(): void {
  for (const row of document.querySelectorAll('[aria-expanded]')) {
    row.addEventListener('click', () => {
      row.setAttribute('aria-expanded', row.getAttribute('aria-expanded') === 'true' ? 'false' : 'true')
    })
  }
}

function reconcile(overrides: Partial<typeof PREF_DEFAULTS> = {}): void {
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS, ...overrides },
    route: { workspace: 'workhorse', card: 'WH-078' },
    schedule: () => {},
  })
}

function clickRow(element: Element): void {
  element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  setBody(prSection({ detailExpanded: true, branchDropdownOpen: false }))
  makeRowsClickable()
  resetAutoExpand()
})

test('a collapsed branch dropdown is opened', () => {
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'false')
  reconcile()
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'true')
})

test('an already-open section is left alone', () => {
  setBody(prSection({ detailExpanded: true, branchDropdownOpen: true }))
  makeRowsClickable()
  reconcile()
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'true')
})

test('collapsing by hand keeps it collapsed', () => {
  reconcile()
  const dropdown = anchors.branchDropdown()!
  assert.equal(dropdown.getAttribute('aria-expanded'), 'true')

  // The user's own click, which the capture-phase watcher reads before the
  // app's handler changes the state.
  clickRow(dropdown)
  assert.equal(dropdown.getAttribute('aria-expanded'), 'false')

  reconcile()
  assert.equal(dropdown.getAttribute('aria-expanded'), 'false', 'the extension re-opened it')
})

test('re-opening by hand lets the extension resume', () => {
  reconcile()
  const dropdown = anchors.branchDropdown()!
  clickRow(dropdown)
  clickRow(dropdown)
  assert.equal(dropdown.getAttribute('aria-expanded'), 'true')

  setBody(prSection({ detailExpanded: true, branchDropdownOpen: false }))
  makeRowsClickable()
  reconcile()
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'true')
})

test('a collapse on one card does not suppress expansion on another', () => {
  reconcile()
  clickRow(anchors.branchDropdown()!)

  setBody(prSection({ detailExpanded: true, branchDropdownOpen: false }))
  makeRowsClickable()
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS },
    route: { workspace: 'workhorse', card: 'WH-099' },
    schedule: () => {},
  })
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'true')
})

test('turning the switch off stops expansion and leaves open sections open', () => {
  reconcile()
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'true')

  setBody(prSection({ detailExpanded: true, branchDropdownOpen: false }))
  makeRowsClickable()
  reconcile({ autoExpandBranchDropdown: false })
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'false')
})

// ── The stat rows ────────────────────────────────────────────────────────
//
// Checks and Review Hero are both disclosures holding readings behind a
// chevron — the app's own run stats, and the extension's named jobs under
// Checks. Opening them is what puts those in view without a click.

test('both rows stay closed by default', () => {
  reconcile()
  assert.equal(anchors.reviewRow()?.getAttribute('aria-expanded'), 'false')
  assert.equal(anchors.checksRow()?.getAttribute('aria-expanded'), 'false')
})

test('with the switch on, both rows open', () => {
  // spec: AEXP
  reconcile({ autoExpandRows: true })
  assert.equal(anchors.reviewRow()?.getAttribute('aria-expanded'), 'true')
  assert.equal(anchors.checksRow()?.getAttribute('aria-expanded'), 'true')
})

test('closing one by hand keeps it closed', () => {
  reconcile({ autoExpandRows: true })
  const review = anchors.reviewRow()!
  clickRow(review)
  assert.equal(review.getAttribute('aria-expanded'), 'false')

  reconcile({ autoExpandRows: true })
  assert.equal(review.getAttribute('aria-expanded'), 'false')
})

test('closing one row does not hold the other closed', () => {
  // Each row has its own record, so a collapsed Review Hero must not suppress
  // the Checks row the user never touched.
  reconcile({ autoExpandRows: true })
  clickRow(anchors.reviewRow()!)
  assert.equal(anchors.reviewRow()?.getAttribute('aria-expanded'), 'false')

  reconcile({ autoExpandRows: true })
  assert.equal(anchors.reviewRow()?.getAttribute('aria-expanded'), 'false')
  assert.equal(anchors.checksRow()?.getAttribute('aria-expanded'), 'true')
})

test('a section with nothing to expand is not an error', () => {
  setBody('<div></div>')
  reconcile({ autoExpandRows: true })
  assert.equal(document.querySelectorAll('[aria-expanded]').length, 0)
})
