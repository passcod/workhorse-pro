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

  /** The Based-on row, beneath which the resolved base branch hangs. */
  basedOnRow(): Element | null {
    const hooked = document.querySelector('[data-wh-pr-row="based-on"]')
    if (hooked) return hooked
    for (const span of document.querySelectorAll('span')) {
      if (span.textContent?.trim() === 'Based on') return span.parentElement
    }
    return null
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

  /** The app's own conversations list, hidden while the scope is widened. */
  conversationsList(): HTMLElement | null {
    const hooked = document.querySelector<HTMLElement>('[data-wh-conversations-list]')
    if (hooked) return hooked
    const header = this.conversationsHeader()
    if (!header) return null
    let sibling = header.nextElementSibling
    // Skip the error paragraph the header can render before the list.
    while (sibling && sibling.tagName === 'P') sibling = sibling.nextElementSibling
    return sibling as HTMLElement | null
  },
}

export type Anchors = typeof anchors
