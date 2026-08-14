import { anchors } from '../content/anchors.ts'
import { ensureOrdered, el, remove, statRow } from '../content/dom.ts'
import type { Context, Feature } from '../content/reconcile.ts'
import { branchStatus } from '../data/workhorse.ts'
import { breakdownIsEmpty, checkBreakdown, formatReviewCounts } from '../lib/checks.ts'

/**
 * The three readings that hang beneath the rows they belong to in the pull
 * request section, each rendered from the branch status the extension holds
 * for the card on screen. spec: STAT
 */

const BREAKDOWN = 'checks-breakdown'
const RUNS = 'review-runs'
const LAST_RUN = 'review-last-run'

/** Injection order within each disclosure, so a row that is removed and
 *  re-added does not come back below its neighbour. */
const BREAKDOWN_ORDER = 10
const RUNS_ORDER = 10
const LAST_RUN_ORDER = 20

/** Comma-separated parts, with the failure count carrying the row's colour. */
function breakdownNodes(counts: {
  passed: number
  failed: number
  running: number
  skipped: number
}): Node[] {
  const parts: Node[] = []
  const push = (node: Node) => {
    if (parts.length > 0) parts.push(document.createTextNode(', '))
    parts.push(node)
  }
  // Only non-zero buckets appear, so a clean run reads as a passed count alone
  // rather than padding three zeroes around it. spec: STAT
  if (counts.passed > 0) push(document.createTextNode(`${counts.passed} passed`))
  if (counts.failed > 0) push(el('span', 'whp-amber', `${counts.failed} failed`))
  if (counts.running > 0) push(document.createTextNode(`${counts.running} running`))
  if (counts.skipped > 0) push(document.createTextNode(`${counts.skipped} skipped`))
  return parts
}

export function statRows(): Feature {
  return {
    name: 'statRows',
    reconcile({ prefs, route }: Context) {
      if (!route.card || !route.workspace) {
        remove(BREAKDOWN)
        remove(RUNS)
        remove(LAST_RUN)
        return
      }

      // Null while the first read is in flight; the store schedules another
      // pass when it lands, so this renders nothing for a frame rather than
      // blocking. spec: DATA
      const status = branchStatus(route.workspace, route.card)

      // ── Check breakdown ────────────────────────────────────────────────
      const checksContent = anchors.checksContent()
      const counts = status?.ci ? checkBreakdown(status.ci) : null
      if (prefs.checksBreakdown && checksContent && counts && !breakdownIsEmpty(counts)) {
        const row = ensureOrdered(checksContent, BREAKDOWN, BREAKDOWN_ORDER, () => statRow('Latest run').root)
        const value = row.querySelector('.whp-stat-value')!
        value.replaceChildren(...breakdownNodes(counts))
      } else {
        remove(BREAKDOWN)
      }

      // ── Review run stats ───────────────────────────────────────────────
      const reviewContent = anchors.reviewContent()
      // The live round while a loop is running, the last completed round
      // otherwise. spec: STAT
      const runs = status
        ? status.loop.active
          ? status.loop.round
          : (status.lastReview?.round ?? 0)
        : 0
      if (prefs.reviewStats && reviewContent && runs > 0) {
        const row = ensureOrdered(reviewContent, RUNS, RUNS_ORDER, () => statRow('Runs').root)
        row.querySelector('.whp-stat-value')!.textContent = String(runs)
      } else {
        remove(RUNS)
      }

      const lastReview = status?.lastReview ?? null
      if (prefs.reviewStats && reviewContent && lastReview) {
        const row = ensureOrdered(reviewContent, LAST_RUN, LAST_RUN_ORDER, () => statRow('Last run').root)
        const value = row.querySelector('.whp-stat-value')!
        const summary = formatReviewCounts(lastReview.counts)
        const nodes: Node[] = [document.createTextNode(summary.text)]
        if (summary.critical > 0) {
          nodes.push(document.createTextNode(', '))
          nodes.push(el('span', 'whp-amber', `${summary.critical} critical`))
        }
        value.replaceChildren(...nodes)
      } else {
        remove(LAST_RUN)
      }
    },
  }
}
