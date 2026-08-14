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
 * When each target was last clicked. A click that fails to change the state —
 * a mis-resolved anchor, say — would otherwise be repeated on every pass, and
 * a pass runs on every DOM change.
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

function prKey(card: string): string {
  return `${card}:pr`
}

function branchKey(card: string): string {
  return `${card}:branch`
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
      if (prefs.autoExpandPrDetail && !collapsedByUser.has(prKey(card))) {
        if (!anchors.prDetailExpanded()) {
          const toggle = anchors.prDetailToggle()
          if (toggle) click(prKey(card), toggle)
        }
      }

      if (prefs.autoExpandBranchDropdown && !collapsedByUser.has(branchKey(card))) {
        const dropdown = anchors.branchDropdown()
        if (dropdown?.getAttribute('aria-expanded') === 'false') {
          click(branchKey(card), dropdown)
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
