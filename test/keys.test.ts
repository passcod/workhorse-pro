import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bindingFromEvent,
  bindingProblem,
  formatBinding,
  isModifierKey,
  matchesBinding,
  parseBinding,
} from '../src/lib/keys.ts'

function press(key: string, mods: Partial<Record<'ctrl' | 'alt' | 'shift' | 'meta', boolean>> = {}) {
  return {
    key,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    shiftKey: mods.shift ?? false,
    metaKey: mods.meta ?? false,
  }
}

test('a press becomes a binding in a fixed spelling', () => {
  assert.equal(formatBinding(bindingFromEvent(press('s', { ctrl: true }))), 'Ctrl+S')
  assert.equal(
    formatBinding(bindingFromEvent(press('p', { ctrl: true, shift: true }))),
    'Ctrl+Shift+P',
  )
  assert.equal(formatBinding(bindingFromEvent(press('ArrowUp', { alt: true }))), 'Alt+ArrowUp')
})

test('the spelling does not depend on the order modifiers were pressed', () => {
  const a = formatBinding(bindingFromEvent(press('k', { ctrl: true, shift: true, alt: true })))
  const b = formatBinding(bindingFromEvent(press('K', { alt: true, shift: true, ctrl: true })))
  assert.equal(a, b)
})

test('a bare modifier is not a binding', () => {
  for (const key of ['Control', 'Shift', 'Alt', 'Meta']) {
    assert.equal(isModifierKey(key), true)
    assert.equal(bindingFromEvent(press(key, { ctrl: true })), null)
  }
})

test('a written binding round-trips', () => {
  for (const text of ['Ctrl+S', 'Ctrl+Shift+P', 'Alt+ArrowUp', 'Ctrl+Alt+Shift+Meta+K']) {
    assert.equal(formatBinding(parseBinding(text)), text)
  }
})

test('modifier names are read generously', () => {
  assert.equal(formatBinding(parseBinding('control+s')), 'Ctrl+S')
  assert.equal(formatBinding(parseBinding('cmd+s')), 'Meta+S')
  assert.equal(formatBinding(parseBinding('option+s')), 'Alt+S')
})

test('an unrecognised modifier is refused rather than ignored', () => {
  // Dropping it silently would widen what matches, which is worse than
  // refusing the binding.
  assert.equal(parseBinding('Hyper+S'), null)
})

test('matching requires every modifier to agree', () => {
  assert.equal(matchesBinding(press('s', { ctrl: true }), 'Ctrl+S'), true)
  assert.equal(matchesBinding(press('S', { ctrl: true }), 'Ctrl+S'), true)
  assert.equal(matchesBinding(press('s', { ctrl: true, shift: true }), 'Ctrl+S'), false)
  assert.equal(matchesBinding(press('s', { alt: true }), 'Ctrl+S'), false)
  assert.equal(matchesBinding(press('a', { ctrl: true }), 'Ctrl+S'), false)
})

test('an empty binding matches nothing', () => {
  assert.equal(matchesBinding(press('s', { ctrl: true }), ''), false)
  assert.equal(matchesBinding(press('s', { ctrl: true }), '   '), false)
})

test('a binding with no modifier is refused', () => {
  // It would swallow ordinary typing, and the bare arrows belong to recall.
  assert.match(bindingProblem('S') ?? '', /Ctrl, Alt or Meta/)
  assert.match(bindingProblem('ArrowUp') ?? '', /Ctrl, Alt or Meta/)
  assert.match(bindingProblem('Shift+S') ?? '', /Ctrl, Alt or Meta/)
})

test('a usable binding has no complaint, and unbound is allowed', () => {
  assert.equal(bindingProblem('Ctrl+S'), null)
  assert.equal(bindingProblem('Alt+K'), null)
  assert.equal(bindingProblem('Meta+P'), null)
  assert.equal(bindingProblem(''), null)
})

test('nonsense is refused with an explanation', () => {
  assert.match(bindingProblem('Hyper+S') ?? '', /Not a binding/)
})
