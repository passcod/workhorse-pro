import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom } from './dom.ts'

installDom()
const { read, put, peek, reset, subscribe } = await import('../src/data/store.ts')

beforeEach(() => reset())

/** Yield long enough for a resolved fetch to land in the cache. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

test('the first read has nothing and fetches', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return 'value'
  }

  assert.equal(read('k', fetcher, { ttl: 1000 }), null)
  await tick()
  assert.equal(read('k', fetcher, { ttl: 1000 }), 'value')
  assert.equal(calls, 1)
})

test('a fresh value is served without another request', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return calls
  }

  read('k', fetcher, { ttl: 10_000 })
  await tick()
  for (let i = 0; i < 5; i++) read('k', fetcher, { ttl: 10_000 })
  await tick()
  assert.equal(calls, 1)
})

test('concurrent reads of the same key issue one request', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    await tick()
    return 'value'
  }

  read('k', fetcher, { ttl: 1000 })
  read('k', fetcher, { ttl: 1000 })
  read('k', fetcher, { ttl: 1000 })
  await tick()
  await tick()
  assert.equal(calls, 1)
})

test('an observed response satisfies the read without a request', async () => {
  // This is the whole of what observation does: one read path, populated by
  // either source, with no separate mode. spec: DATA
  let calls = 0
  const fetcher = async () => {
    calls++
    return 'fetched'
  }

  put('k', 'observed')
  assert.equal(read('k', fetcher, { ttl: 10_000 }), 'observed')
  await tick()
  assert.equal(calls, 0)
})

test('a stale value is still served while it refreshes', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return `value-${calls}`
  }

  read('k', fetcher, { ttl: 0 })
  await tick()
  // Stale immediately, but the old value is what renders rather than a blank.
  assert.equal(read('k', fetcher, { ttl: 0 }), 'value-1')
  await tick()
  assert.equal(peek('k'), 'value-2')
})

test('a failed read keeps the last value and backs off', async () => {
  let calls = 0
  let fail = false
  const fetcher = async () => {
    calls++
    if (fail) throw new Error('boom')
    return 'good'
  }

  read('k', fetcher, { ttl: 0 })
  await tick()
  assert.equal(peek('k'), 'good')

  fail = true
  read('k', fetcher, { ttl: 0 })
  await tick()
  // The value survives the failure rather than the row blanking.
  assert.equal(peek('k'), 'good')

  const after = calls
  // Backed off: repeated reads do not retry immediately.
  for (let i = 0; i < 5; i++) read('k', fetcher, { ttl: 0 })
  await tick()
  assert.equal(calls, after)
})

test('a key that never resolves does not retry on every read', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    throw new Error('always')
  }

  for (let i = 0; i < 10; i++) read('k', fetcher, { ttl: 0 })
  await tick()
  assert.equal(calls, 1)
})

test('subscribers are told when data lands', async () => {
  let notified = 0
  subscribe(() => notified++)
  read('k', async () => 'value', { ttl: 1000 })
  await tick()
  assert.ok(notified >= 1)

  const before = notified
  put('k2', 'observed')
  assert.equal(notified, before + 1)
})
