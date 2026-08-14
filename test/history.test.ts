import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendHistory,
  caretAllowsStep,
  migrateLegacyHistory,
  stepHistory,
} from '../src/lib/history.ts'

test('appending records a sent message', () => {
  assert.deepEqual(appendHistory([], 'hello'), ['hello'])
})

test('appending trims and ignores empty messages', () => {
  const entries = ['a']
  assert.equal(appendHistory(entries, '   '), entries)
  assert.deepEqual(appendHistory([], '  hi  '), ['hi'])
})

test('consecutive duplicates are recorded once', () => {
  // This is what makes double-recording harmless: a send the app refuses is
  // recorded, stays in the composer, and is recorded again when it really goes.
  const entries = appendHistory(['a'], 'b')
  assert.equal(appendHistory(entries, 'b'), entries)
  assert.deepEqual(appendHistory(entries, 'a'), ['a', 'b', 'a'])
})

test('history over the cap drops the oldest first', () => {
  let entries: readonly string[] = []
  for (let i = 0; i < 5; i++) entries = appendHistory(entries, `m${i}`, 3)
  assert.deepEqual(entries, ['m2', 'm3', 'm4'])
})

test('stepping older walks backwards from the newest', () => {
  const entries = ['one', 'two', 'three']
  const first = stepHistory(entries, null, 'older')
  assert.deepEqual(first, { kind: 'entry', index: 2, value: 'three' })
  assert.deepEqual(stepHistory(entries, 2, 'older'), {
    kind: 'entry',
    index: 1,
    value: 'two',
  })
})

test('stepping older stops at the oldest rather than wrapping', () => {
  assert.deepEqual(stepHistory(['a', 'b'], 0, 'older'), {
    kind: 'entry',
    index: 0,
    value: 'a',
  })
})

test('stepping newer past the newest asks for the held draft back', () => {
  assert.deepEqual(stepHistory(['a', 'b'], 1, 'newer'), { kind: 'restore' })
})

test('stepping does nothing when there is nothing to recall', () => {
  assert.equal(stepHistory([], null, 'older'), null)
  assert.equal(stepHistory(['a'], null, 'newer'), null)
})

test('the caret rule lets up recall only from the first line', () => {
  const value = 'first\nsecond'
  assert.equal(caretAllowsStep(value, 3, 3, 'older'), true)
  assert.equal(caretAllowsStep(value, 8, 8, 'older'), false)
})

test('the caret rule lets down recall only from the last line', () => {
  const value = 'first\nsecond'
  assert.equal(caretAllowsStep(value, 8, 8, 'newer'), true)
  assert.equal(caretAllowsStep(value, 3, 3, 'newer'), false)
})

test('recall may be entered from a composer that already has text', () => {
  // The rule is about the caret, not about the composer being empty — which is
  // what lets a draft be held aside rather than blocking recall. spec: HIST
  assert.equal(caretAllowsStep('a draft', 0, 0, 'older'), true)
  assert.equal(caretAllowsStep('a draft', 7, 7, 'older'), true)
})

test('a selection suppresses recall', () => {
  assert.equal(caretAllowsStep('abc', 0, 3, 'older'), false)
  assert.equal(caretAllowsStep('abc', 0, 3, 'newer'), false)
})

test("the app's per-conversation history is flattened oldest first", () => {
  const legacy = JSON.stringify({
    newer: { entries: ['c', 'd'], updatedAt: 200 },
    older: { entries: ['a', 'b'], updatedAt: 100 },
  })
  assert.deepEqual(migrateLegacyHistory(legacy), ['a', 'b', 'c', 'd'])
})

test('malformed legacy history yields nothing rather than throwing', () => {
  assert.deepEqual(migrateLegacyHistory(null), [])
  assert.deepEqual(migrateLegacyHistory('not json'), [])
  assert.deepEqual(migrateLegacyHistory('[]'), [])
  assert.deepEqual(migrateLegacyHistory(JSON.stringify({ k: { entries: 'no' } })), [])
  assert.deepEqual(
    migrateLegacyHistory(JSON.stringify({ k: { entries: ['a', 5, null], updatedAt: 1 } })),
    ['a'],
  )
})
