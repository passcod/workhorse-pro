import { test } from 'node:test'
import assert from 'node:assert/strict'
import { branchStatusKey, keyForUrl, recentSessionsKey, SIDEBAR_DATA_KEY } from '../src/data/keys.ts'
import { parseRoute } from '../src/lib/route.ts'

const BASE = 'https://workhorse.bes.au'

/**
 * The two directions have to agree. If a URL mapped to a key nothing reads,
 * observed responses would land in the cache unread and the optimisation
 * would silently do nothing at all. spec: DATA
 */

test('an observed branch-status URL maps to the key the reader builds', () => {
  const url = `${BASE}/api/card-branch-status?cardId=WH-078&workspace=workhorse`
  assert.equal(keyForUrl(url, BASE), branchStatusKey('workhorse', 'WH-078'))
})

test('branch status needs both parameters to be identifiable', () => {
  assert.equal(keyForUrl(`${BASE}/api/card-branch-status?cardId=WH-1`, BASE), null)
  assert.equal(keyForUrl(`${BASE}/api/card-branch-status?workspace=w`, BASE), null)
})

test('sidebar data maps to its key', () => {
  assert.equal(keyForUrl(`${BASE}/api/sidebar-data`, BASE), SIDEBAR_DATA_KEY)
})

test('a scoped session list is a different key from an unscoped one', () => {
  // The extension reads the unscoped list; the app reads a scoped one. They
  // are different data and must not overwrite each other.
  const unscoped = keyForUrl(`${BASE}/api/sessions?recent=true&limit=30`, BASE)
  const scoped = keyForUrl(`${BASE}/api/sessions?recent=true&limit=30&workspace=w`, BASE)
  assert.equal(unscoped, recentSessionsKey(30, null))
  assert.notEqual(unscoped, scoped)
})

test('a card-scoped session list is not a recent list', () => {
  assert.equal(keyForUrl(`${BASE}/api/sessions?cardId=abc`, BASE), null)
})

test('relative URLs resolve against the app origin', () => {
  assert.equal(keyForUrl('/api/sidebar-data', BASE), SIDEBAR_DATA_KEY)
})

test('paths outside the allowlist are ignored', () => {
  assert.equal(keyForUrl(`${BASE}/api/create-pr`, BASE), null)
  assert.equal(keyForUrl(`${BASE}/api/chat-history?x=1`, BASE), null)
})

test('cross-origin responses are never the app’s own reads', () => {
  assert.equal(keyForUrl('https://api.github.com/api/sidebar-data', BASE), null)
  assert.equal(keyForUrl('https://evil.example/api/sidebar-data', BASE), null)
})

test('unparseable input yields nothing rather than throwing', () => {
  assert.equal(keyForUrl('://nonsense', BASE), null)
})

test('a card route supplies both branch-status parameters', () => {
  assert.deepEqual(parseRoute('/workhorse/cards/WH-078'), {
    workspace: 'workhorse',
    card: 'WH-078',
  })
  assert.deepEqual(parseRoute('/workhorse/inbox/WH-078'), {
    workspace: 'workhorse',
    card: 'WH-078',
  })
})

test('non-card routes name their workspace but no card', () => {
  assert.deepEqual(parseRoute('/workhorse'), { workspace: 'workhorse', card: null })
  assert.deepEqual(parseRoute('/workhorse/sessions/abc'), {
    workspace: 'workhorse',
    card: null,
  })
  assert.deepEqual(parseRoute('/'), { workspace: null, card: null })
})

test('an encoded workspace slug is decoded', () => {
  assert.deepEqual(parseRoute('/my%20workspace/cards/WH-1'), {
    workspace: 'my workspace',
    card: 'WH-1',
  })
})
