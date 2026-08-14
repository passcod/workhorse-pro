import { anchors } from '../content/anchors.ts'
import { writeComposer } from '../content/dom.ts'
import { cornerDownLeftIcon } from '../content/icons.ts'
import { marked, type Context, type Feature } from '../content/reconcile.ts'
import { foldReturnedText, renderedMessageText } from '../lib/queuedRevert.ts'

/**
 * A control on each queued message that reverts it into the composer.
 *
 * While a turn runs, messages typed into the composer are queued and delivered
 * when it ends. The app reveals a discard control on each; this sits a revert
 * control beside it, which folds the message's text back into the composer and
 * then drops the message from the queue through the app's own discard — so the
 * queue heals exactly as it would from a plain discard. spec: QRV
 */

const ID = 'data-whp-id'
const REVERT = 'queued-revert'
/** Marks a queued message's container, so its revert control reveals on hover. */
const CONTAINER = 'data-whp-queued'

/**
 * The message's body from its discard control.
 *
 * The body is the discard control's next sibling when the message is grouped
 * under the one above (no header, the discard floats over the message), and the
 * header row's next sibling when the message shows a header (the discard is the
 * last thing in that row). One expression covers both. spec: QRV
 */
function bodyFor(discard: Element): Element | null {
  return discard.nextElementSibling ?? discard.parentElement?.nextElementSibling ?? null
}

function createButton(grouped: boolean): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = grouped ? 'whp-queued-revert whp-queued-revert-grouped' : 'whp-queued-revert'
  button.title = 'Revert this queued message to the input'
  button.setAttribute('aria-label', 'Revert queued message to input')
  button.appendChild(cornerDownLeftIcon(14))
  button.setAttribute(ID, REVERT)
  marked(button)

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    // The discard control is resolved fresh from the DOM rather than captured,
    // so a re-render that replaced it does not leave a stale handle behind.
    const discard = button.nextElementSibling
    if (!discard) return
    const composer = anchors.composer()
    const body = bodyFor(discard)
    if (composer && body) {
      const text = renderedMessageText(body)
      if (text) writeComposer(composer, foldReturnedText(composer.value, text))
    }
    // Leave the queue through the app's own discard, keeping the others' order.
    ;(discard as HTMLElement).click()
  })

  return button
}

export function queuedRevert(): Feature {
  return {
    name: 'queuedRevert',
    reconcile({ prefs }: Context) {
      const discards = prefs.queuedRevert ? anchors.queuedDiscards() : []
      const live = new Set(discards)

      // Drop any revert control no longer sitting before a live discard — a
      // message that has since been delivered, or the feature switched off.
      for (const button of document.querySelectorAll(`[${ID}="${REVERT}"]`)) {
        const next = button.nextElementSibling
        if (!next || !live.has(next as HTMLElement)) button.remove()
      }

      const containers = new Set<Element>()
      for (const discard of discards) {
        const container = bodyFor(discard)?.parentElement
        if (container) {
          container.setAttribute(CONTAINER, '')
          containers.add(container)
        }
        const previous = discard.previousElementSibling
        if (previous?.getAttribute(ID) === REVERT) continue
        // Grouped when the body follows the discard directly (no header row).
        discard.before(createButton(discard.nextElementSibling !== null))
      }

      // Clear the hover mark from any container that no longer holds a control.
      for (const node of document.querySelectorAll(`[${CONTAINER}]`)) {
        if (!containers.has(node)) node.removeAttribute(CONTAINER)
      }
    },
  }
}
