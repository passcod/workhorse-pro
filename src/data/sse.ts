import { reportOnce } from '../log.ts'
import type { RecentSession } from './types.ts'

/**
 * The app's session event stream.
 *
 * Same-origin, cookie-authenticated, and scoped to the user rather than to the
 * active workspace — so it already carries everything a list spanning every
 * workspace needs, on one connection. spec: DATA
 */

const ENDPOINT = '/api/sidebar-events'
const RETRY_BASE = 1_000
const RETRY_CEILING = 30_000

let source: EventSource | null = null
let retryDelay = RETRY_BASE
let retryTimer: ReturnType<typeof setTimeout> | null = null
let notify: (() => void) | null = null

const running = new Set<string>()
/** Fields a `session_updated` frame has revised since the list was fetched. */
const revisions = new Map<string, Partial<RecentSession>>()

/** Session ids whose agent is currently running. */
export function runningSessions(): ReadonlySet<string> {
  return running
}

/** Apply any streamed revisions over a session as the list read it. */
export function reviseSession(session: RecentSession): RecentSession {
  const revision = revisions.get(session.id)
  return revision ? { ...session, ...revision } : session
}

function handle(raw: string): void {
  const event = JSON.parse(raw) as {
    type?: string
    sessionIds?: unknown
    session?: Record<string, unknown>
  }

  if (event.type === 'active_sessions' && Array.isArray(event.sessionIds)) {
    running.clear()
    for (const id of event.sessionIds) if (typeof id === 'string') running.add(id)
    notify?.()
    return
  }

  const session = event.session
  if (!session) return
  const id = typeof session.id === 'string' ? session.id : null
  if (!id) return

  if (event.type === 'agent_start') running.add(id)
  if (event.type === 'agent_stop') running.delete(id)

  if (
    event.type === 'agent_start' ||
    event.type === 'agent_stop' ||
    event.type === 'session_updated'
  ) {
    // Only the fields a row renders; anything else on the frame is the app's
    // business. This is what lets a row's preview and timestamp move without
    // the list being refetched. spec: SCOP
    const revision: Partial<RecentSession> = {}
    if (typeof session.title === 'string') revision.title = session.title
    if (typeof session.lastMessagePreview === 'string') {
      revision.lastMessagePreview = session.lastMessagePreview
    }
    if (typeof session.lastMessageAt === 'string') revision.lastMessageAt = session.lastMessageAt
    if (typeof session.messageCount === 'number') revision.messageCount = session.messageCount
    if (typeof session.waitingOnUser === 'boolean') revision.waitingOnUser = session.waitingOnUser
    revisions.set(id, { ...revisions.get(id), ...revision })
    notify?.()
  }
}

function connect(): void {
  source = new EventSource(ENDPOINT)

  source.onopen = () => {
    retryDelay = RETRY_BASE
  }

  source.onmessage = (event) => {
    try {
      handle(event.data as string)
    } catch (error) {
      reportOnce('sse.parse', error)
    }
  }

  source.onerror = () => {
    source?.close()
    source = null
    // Rows keep rendering from the last read while this is down; only the
    // running indicator is lost. spec: SCOP
    const delay = retryDelay
    retryDelay = Math.min(delay * 2, RETRY_CEILING)
    retryTimer = setTimeout(connect, delay)
  }
}

/** Open the stream if it is not already open. Idempotent. */
export function startSessionEvents(onChange: () => void): void {
  notify = onChange
  if (source || retryTimer) return
  connect()
}

/** Close the stream and forget what it told us. */
export function stopSessionEvents(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  source?.close()
  source = null
  running.clear()
  revisions.clear()
  retryDelay = RETRY_BASE
}
