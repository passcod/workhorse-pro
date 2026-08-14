import { read } from './store.ts'
import { checkRunsKey, workflowRunsKey } from './keys.ts'
import type { CheckRun, CheckRunsResponse, WorkflowRunsResponse } from './types.ts'
import type { PrRef } from '../lib/github.ts'
import { ext } from '../ext.ts'

/**
 * Reads against GitHub's API, for detail Workhorse does not carry.
 *
 * Everything here is additive: a missing token, a rejected one, or a rate
 * limit leaves the caller with null and the tokenless form on screen.
 * spec: GHUB
 */

const API = 'https://api.github.com'
const HEAD_SHA = { ttl: 60_000 }
const CHECK_RUNS = { ttl: 20_000, poll: 30_000 }

/** Where the token's last verdict is recorded for the preferences page. */
export const TOKEN_STATUS_KEY = 'githubTokenStatus'
export type TokenStatus = 'unknown' | 'ok' | 'rejected'

/**
 * When the rate limit says to stop asking. Respecting the limit rather than
 * polling into it is the difference between one degraded feature and an hour
 * of refused requests across every tab. spec: GHUB
 */
let pausedUntil = 0

/**
 * Check a token against GitHub without needing any permission on it.
 *
 * `/rate_limit` answers for any valid credential and refuses an invalid one,
 * so it verifies the token itself rather than what it can reach. That lets the
 * preferences page settle the verdict the moment a token is saved, instead of
 * waiting for a card to be opened — which is what would otherwise make
 * "verified" and "usable" circular.
 */
export async function verifyToken(token: string): Promise<TokenStatus> {
  if (!token) return 'unknown'
  try {
    const response = await fetch(`${API}/rate_limit`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      credentials: 'omit',
    })
    if (response.status === 401 || response.status === 403) return 'rejected'
    if (!response.ok) return 'unknown'
    return 'ok'
  } catch {
    // Unreachable is not the same as refused, and must not read as one.
    return 'unknown'
  }
}

async function recordStatus(status: TokenStatus): Promise<void> {
  try {
    await ext.storage.local.set({ [TOKEN_STATUS_KEY]: status })
  } catch {
    // The status is a convenience for the preferences page, not a dependency.
  }
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  if (Date.now() < pausedUntil) throw new Error('rate limited')

  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    credentials: 'omit',
  })

  // Back off before the limit is reached rather than after: the remaining
  // count is the only warning there is.
  const remaining = Number(response.headers.get('x-ratelimit-remaining'))
  if (Number.isFinite(remaining) && remaining < 50) {
    const reset = Number(response.headers.get('x-ratelimit-reset'))
    pausedUntil = Number.isFinite(reset) ? reset * 1000 : Date.now() + 60_000
  }

  if (response.status === 401 || response.status === 403) {
    void recordStatus('rejected')
    throw new Error(`github ${response.status}`)
  }
  if (!response.ok) throw new Error(`github ${response.status}`)

  void recordStatus('ok')
  return (await response.json()) as T
}

/**
 * The pull request's head commit.
 *
 * Check runs are read by commit rather than by branch name so a branch
 * containing a slash cannot break the request path.
 */
function headSha(pr: PrRef, token: string): string | null {
  return read<string>(
    `pr-head:${pr.owner}/${pr.repo}#${pr.number}`,
    async () => {
      const data = await apiGet<{ head?: { sha?: string } }>(
        `/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`,
        token,
      )
      const sha = data.head?.sha
      if (!sha) throw new Error('no head sha')
      return sha
    },
    HEAD_SHA,
  )
}

/**
 * Check runs for a card's pull request head, or null when they cannot be read
 * — no token, no pull request yet, a rate limit, or a rejected token.
 */
export function checkRuns(pr: PrRef | null, token: string): CheckRun[] | null {
  if (!pr || !token) return null
  const sha = headSha(pr, token)
  if (!sha) return null

  const response = read<CheckRunsResponse>(
    checkRunsKey(pr.owner, pr.repo, sha),
    () =>
      apiGet<CheckRunsResponse>(
        `/repos/${pr.owner}/${pr.repo}/commits/${sha}/check-runs?per_page=100`,
        token,
      ),
    CHECK_RUNS,
  )
  return response?.check_runs ?? null
}

/**
 * The workflow each check suite belongs to, by suite id.
 *
 * A check run names the job but not the workflow it came from, which is why
 * three jobs called `gate` read alike. Workflow runs carry both the workflow's
 * name and the suite id, so one extra read per head commit supplies the
 * missing half. Empty when it cannot be read — a job then shows its own name
 * alone, which is what it did before.
 */
export function workflowNames(pr: PrRef | null, token: string): ReadonlyMap<number, string> {
  const empty = new Map<number, string>()
  if (!pr || !token) return empty
  const sha = headSha(pr, token)
  if (!sha) return empty

  const response = read<WorkflowRunsResponse>(
    workflowRunsKey(pr.owner, pr.repo, sha),
    () =>
      apiGet<WorkflowRunsResponse>(
        `/repos/${pr.owner}/${pr.repo}/actions/runs?head_sha=${sha}&per_page=100`,
        token,
      ),
    CHECK_RUNS,
  )
  if (!response) return empty

  const names = new Map<number, string>()
  for (const run of response.workflow_runs) {
    if (run.check_suite_id == null || !run.name) continue
    names.set(run.check_suite_id, run.name)
  }
  return names
}

/** Test seam. */
export function resetRateLimit(): void {
  pausedUntil = 0
}
