import { read } from './store.ts'
import { branchStatusKey, subscriptionUsageKey } from './keys.ts'
import type { BranchStatusData, SubscriptionUsageData } from './types.ts'

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
 * Matches the app's own cadence for this key.
 *
 * The figure only moves when the paired device reports, and it reads every five
 * minutes, so asking faster re-fetches a payload that cannot have changed. The
 * app polls at a third of that interval to keep the age on screen close to
 * true, and the extension follows it rather than setting its own pace.
 */
const SUBSCRIPTION_USAGE = { ttl: 60_000, poll: 100_000 }

/**
 * The acting user's Claude subscription position.
 *
 * Almost always served from an observed response: the app polls this itself
 * while its meter is on screen, which is exactly when the usage stack wants it.
 * The extension's own read is the fallback for when observation is off or has
 * ceased to work. spec: DATA
 */
export function subscriptionUsage(): SubscriptionUsageData | null {
  return read<SubscriptionUsageData>(
    subscriptionUsageKey(),
    () => getJson<SubscriptionUsageData>('/api/me/subscription-usage'),
    SUBSCRIPTION_USAGE,
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
