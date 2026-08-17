/**
 * Cache keys, and the mapping from a request URL back to one.
 *
 * Both directions live here because both are used: the extension builds a key
 * when it reads, and the observer derives the same key from a URL the app
 * fetched. If the two disagreed, an observed response would sit in the cache
 * under a key nothing reads and the optimisation would silently do nothing.
 * spec: DATA
 */

export function branchStatusKey(workspace: string, card: string): string {
  return `branch-status:${workspace}:${card}`
}

export function checkRunsKey(owner: string, repo: string, ref: string): string {
  return `check-runs:${owner}/${repo}@${ref}`
}

export function workflowRunsKey(owner: string, repo: string, ref: string): string {
  return `workflow-runs:${owner}/${repo}@${ref}`
}

/** Paths worth observing. Anything else the app fetches is ignored. */
export const OBSERVED_PATHS = ['/api/card-branch-status'] as const

/**
 * The cache key a fetched URL corresponds to, or null when the extension has
 * no interest in it.
 *
 * Accepts a full or relative URL; `base` supplies the origin for relative ones.
 */
export function keyForUrl(url: string, base: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url, base)
  } catch {
    return null
  }
  // Cross-origin responses are never the app's own reads.
  if (parsed.origin !== new URL(base).origin) return null

  switch (parsed.pathname) {
    case '/api/card-branch-status': {
      const card = parsed.searchParams.get('cardId')
      const workspace = parsed.searchParams.get('workspace')
      if (!card || !workspace) return null
      return branchStatusKey(workspace, card)
    }
    default:
      return null
  }
}
