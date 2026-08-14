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
    // Fallback, before a PR exists: the chevron beside Create PR.
    const prePr = document.querySelector<HTMLElement>('button[title="Branch details"]')
    if (prePr) return prePr
    // Fallback, once a PR exists: the collapsed bar's own button, identified
    // by the GitHub link that sits in the same row.
    const link = document.querySelector('a[title="Open on GitHub"]')
    return link?.parentElement?.querySelector<HTMLElement>('button') ?? null
  },

  /**
   * Whether the pull request detail is open.
   *
   * Fallback: the branch controls only render inside the expanded detail, so
   * their presence is the state.
   */
  prDetailExpanded(): boolean {
    const hooked = document.querySelector('[data-wh-pr-expanded]')
    if (hooked) return hooked.getAttribute('data-wh-pr-expanded') === 'true'
    return document.querySelector('[title="Advanced branch controls"]') !== null
  },

  /** The branch diagnostics dropdown, which carries its own expanded state. */
  branchDropdown(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('[data-wh-branch-toggle]') ??
      document.querySelector<HTMLElement>('[title="Advanced branch controls"]')
    )
  },

  checksRow(): Element | null {
    return (
      document.querySelector('[data-wh-pr-row="checks"]') ?? disclosureByLabel('Checks')
    )
  },

  checksContent(): Element | null {
    return disclosureContent(this.checksRow())
  },

  reviewRow(): Element | null {
    return (
      document.querySelector('[data-wh-pr-row="review-hero"]') ??
      disclosureByLabel('Review Hero')
    )
  },

  reviewContent(): Element | null {
    return disclosureContent(this.reviewRow())
  },

  /**
   * The toggle above an open artefact, offering File and Changes.
   *
   * Identified by the segments in it rather than by where it sits. The app
   * builds the device toggle above a mockup from the same component, with the
   * same markup, in the same corner of the same bar — so anything positional
   * would find that one too and put a Diff segment on a mockup. spec: DIFF
   *
   * The extension's own segment is skipped when reading the labels, so the
   * anchor still resolves once the segment has been injected.
   */
  artefactToggle(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-artefact-toggle]')
    if (hooked) return hooked
    for (const button of document.querySelectorAll('button[type="button"]')) {
      if (button.hasAttribute(MARK)) continue
      if ((button.textContent?.trim() ?? '') !== 'File') continue
      const wrapper = button.parentElement
      if (!wrapper) continue
      const labels = [...wrapper.children]
        .filter((child) => !child.hasAttribute(MARK))
        .map((child) => child.textContent?.trim() ?? '')
      if (labels.length === 2 && labels[0] === 'File' && labels[1] === 'Changes') {
        return wrapper as HTMLElement
      }
    }
    return null
  },

  /** The app's own segments in that toggle, in the order it renders them. */
  artefactToggleSegments(): HTMLElement[] {
    const toggle = this.artefactToggle()
    if (!toggle) return []
    return [...toggle.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute(MARK),
    )
  },

  /**
   * The bar the artefact toggle sits in.
   *
   * Fallback: the bar always carries the control that steps to the previous
   * file, so the bar is the nearest ancestor of the toggle holding both. Its
   * own markup offers nothing else to go on, and climbing a fixed number of
   * levels would break on any change to how the bar is laid out.
   */
  artefactHeaderBar(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-artefact-header]')
    if (hooked) return hooked
    const toggle = this.artefactToggle()
    if (!toggle) return null
    let candidate = toggle.parentElement
    while (candidate) {
      if (candidate.querySelector('button[title="Previous file"]')) return candidate
      candidate = candidate.parentElement
    }
    return null
  },

  /**
   * What the app renders the open artefact into: the bar's next sibling.
   *
   * Anything the extension put there is skipped, so this cannot return the
   * extension's own diff panel and have it hide itself.
   */
  artefactView(): HTMLElement | null {
    const bar = this.artefactHeaderBar()
    if (!bar) return null
    let sibling = bar.nextElementSibling
    while (sibling && sibling.hasAttribute(MARK)) sibling = sibling.nextElementSibling
    return sibling as HTMLElement | null
  },

  /** The sidebar's Conversations header row. */
  conversationsHeader(): Element | null {
    const hooked = document.querySelector('[data-wh-conversations]')
    if (hooked) return hooked
    for (const span of document.querySelectorAll('nav span, aside span')) {
      if (span.textContent?.trim() === 'Conversations') {
        // The row is the div wrapping the label and its controls. Deliberately
        // not `closest('a, div')`: the label can sit inside a link, and the
        // link is not the row.
        return span.closest('div')
      }
    }
    return null
  },

  /**
   * The cluster of controls at the right of the Conversations header, where
   * the app puts its own row buttons and where the scope control belongs.
   *
   * Injecting into this cluster rather than beside the header is what keeps
   * the control reachable: appended anywhere else it inherits the label's
   * layout, and inside the label's link a click navigates instead of toggling.
   */
  conversationsControls(): Element | null {
    const header = this.conversationsHeader()
    if (!header) return null
    const hooked = header.querySelector('[data-wh-conversations-controls]')
    if (hooked) return hooked
    // The "New" button is the cluster's stable member; the row always has one.
    const add = header.querySelector('button[title="New"], button[title="Starting…"]')
    return add?.parentElement ?? null
  },

  /**
   * The app's own conversations list, hidden while the scope is widened.
   *
   * Null when the app is rendering no list at all, which it does when the
   * scoped list has nothing in it.
   *
   * The extension's own list sits in the same place, so this has to skip
   * anything the extension put there. Without that check it returns the
   * extension's container whenever the app's list is absent — and the caller
   * then hides *that*, leaving the widened list invisible and no way to get it
   * back, since nothing clears the style it was given.
   */
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

  conversationsList(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-conversations-list]')
    if (hooked) return hooked
    const header = this.conversationsHeader()
    if (!header) return null
    let sibling = header.nextElementSibling
    // Skip the error paragraph the header can render before the list, and
    // anything of the extension's own.
    while (sibling && (sibling.tagName === 'P' || sibling.hasAttribute(MARK))) {
      sibling = sibling.nextElementSibling
    }
    return sibling as HTMLElement | null
  },
}

export type Anchors = typeof anchors
