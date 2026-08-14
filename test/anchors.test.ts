import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'
import { composerArea, prSection, sidebar } from './fixtures/app.ts'

installDom()
const { anchors } = await import('../src/content/anchors.ts')

beforeEach(() => setBody(''))

test('an anchor that resolves to nothing returns nothing rather than throwing', () => {
  // The normal state on a page the feature does not apply to. spec: INJ
  assert.equal(anchors.composer(), null)
  assert.equal(anchors.checksRow(), null)
  assert.equal(anchors.basedOnRow(), null)
  assert.equal(anchors.conversationsHeader(), null)
  assert.equal(anchors.prDetailExpanded(), false)
})

test('the composer resolves', () => {
  setBody(composerArea())
  assert.equal(anchors.composer()?.tagName, 'TEXTAREA')
})

test('the pull request detail toggle resolves before a PR exists', () => {
  setBody(prSection({ hasPr: false }))
  const toggle = anchors.prDetailToggle()
  assert.equal(toggle?.getAttribute('title'), 'Branch details')
})

test('the pull request detail toggle resolves once a PR exists', () => {
  setBody(prSection({ hasPr: true }))
  const toggle = anchors.prDetailToggle()
  assert.equal(toggle?.tagName, 'BUTTON')
  // The bar's own button, not the GitHub link beside it.
  assert.equal(toggle?.getAttribute('title'), null)
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

test('disclosure rows resolve by their visible label, not by position', () => {
  setBody(prSection({ detailExpanded: true }))
  assert.equal(anchors.checksRow()?.firstElementChild?.textContent, 'Checks')
  assert.equal(anchors.reviewRow()?.firstElementChild?.textContent, 'Review Hero')
  // The branch dropdown also carries aria-expanded and must not be mistaken
  // for a disclosure row.
  assert.notEqual(anchors.checksRow(), anchors.branchDropdown())
})

test('disclosure content exists only while its row is open', () => {
  setBody(prSection({ detailExpanded: true, checksOpen: false }))
  assert.equal(anchors.checksContent(), null)
  setBody(prSection({ detailExpanded: true, checksOpen: true }))
  assert.ok(anchors.checksContent())
})

test('each disclosure resolves its own content, not a neighbour’s', () => {
  setBody(prSection({ detailExpanded: true, checksOpen: true, reviewOpen: true }))
  const checks = anchors.checksContent()
  const review = anchors.reviewContent()
  assert.ok(checks)
  assert.ok(review)
  assert.notEqual(checks, review)
})

test('the based-on row resolves to the row, not the label', () => {
  setBody(prSection({ detailExpanded: true }))
  const row = anchors.basedOnRow()
  assert.equal(row?.firstElementChild?.textContent, 'Based on')
  assert.ok(row?.parentElement, 'the row must have a parent to hang a sibling from')
})

test('the conversations header and list resolve', () => {
  setBody(sidebar())
  const header = anchors.conversationsHeader()
  assert.ok(header)
  assert.match(header.textContent ?? '', /Conversations/)
  const list = anchors.conversationsList()
  assert.equal(list?.className, 'conversations-list')
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
