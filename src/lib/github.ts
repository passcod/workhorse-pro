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
