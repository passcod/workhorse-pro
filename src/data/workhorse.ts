import { read } from './store.ts'
import { branchStatusKey, recentSessionsKey, SIDEBAR_DATA_KEY } from './keys.ts'
import type { BranchStatusData, SessionsResponse, SidebarData } from './types.ts'

/**
 * Reads against the app's own endpoints. Same-origin, so the session cookie
 * travels without the extension holding any credential. spec: DATA
 */

/** Matches the staleness the app applies to branch status, and its poll. */
const BRANCH_STATUS = { ttl: 10_000, poll: 15_000 }
const SIDEBAR = { ttl: 30_000, poll: 60_000 }
const SESSIONS = { ttl: 10_000, poll: 20_000 }

import { WIDENED_FETCH } from '../lib/conversationScope.ts'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return (await response.json()) as T
}

export function branchStatus(workspace: string, card: string): BranchStatusData | null {
  const path =
    `/api/card-branch-status?cardId=${encodeURIComponent(card)}` +
    `&workspace=${encodeURIComponent(workspace)}`
  return read<BranchStatusData>(
    branchStatusKey(workspace, card),
    () => getJson<BranchStatusData>(path),
    BRANCH_STATUS,
  )
}

export function sidebarData(): SidebarData | null {
  return read<SidebarData>(
    SIDEBAR_DATA_KEY,
    () => getJson<SidebarData>('/api/sidebar-data'),
    SIDEBAR,
  )
}

/** Conversations across every workspace the user can see. spec: SCOP */
export function recentSessions(limit = WIDENED_FETCH): SessionsResponse | null {
  return read<SessionsResponse>(
    recentSessionsKey(limit, null),
    () => getJson<SessionsResponse>(`/api/sessions?recent=true&limit=${limit}`),
    SESSIONS,
  )
}

/**
 * Dismiss a conversation from the recent list.
 *
 * The server dismisses every conversation the row stands for — all of a card's
 * — and echoes the ids it cleared, so the caller can drop exactly those rather
 * than guessing. Returns null when the write failed, which means the server
 * still has them and the rows should come back. spec: SCOP
 */
export async function dismissSessions(sessionId: string): Promise<string[] | null> {
  try {
    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ dismissedFromRecent: true }),
    })
    if (!response.ok) return null
    const data = (await response.json().catch(() => null)) as { dismissedIds?: string[] } | null
    const ids = data?.dismissedIds
    return Array.isArray(ids) ? ids : [sessionId]
  } catch {
    return null
  }
}

/**
 * Mint a bearer for the user's paired device. Returns null when there is no
 * device or no session, which are both ordinary states rather than errors.
 */
export async function deviceToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/local-mode/bearer-token', {
      method: 'POST',
      credentials: 'same-origin',
    })
    if (!response.ok) return null
    const data = (await response.json()) as { token?: string }
    return data.token ?? null
  } catch {
    return null
  }
}
