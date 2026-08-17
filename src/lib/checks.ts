import type { CheckStatus } from '../data/types.ts'

/** The three buckets the breakdown reports. spec: STAT */
export interface CheckBreakdown {
  passed: number
  failed: number
  running: number
}

/**
 * Split a ref's checks into passed, failed, and running.
 *
 * Mirrors the derivation the app applies to the same payload, and must keep
 * mirroring it: the breakdown sits directly beneath the row's own verdict, so
 * the two disagreeing about one head would be worse than showing nothing. The
 * app folds suites settled without running their work — skipped, neutral,
 * cancelled, stale — into the total, so they land in the passed count here too
 * rather than being singled out.
 *
 * Two guards carry that:
 *
 * - `failed` and `running` are floored at one when the overall status reports
 *   failure or work in progress. GitHub can report a verdict with no detail
 *   behind it, and a breakdown reading "3 passed" under a row reading
 *   "1 failed" would count the failure as a pass.
 * - `passed` is what remains, floored at zero. The counts come from two
 *   endpoints and a floor above may have raised one, so a total that cannot
 *   accommodate them must not render as a negative count.
 *
 * spec: STAT
 */
export function checkBreakdown(ci: CheckStatus): CheckBreakdown {
  const total = Number.isFinite(ci.total) ? ci.total : 0
  const failed = ci.status === 'failing' ? Math.max(ci.failing, 1) : ci.failing
  const running = ci.status === 'pending' ? Math.max(ci.running, 1) : ci.running
  return {
    passed: Math.max(total - running - failed, 0),
    failed,
    running,
  }
}

/** Whether a breakdown has anything worth rendering. */
export function breakdownIsEmpty(breakdown: CheckBreakdown): boolean {
  return breakdown.passed === 0 && breakdown.failed === 0 && breakdown.running === 0
}

/**
 * The comment counts a completed review run reports, as the row renders them.
 * Zero findings reads as no issues rather than as a count of nothing. spec: STAT
 */
export function formatReviewCounts(counts: {
  critical: number
  suggestion: number
  nit: number
}): { total: number; critical: number; text: string } {
  const total = counts.critical + counts.suggestion + counts.nit
  if (total === 0) return { total: 0, critical: 0, text: 'No issues' }
  return {
    total,
    critical: counts.critical,
    text: `${total} issue${total === 1 ? '' : 's'}`,
  }
}
