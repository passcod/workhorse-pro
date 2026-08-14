/**
 * Keyboard bindings, as text the user can read and edit.
 *
 * A binding is written modifiers-first in a fixed order — `Ctrl+Shift+S` — so
 * the same combination always has one spelling, whichever order the user
 * happened to press it in. Pure, so the parsing and matching can be exercised
 * without a DOM. spec: STSH
 */

export interface KeyEventLike {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

export interface Binding {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** The key itself, upper-cased for single characters. */
  key: string
}

/** Keys that are only ever modifiers, and so cannot be a binding on their own. */
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'OS'])

function normaliseKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key
}

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key)
}

/** The binding a key press describes, or null for a bare modifier. */
export function bindingFromEvent(event: KeyEventLike): Binding | null {
  if (isModifierKey(event.key)) return null
  return {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    key: normaliseKey(event.key),
  }
}

export function formatBinding(binding: Binding | null): string {
  if (!binding) return ''
  const parts: string[] = []
  if (binding.ctrl) parts.push('Ctrl')
  if (binding.alt) parts.push('Alt')
  if (binding.shift) parts.push('Shift')
  if (binding.meta) parts.push('Meta')
  parts.push(binding.key)
  return parts.join('+')
}

/** Read a written binding. Returns null for empty or unparseable input. */
export function parseBinding(text: string): Binding | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const parts = trimmed.split('+').map((part) => part.trim()).filter(Boolean)
  const key = parts.pop()
  if (!key) return null

  const binding: Binding = { ctrl: false, alt: false, shift: false, meta: false, key: normaliseKey(key) }
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case 'ctrl':
      case 'control':
        binding.ctrl = true
        break
      case 'alt':
      case 'option':
        binding.alt = true
        break
      case 'shift':
        binding.shift = true
        break
      case 'meta':
      case 'cmd':
      case 'command':
      case 'super':
        binding.meta = true
        break
      default:
        // An unrecognised modifier would silently widen what matches.
        return null
    }
  }
  return binding
}

/** Whether a key press is this binding. Every modifier must match exactly. */
export function matchesBinding(event: KeyEventLike, text: string): boolean {
  const binding = parseBinding(text)
  if (!binding) return false
  return (
    event.ctrlKey === binding.ctrl &&
    event.altKey === binding.alt &&
    event.shiftKey === binding.shift &&
    event.metaKey === binding.meta &&
    normaliseKey(event.key) === binding.key
  )
}

/**
 * Why a binding is not usable, or null when it is.
 *
 * A binding with no modifier would swallow ordinary typing — and the bare
 * arrows in particular belong to history recall, which shares this composer.
 */
export function bindingProblem(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null // Unbound is a legitimate choice.
  const binding = parseBinding(trimmed)
  if (!binding) return 'Not a binding this understands.'
  if (!binding.ctrl && !binding.alt && !binding.meta) {
    return 'Needs Ctrl, Alt or Meta — without one it would swallow ordinary typing.'
  }
  return null
}
