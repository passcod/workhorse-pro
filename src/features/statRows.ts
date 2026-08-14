import { anchors } from '../content/anchors.ts'
import { ensure, ensureAfter, el, remove, statRow } from '../content/dom.ts'
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
const BASE = 'effective-base'

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
  if (counts.failed > 0) push(el('span', 'whx-amber', `${counts.failed} failed`))
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
        remove(BASE)
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
        const row = ensure(checksContent, BREAKDOWN, () => statRow('Latest run').root)
        const value = row.querySelector('.whx-stat-value')!
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
        const row = ensure(reviewContent, RUNS, () => statRow('Runs').root)
        row.querySelector('.whx-stat-value')!.textContent = String(runs)
      } else {
        remove(RUNS)
      }

      const lastReview = status?.lastReview ?? null
      if (prefs.reviewStats && reviewContent && lastReview) {
        const row = ensure(reviewContent, LAST_RUN, () => statRow('Last run').root)
        const value = row.querySelector('.whx-stat-value')!
        const summary = formatReviewCounts(lastReview.counts)
        const nodes: Node[] = [document.createTextNode(summary.text)]
        if (summary.critical > 0) {
          nodes.push(document.createTextNode(', '))
          nodes.push(el('span', 'whx-amber', `${summary.critical} critical`))
        }
        value.replaceChildren(...nodes)
      } else {
        remove(LAST_RUN)
      }

      // ── Effective base branch ──────────────────────────────────────────
      const basedOn = anchors.basedOnRow()
      const effective = status?.effectiveBaseBranch ?? null
      if (prefs.effectiveBaseBranch && basedOn && effective) {
        const row = ensureAfter(basedOn, BASE, () => {
          const node = el('div', 'whx-base-row')
          node.title = 'Effective base branch'
          node.appendChild(el('span', undefined, '↳'))
          node.appendChild(el('span', 'whx-mono'))
          return node
        })
        row.querySelector('.whx-mono')!.textContent = effective
      } else {
        remove(BASE)
      }
    },
  }
}
