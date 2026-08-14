import { marked } from './reconcile.ts'

/**
 * Injection helpers.
 *
 * `ensure` is what makes features idempotent: it returns the existing node for
 * an id or creates it, so a feature's reconcile can be written as "this should
 * exist, here" and run any number of times. spec: INJ
 */

const ID = 'data-whx-id'

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
  const root = el('div', 'whx-stat-row')
  root.appendChild(el('span', 'whx-stat-label', label))
  const value = el('span', 'whx-stat-value')
  root.appendChild(value)
  return { root, value }
}

/** Replace an element's children with the given nodes. */
export function setChildren(parent: Element, children: (Node | string)[]): void {
  parent.replaceChildren(...children)
}
