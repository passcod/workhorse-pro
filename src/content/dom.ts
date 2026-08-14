import { marked } from './reconcile.ts'

/**
 * Injection helpers.
 *
 * `ensure` is what makes features idempotent: it returns the existing node for
 * an id or creates it, so a feature's reconcile can be written as "this should
 * exist, here" and run any number of times. spec: INJ
 */

const ID = 'data-whp-id'

/** Find or create a child of `parent` identified by `id`. */
export function ensure<T extends HTMLElement>(
  parent: Element,
  id: string,
  create: () => T,
): T {
  const existing = parent.querySelector<T>(`:scope > [${ID}="${CSS.escape(id)}"]`)
  if (existing) return existing
  const element = create()
  element.setAttribute(ID, id)
  marked(element)
  parent.appendChild(element)
  return element
}

/**
 * Find or create a child, keeping the extension's own children of that parent
 * in a fixed order among themselves.
 *
 * Appending alone leaves the order to whichever feature happened to inject
 * first — and a row that is removed and re-added lands at the end, so the same
 * two rows can appear either way round depending on what the data did. The
 * app's own children are left exactly where they are.
 */
export function ensureOrdered<T extends HTMLElement>(
  parent: Element,
  id: string,
  order: number,
  create: () => T,
): T {
  const element = ensure(parent, id, create)
  element.dataset.whpOrder = String(order)

  const ours = [...parent.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.whpOrder !== undefined,
  )
  const desired = [...ours].sort(
    (a, b) => Number(a.dataset.whpOrder) - Number(b.dataset.whpOrder),
  )
  // Only touch the DOM when something is actually out of place: a move is a
  // mutation, and a mutation schedules another pass.
  if (ours.every((node, index) => node === desired[index])) return element

  const first = ours[0]!
  const lead = desired[0]!
  if (lead !== first) first.before(lead)
  let previous: Element = lead
  for (const node of desired.slice(1)) {
    if (previous.nextElementSibling !== node) previous.after(node)
    previous = node
  }
  return element
}

/**
 * Find or create a node that hangs beneath `reference`, keeping the extension's
 * own children of that parent contiguous and in a fixed order among themselves,
 * immediately after the reference.
 *
 * Used where several readings sit beneath a row the app renders flat — the
 * Checks row is not a disclosure and has no content block of its own, so the
 * breakdown and the named jobs stack after it rather than inside it. Ordering
 * keeps a reading that is removed and re-added from returning below its
 * neighbour, and the after-reference placement keeps the group beneath the row
 * even as the app re-inserts its own rows around it.
 */
export function ensureAfterOrdered<T extends HTMLElement>(
  reference: Element,
  id: string,
  order: number,
  create: () => T,
): T {
  const parent = reference.parentElement
  if (!parent) throw new Error(`ensureAfterOrdered: ${id} has no parent to sit in`)
  let element = parent.querySelector<T>(`:scope > [${ID}="${CSS.escape(id)}"]`)
  if (!element) {
    element = create()
    element.setAttribute(ID, id)
    marked(element)
    reference.after(element)
  }
  element.dataset.whpOrder = String(order)

  const ours = [...parent.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.whpOrder !== undefined,
  )
  const desired = [...ours].sort(
    (a, b) => Number(a.dataset.whpOrder) - Number(b.dataset.whpOrder),
  )
  // Only touch the DOM when something is out of place: a move is a mutation,
  // and a mutation schedules another pass.
  let previous: Element = reference
  for (const node of desired) {
    if (previous.nextElementSibling !== node) previous.after(node)
    previous = node
  }
  return element
}

/**
 * Find or create a node placed immediately after `reference`.
 *
 * Used where a row hangs beneath a specific sibling rather than inside a
 * container — the resolved base branch under the Based-on row, for instance.
 */
export function ensureAfter<T extends HTMLElement>(
  reference: Element,
  id: string,
  create: () => T,
): T {
  const parent = reference.parentElement
  if (!parent) throw new Error(`ensureAfter: ${id} has no parent to sit in`)
  const existing = parent.querySelector<T>(`:scope > [${ID}="${CSS.escape(id)}"]`)
  if (existing) {
    // Keep it adjacent: the app can re-order the rows around it.
    if (existing.previousElementSibling !== reference) {
      reference.after(existing)
    }
    return existing
  }
  const element = create()
  element.setAttribute(ID, id)
  marked(element)
  reference.after(element)
  return element
}

/** Remove an injected node wherever it is, if present. */
export function remove(id: string, root: ParentNode = document): void {
  for (const node of root.querySelectorAll(`[${ID}="${CSS.escape(id)}"]`)) {
    node.remove()
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * A reading beneath the row it belongs to, in the shape the app gives its own:
 * an italic muted label on the left, a tabular value on the right.
 */
export function statRow(label: string): {
  root: HTMLDivElement
  value: HTMLSpanElement
} {
  const root = el('div', 'whp-stat-row')
  root.appendChild(el('span', 'whp-stat-label', label))
  const value = el('span', 'whp-stat-value')
  root.appendChild(value)
  return { root, value }
}

/** Replace an element's children with the given nodes. */
export function setChildren(parent: Element, children: (Node | string)[]): void {
  parent.replaceChildren(...children)
}
