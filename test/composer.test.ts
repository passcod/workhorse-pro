import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, installExtStub, setBody } from './dom.ts'
import { composerArea } from './fixtures/app.ts'

const dom = installDom()
installExtStub()

const { composerFeature } = await import('../src/features/composer.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const local = await import('../src/localData.ts')

const DRAFTS_KEY = 'workhorse:chat-drafts'
const feature = composerFeature()

function reconcile(): HTMLTextAreaElement {
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS },
    route: { workspace: 'workhorse', card: 'WH-078' },
    schedule: () => {},
  })
  return document.querySelector('textarea')!
}

function key(
  element: Element,
  init: { key: string; altKey?: boolean; shiftKey?: boolean },
): boolean {
  const event = new dom.window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  element.dispatchEvent(event)
  return event.defaultPrevented
}

/** Type into the composer as a user would, so recall sees an edit. */
function type(element: HTMLTextAreaElement, text: string): void {
  element.value = text
  element.setSelectionRange(text.length, text.length)
  element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

function caretTo(element: HTMLTextAreaElement, index: number): void {
  element.setSelectionRange(index, index)
}

beforeEach(async () => {
  setBody(composerArea())
  await local.clearHistory()
  await local.clearStash()
  dom.window.localStorage.clear()
})

test('recall from an empty composer walks back through sent messages', () => {
  local.recordSent('first')
  local.recordSent('second')
  const composer = reconcile()

  assert.equal(key(composer, { key: 'ArrowUp' }), true)
  assert.equal(composer.value, 'second')

  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'first')
})

test('stepping newer returns towards the most recent, then empties', () => {
  local.recordSent('first')
  local.recordSent('second')
  const composer = reconcile()

  key(composer, { key: 'ArrowUp' })
  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'first')

  key(composer, { key: 'ArrowDown' })
  assert.equal(composer.value, 'second')
  key(composer, { key: 'ArrowDown' })
  assert.equal(composer.value, '')
})

test('recall with no history leaves the arrow key alone', () => {
  const composer = reconcile()
  assert.equal(key(composer, { key: 'ArrowUp' }), false)
})

test('the caret rule lets arrows move within a multi-line message', () => {
  local.recordSent('recalled')
  const composer = reconcile()
  type(composer, 'line one\nline two')

  caretTo(composer, 12) // on the second line
  assert.equal(key(composer, { key: 'ArrowUp' }), false, 'should have moved the caret')

  caretTo(composer, 2) // on the first line
  assert.equal(key(composer, { key: 'ArrowUp' }), true, 'should have recalled')
})

test('recall from a composer with text holds the draft and gives it back', () => {
  // The behaviour the whole draft-protection design exists to make safe.
  // spec: HIST
  local.recordSent('an old message')
  const composer = reconcile()
  type(composer, 'my unsent draft')

  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'an old message')

  key(composer, { key: 'ArrowDown' })
  assert.equal(composer.value, 'my unsent draft')
})

test('editing during recall leaves recall, and a further recall holds the edit', () => {
  local.recordSent('old')
  const composer = reconcile()

  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'old')

  type(composer, 'now a new draft')
  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'old')

  key(composer, { key: 'ArrowDown' })
  assert.equal(composer.value, 'now a new draft')
})

test('sending records the message', () => {
  const composer = reconcile()
  type(composer, 'a message')
  key(composer, { key: 'Enter' })
  assert.deepEqual([...local.getHistory()], ['a message'])
})

test('shift-enter is a newline, not a send', () => {
  const composer = reconcile()
  type(composer, 'a message')
  key(composer, { key: 'Enter', shiftKey: true })
  assert.deepEqual([...local.getHistory()], [])
})

test('a refused send recorded twice yields one entry', () => {
  const composer = reconcile()
  type(composer, 'a message')
  key(composer, { key: 'Enter' })
  key(composer, { key: 'Enter' })
  assert.deepEqual([...local.getHistory()], ['a message'])
})

test('abandoning recall puts the held draft back in the app’s draft store', () => {
  // Recalled text goes through the composer, so the app records it as the
  // draft. Closing the tab mid-recall must not cost the user their own text.
  // spec: HIST
  local.recordSent('an old message')
  const composer = reconcile()

  const drafts = JSON.stringify({ 'session:abc': { text: 'my real draft', updatedAt: 1 } })
  dom.window.localStorage.setItem(DRAFTS_KEY, drafts)
  type(composer, 'my real draft')

  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'an old message')

  dom.window.dispatchEvent(new dom.window.Event('pagehide'))
  assert.equal(dom.window.localStorage.getItem(DRAFTS_KEY), drafts)
})

test('the composer being removed restores the draft too', () => {
  // What a soft navigation looks like from outside. spec: HIST
  local.recordSent('an old message')
  const composer = reconcile()

  const drafts = JSON.stringify({ 'session:abc': { text: 'my real draft', updatedAt: 1 } })
  dom.window.localStorage.setItem(DRAFTS_KEY, drafts)
  type(composer, 'my real draft')
  key(composer, { key: 'ArrowUp' })

  setBody('<div></div>')
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS },
    route: { workspace: 'workhorse', card: null },
    schedule: () => {},
  })
  assert.equal(dom.window.localStorage.getItem(DRAFTS_KEY), drafts)
})

test('a normal exit from recall leaves the draft store alone', () => {
  local.recordSent('an old message')
  const composer = reconcile()
  dom.window.localStorage.setItem(DRAFTS_KEY, '{}')

  key(composer, { key: 'ArrowUp' })
  key(composer, { key: 'ArrowDown' })
  key(composer, { key: 'Enter' })
  // Nothing to restore: the user left recall themselves.
  assert.equal(dom.window.localStorage.getItem(DRAFTS_KEY), '{}')
})

test('pushing parks the draft and empties the composer', () => {
  const composer = reconcile()
  type(composer, 'park me')

  assert.equal(key(composer, { key: 'ArrowDown', altKey: true }), true)
  assert.equal(composer.value, '')
  assert.deepEqual([...local.getStash()], ['park me'])
})

test('popping brings it back', () => {
  const composer = reconcile()
  type(composer, 'park me')
  key(composer, { key: 'ArrowDown', altKey: true })
  key(composer, { key: 'ArrowUp', altKey: true })
  assert.equal(composer.value, 'park me')
  assert.deepEqual([...local.getStash()], [])
})

test('popping into a composer with text exchanges the two', () => {
  const composer = reconcile()
  type(composer, 'first')
  key(composer, { key: 'ArrowDown', altKey: true })
  type(composer, 'second')

  key(composer, { key: 'ArrowUp', altKey: true })
  assert.equal(composer.value, 'first')
  assert.deepEqual([...local.getStash()], ['second'])
})

test('pushing during recall stashes the old message and hands the draft back', () => {
  // The rule that makes history and stash one design rather than two. spec: STSH
  local.recordSent('an old message')
  const composer = reconcile()
  type(composer, 'my unsent draft')

  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'an old message')

  key(composer, { key: 'ArrowDown', altKey: true })
  assert.deepEqual([...local.getStash()], ['an old message'])
  assert.equal(composer.value, 'my unsent draft')
})

test('the stash keys do not collide with recall', () => {
  local.recordSent('history entry')
  const composer = reconcile()
  type(composer, 'draft')

  // Alt held: the stash. Alt free: recall.
  key(composer, { key: 'ArrowUp', altKey: true })
  assert.equal(composer.value, 'draft', 'a pop from an empty stack should do nothing')

  key(composer, { key: 'ArrowUp' })
  assert.equal(composer.value, 'history entry')
})

test('the stash depth shows while something is held', () => {
  const composer = reconcile()
  type(composer, 'park me')
  key(composer, { key: 'ArrowDown', altKey: true })
  reconcile()

  const badge = document.querySelector('[data-whx-id="stash-badge"]')
  assert.equal(badge?.textContent, '1 stashed')

  key(composer, { key: 'ArrowUp', altKey: true })
  reconcile()
  assert.equal(document.querySelector('[data-whx-id="stash-badge"]'), null)
})
