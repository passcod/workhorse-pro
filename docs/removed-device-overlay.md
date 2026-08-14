# Removed: live paired-device state

Removed in "Remove the paired-device overlay". Kept here so it can be put back
without rediscovering how it hooked up.

## What it did

A conversation on a card checked out to the user's own device knows more than
the shared cloud record does until the turn ends — the device updates its own
session row as it goes and only pushes terminal metadata back. The app corrects
this in its own sidebar with `useSidebarLocalOverlay`. Because the widened list
*replaces* the app's list, rows lost that correction, and this restored it.

## Why it went

By the time the widened list was rebuilt from `ConversationsList`, row labels
came from the card's title rather than the conversation's preview — so the
overlay's only remaining contribution was one running indicator: marking a row
as running when the agent was on the user's own device, and only while the list
was widened. The cloud event stream already covers agents running in the cloud;
this covered the device-run case alone.

For that it cost `optional_host_permissions: ["*://*/*"]` — the broadest thing
in the manifest — plus this module, a grant control on the preferences page, an
in-sidebar prompt, instance-URL plumbing, and the background script (whose only
job was opening the preferences page for that prompt). None of it was ever run
in a browser.

## What putting it back requires

- `optional_host_permissions: ["*://*/*"]` in the manifest. It cannot be
  narrowed: the device's address is only known at runtime.
- A background script, and `OPEN_OPTIONS_MESSAGE` in `lib/messages.ts`. A
  content script cannot call `runtime.openOptionsPage`.
- A `deviceOverlay` switch in `prefs.ts`, and the paired-device section of the
  preferences page (a grant button, a status line).
- `setDeviceNotifier(reconciler.schedule)` in `content/index.ts`, so a landed
  poll schedules a pass.
- In `features/conversationScope.ts`, before building rows:

```ts
const held = new Set(sidebar?.myLocalInstance?.cardIds ?? [])
const localIds = pool
  .filter((session) => session.cardId !== null && held.has(session.cardId))
  .map((session) => session.id)
const overlay = prefs.deviceOverlay
  ? deviceOverlay(sidebar?.myLocalInstance?.url ?? null, localIds)
  : new Map<string, SessionSummary>()

const running = new Set(runningSessions())
for (const [id, summary] of overlay) {
  if (summary.agentActiveAt != null) running.add(id)
}
```

  and, when the permission is wanted but missing, a prompt after the list:

```ts
const wantsDevice = prefs.deviceOverlay && localIds.length > 0 && devicePermitted() === false
```

  which messages the background script to open the preferences page.

## The constraint that shaped it

The permission cannot be requested from the content script: content scripts get
`storage`, `runtime`, `i18n` and part of `extension`, and `permissions` is not
among them. A background script cannot request it either, because
`permissions.request()` needs a user gesture. So the grant has to happen on an
extension page, which has no way to ask the app for the device's address — hence
the content script leaving it in `storage.local` under `lastKnownInstanceUrl`
for the preferences page to find.

`deviceToken()` in `data/workhorse.ts` and `SessionSummary` in `data/types.ts`
were left in place; both are still small and harmless, and are what a
restoration would build on.

## The module as it was

```ts
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
```
