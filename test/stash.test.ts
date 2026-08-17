import { test } from 'node:test'
import assert from 'node:assert/strict'
import { popStash, pushStash, stashPlaceholder } from '../src/lib/stash.ts'

test('pushing moves the composer onto the stack and empties it', () => {
  const result = pushStash([], 'a draft')
  assert.deepEqual(result.stack, ['a draft'])
  assert.equal(result.composer, '')
  assert.equal(result.changed, true)
})

test('pushing an empty composer does nothing', () => {
  const result = pushStash(['held'], '   ')
  assert.deepEqual(result.stack, ['held'])
  assert.equal(result.changed, false)
})

test('popping returns the top entry', () => {
  const result = popStash(['first', 'second'])
  assert.equal(result.composer, 'second')
  assert.deepEqual(result.stack, ['first'])
})

test('popping an empty stack does nothing', () => {
  const result = popStash([], 'text')
  assert.equal(result.changed, false)
  assert.equal(result.composer, 'text')
})

test('pushing then popping returns the composer to its starting text', () => {
  const pushed = pushStash([], 'original')
  const popped = popStash(pushed.stack, pushed.composer)
  assert.equal(popped.composer, 'original')
  assert.deepEqual(popped.stack, [])
})

test('popping into a composer with text exchanges the two', () => {
  // Nothing is destroyed: the composer's text goes on the stack as the top
  // entry comes off, so the pair can be cycled. spec: STSH
  const result = popStash(['stashed'], 'current')
  assert.equal(result.composer, 'stashed')
  assert.deepEqual(result.stack, ['current'])

  const back = popStash(result.stack, result.composer)
  assert.equal(back.composer, 'current')
  assert.deepEqual(back.stack, ['stashed'])
})

test('pushing during recall hands the held draft back', () => {
  // "Whatever it held before" is the user's own draft while recall is showing
  // something else, so pushing sets the old message aside and returns the
  // draft. spec: STSH
  const result = pushStash([], 'a recalled message', 'my unsent draft')
  assert.deepEqual(result.stack, ['a recalled message'])
  assert.equal(result.composer, 'my unsent draft')
})

test('the stack drops the oldest entry over its cap', () => {
  let stack: readonly string[] = []
  for (let i = 0; i < 4; i++) stack = pushStash(stack, `d${i}`, '', 2).stack
  assert.deepEqual(stack, ['d2', 'd3'])
})

test('the placeholder previews the first line of the most recent draft', () => {
  assert.equal(stashPlaceholder(['older', 'newest\nmore']), 'newest')
})

test('a single-line draft previews whole', () => {
  assert.equal(stashPlaceholder(['just this']), 'just this')
})

test('an empty stack has no preview', () => {
  assert.equal(stashPlaceholder([]), '')
})
