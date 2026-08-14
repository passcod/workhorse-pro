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

export const SIDEBAR_DATA_KEY = 'sidebar-data'

export function recentSessionsKey(limit: number, workspace: string | null): string {
  return `sessions-recent:${limit}:${workspace ?? ''}`
}

export function cardFilesKey(workspace: string, card: string): string {
  return `card-files:${workspace}:${card}`
}

export function cardDetailKey(workspace: string, card: string): string {
  return `card-detail:${workspace}:${card}`
}

/** Keyed by the card's own id, which is what the endpoint takes. */
export function baseFileKey(cardId: string, filePath: string): string {
  return `base-file:${cardId}:${filePath}`
}

export function checkRunsKey(owner: string, repo: string, ref: string): string {
  return `check-runs:${owner}/${repo}@${ref}`
}

export function workflowRunsKey(owner: string, repo: string, ref: string): string {
  return `workflow-runs:${owner}/${repo}@${ref}`
}

/** Paths worth observing. Anything else the app fetches is ignored. */
export const OBSERVED_PATHS = [
  '/api/card-branch-status',
  '/api/sidebar-data',
  '/api/sessions',
  '/api/card-files',
  '/api/card-detail',
  '/api/base-file',
] as const

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
    case '/api/sidebar-data':
      return SIDEBAR_DATA_KEY
    case '/api/card-files': {
      const card = parsed.searchParams.get('cardId')
      const workspace = parsed.searchParams.get('workspace')
      if (!card || !workspace) return null
      return cardFilesKey(workspace, card)
    }
    case '/api/card-detail': {
      const card = parsed.searchParams.get('cardId')
      const workspace = parsed.searchParams.get('workspace')
      if (!card || !workspace) return null
      return cardDetailKey(workspace, card)
    }
    case '/api/base-file': {
      const card = parsed.searchParams.get('cardId')
      const filePath = parsed.searchParams.get('filePath')
      if (!card || !filePath) return null
      // A peeked read compares against the peeked pull request instead of the
      // base branch. Filing it under this key would put that answer where the
      // base-branch one is read from, so it is left alone.
      if (parsed.searchParams.get('prNumber') !== null) return null
      return baseFileKey(card, filePath)
    }
    case '/api/sessions': {
      if (parsed.searchParams.get('recent') !== 'true') return null
      const limit = Number(parsed.searchParams.get('limit') ?? '8')
      if (!Number.isFinite(limit)) return null
      return recentSessionsKey(limit, parsed.searchParams.get('workspace'))
    }
    default:
      return null
  }
}
