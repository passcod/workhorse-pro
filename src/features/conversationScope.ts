import { anchors } from '../content/anchors.ts'
import { ensureAfter, el, remove } from '../content/dom.ts'
import { marked, type Context, type Feature } from '../content/reconcile.ts'
import { recentSessions, sidebarData } from '../data/workhorse.ts'
import { reviseSession, runningSessions, startSessionEvents } from '../data/sse.ts'
import { deviceOverlay, devicePermitted } from '../data/device.ts'
import { scopeGlyphColours, workspaceColours } from '../lib/colours.ts'
import { OPEN_OPTIONS_MESSAGE } from '../lib/messages.ts'
import { ext } from '../ext.ts'
import { setPref } from '../prefs.ts'
import type { RecentSession, SessionSummary } from '../data/types.ts'

/**
 * Widen the sidebar's conversations list past the active workspace.
 *
 * The app's own list is hidden rather than removed while the scope is wide, so
 * React keeps owning it and narrowing restores it intact. spec: SCOP
 */

const TOGGLE = 'scope-toggle'
const LIST = 'scope-list'
const NOTICE = 'device-notice'

function buildToggle(onClick: () => void): HTMLButtonElement {
  const button = el('button', 'whx-scope')
  button.type = 'button'
  button.title = 'Conversations from every workspace'
  for (let i = 0; i < 4; i++) button.appendChild(el('span', 'whx-scope-glyph'))
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

function rowFor(
  session: RecentSession,
  colour: string | undefined,
  isRunning: boolean,
  live: SessionSummary | undefined,
): HTMLAnchorElement {
  const row = el('a', 'whx-conv')
  row.href = session.workspaceName
    ? `/${encodeURIComponent(session.workspaceName)}/sessions/${session.id}`
    : '#'

  const glyph = el('span', 'whx-conv-glyph')
  if (colour) glyph.style.background = colour
  glyph.title = session.workspaceName ?? ''
  row.appendChild(glyph)

  const title =
    session.title ??
    session.cardTitle ??
    live?.lastMessagePreview ??
    session.lastMessagePreview ??
    'Conversation'
  row.appendChild(el('span', 'whx-conv-title', title))

  if (isRunning) row.appendChild(el('span', 'whx-conv-running'))
  return row
}

export function conversationScope(): Feature {
  return {
    name: 'conversationScope',
    reconcile({ prefs, schedule }: Context) {
      const header = anchors.conversationsHeader()
      const appList = anchors.conversationsList()

      if (!prefs.crossWorkspaceConversations || !header) {
        remove(TOGGLE)
        remove(LIST)
        remove(NOTICE)
        if (appList) appList.style.display = ''
        return
      }

      // The control sits at the header whether or not the scope is wide; its
      // state and the feature's switch are separate things. spec: SCOP
      const toggle = ensureAfter(header.lastElementChild ?? header, TOGGLE, () =>
        buildToggle(() => {
          void setPref('scopeWide', !prefs.scopeWide)
        }),
      )
      toggle.setAttribute('aria-pressed', String(prefs.scopeWide))

      if (!prefs.scopeWide) {
        // Narrow scope leaves the sidebar entirely alone.
        remove(LIST)
        remove(NOTICE)
        if (appList) appList.style.display = ''
        return
      }

      const sidebar = sidebarData()
      const colours = workspaceColours((sidebar?.workspaces ?? []).map((w) => w.name))
      for (const [index, glyph] of [...toggle.children].entries()) {
        const sample = scopeGlyphColours([...colours.values()])[index]
        if (sample) (glyph as HTMLElement).style.background = sample
      }

      const response = recentSessions()
      if (!response) {
        // Nothing to show yet. Leave the app's list visible rather than
        // blanking the sidebar while the first read is in flight.
        remove(LIST)
        return
      }

      startSessionEvents(schedule)
      if (appList) appList.style.display = 'none'

      const sessions = response.sessions
        .map(reviseSession)
        .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))

      const held = new Set(sidebar?.myLocalInstance?.cardIds ?? [])
      const localIds = sessions
        .filter((session) => session.cardId !== null && held.has(session.cardId))
        .map((session) => session.id)
      const overlay = prefs.deviceOverlay
        ? deviceOverlay(sidebar?.myLocalInstance?.url ?? null, localIds)
        : new Map<string, SessionSummary>()

      const running = runningSessions()
      const container = ensureAfter(appList ?? header, LIST, () => el('div', 'whx-list'))
      container.replaceChildren(
        ...sessions.map((session) =>
          rowFor(
            session,
            colours.get((session.workspaceName ?? '').toLowerCase()),
            running.has(session.id) || overlay.get(session.id)?.agentActiveAt != null,
            overlay.get(session.id),
          ),
        ),
      )

      // Asked once, without pressing the point. spec: SCOP
      const wantsDevice =
        prefs.deviceOverlay && localIds.length > 0 && devicePermitted() === false
      if (wantsDevice) {
        const notice = ensureAfter(container, NOTICE, () => {
          const node = el('div', 'whx-notice')
          node.appendChild(document.createTextNode('Device state unavailable — '))
          const button = el('button', undefined, 'grant access')
          button.addEventListener('click', () => {
            void ext.runtime.sendMessage({ type: OPEN_OPTIONS_MESSAGE })
          })
          node.appendChild(marked(button))
          return node
        })
        notice.hidden = false
      } else {
        remove(NOTICE)
      }
    },
  }
}
