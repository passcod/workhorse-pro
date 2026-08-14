import { anchors } from '../content/anchors.ts'
import { ensure, ensureAfter, el, remove } from '../content/dom.ts'
import { marked, type Context, type Feature } from '../content/reconcile.ts'
import {
  bellIcon,
  closeIcon,
  hourglassIcon,
  messageIcon,
  statusIcon,
  workspaceScopeIcon,
} from '../content/icons.ts'
import { dismissSessions, recentSessions, sidebarData } from '../data/workhorse.ts'
import { reviseSession, runningSessions, startSessionEvents } from '../data/sse.ts'
import { deviceOverlay, devicePermitted } from '../data/device.ts'
import { scopeGlyphColours, workspaceColours } from '../lib/colours.ts'
import {
  dedupeSessions,
  dismissalSiblings,
  mayHaveOlder,
  rowModel,
  type RowModel,
} from '../lib/conversations.ts'
import { WIDENED_FETCH, WIDENED_ROWS } from '../lib/conversationScope.ts'
import { OPEN_OPTIONS_MESSAGE } from '../lib/messages.ts'
import { ext } from '../ext.ts'
import { setPref } from '../prefs.ts'
import type { RecentSession, SessionSummary } from '../data/types.ts'

/**
 * Widen the conversations list past the active workspace.
 *
 * The rows are the app's rows: one per card rather than one per conversation,
 * carrying the card's status glyph, its title, and its code — with the
 * workspace's colour on the code, a dismiss control in the code's slot on
 * hover, and the same hover card beside the row. The list is the app's list
 * widened, not a different list. spec: SCOP
 */

const TOGGLE = 'scope-toggle'
const LIST = 'scope-list'
const NOTICE = 'device-notice'
const TOOLTIP_ID = 'row-tooltip'
const TOOLTIP_WIDTH = 208
const TOOLTIP_GAP = 8

/** Rows dismissed in this tab, held until the server list reflects them. */
const pendingDismissals = new Set<string>()
/** Rows paged in by **Older**, and where the next page starts. */
let extraSessions: RecentSession[] = []
let nextCursor: string | null = null
let expanded = false
let loading = false
let loadError = false

function activeSessionId(): string | null {
  const url = new URL(location.href)
  const fromQuery = url.searchParams.get('session')
  if (fromQuery) return fromQuery
  const match = /\/sessions\/([^/?#]+)/.exec(url.pathname)
  return match?.[1] ?? null
}

// ── The hover card ───────────────────────────────────────────────────────

function hideTooltip(): void {
  remove(TOOLTIP_ID)
}

/**
 * Show the row's hover card beside it, flipping to the row's other side when
 * there is no room. Appended to the body rather than the row: the sidebar
 * scrolls, and a card inside it would be clipped.
 */
function showTooltip(row: HTMLElement, model: RowModel): void {
  hideTooltip()
  const rect = row.getBoundingClientRect()
  const card = marked(el('div', 'whp-tooltip'))
  card.setAttribute('data-whp-id', TOOLTIP_ID)
  card.setAttribute('role', 'tooltip')

  card.appendChild(el('div', 'whp-tooltip-title', model.tooltip.title))

  if (model.tooltip.workspaceName || model.tooltip.cardCode) {
    const meta = el('div', 'whp-tooltip-meta')
    if (model.tooltip.workspaceName) {
      const name = el('span', 'whp-tooltip-ws', model.tooltip.workspaceName)
      if (model.tooltip.colour) name.style.color = model.tooltip.colour
      meta.appendChild(name)
    }
    if (model.tooltip.workspaceName && model.tooltip.cardCode) {
      meta.appendChild(el('span', 'whp-tooltip-dot'))
    }
    if (model.tooltip.cardCode) {
      const code = el('span', 'whp-tooltip-code', model.tooltip.cardCode)
      if (model.tooltip.colour) code.style.color = model.tooltip.colour
      meta.appendChild(code)
    }
    card.appendChild(meta)
  }

  if (model.tooltip.state) {
    const state = el(
      'div',
      model.tooltip.state.accent ? 'whp-tooltip-state whp-accent' : 'whp-tooltip-state',
    )
    state.appendChild(
      model.tooltip.state.kind === 'bell'
        ? bellIcon(10)
        : model.tooltip.state.kind === 'hourglass'
          ? hourglassIcon(model.waitingOnMerge, 10)
          : statusIcon(model.statusIconStyle, model.statusColour, 10),
    )
    state.appendChild(document.createTextNode(model.tooltip.state.label))
    card.appendChild(state)
  }

  document.body.appendChild(card)

  // Measured rather than assumed: the title wraps, so the height is not known
  // until it has rendered.
  const height = card.getBoundingClientRect().height
  const left =
    rect.right + TOOLTIP_GAP + TOOLTIP_WIDTH > window.innerWidth
      ? Math.max(TOOLTIP_GAP, rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH)
      : rect.right + TOOLTIP_GAP
  const top = Math.max(
    TOOLTIP_GAP,
    Math.min(rect.top - 4, window.innerHeight - height - TOOLTIP_GAP),
  )
  card.style.left = `${left}px`
  card.style.top = `${top}px`
}

// ── Rows ─────────────────────────────────────────────────────────────────

function indicatorFor(model: RowModel): SVGSVGElement {
  switch (model.indicator) {
    case 'bell':
      return bellIcon()
    case 'hourglass':
      return hourglassIcon(model.waitingOnMerge)
    case 'status':
      return statusIcon(model.statusIconStyle, model.statusColour)
    case 'project':
      // The app draws the project's emoji here; without a text glyph to hand,
      // its colour on the status ring is the closest honest stand-in.
      return statusIcon('not-started', model.projectColour)
    default:
      return messageIcon()
  }
}

function buildRow(model: RowModel, onDismiss: (id: string) => void): HTMLElement {
  const row = el('div', 'whp-row')
  if (model.active) row.classList.add('whp-row-active')

  const link = el('a', 'whp-row-link')
  link.href = model.href

  const indicator = el('span', 'whp-row-indicator')
  if (model.streaming) indicator.classList.add('whp-streaming')
  if (model.projectEmoji && model.indicator === 'project') {
    indicator.textContent = model.projectEmoji
  } else {
    indicator.appendChild(indicatorFor(model))
  }
  link.appendChild(indicator)

  link.appendChild(el('span', 'whp-row-label', model.label))

  if (model.slotText) {
    const slot = el('span', 'whp-row-code', model.slotText)
    slot.style.color = model.slotColour ?? 'var(--text-muted)'
    link.appendChild(slot)
  }
  row.appendChild(link)

  // The dismiss control occupies the code's slot on hover. With no code there
  // is nothing to fade, so a gradient masks the truncated label behind it.
  const dismissWrap = el('div', model.slotText ? 'whp-row-dismiss' : 'whp-row-dismiss whp-row-dismiss-masked')
  const button = el('button', 'whp-row-dismiss-button')
  button.type = 'button'
  button.title = 'Dismiss'
  button.setAttribute('aria-label', `Dismiss ${model.label}`)
  button.appendChild(closeIcon())
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onDismiss(model.id)
  })
  dismissWrap.appendChild(button)
  row.appendChild(dismissWrap)

  row.addEventListener('pointerenter', (event) => {
    if ((event as PointerEvent).pointerType === 'touch') return
    showTooltip(row, model)
  })
  row.addEventListener('pointerleave', hideTooltip)

  return row
}

// ── Paging ───────────────────────────────────────────────────────────────

function pageUrl(cursor: string): string {
  // Paging follows the scope in view: no workspace parameter widens the page
  // to every workspace, the same as the list itself.
  return `/api/sessions?recent=true&limit=50&cursor=${encodeURIComponent(cursor)}`
}

async function loadPage(cursor: string, schedule: () => void): Promise<void> {
  if (loading) return
  loading = true
  loadError = false
  schedule()
  try {
    const response = await fetch(pageUrl(cursor), { credentials: 'same-origin' })
    if (!response.ok) {
      loadError = true
      return
    }
    const data = (await response.json()) as { sessions?: RecentSession[]; nextCursor?: string | null }
    const incoming = data.sessions ?? []
    const existing = new Set(extraSessions.map((s) => s.id))
    const merged = [...extraSessions, ...incoming.filter((s) => !existing.has(s.id))]
    const capped = merged.length > 200
    extraSessions = merged.slice(0, 200)
    nextCursor = capped ? null : (data.nextCursor ?? null)
  } catch {
    loadError = true
  } finally {
    loading = false
    schedule()
  }
}

function moreButton(label: string, onClick: () => void): HTMLElement {
  const button = el('button', 'whp-more', label)
  button.type = 'button'
  button.addEventListener('click', onClick)
  return button
}

// ── The feature ──────────────────────────────────────────────────────────

export function conversationScope(): Feature {
  return {
    name: 'conversationScope',
    reconcile({ prefs, schedule }: Context) {
      const header = anchors.conversationsHeader()
      const controls = anchors.conversationsControls()
      const appList = anchors.conversationsList()

      const teardown = () => {
        remove(TOGGLE)
        remove(LIST)
        remove(NOTICE)
        hideTooltip()
        if (appList) appList.style.display = ''
      }

      if (!prefs.crossWorkspaceConversations || !header || !controls) {
        teardown()
        return
      }

      // The control lives in the header's own control cluster, alongside the
      // app's row buttons — which is also what keeps it clickable and keeps
      // the widened state undoable without a reload. spec: SCOP
      const toggle = ensure(controls, TOGGLE, () => {
        const button = el('button', 'whp-scope')
        button.type = 'button'
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          void setPref('scopeWide', !prefs.scopeWide)
        })
        return button
      })
      toggle.setAttribute('aria-pressed', String(prefs.scopeWide))
      toggle.title = prefs.scopeWide ? 'Show this workspace only' : 'Show all workspaces'

      const sidebar = sidebarData()
      const colours = workspaceColours((sidebar?.workspaces ?? []).map((w) => w.name))
      // Coloured while widened, plain otherwise — the control reads as a
      // miniature of the colouring it turns on.
      const glyphColours = prefs.scopeWide ? scopeGlyphColours([...colours.values()]) : []
      toggle.replaceChildren(workspaceScopeIcon(glyphColours))

      if (!prefs.scopeWide) {
        remove(LIST)
        remove(NOTICE)
        hideTooltip()
        if (appList) appList.style.display = ''
        // Flipping the scope drops the previous list's extras so they cannot
        // bleed into the next one.
        extraSessions = []
        nextCursor = null
        expanded = false
        return
      }

      const response = recentSessions(WIDENED_FETCH)
      if (!response) {
        // Leave the app's list in place rather than blanking the sidebar while
        // the first read is in flight.
        remove(LIST)
        return
      }

      startSessionEvents(schedule)
      if (appList) appList.style.display = 'none'

      const fetched = response.sessions
      const fetchedIds = new Set(fetched.map((s) => s.id))
      const pool = [...fetched, ...extraSessions.filter((s) => !fetchedIds.has(s.id))]
        .filter((s) => !pendingDismissals.has(s.id))
        .map(reviseSession)
      const deduped = dedupeSessions(pool)
      const visible = expanded ? deduped : deduped.slice(0, WIDENED_ROWS)

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

      const active = activeSessionId()
      const onDismiss = (sessionId: string) => {
        // A card row stands for every conversation on the card, so clear the
        // siblings too or the row snaps back to the next most recent.
        const siblings = dismissalSiblings(pool, sessionId)
        for (const id of siblings) pendingDismissals.add(id)
        hideTooltip()
        schedule()
        void dismissSessions(sessionId).then((confirmed) => {
          const ids = confirmed ?? siblings
          extraSessions = extraSessions.filter((s) => !ids.includes(s.id))
          if (confirmed === null) {
            // The write failed, so the server still has them — restoring the
            // rows keeps the list honest about what is there.
            for (const id of siblings) pendingDismissals.delete(id)
          }
          schedule()
        })
      }

      const container = ensureAfter(appList ?? header, LIST, () => el('div', 'whp-list'))
      const children: Node[] = visible.map((session) =>
        buildRow(rowModel(session, { colours, activeSessionId: active, streaming: running }), onDismiss),
      )

      if (
        mayHaveOlder({
          expanded,
          dedupedCount: deduped.length,
          fetchedCount: fetched.length,
          rowCount: WIDENED_ROWS,
          fetchLimit: WIDENED_FETCH,
        })
      ) {
        children.push(
          moreButton(loading ? 'Loading…' : 'Older', () => {
            expanded = true
            const last = fetched[fetched.length - 1]
            if (last) void loadPage(last.id, schedule)
            else schedule()
          }),
        )
      } else if (expanded && nextCursor) {
        const cursor = nextCursor
        children.push(
          moreButton(loading ? 'Loading…' : 'Load more', () => void loadPage(cursor, schedule)),
        )
      }
      if (loadError) {
        children.push(
          moreButton('Failed to load — retry', () => {
            const cursor = nextCursor ?? fetched[fetched.length - 1]?.id
            if (cursor) void loadPage(cursor, schedule)
          }),
        )
      }

      container.replaceChildren(...children)

      const wantsDevice = prefs.deviceOverlay && localIds.length > 0 && devicePermitted() === false
      if (wantsDevice) {
        ensureAfter(container, NOTICE, () => {
          const node = el('div', 'whp-notice')
          node.appendChild(document.createTextNode('Device state unavailable — '))
          const button = el('button', undefined, 'grant access')
          button.type = 'button'
          button.addEventListener('click', () => {
            void ext.runtime.sendMessage({ type: OPEN_OPTIONS_MESSAGE })
          })
          node.appendChild(button)
          return node
        })
      } else {
        remove(NOTICE)
      }
    },
  }
}

/** Test seam. */
export function resetConversationScope(): void {
  pendingDismissals.clear()
  extraSessions = []
  nextCursor = null
  expanded = false
  loading = false
  loadError = false
}
