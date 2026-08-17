import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom } from './dom.ts'

const dom = installDom()
const { startObserving } = await import('../src/data/observed.ts')
const { peek, reset } = await import('../src/data/store.ts')
const { OBSERVED_MESSAGE } = await import('../src/lib/messages.ts')
const { branchStatusKey } = await import('../src/data/keys.ts')

/**
 * Everything reaching the receiver came through the page, so it is untrusted:
 * a payload that fails any check has to be dropped, leaving the ordinary read
 * path to fetch the data itself. spec: DATA
 */

startObserving()

const ORIGIN = 'https://workhorse.bes.au'
const BRANCH_STATUS_URL = `${ORIGIN}/api/card-branch-status?cardId=WH-078&workspace=workhorse`

function send(data: unknown, origin = ORIGIN): void {
  const event = new dom.window.MessageEvent('message', {
    data,
    origin,
    // jsdom's window is structurally narrower than the DOM lib's Window, but
    // it is the same object the receiver compares against.
    source: dom.window as unknown as MessageEventSource,
  })
  dom.window.dispatchEvent(event)
}

const validBody = { branch: { name: 'wh-078' }, loop: { active: false, round: 0 } }

beforeEach(() => reset())

test('an observed response lands in the cache under the reader’s key', () => {
  send({ source: OBSERVED_MESSAGE, url: BRANCH_STATUS_URL, body: validBody })
  assert.deepEqual(peek(branchStatusKey('workhorse', 'WH-078')), validBody)
})

test('a payload of the wrong shape is discarded', () => {
  send({ source: OBSERVED_MESSAGE, url: BRANCH_STATUS_URL, body: { nothing: true } })
  assert.equal(peek(branchStatusKey('workhorse', 'WH-078')), null)

  send({ source: OBSERVED_MESSAGE, url: BRANCH_STATUS_URL, body: 'a string' })
  assert.equal(peek(branchStatusKey('workhorse', 'WH-078')), null)
})

test('a message from another origin is ignored', () => {
  send({ source: OBSERVED_MESSAGE, url: BRANCH_STATUS_URL, body: validBody }, 'https://evil.example')
  assert.equal(peek(branchStatusKey('workhorse', 'WH-078')), null)
})

test('a message without the expected marker is ignored', () => {
  send({ url: BRANCH_STATUS_URL, body: validBody })
  send({ source: 'something-else', url: BRANCH_STATUS_URL, body: validBody })
  assert.equal(peek(branchStatusKey('workhorse', 'WH-078')), null)
})

test('a response for a path the extension does not read is ignored', () => {
  send({ source: OBSERVED_MESSAGE, url: `${ORIGIN}/api/create-pr`, body: validBody })
  assert.equal(peek('branch-status:workhorse:WH-078'), null)
})

test('malformed messages do not throw', () => {
  send(null)
  send('a string')
  send({ source: OBSERVED_MESSAGE })
  send({ source: OBSERVED_MESSAGE, url: 42, body: validBody })
  assert.equal(peek(branchStatusKey('workhorse', 'WH-078')), null)
})
