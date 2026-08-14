/**
 * Response shapes from Workhorse and GitHub.
 *
 * Declared here rather than imported: the two repositories are independent, so
 * a copied shape that drifts has to be caught by a test rather than by the
 * compiler. Only the fields this extension reads are declared — a narrower
 * surface means less to drift. spec: PKG
 */

export interface CheckStatus {
  status: 'passing' | 'failing' | 'pending' | null
  /** Check suites plus legacy commit statuses found against the ref. */
  total: number
  running: number
  failing: number
  /**
   * Settled without running their work — skipped, neutral, cancelled, stale.
   * A subset of those counting as passing, not a fourth bucket. Reaches the
   * client over the wire, so it can be absent on a response cached from before
   * the field existed.
   */
  skipped: number
  /** Whether the repo has any active workflow; null when the lookup failed. */
  repoRunsChecks: boolean | null
}

export interface BranchStatusData {
  prUrl: string | null
  prNumber: number | null
  ci: CheckStatus | null
  branch: { name: string | null } | null
  /**
   * Present only when the card's base resolves to something other than what
   * its label implies — a card stacked on a merged parent inherits the
   * parent's own base.
   */
  effectiveBaseBranch?: string | null
  loop: { active: boolean; round: number; paused: boolean }
  lastReview: {
    round: number
    counts: { critical: number; suggestion: number; nit: number }
  } | null
}

export interface RecentSession {
  id: string
  title: string | null
  lastMessagePreview: string | null
  messageCount: number
  lastMessageAt: string
  cardId: string | null
  waitingOnUser: boolean
  cardIdentifier: string | null
  cardTitle: string | null
  cardStatusColour: string | null
  cardStatusLabel: string | null
  workspaceName: string | null
}

export interface SidebarData {
  workspaces: { id: string; name: string }[]
  recentSessions: RecentSession[]
  myLocalInstance: { url: string; cardIds: string[] } | null
}

export interface SessionsResponse {
  sessions: RecentSession[]
  nextCursor: string | null
}

/** What the device reports for sessions it is running. */
export interface SessionSummary {
  id: string
  lastMessagePreview?: string | null
  messageCount?: number
  lastMessageAt?: string
  agentActiveAt?: string | null
}

/** A GitHub check run, narrowed to what the named-checks row renders. */
export interface CheckRun {
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'timed_out'
    | 'action_required'
    | 'stale'
    | 'skipped'
    | null
  html_url: string | null
}

export interface CheckRunsResponse {
  total_count: number
  check_runs: CheckRun[]
}
