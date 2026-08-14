import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scopeGlyphColours, workspaceColours } from '../src/lib/colours.ts'

/**
 * These reproduce the app's own derivation. The point of testing them is that
 * a workspace must carry the same colour in the extension's list as the app
 * gives it, so the assertions mirror the app's own suite. spec: SCOP
 */

function hueOf(colour: string): number {
  const match = /^oklch\([\d.]+ [\d.]+ ([\d.]+)\)$/.exec(colour)
  assert.ok(match, `unexpected colour form: ${colour}`)
  return Number(match[1])
}

test('every workspace takes its own colour', () => {
  for (let n = 1; n <= 12; n++) {
    const names = Array.from({ length: n }, (_, i) => `workspace-${i}`)
    const colours = workspaceColours(names)
    assert.equal(colours.size, n)
    assert.equal(new Set(colours.values()).size, n)
  }
})

test('names are keyed lower-cased and deduplicated', () => {
  const colours = workspaceColours(['Alpha', 'alpha', 'BETA'])
  assert.equal(colours.size, 2)
  assert.ok(colours.has('alpha'))
  assert.ok(colours.has('beta'))
})

test('hues stay inside the allowed arc', () => {
  const colours = workspaceColours(['a', 'b', 'c', 'd', 'e'])
  for (const colour of colours.values()) {
    const hue = hueOf(colour)
    assert.ok(hue >= 0 && hue <= 265, `hue out of range: ${hue}`)
  }
})

test('a single workspace takes the start of the arc', () => {
  const colours = workspaceColours(['only'])
  assert.equal(hueOf(colours.get('only')!), 0)
})

test('the assignment is stable between runs', () => {
  const names = ['zebra', 'apple', 'mango']
  assert.deepEqual([...workspaceColours(names)], [...workspaceColours(names)])
  // And independent of the order they arrive in.
  assert.deepEqual(
    [...workspaceColours(names)].sort(),
    [...workspaceColours([...names].reverse())].sort(),
  )
})

test('the scope glyph samples four colours', () => {
  assert.deepEqual(scopeGlyphColours(['a', 'b']), ['a', 'b', 'a', 'b'])
  assert.deepEqual(scopeGlyphColours(['a', 'b', 'c', 'd']), ['a', 'b', 'c', 'd'])
  assert.equal(scopeGlyphColours(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).length, 4)
  assert.deepEqual(scopeGlyphColours([]), [])
})
