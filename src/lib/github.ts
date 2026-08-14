/**
 * Parsing GitHub identifiers out of the links the app already renders, so no
 * additional Workhorse endpoint is needed to know which repository a card
 * belongs to. spec: GHUB
 */

export interface PrRef {
  owner: string
  repo: string
  number: number
}

/**
 * Read owner, repository and pull request number from a pull request URL.
 *
 * Returns null for anything that is not a github.com pull request URL,
 * including a card whose pull request does not exist yet — which is an
 * ordinary state, not an error.
 */
export function parsePrUrl(url: string | null | undefined): PrRef | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 4) return null
  const [owner, repo, kind, number] = segments
  if (kind !== 'pull' || !owner || !repo || !number) return null
  const parsedNumber = Number(number)
  if (!Number.isInteger(parsedNumber) || parsedNumber <= 0) return null
  return { owner, repo, number: parsedNumber }
}

/** How many jobs the checks row lists before saying how many it left out. */
export const MAX_LISTED_CHECKS = 5

export type CheckState = 'failed' | 'running' | 'passed' | 'skipped'

/**
 * Which bucket a check run falls into.
 *
 * Mirrors how the counts treat conclusions: anything settled without running
 * its work is skipped rather than failed, and an unrecognised conclusion is
 * read as passed — the same way the passed count is whatever remains.
 */
export function checkRunState(run: {
  status: string
  conclusion: string | null
}): CheckState {
  if (run.status !== 'completed') return 'running'
  switch (run.conclusion) {
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return 'failed'
    case 'skipped':
    case 'neutral':
    case 'cancelled':
    case 'stale':
      return 'skipped'
    default:
      return 'passed'
  }
}

/**
 * How long a job has been going, or ran for before it settled.
 *
 * Null when GitHub has not said it started — a queued job has no elapsed time,
 * and reporting one would make a queue look like work.
 */
export function elapsedMs(
  run: { started_at: string | null; completed_at: string | null },
  now: number,
): number | null {
  if (!run.started_at) return null
  const started = Date.parse(run.started_at)
  if (!Number.isFinite(started)) return null
  const ended = run.completed_at ? Date.parse(run.completed_at) : now
  if (!Number.isFinite(ended)) return null
  return Math.max(ended - started, 0)
}

/**
 * A duration at the coarseness the reader needs: seconds while that is the
 * interesting figure, then minutes, then hours. A job at 3s and one at 51m are
 * both answered in two parts at most.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0 ? `${minutes}m` : `${minutes}m${rest}s`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${rest}m`
}

export interface RankedCheck {
  run: CheckRunLike
  state: CheckState
  /** Null when the job has not started. */
  elapsed: number | null
}

interface CheckRunLike {
  name: string
  status: string
  conclusion: string | null
  html_url: string | null
  started_at: string | null
  completed_at: string | null
}

/**
 * The jobs worth showing, longest first, and how many were left out.
 *
 * Only failures and jobs still going: a passing suite has nothing to act on,
 * and listing it would bury the two rows that do. Failures come first because
 * they are the thing to act on; the rest go by how long they have been
 * running, which makes the list answer two questions at once — that work is
 * happening, and which of it has been happening suspiciously long.
 *
 * Some repositories run over a hundred jobs, and the section this sits in does
 * not scroll, so the list is capped rather than complete.
 */
export function rankChecks(
  runs: readonly CheckRunLike[],
  now: number,
  limit = MAX_LISTED_CHECKS,
): { shown: RankedCheck[]; hidden: number; running: number; failed: number } {
  const interesting: RankedCheck[] = []
  let running = 0
  let failed = 0
  for (const run of runs) {
    const state = checkRunState(run)
    if (state !== 'failed' && state !== 'running') continue
    if (state === 'failed') failed++
    else running++
    interesting.push({ run, state, elapsed: elapsedMs(run, now) })
  }

  interesting.sort((a, b) => {
    if (a.state !== b.state) return a.state === 'failed' ? -1 : 1
    // A job with no start time has done nothing yet, so it sorts last.
    return (b.elapsed ?? -1) - (a.elapsed ?? -1)
  })

  return {
    shown: interesting.slice(0, limit),
    hidden: Math.max(interesting.length - limit, 0),
    running,
    failed,
  }
}
