import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, installExtStub, setBody } from './dom.ts'
import { queuedMessages } from './fixtures/app.ts'

const dom = installDom()
installExtStub()

const { queuedRevert } = await import('../src/features/queuedRevert.ts')
const { composerFeature } = await import('../src/features/composer.ts')
const { renderedMessageText } = await import('../src/lib/queuedRevert.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const local = await import('../src/localData.ts')

const feature = queuedRevert()
// The revert writes through the composer feature, which has to have seen the
// composer for that to work — the same pairing as on a real page.
const composerFeat = composerFeature()

function reconcile(overrides: Record<string, unknown> = {}): void {
  const context = {
    prefs: { ...PREF_DEFAULTS, ...overrides },
    route: { workspace: 'workhorse', card: 'WH-078', filePath: null, view: null },
    schedule: () => {},
  }
  composerFeat.reconcile(context)
  feature.reconcile(context)
}

/** Wire each discard control to drop its whole message, as the app's does. */
function wireDiscards(): void {
  for (const discard of document.querySelectorAll('button[aria-label="Discard queued message"]')) {
    discard.addEventListener('click', () => {
      discard.closest('.group')?.remove()
    })
  }
}

function reverts(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-whp-id="queued-revert"]')]
}

function composer(): HTMLTextAreaElement {
  return document.querySelector('textarea')!
}

/** Type into the composer as a user would, so the composer feature sees it. */
function type(element: HTMLTextAreaElement, text: string): void {
  element.value = text
  element.setSelectionRange(text.length, text.length)
  element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

function click(element: Element): void {
  element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
}

beforeEach(async () => {
  setBody('')
  await local.clearHistory()
  await local.clearStash()
})

test('renderedMessageText joins paragraphs with a blank line', () => {
  setBody(queuedMessages([{ content: '<p>first line</p><p>second line</p>' }]))
  const body = document.querySelector('.body')!
  assert.equal(renderedMessageText(body), 'first line\n\nsecond line')
})

test('renderedMessageText reads a single paragraph as its text', () => {
  setBody(queuedMessages([{ content: '<p>just one</p>' }]))
  assert.equal(renderedMessageText(document.querySelector('.body')!), 'just one')
})

test('a revert control is injected before each queued discard', () => {
  setBody(queuedMessages([{}, { grouped: true }]))
  reconcile()
  const injected = reverts()
  assert.equal(injected.length, 2)
  for (const button of injected) {
    // It sits immediately before the app's discard control.
    assert.equal(button.nextElementSibling?.getAttribute('aria-label'), 'Discard queued message')
  }
})

test('the grouped message gets the floating variant, the header one does not', () => {
  setBody(queuedMessages([{}, { grouped: true }]))
  reconcile()
  const [header, grouped] = reverts()
  assert.equal(header!.classList.contains('whp-queued-revert-grouped'), false)
  assert.equal(grouped!.classList.contains('whp-queued-revert-grouped'), true)
})

test('the message container is marked so the control reveals on hover', () => {
  setBody(queuedMessages([{}]))
  reconcile()
  assert.ok(document.querySelector('.group[data-whp-queued]'))
})

test('reverting stashes the draft, takes the composer, and drops the message', () => {
  setBody(queuedMessages([{ content: '<p>queued prompt</p>' }]))
  wireDiscards()
  reconcile()

  type(composer(), 'a draft I was writing')
  click(reverts()[0]!)

  // The composer holds the reverted message alone — the draft is on the stash,
  // not folded in above it.
  assert.equal(composer().value, 'queued prompt')
  assert.deepEqual([...local.getStash()], ['a draft I was writing'])
  // The message left the queue through the app's own discard.
  assert.equal(document.querySelector('.group'), null)
})

test('reverting into an empty composer stashes nothing', () => {
  setBody(queuedMessages([{ content: '<p>queued prompt</p>' }]))
  wireDiscards()
  reconcile()

  click(reverts()[0]!)
  assert.equal(composer().value, 'queued prompt')
  assert.deepEqual([...local.getStash()], [])
})

test('the stashed draft comes back through the badge', () => {
  // The parked draft has to be recoverable, which is the badge's whole job.
  setBody(queuedMessages([{ content: '<p>queued prompt</p>' }]))
  wireDiscards()
  reconcile()

  type(composer(), 'my draft')
  click(reverts()[0]!)
  reconcile()

  const badge = document.querySelector<HTMLElement>('[data-whp-id="stash-badge"]')
  assert.equal(badge?.textContent, '1 stashed')
  click(badge!)
  // Popping into a composer holding the reverted message exchanges the two.
  assert.equal(composer().value, 'my draft')
  assert.deepEqual([...local.getStash()], ['queued prompt'])
})

test('the badge shows a revert-parked draft even with stashing by key off', () => {
  // Otherwise a revert would swallow the draft with no way back to it.
  setBody(queuedMessages([{ content: '<p>queued prompt</p>' }]))
  wireDiscards()
  reconcile({ composerStash: false })

  type(composer(), 'my draft')
  click(reverts()[0]!)
  reconcile({ composerStash: false })

  assert.equal(
    document.querySelector('[data-whp-id="stash-badge"]')?.textContent,
    '1 stashed',
  )
})

test('reverting during recall parks the held draft, not the recalled message', () => {
  // Recall shows an old message while the user's own text is held aside. The
  // held text is what a stash is for; the recalled message is in history.
  setBody(queuedMessages([{ content: '<p>queued prompt</p>' }]))
  wireDiscards()
  reconcile()
  local.recordSent('an old message')

  type(composer(), 'my real draft')
  composer().dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key: 'ArrowUp',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  )
  assert.equal(composer().value, 'an old message')

  click(reverts()[0]!)
  assert.equal(composer().value, 'queued prompt')
  assert.deepEqual([...local.getStash()], ['my real draft'])
})

test('a message that reads as empty is not discarded', () => {
  // Discarding without the text safely in the composer would lose it outright.
  setBody(queuedMessages([{ content: '' }]))
  wireDiscards()
  reconcile()

  click(reverts()[0]!)
  assert.ok(document.querySelector('.group'), 'the message should still be queued')
})

test('turning the feature off injects nothing', () => {
  setBody(queuedMessages([{}]))
  reconcile({ queuedRevert: false })
  assert.equal(reverts().length, 0)
})

test('a control whose message is delivered is cleaned up on the next pass', () => {
  setBody(queuedMessages([{}]))
  reconcile()
  assert.equal(reverts().length, 1)

  // The app delivers the message: its discard control goes, ours is orphaned.
  document.querySelector('button[aria-label="Discard queued message"]')!.remove()
  reconcile()
  assert.equal(reverts().length, 0)
  // The hover mark goes with it.
  assert.equal(document.querySelector('[data-whp-queued]'), null)
})

test('a second pass does not inject a duplicate control', () => {
  setBody(queuedMessages([{}]))
  reconcile()
  reconcile()
  assert.equal(reverts().length, 1)
})
