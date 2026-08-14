import { anchors } from '../content/anchors.ts'
import { ensureAfter, el, remove } from '../content/dom.ts'
import type { Context, Feature } from '../content/reconcile.ts'
import { caretAllowsStep, stepHistory } from '../lib/history.ts'
import { matchesBinding } from '../lib/keys.ts'
import { popStash, pushStash } from '../lib/stash.ts'
import { getHistory, getStash, recordSent, setStash } from '../localData.ts'
import type { Prefs } from '../prefs.ts'

/**
 * Input history and the stash.
 *
 * Built as one module because the two share the composer's held draft: pushing
 * while recalling stashes the recalled message and hands the draft back, which
 * neither feature can implement alone. spec: HIST, STSH
 */

/** The app's own draft store, which recall has to be careful not to cost. */
const DRAFTS_KEY = 'workhorse:chat-drafts'
const BADGE = 'stash-badge'

/** Writing through this makes React's own change handler run. */
const nativeValue = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  'value',
)?.set

let composer: HTMLTextAreaElement | null = null
let prefs: Prefs | null = null

/** Position in history while recalling; null when not. */
let historyIndex: number | null = null
/** The user's own text, held aside while recall shows something else. */
let heldDraft: string | null = null
/** The app's whole draft store as it was when recall began. */
let draftSnapshot: string | null = null
/** True while this module is writing, so its own input event is ignored. */
let applying = false

function readDrafts(): string | null {
  try {
    return localStorage.getItem(DRAFTS_KEY)
  } catch {
    return null
  }
}

function writeDrafts(value: string): void {
  try {
    localStorage.setItem(DRAFTS_KEY, value)
  } catch {
    // A full or unavailable store is the app's own failure mode too.
  }
}

/**
 * Put text in the composer as though the user had typed it, so the app's
 * change handler runs and its draft retention and auto-resize behave normally.
 */
function setValue(element: HTMLTextAreaElement, text: string): void {
  applying = true
  try {
    nativeValue?.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
    element.setSelectionRange(text.length, text.length)
    element.focus()
  } finally {
    applying = false
  }
}

function beginRecall(element: HTMLTextAreaElement): void {
  heldDraft = element.value
  // Snapshotting the whole store sidesteps having to know which conversation
  // the composer belongs to — the app does not render its draft key, and
  // recall cannot move between composers without unmounting this one, so
  // there is no other conversation's draft in the window to clobber.
  draftSnapshot = readDrafts()
}

/**
 * Leave recall.
 *
 * `restoreDrafts` is for the exits the user did not choose — the tab closing,
 * a navigation, the composer being removed. Recalled text has by then been
 * written to the app's draft store, so without this the user's own work would
 * be gone. The snapshot is written directly, ahead of the delay the app
 * applies to recording drafts, so it is not overtaken. spec: HIST
 */
function endRecall(restoreDrafts: boolean): void {
  if (restoreDrafts && historyIndex !== null && draftSnapshot !== null) {
    writeDrafts(draftSnapshot)
  }
  historyIndex = null
  heldDraft = null
  draftSnapshot = null
}

function step(element: HTMLTextAreaElement, direction: 'older' | 'newer'): boolean {
  if (
    !caretAllowsStep(element.value, element.selectionStart, element.selectionEnd, direction)
  ) {
    return false
  }
  const next = stepHistory(getHistory(), historyIndex, direction)
  if (!next) return false

  if (next.kind === 'restore') {
    // Stepping past the newest message puts the held draft back rather than
    // emptying the composer. Writing it through the composer makes it the
    // app's draft again, so no snapshot restore is needed.
    setValue(element, heldDraft ?? '')
    endRecall(false)
    return true
  }

  if (historyIndex === null) beginRecall(element)
  historyIndex = next.index
  setValue(element, next.value)
  return true
}

function push(element: HTMLTextAreaElement): void {
  // "Whatever it held before" is empty in the ordinary case and the held draft
  // during recall — one rule, both cases. spec: STSH
  const previous = historyIndex !== null ? (heldDraft ?? '') : ''
  const result = pushStash(getStash(), element.value, previous)
  if (!result.changed) return
  setStash(result.stack)
  setValue(element, result.composer)
  endRecall(false)
}

function pop(element: HTMLTextAreaElement): void {
  const result = popStash(getStash(), element.value)
  if (!result.changed) return
  setStash(result.stack)
  setValue(element, result.composer)
  endRecall(false)
}

function onKeyDown(event: KeyboardEvent): void {
  const element = event.currentTarget as HTMLTextAreaElement
  if (!prefs) return
  const bare = !event.ctrlKey && !event.metaKey && !event.shiftKey

  // The stash's bindings are the user's to set, because the good ones are
  // exactly the ones already taken by something — a browser, a desktop, another
  // editor. Both are prevented so whatever the binding would otherwise do does
  // not happen over the app. spec: STSH
  if (prefs.composerStash) {
    if (matchesBinding(event, prefs.stashPushKey)) {
      event.preventDefault()
      push(element)
      return
    }
    if (matchesBinding(event, prefs.stashPopKey)) {
      event.preventDefault()
      pop(element)
      return
    }
  }

  if (prefs.inputHistory && !event.altKey && bare) {
    // Recall keeps the bare arrows; the stash no longer uses them at all.
    if (event.key === 'ArrowUp' && step(element, 'older')) {
      event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown' && step(element, 'newer')) {
      event.preventDefault()
      return
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    // Recorded before the send goes out, so the message survives a send that
    // is lost. A send the app refuses records text that stays in the composer
    // and is recorded again later; consecutive duplicates collapse. spec: HIST
    if (prefs.inputHistory) recordSent(element.value)
    endRecall(false)
  }
}

function onInput(): void {
  // Editing leaves recall — the text is a draft now, and a further recall
  // holds that instead.
  if (!applying) endRecall(false)
}

/**
 * Catch sends made by clicking rather than pressing Enter, without having to
 * identify the send button: any click that empties the composer was a send.
 * An ordinary click leaves the value alone and records nothing.
 */
function onClickCapture(): void {
  const element = composer
  if (!element || !prefs?.inputHistory) return
  const before = element.value
  if (!before.trim()) return
  requestAnimationFrame(() => {
    if (composer === element && element.value === '') {
      recordSent(before)
      endRecall(false)
    }
  })
}

function onPageHide(): void {
  endRecall(true)
}

function attach(element: HTMLTextAreaElement): void {
  composer = element
  element.addEventListener('keydown', onKeyDown)
  element.addEventListener('input', onInput)
}

export function composerFeature(): Feature {
  document.addEventListener('click', onClickCapture, true)
  window.addEventListener('pagehide', onPageHide)

  return {
    name: 'composer',
    reconcile({ prefs: current }: Context) {
      prefs = current
      const element = anchors.composer()

      if (composer && composer !== element) {
        // The composer this module was bound to has gone — a soft navigation
        // looks exactly like this. Recall ends by a route the user did not
        // choose, so the held draft goes back. spec: HIST
        endRecall(true)
        composer = null
      }

      if (!element) {
        remove(BADGE)
        return
      }
      if (composer !== element) attach(element)

      const depth = getStash().length
      if (current.composerStash && depth > 0) {
        // The count doubles as the control: a stash whose only way back is a
        // binding is one the user has to remember, and the depth is already
        // sitting there saying there is something to bring back.
        const badge = ensureAfter(element, BADGE, () => {
          const button = el('button', 'whp-stash-badge')
          button.type = 'button'
          button.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            if (composer) pop(composer)
          })
          return button
        })
        badge.textContent = `${depth} stashed`
        badge.title = current.stashPopKey
          ? `Restore the last stashed draft (${current.stashPopKey})`
          : 'Restore the last stashed draft'
      } else {
        remove(BADGE)
      }
    },
  }
}
