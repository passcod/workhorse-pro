/**
 * Every handle onto the app's markup.
 *
 * Each anchor prefers a `data-wh-*` attribute and falls back to structure or
 * visible label text. The fallbacks are the fragile part of this extension by
 * construction, which is why they are all in one file and each records what it
 * stands in for — when the app grows the attribute, the fallback is deleted
 * rather than tracked down.
 *
 * Nothing here matches on utility class names. Those exist in the compiled
 * stylesheet only while some component uses them, so a class-based selector
 * can stop matching because of a change nowhere near the markup it targets.
 * spec: INJ
 */

import { MARK } from './reconcile.ts'

/**
 * Where the extension records the name the app's own wordmark carried, so it
 * can put it back. It sits on the app's element rather than in the extension,
 * because the app can rebuild that element at any time and a value held aside
 * would then be restored onto the wrong node. spec: BRND
 */
export const BRAND_ORIGINAL = 'data-whp-brand'

/** Text content of an element's first child element, trimmed. */
function labelOf(element: Element): string {
  return element.firstElementChild?.textContent?.trim() ?? ''
}

/**
 * A disclosure row in the pull request section, found by its visible label.
 *
 * The app renders these as a header carrying `aria-expanded` whose first child
 * is the label, followed by a content block when open.
 */
function disclosureByLabel(label: string, root: ParentNode = document): Element | null {
  for (const candidate of root.querySelectorAll('[aria-expanded]')) {
    if (labelOf(candidate) === label) return candidate
  }
  return null
}

/** The content block a disclosure row reveals, or null when it is closed. */
function disclosureContent(row: Element | null): Element | null {
  if (!row) return null
  if (row.getAttribute('aria-expanded') !== 'true') return null
  // A notice paragraph can sit between the header and its content; the content
  // is the first following div.
  let sibling = row.nextElementSibling
  while (sibling && sibling.tagName !== 'DIV') sibling = sibling.nextElementSibling
  return sibling
}

export const anchors = {
  /** The message composer. */
  composer(): HTMLTextAreaElement | null {
    return (
      document.querySelector<HTMLTextAreaElement>('[data-wh-composer]') ??
      // Fallback: the app renders exactly one textarea on a card or session
      // page, and it is the composer.
      document.querySelector<HTMLTextAreaElement>('textarea')
    )
  },

  /** The control that expands the pull request detail section. */
  prDetailToggle(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-pr-toggle]')
    if (hooked) return hooked
    // Fallback: the bar's title row is the toggle. It carries no title of its
    // own, but its chevron carries the app's own test id — `pr-create-chevron`
    // before a PR exists, `pr-detail-chevron` once one does. Resolving through
    // the chevron and climbing to its button keeps the whole title row as the
    // hit area, and never returns the Create button or the kebab beside it.
    const chevron = document.querySelector(
      '[data-testid="pr-detail-chevron"], [data-testid="pr-create-chevron"]',
    )
    const button = chevron?.closest('button')
    return button instanceof HTMLElement ? button : null
  },

  /**
   * Whether the pull request detail is open.
   *
   * Fallback: the branch rows only render inside the expanded detail, so the
   * presence of the branch disclosure is the state.
   */
  prDetailExpanded(): boolean {
    const hooked = document.querySelector('[data-wh-pr-expanded]')
    if (hooked) return hooked.getAttribute('data-wh-pr-expanded') === 'true'
    return this.branchDropdown() !== null
  },

  /**
   * The branch diagnostics disclosure, which carries its own expanded state.
   *
   * Fallback: the app labels the row "Merge into" and gives the row itself the
   * native tooltip "Branch detail", with its chevron carrying the app's own
   * test id. The chevron is the surer handle — the tooltip is prose and the
   * test id is not — so it is tried first and the row climbed to from it.
   */
  branchDropdown(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-branch-toggle]')
    if (hooked) return hooked
    const chevron = document.querySelector('[data-testid="pr-branch-chevron"]')
    const row = chevron?.closest('[aria-expanded]')
    if (row instanceof HTMLElement) return row
    return document.querySelector<HTMLElement>('[title="Branch detail"]')
  },

  /**
   * The Checks row, which the app renders as a disclosure: a label and a
   * verdict, with its CI toggles and its own run breakdown inside. The
   * extension's named jobs hang inside that content block.
   */
  checksRow(): Element | null {
    return (
      document.querySelector('[data-wh-pr-row="checks"]') ??
      document.querySelector('[data-testid="pr-checks-row"]') ??
      disclosureByLabel('Checks')
    )
  },

  checksContent(): Element | null {
    return disclosureContent(this.checksRow())
  },

  reviewRow(): Element | null {
    return (
      document.querySelector('[data-wh-pr-row="review-hero"]') ??
      document.querySelector('[data-testid="pr-review-hero-row"]') ??
      disclosureByLabel('Review Hero')
    )
  },

  reviewContent(): Element | null {
    return disclosureContent(this.reviewRow())
  },

  /**
   * The wordmark in the sidebar's top corner — the element holding the app's
   * own name, beside its brand mark.
   *
   * Fallback: the app renders the name as a span reading `Workhorse`. Once the
   * extension has rewritten it that text is gone, so a span carrying the
   * original text the extension recorded resolves too — otherwise the anchor
   * would stop resolving the moment the feature had done its work, and the
   * feature could never restore what it changed.
   *
   * Spans inside a control are skipped. The wordmark is not interactive, while
   * the workspace switcher's trigger reads a workspace name — and a workspace
   * can be named `Workhorse`, which would otherwise put the extension's
   * branding on the switcher. spec: BRND
   */
  wordmark(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-wordmark]')
    if (hooked) return hooked
    for (const span of document.querySelectorAll<HTMLElement>('aside span, header span')) {
      if (span.hasAttribute(MARK) || span.closest('button, a')) continue
      const text = span.textContent?.trim() ?? ''
      if (text === 'Workhorse' || span.hasAttribute(BRAND_ORIGINAL)) return span
    }
    return null
  },

  /**
   * The brand mark beside that wordmark: a burnt-orange square carrying a "W".
   *
   * Fallback: the app renders it as an svg immediately before the wordmark. It
   * is decorative and carries no label of its own, so its position beside the
   * name is the only thing identifying it.
   */
  brandMark(): SVGElement | null {
    const hooked = document.querySelector<SVGElement>('[data-wh-brand-mark]')
    if (hooked) return hooked
    const sibling = this.wordmark()?.previousElementSibling
    return sibling instanceof SVGElement ? sibling : null
  },

  /**
   * The same mark in the retracted rail, which is all the branding on show
   * while the sidebar is minimised.
   *
   * Its own attribute rather than the header's: the rail carries no wordmark,
   * so one attribute covering both would resolve the rail's mark as the
   * header's too, and the extension would put two marks against the one node.
   *
   * Fallback: the rail is the control that reveals the sidebar again with the
   * mark stacked above it, so the mark is the svg among that button's
   * siblings. There is no wordmark in the rail to resolve from.
   */
  railBrandMark(): SVGElement | null {
    const hooked = document.querySelector<SVGElement>('[data-wh-rail-mark]')
    if (hooked) return hooked
    const rail = document.querySelector('button[title="Show sidebar"]')?.parentElement
    if (!rail) return null
    for (const child of rail.children) {
      if (child instanceof SVGElement && !child.hasAttribute(MARK)) return child
    }
    return null
  },

  /**
   * The Claude usage bar in the sidebar footer — the track carrying the fill and
   * the clock notch.
   *
   * Fallback: the app declares it a meter and names it, which is a semantic
   * handle rather than a structural guess, so it is as good as an attribute for
   * everything except being ours to keep.
   *
   * The app renders no meter at all when the five-hour figure could not be read,
   * which is what makes "no reading to expand" resolve as absent rather than
   * needing a state of its own.
   *
   * The extension's own bottom row carries the same role and name, because it
   * takes over the reading the app's meter announced. So injected nodes are
   * skipped: an anchor that could return one would have the feature hiding its
   * own bar and redrawing over itself. spec: UHST, INJ
   */
  usageBar(): HTMLElement | null {
    for (const candidate of document.querySelectorAll<HTMLElement>(
      '[data-wh-usage-meter], [role="meter"][aria-label="Claude plan usage"]',
    )) {
      // `closest`, not the attribute itself: only the injected root is marked,
      // and the row carrying this role is nested inside it.
      if (!candidate.closest(`[${MARK}]`)) return candidate
    }
    return null
  },

  /**
   * The footer block holding that bar, which is what the stack is drawn over.
   *
   * Resolved through the bar rather than on its own: the block carries nothing
   * naming it, and reaching it from the meter means the two cannot disagree
   * about which footer is in play. spec: UHST
   */
  usageSlot(): HTMLElement | null {
    const parent = this.usageBar()?.parentElement
    return parent instanceof HTMLElement ? parent : null
  },

  /**
   * The workspace switcher's open menu, or null while it is closed.
   *
   * The menu is unmounted when the switcher closes, so "closed" and "not on
   * this page" resolve the same way — and an ordering the extension applied is
   * gone the next time the app builds it. spec: WSRT
   */
  workspaceSwitcherMenu(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-workspace-switcher]')
    if (hooked) return hooked
    // Fallback: the menu ends with the control that opens the add-workspace
    // dialog, and that label appears nowhere else in the app.
    for (const button of document.querySelectorAll('button')) {
      const label = button.textContent?.trim() ?? ''
      if (label === 'Add workspace…' || label === 'Add workspace...') {
        return button.parentElement
      }
    }
    return null
  },

  /**
   * The workspace rows in that menu, in the order they currently sit.
   *
   * Each row is a link to the workspace. The menu's other children — the
   * divider and the add-workspace control — are not rows and are left out, so
   * a caller reordering rows cannot move them. spec: WSRT
   */
  workspaceSwitcherRows(): HTMLElement[] {
    const menu = this.workspaceSwitcherMenu()
    if (!menu) return []
    return [...menu.children].filter(
      (child): child is HTMLElement => child.tagName === 'A' && !child.hasAttribute(MARK),
    )
  },

  /**
   * The workspace name a row shows.
   *
   * The name is the row's first child element; the row can carry an unread
   * count after it, so the row's whole text is not the name. Falling back to
   * that whole text keeps a row with no child element sortable rather than
   * sorting it as the empty string. spec: WSRT
   */
  workspaceRowName(row: Element): string {
    return labelOf(row) || (row.textContent?.trim() ?? '')
  },
}

export type Anchors = typeof anchors
