import { reportOnce } from '../log.ts'
import { parseRoute, type Route } from '../lib/route.ts'
import type { Prefs } from '../prefs.ts'

/**
 * The reconcile loop.
 *
 * A pass is idempotent reconciliation, not event handling: each feature is
 * handed the current page and asked to make its injections match the desired
 * state. Nothing needs to detect that a route changed or a disclosure opened —
 * those produce a page the next pass reconciles against.
 *
 * That shape is what makes the extension viable against an app that soft-
 * navigates and re-creates subtrees on state changes the extension cannot see.
 * Responding to particular mutations would accumulate special cases without
 * end. spec: INJ
 */

export interface Context {
  prefs: Prefs
  route: Route
  /** Ask for another pass, e.g. once awaited data has landed. */
  schedule: () => void
}

export interface Feature {
  name: string
  reconcile(context: Context): void
}

/** Attribute marking a node as the extension's own. */
export const MARK = 'data-whp'

/** Mark an element as injected, so the observer ignores its own work. */
export function marked<T extends Element>(element: T): T {
  element.setAttribute(MARK, '')
  return element
}

function isOurs(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return element?.closest(`[${MARK}]`) != null
}

/**
 * Whether a batch of mutations was caused solely by the extension.
 *
 * Without this the observer feeds itself: an injected row is a childList
 * mutation, which schedules a pass, which re-checks the injection, forever.
 */
function onlyOurs(records: MutationRecord[]): boolean {
  for (const record of records) {
    for (const node of record.addedNodes) if (!isOurs(node)) return false
    for (const node of record.removedNodes) if (!isOurs(node)) return false
    // A record whose target is ours with no node changes is ours too.
    if (record.addedNodes.length === 0 && record.removedNodes.length === 0) {
      if (!isOurs(record.target)) return false
    }
  }
  return true
}

export class Reconciler {
  private features: Feature[] = []
  private prefs: Prefs
  private observer: MutationObserver | null = null
  private frame: number | null = null

  constructor(prefs: Prefs) {
    this.prefs = prefs
  }

  register(feature: Feature): void {
    this.features.push(feature)
  }

  setPrefs(prefs: Prefs): void {
    this.prefs = prefs
    this.schedule()
  }

  start(): void {
    this.observer = new MutationObserver((records) => {
      if (onlyOurs(records)) return
      this.schedule()
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
    this.schedule()
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = null
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
  }

  /** Coalesce to at most one pass per frame. */
  schedule = (): void => {
    if (this.frame !== null) return
    const run = () => {
      this.frame = null
      this.pass()
    }
    this.frame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(run)
        : (setTimeout(run, 0) as unknown as number)
  }

  /** One reconcile pass. Public so tests can drive it without a frame. */
  pass(): void {
    const context: Context = {
      prefs: this.prefs,
      route: parseRoute(location.pathname),
      schedule: this.schedule,
    }
    for (const feature of this.features) {
      try {
        feature.reconcile(context)
      } catch (error) {
        // A feature that throws is skipped for this pass and reported once,
        // leaving every other feature working. spec: INJ
        reportOnce(`feature:${feature.name}`, error)
      }
    }
  }
}
