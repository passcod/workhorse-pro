import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'
import { artefactPane, composerArea, prSection, sidebar } from './fixtures/app.ts'

installDom()
const { anchors } = await import('../src/content/anchors.ts')

beforeEach(() => setBody(''))

test('an anchor that resolves to nothing returns nothing rather than throwing', () => {
  // The normal state on a page the feature does not apply to. spec: INJ
  assert.equal(anchors.composer(), null)
  assert.equal(anchors.checksRow(), null)
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

test('the conversations header resolves to the row, not the label link', () => {
  setBody(sidebar())
  const header = anchors.conversationsHeader()
  assert.ok(header)
  assert.equal(header.className, 'nav-row group')
})

test('the conversations list resolves as the header’s sibling', () => {
  setBody(sidebar())
  assert.equal(anchors.conversationsList()?.className, 'conversations-list')
})

test('the app rendering no list at all resolves to nothing', () => {
  setBody(sidebar({ withList: false }))
  assert.equal(anchors.conversationsList(), null)
})

test('the extension’s own list is never mistaken for the app’s', () => {
  // It sits in the same place, so without this the feature hides its own list
  // — and nothing clears that, so the widened list never comes back.
  setBody(sidebar({ withList: false }))
  const header = anchors.conversationsHeader()!
  const ours = document.createElement('div')
  ours.setAttribute('data-whp', '')
  ours.className = 'whp-list'
  header.after(ours)

  assert.equal(anchors.conversationsList(), null)
})

test('the app’s list is still found past the extension’s own', () => {
  setBody(sidebar())
  const header = anchors.conversationsHeader()!
  const ours = document.createElement('div')
  ours.setAttribute('data-whp', '')
  header.after(ours)

  assert.equal(anchors.conversationsList()?.className, 'conversations-list')
})

test('the header’s control cluster resolves, so the scope control has a home', () => {
  // Placement is not cosmetic: injected outside the cluster the control either
  // takes the label's layout or sits inside its link, where a click navigates
  // instead of toggling — which leaves no way back to the narrow list.
  setBody(sidebar())
  const controls = anchors.conversationsControls()
  assert.equal(controls?.className, 'nav-controls')
  assert.ok(controls?.querySelector('button[title="New"]'))
})

test('the control cluster is absent when the header is', () => {
  setBody('<div></div>')
  assert.equal(anchors.conversationsControls(), null)
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

test('the artefact toggle resolves by its segments', () => {
  setBody(artefactPane())
  const toggle = anchors.artefactToggle()
  assert.ok(toggle)
  assert.deepEqual(
    [...toggle.children].map((child) => child.textContent),
    ['File', 'Changes'],
  )
})

test('the device toggle above a mockup is not the artefact toggle', () => {
  // Same component, same markup, same corner of the same bar. Only the labels
  // tell them apart, and a Diff segment on a mockup is what matching by
  // position would produce. spec: DIFF
  setBody(artefactPane({ segments: ['Desktop', 'Tablet', 'Mobile'] }))
  assert.equal(anchors.artefactToggle(), null)
})

test('the artefact toggle still resolves once the extension has added a segment', () => {
  setBody(artefactPane())
  const toggle = anchors.artefactToggle()!
  const injected = document.createElement('button')
  injected.type = 'button'
  injected.textContent = 'Diff'
  injected.setAttribute('data-whp', '')
  toggle.appendChild(injected)

  assert.equal(anchors.artefactToggle(), toggle)
  // The app's own segments are what the feature reads, and its own is not one.
  assert.deepEqual(
    anchors.artefactToggleSegments().map((node) => node.textContent),
    ['File', 'Changes'],
  )
})

test('the header bar is the ancestor holding both the toggle and the file stepper', () => {
  setBody(artefactPane())
  const bar = anchors.artefactHeaderBar()
  assert.ok(bar)
  assert.ok(bar.contains(anchors.artefactToggle()))
  assert.ok(bar.querySelector('button[title="Previous file"]'))
  // Not the whole column: the artefact view is a sibling of the bar, not inside it.
  assert.equal(bar.querySelector('.artifact-view'), null)
})

test('the artefact view is the bar next sibling', () => {
  setBody(artefactPane())
  const view = anchors.artefactView()
  assert.equal(view?.className, 'artifact-view')
})

test('the artefact view skips anything the extension put there', () => {
  // Without this the panel would resolve as the app's view and hide itself.
  setBody(artefactPane())
  const bar = anchors.artefactHeaderBar()!
  const panel = document.createElement('div')
  panel.setAttribute('data-whp', '')
  bar.after(panel)

  assert.equal(anchors.artefactView()?.className, 'artifact-view')
})

test('the artefact anchors resolve to nothing off an artefact page', () => {
  setBody(composerArea())
  assert.equal(anchors.artefactToggle(), null)
  assert.equal(anchors.artefactHeaderBar(), null)
  assert.equal(anchors.artefactView(), null)
})
