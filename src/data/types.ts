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
  loop: { active: boolean; round: number; paused: boolean }
  lastReview: {
    round: number
    counts: { critical: number; suggestion: number; nit: number }
  } | null
}

/**
 * One artefact in a card's worktree, as the card-files listing carries it.
 *
 * `content` is the version on the card's branch, which is the "after" side of
 * the raw diff. spec: DIFF
 */
export interface CardFile {
  filePath: string
  isNew: boolean
  isDeleted: boolean
  content: string
}

export interface CardFilesData {
  initialFiles: CardFile[]
}

/** The artefact's content on the base branch. Null when it is not there. */
export interface BaseFileData {
  content: string | null
}

/**
 * Card detail, narrowed to the identifier-to-id mapping.
 *
 * The base-file read is keyed by the card's own id rather than the identifier
 * the route carries, and this is where that id comes from.
 */
export interface CardDetailData {
  card: { id: string } | null
}

/**
 * A row's worth of a recent conversation, as `mapRecentSession` returns it.
 *
 * A row is not a conversation: card-bound conversations collapse to one row
 * per card and project conversations to one per project, so most rows stand
 * for a card and show the card's identity rather than the conversation's.
 * spec: SCOP
 */
export interface RecentSession {
  id: string
  title: string | null
  lastMessagePreview: string | null
  messageCount: number
  lastMessageAt: string
  cardId: string | null
  kind: string | null
  waitingOnUser: boolean
  /** Queued for review or waiting on a scheduled merge. */
  waitingOnExternal: boolean
  waitingOnMerge: boolean
  cardIdentifier: string | null
  cardTitle: string | null
  /** Which status glyph the card's status draws, e.g. `almost-done`. */
  cardStatusIconStyle: string | null
  cardStatusColour: string | null
  cardStatusLabel: string | null
  projectId: string | null
  projectName: string | null
  projectHash: string | null
  projectEmoji: string | null
  projectColour: string | null
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
  /** When the job began, and when it settled. Absent before it starts. */
  started_at: string | null
  completed_at: string | null
  /**
   * The suite this job belongs to. The only link back to the workflow that
   * produced it — a check run does not carry the workflow's name.
   */
  check_suite: { id: number } | null
}

export interface CheckRunsResponse {
  total_count: number
  check_runs: CheckRun[]
}

/**
 * A workflow run, narrowed to what names a job's workflow.
 *
 * `check_suite_id` is what joins these to check runs, which carry the suite but
 * not the workflow.
 */
export interface WorkflowRun {
  id: number
  name: string | null
  check_suite_id: number | null
}

export interface WorkflowRunsResponse {
  workflow_runs: WorkflowRun[]
}
