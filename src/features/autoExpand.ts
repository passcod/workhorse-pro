import { anchors } from '../content/anchors.ts'
import type { Context, Feature } from '../content/reconcile.ts'

/**
 * Open the pull request detail and the branch dropdown when a card is shown,
 * so the detail is in front of the user rather than behind two chevrons.
 *
 * The feature is only useful if it yields to a deliberate collapse, which is
 * what the collapsed-by-user set is for. It is held in memory for the page
 * session: a reload is a fresh start. spec: AEXP
 */

const collapsedByUser = new Set<string>()

/**
 * True while the extension is dispatching a click, so the listener below can
 * tell the extension's own expansion from the user's. Without it, opening a
 * section would read as the user having chosen to open it.
 */
let synthetic = false

/**
 * When each target was last clicked without the section opening.
 *
 * A click that fails to change anything — a mis-resolved anchor, say — would
 * otherwise be repeated on every pass, and a pass runs on every DOM change.
 * The record is dropped as soon as the section is seen open, so it only ever
 * holds while a click looks ineffective: a section legitimately re-collapsing
 * and needing opening again is not delayed by an earlier success.
 */
const lastClick = new Map<string, number>()
const CLICK_COOLDOWN = 1_000

function click(key: string, element: HTMLElement): void {
  const previous = lastClick.get(key) ?? 0
  if (Date.now() - previous < CLICK_COOLDOWN) return
  lastClick.set(key, Date.now())
  synthetic = true
  try {
    element.click()
  } finally {
    synthetic = false
  }
}

/**
 * Open `element` unless the user closed it, or it is already open.
 *
 * Seeing it open is what clears the ineffective-click record, so this is the
 * single place both halves of that rule live.
 */
function ensureOpen(key: string, isExpanded: () => boolean, element: HTMLElement | null): void {
  if (isExpanded()) {
    lastClick.delete(key)
    return
  }
  if (!element) return
  if (collapsedByUser.has(key)) return
  click(key, element)
  // Re-read rather than waiting for the next pass. The app's own sections
  // re-render asynchronously, so this usually still reads closed and the
  // record clears on the pass that re-render triggers — but where the change
  // is synchronous, holding the record would block the next legitimate open.
  if (isExpanded()) lastClick.delete(key)
}

function prKey(card: string): string {
  return `${card}:pr`
}

function branchKey(card: string): string {
  return `${card}:branch`
}

/**
 * The disclosure rows the extension's own readings hang inside.
 *
 * Only Review Hero: the Checks row is flat, so its breakdown and named jobs
 * hang beneath it as siblings and are in view whenever the row is, with nothing
 * to open.
 */
function rowTargets(): { key: string; element: HTMLElement | null }[] {
  return [{ key: 'review', element: anchors.reviewRow() as HTMLElement | null }]
}

/**
 * Record a deliberate collapse. Runs in the capture phase so it reads the
 * state before the app's own handler changes it.
 */
function watchForUserCollapse(getCard: () => string | null): void {
  document.addEventListener(
    'click',
    (event) => {
      if (synthetic) return
      const card = getCard()
      if (!card) return
      const target = event.target as Element | null
      if (!target) return

      const prToggle = anchors.prDetailToggle()
      if (prToggle && (target === prToggle || prToggle.contains(target))) {
        if (anchors.prDetailExpanded()) collapsedByUser.add(prKey(card))
        else collapsedByUser.delete(prKey(card))
        return
      }

      const dropdown = anchors.branchDropdown()
      if (dropdown && (target === dropdown || dropdown.contains(target))) {
        if (dropdown.getAttribute('aria-expanded') === 'true') {
          collapsedByUser.add(branchKey(card))
        } else {
          collapsedByUser.delete(branchKey(card))
        }
        return
      }

      for (const { key, element } of rowTargets()) {
        if (!element || (target !== element && !element.contains(target))) continue
        const rowKey = `${card}:${key}`
        if (element.getAttribute('aria-expanded') === 'true') collapsedByUser.add(rowKey)
        else collapsedByUser.delete(rowKey)
        return
      }
    },
    true,
  )
}

export function autoExpand(): Feature {
  let card: string | null = null
  watchForUserCollapse(() => card)

  return {
    name: 'autoExpand',
    reconcile({ prefs, route }: Context) {
      card = route.card
      if (!card) return

      // The extension only ever opens a section, never closes one, so it
      // cannot conflict with the app opening one of its own accord — which it
      // does when it detects upstream conflicts. spec: AEXP
      if (prefs.autoExpandPrDetail) {
        ensureOpen(prKey(card), () => anchors.prDetailExpanded(), anchors.prDetailToggle())
      }

      if (prefs.autoExpandBranchDropdown) {
        const dropdown = anchors.branchDropdown()
        if (dropdown) {
          ensureOpen(
            branchKey(card),
            () => dropdown.getAttribute('aria-expanded') === 'true',
            dropdown,
          )
        }
      }

      // The review run stats live inside the Review Hero row, so opening it is
      // what puts those readings in view without a click.
      if (prefs.autoExpandRows) {
        for (const { key, element } of rowTargets()) {
          if (!element) continue
          ensureOpen(
            `${card}:${key}`,
            () => element.getAttribute('aria-expanded') === 'true',
            element,
          )
        }
      }
    },
  }
}

/** Test seam. */
export function resetAutoExpand(): void {
  collapsedByUser.clear()
  lastClick.clear()
}
