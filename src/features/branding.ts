import { anchors, BRAND_ORIGINAL } from '../content/anchors.ts'
import { el, ensureBefore, remove } from '../content/dom.ts'
import type { Context, Feature } from '../content/reconcile.ts'

/**
 * Put Workhorse Pro's own branding in the sidebar's top corner.
 *
 * The app's wordmark reads "Workhorse" beside a burnt-orange tile carrying a
 * "W"; here it reads "Prohorse" and the tile carries a horse. The tile itself
 * is kept — same square, same radius, same accent — because it is what makes
 * the corner read as Workhorse-shaped, and because a bare glyph has nothing
 * holding the corner in the retracted rail, where there is no wordmark beside
 * it.
 *
 * That rail is all the branding on show while the sidebar is minimised, so its
 * mark is swapped too — otherwise collapsing the sidebar brings the app's own
 * mark back.
 *
 * Nothing the app rendered is ever detached. The mark is hidden and the
 * extension's own sits beside it, because removing a node React still holds
 * makes React throw when it later unmounts it — a crash in the app, which is
 * further than any of this is worth. spec: BRND
 */

const WORDMARK = 'Prohorse'
const MARK_EMOJI = '🐴'

const HEADER_MARK_ID = 'brand-mark'
const RAIL_MARK_ID = 'brand-mark-rail'

/** The app's tile, rebuilt with a horse on it, sized to sit where it sat. */
function emojiMark(): HTMLSpanElement {
  const node = el('span', 'whp-brand-mark', MARK_EMOJI)
  // Decorative, exactly as the app's own mark is: the wordmark beside it
  // carries the name, and in the rail there is no name to carry.
  node.setAttribute('aria-hidden', 'true')
  return node
}

/**
 * Swap an app-rendered mark for the extension's own, or put the app's back.
 *
 * The extension's mark is a sibling rather than a child because the app's mark
 * is an svg, and the emoji is text.
 */
function applyMark(mark: SVGElement | null, id: string, on: boolean): void {
  if (!mark) return
  const parent = mark.parentElement
  if (!parent) return

  if (!on) {
    if (mark.hasAttribute(BRAND_ORIGINAL)) {
      mark.style.removeProperty('display')
      mark.removeAttribute(BRAND_ORIGINAL)
    }
    remove(id, parent)
    return
  }

  if (!mark.hasAttribute(BRAND_ORIGINAL)) {
    mark.style.setProperty('display', 'none')
    mark.setAttribute(BRAND_ORIGINAL, '')
  }
  ensureBefore(mark, id, emojiMark)
}

export function branding(): Feature {
  return {
    name: 'branding',
    reconcile({ prefs }: Context) {
      const wordmark = anchors.wordmark()
      const on = prefs.proWordmark

      if (wordmark) {
        if (on) {
          if (!wordmark.hasAttribute(BRAND_ORIGINAL)) {
            wordmark.setAttribute(BRAND_ORIGINAL, wordmark.textContent ?? '')
          }
          // Only when it differs. A write is a mutation, a mutation schedules
          // another pass, and a pass that changes nothing is what makes the
          // loop settle. spec: INJ
          if (wordmark.textContent !== WORDMARK) wordmark.textContent = WORDMARK
        } else if (wordmark.hasAttribute(BRAND_ORIGINAL)) {
          const original = wordmark.getAttribute(BRAND_ORIGINAL) ?? ''
          if (wordmark.textContent !== original) wordmark.textContent = original
          wordmark.removeAttribute(BRAND_ORIGINAL)
        }
      }

      applyMark(anchors.brandMark(), HEADER_MARK_ID, on)
      applyMark(anchors.railBrandMark(), RAIL_MARK_ID, on)
    },
  }
}
