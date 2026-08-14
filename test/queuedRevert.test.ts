import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, installExtStub, setBody } from './dom.ts'
import { queuedMessages } from './fixtures/app.ts'

const dom = installDom()
installExtStub()

const { queuedRevert } = await import('../src/features/queuedRevert.ts')
const { foldReturnedText, renderedMessageText } = await import('../src/lib/queuedRevert.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')

const feature = queuedRevert()

function reconcile(overrides: Record<string, unknown> = {}): void {
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS, ...overrides },
    route: { workspace: 'workhorse', card: 'WH-078', filePath: null, view: null },
    schedule: () => {},
  })
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

beforeEach(() => setBody(''))

test('foldReturnedText puts returned text above an existing draft', () => {
  assert.equal(foldReturnedText('', 'reverted'), 'reverted')
  assert.equal(foldReturnedText('   ', 'reverted'), 'reverted')
  assert.equal(foldReturnedText('my draft', 'reverted'), 'reverted\n\nmy draft')
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

test('reverting folds the message into the composer and drops it from the queue', () => {
  setBody(queuedMessages([{ content: '<p>queued prompt</p>' }]))
  wireDiscards()
  reconcile()

  composer().value = 'a draft I was writing'
  reverts()[0]!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))

  assert.equal(composer().value, 'queued prompt\n\na draft I was writing')
  // The message left the queue through the app's own discard.
  assert.equal(document.querySelector('.group'), null)
})

test('reverting into an empty composer is just the message', () => {
  setBody(queuedMessages([{ content: '<p>queued prompt</p>' }]))
  wireDiscards()
  reconcile()

  reverts()[0]!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  assert.equal(composer().value, 'queued prompt')
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
