import { ext } from '../ext.ts'
import { reportOnce } from '../log.ts'
import { deviceToken } from './workhorse.ts'
import type { SessionSummary } from './types.ts'

/**
 * Live state from the user's paired device.
 *
 * A conversation on a card checked out to the device knows more than the
 * shared record does until the turn ends. Reading it needs host access to an
 * address only known at runtime, which is why the permission is optional and
 * granted from the preferences page — a content script has no `permissions`
 * API, and a background script has no user gesture to request with. spec: DATA
 *
 * Everything here is separable: with no device, no permission, or a failed
 * read, callers get an empty overlay and rows show the shared record's values.
 */

const POLL = 5_000

let summaries = new Map<string, SessionSummary>()
let lastPoll = 0
let inflight = false
let token: string | null = null
let permitted: boolean | null = null
let permissionCheckedFor: string | null = null
let notify: (() => void) | null = null

export function setDeviceNotifier(fn: () => void): void {
  notify = fn
}

/** Where the last seen device address is left for the preferences page. */
export const INSTANCE_URL_KEY = 'lastKnownInstanceUrl'

function originOf(instanceUrl: string): string | null {
  try {
    return new URL(instanceUrl).origin + '/*'
  } catch {
    return null
  }
}

let rememberedInstance: string | null = null

/**
 * Record the device's address for the preferences page.
 *
 * The address is only known while a Workhorse tab is open, but the permission
 * has to be requested from the preferences page — which has no way to ask the
 * app. So the content script leaves it here when it sees one. spec: PREF
 */
function rememberInstance(instanceUrl: string): void {
  if (rememberedInstance === instanceUrl) return
  rememberedInstance = instanceUrl
  void ext.storage.local.set({ [INSTANCE_URL_KEY]: instanceUrl }).catch(() => {
    // Losing this only costs the preferences page its grant button.
  })
}

/**
 * Whether host access to this device has been granted. Null until the first
 * check resolves, so callers can distinguish "not yet known" from "refused".
 */
export function devicePermitted(): boolean | null {
  return permitted
}

function checkPermission(instanceUrl: string): void {
  const origin = originOf(instanceUrl)
  if (!origin || permissionCheckedFor === origin) return
  permissionCheckedFor = origin
  void ext.permissions
    .contains({ origins: [origin] })
    .then((has) => {
      permitted = has
      notify?.()
    })
    .catch((error: unknown) => {
      permitted = false
      reportOnce('device.permission', error)
    })
}

async function poll(instanceUrl: string, ids: string[]): Promise<void> {
  token ??= await deviceToken()
  if (!token) return
  const target = new URL(
    `/api/sessions-summary?ids=${encodeURIComponent(ids.join(','))}`,
    instanceUrl,
  ).toString()
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  })
  if (response.status === 401) {
    // The bearer is short-lived; drop it and mint a fresh one next time.
    token = null
    return
  }
  if (!response.ok) throw new Error(`sessions-summary ${response.status}`)
  const data = (await response.json()) as { sessions?: SessionSummary[] }
  const next = new Map<string, SessionSummary>()
  for (const session of data.sessions ?? []) next.set(session.id, session)
  summaries = next
  notify?.()
}

/**
 * The device's view of the given sessions, refreshing in the background while
 * there is something to overlay.
 *
 * A failed read keeps the last known values rather than reverting to the
 * shared record's, so a transient failure does not make rows flicker
 * backwards. spec: DATA
 */
export function deviceOverlay(
  instanceUrl: string | null,
  ids: string[],
): ReadonlyMap<string, SessionSummary> {
  if (!instanceUrl || ids.length === 0) return summaries

  rememberInstance(instanceUrl)
  checkPermission(instanceUrl)
  if (permitted !== true) return summaries

  if (!inflight && Date.now() - lastPoll >= POLL) {
    inflight = true
    lastPoll = Date.now()
    poll(instanceUrl, ids)
      .catch((error: unknown) => reportOnce('device.poll', error))
      .finally(() => {
        inflight = false
      })
  }
  return summaries
}

/** Ask for host access to a device. Only an extension page can call this. */
export async function requestDeviceAccess(instanceUrl: string): Promise<boolean> {
  const origin = originOf(instanceUrl)
  if (!origin) return false
  const granted = await ext.permissions.request({ origins: [origin] })
  permitted = granted
  permissionCheckedFor = origin
  return granted
}

/** Test seam. */
export function resetDevice(): void {
  summaries = new Map()
  lastPoll = 0
  token = null
  permitted = null
  permissionCheckedFor = null
  rememberedInstance = null
}
