import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'
import { composerArea, prSection } from './fixtures/app.ts'

installDom()
const { anchors } = await import('../src/content/anchors.ts')

beforeEach(() => setBody(''))

test('an anchor that resolves to nothing returns nothing rather than throwing', () => {
  // The normal state on a page the feature does not apply to. spec: INJ
  assert.equal(anchors.composer(), null)
  assert.equal(anchors.checksRow(), null)
  assert.equal(anchors.prDetailToggle(), null)
  assert.equal(anchors.prDetailExpanded(), false)
})

test('the composer resolves', () => {
  setBody(composerArea())
  assert.equal(anchors.composer()?.tagName, 'TEXTAREA')
})

test('the pull request detail toggle resolves before a PR exists', () => {
  setBody(prSection({ hasPr: false }))
  const toggle = anchors.prDetailToggle()
  assert.equal(toggle?.tagName, 'BUTTON')
  // The title row, reached through its chevron — not the Create button beside it.
  assert.ok(toggle?.querySelector('[data-testid="pr-create-chevron"]'))
  assert.notEqual(toggle?.textContent?.trim(), 'Create PR')
})

test('the pull request detail toggle resolves once a PR exists', () => {
  setBody(prSection({ hasPr: true }))
  const toggle = anchors.prDetailToggle()
  assert.equal(toggle?.tagName, 'BUTTON')
  // The bar's own title row, not the overflow menu beside it: no title of its
  // own, and its chevron inside.
  assert.equal(toggle?.getAttribute('title'), null)
  assert.ok(toggle?.querySelector('[data-testid="pr-detail-chevron"]'))
})

test('the expanded state reads from the branch controls that only exist when open', () => {
  setBody(prSection({ detailExpanded: false }))
  assert.equal(anchors.prDetailExpanded(), false)
  setBody(prSection({ detailExpanded: true }))
  assert.equal(anchors.prDetailExpanded(), true)
})

test('the branch dropdown resolves with its own expanded state', () => {
  setBody(prSection({ detailExpanded: true, branchDropdownOpen: false }))
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'false')
  setBody(prSection({ detailExpanded: true, branchDropdownOpen: true }))
  assert.equal(anchors.branchDropdown()?.getAttribute('aria-expanded'), 'true')
})

test('rows resolve by their visible label, not by position', () => {
  setBody(prSection({ detailExpanded: true }))
  assert.equal(anchors.checksRow()?.firstElementChild?.textContent, 'Checks')
  assert.equal(anchors.reviewRow()?.firstElementChild?.textContent, 'Review Hero')
  // The branch dropdown also carries aria-expanded and must not be mistaken
  // for a disclosure row.
  assert.notEqual(anchors.checksRow(), anchors.branchDropdown())
})

test('the Checks row is a disclosure, carrying its own expanded state', () => {
  // The app moved its own run breakdown inside the row, so it is a disclosure
  // rather than the flat row it used to be — and the named jobs sit in there
  // with it.
  setBody(prSection({ detailExpanded: true, checksOpen: false }))
  assert.equal(anchors.checksRow()?.getAttribute('aria-expanded'), 'false')
  setBody(prSection({ detailExpanded: true, checksOpen: true }))
  assert.equal(anchors.checksRow()?.getAttribute('aria-expanded'), 'true')
})

test('each row content exists only while that row is open', () => {
  setBody(prSection({ detailExpanded: true, reviewOpen: false, checksOpen: false }))
  assert.equal(anchors.reviewContent(), null)
  assert.equal(anchors.checksContent(), null)

  setBody(prSection({ detailExpanded: true, reviewOpen: true, checksOpen: true }))
  assert.equal(anchors.reviewContent()?.getAttribute('data-content'), 'pr-review-hero-row')
  assert.equal(anchors.checksContent()?.getAttribute('data-content'), 'pr-checks-row')
})

test('the branch disclosure is not mistaken for a stat row', () => {
  // It carries aria-expanded too, so a disclosure-by-label search must not
  // reach it — and the detail's expanded state is read from its presence.
  setBody(prSection({ detailExpanded: true }))
  const branch = anchors.branchDropdown()
  assert.ok(branch)
  assert.equal(branch.getAttribute('title'), 'Branch detail')
  assert.notEqual(branch, anchors.checksRow())
  assert.notEqual(branch, anchors.reviewRow())
})

test('a data attribute is preferred over the fallback', () => {
  // As the app grows stable hooks, each fallback becomes a deletion. Until
  // then both paths have to work, and the hook has to win. spec: INJ
  setBody(`
    <div data-wh-pr-row="checks"><span>not the label</span></div>
    ${prSection({ detailExpanded: true })}
  `)
  assert.equal(anchors.checksRow()?.getAttribute('data-wh-pr-row'), 'checks')

  setBody(`<textarea id="wrong"></textarea><textarea data-wh-composer id="right"></textarea>`)
  assert.equal(anchors.composer()?.id, 'right')
})

