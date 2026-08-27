/**
 * Response shapes from Workhorse and GitHub.
 *
 * Declared here rather than imported: the two repositories are independent, so
 * a copied shape that drifts has to be caught by a test rather than by the
 * compiler. Only the fields this extension reads are declared — a narrower
 * surface means less to drift. spec: PKG
 */

/**
 * Branch status, narrowed to the pull request the named jobs are read against.
 *
 * The app's own rows render the check counts and the review run state from the
 * rest of this response, so the extension reads only what it still adds to.
 */
export interface BranchStatusData {
  prUrl: string | null
  prNumber: number | null
  branch: { name: string | null } | null
}

/**
 * The acting user's Claude subscription position, narrowed to the five-hour
 * window the sidebar bar draws.
 *
 * `report` and `unavailable` are exclusive: the app names why there is no
 * reading rather than sending a bare null, and the usage stack has nothing to
 * record whenever `report` is absent.
 */
export interface SubscriptionUsageData {
  report: {
    /** Utilisation of the five-hour window, 0-100. Null when unreadable. */
    percent: number | null
    /** When the window resets, ISO 8601. Null when the payload does not say. */
    resetsAt: string | null
    /** How long the window runs, in minutes. */
    windowMinutes: number | null
  } | null
  /** Why there is no reading, when there is none. */
  unavailable: string | null
  /** When the paired device took the reading, ISO 8601. */
  readAt: string | null
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
