import { read } from './store.ts'
import { branchStatusKey } from './keys.ts'
import type { BranchStatusData } from './types.ts'

/**
 * Reads against the app's own endpoints. Same-origin, so the session cookie
 * travels without the extension holding any credential. spec: DATA
 */

/** Matches the staleness the app applies to branch status, and its poll. */
const BRANCH_STATUS = { ttl: 10_000, poll: 15_000 }

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
