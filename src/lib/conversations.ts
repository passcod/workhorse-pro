import type { RecentSession } from '../data/types.ts'

/**
 * What a conversation row renders from.
 *
 * The app's list is not a list of conversations. Card-bound conversations
 * collapse to one row per card and project conversations to one per project,
 * each showing the most recent, so a row usually stands for a *card* and
 * carries the card's identity — its status glyph, its title, its code. This
 * module reproduces that derivation so the widened list is the same list, just
 * wider. spec: SCOP
 */

/** The trailing slot's stand-in on a row with no card code. */
export const NO_CARD_CODE_GLYPH = '···'

export type IndicatorKind = 'status' | 'project' | 'standalone' | 'bell' | 'hourglass'

export interface RowModel {
  id: string
  href: string
  label: string
  /** The card's code, shown in the trailing slot. Null off a card. */
  cardCode: string | null
  /** What the trailing slot shows: the code, or the glyph standing in for it. */
  slotText: string | null
  /** The workspace's colour, only while the list is widened. */
  slotColour: string | null
  indicator: IndicatorKind
  /** The status glyph to draw when `indicator` is `status`. */
  statusIconStyle: string | null
  statusColour: string | null
  /** The project's emoji and colour when `indicator` is `project`. */
  projectEmoji: string | null
  projectColour: string | null
  /** Whether the hourglass carries the merge dot. */
  waitingOnMerge: boolean
  streaming: boolean
  active: boolean
  tooltip: {
    title: string
    workspaceName: string | null
    cardCode: string | null
    colour: string | null
    state: { label: string; kind: IndicatorKind; accent: boolean } | null
  }
}

/**
 * Collapse conversations to rows: one per card, one per project, and one per
 * standalone conversation.
 *
 * Input must already be newest-first, which the server guarantees, so the
 * first occurrence of each card or project is the most recent and wins.
 */
export function dedupeSessions(sessions: readonly RecentSession[]): RecentSession[] {
  const seenCards = new Set<string>()
  const seenProjects = new Set<string>()
  return sessions.filter((session) => {
    if (session.cardId) {
      if (seenCards.has(session.cardId)) return false
      seenCards.add(session.cardId)
      return true
    }
    if (session.kind === 'project' && session.projectId) {
      if (seenProjects.has(session.projectId)) return false
      seenProjects.add(session.projectId)
      return true
    }
    return true
  })
}

/** Lowercase, hyphen-separated slug for a project name, as the app builds it. */
export function projectNameSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || 'project'
}

function hrefFor(session: RecentSession): string {
  const workspace = session.workspaceName
  if (!workspace) return '#'
  const slug = encodeURIComponent(workspace.toLowerCase())
  // A card-bound row opens the card with the conversation selected, not the
  // standalone conversation surface.
  if (session.cardId && session.cardIdentifier) {
    return `/${slug}/cards/${session.cardIdentifier}?session=${session.id}`
  }
  if (session.kind === 'project' && session.projectId && session.projectHash && session.projectName) {
    const segment = `${projectNameSlug(session.projectName)}-${session.projectHash}`
    return `/${slug}/projects/${segment}?session=${session.id}`
  }
  return `/${slug}/sessions/${session.id}`
}

/**
 * Build a row from a conversation.
 *
 * The indicator's precedence is the app's: a bell for a direct call to action
 * beats an hourglass for an ambient wait, streaming suppresses both because
 * the pulsing status takes the slot, and the bell clears on the row the user
 * is already looking at.
 */
export function rowModel(
  session: RecentSession,
  options: {
    colours: ReadonlyMap<string, string>
    activeSessionId: string | null
    streaming: ReadonlySet<string>
  },
): RowModel {
  const isCardBound = !!session.cardId
  const isProjectBound = session.kind === 'project' && !!session.projectId

  const label =
    session.cardTitle ??
    (isProjectBound ? session.projectName : null) ??
    session.title ??
    'New conversation'

  const active = options.activeSessionId === session.id
  const streaming = options.streaming.has(session.id)
  const showBell = session.waitingOnUser && !streaming && !active
  const showHourglass = session.waitingOnExternal && !showBell && !streaming

  const cardCode = isCardBound ? session.cardIdentifier : null
  // Only the widened list is coloured; with one workspace in view a colour
  // would say nothing. This list is always the widened one.
  const slotColour = session.workspaceName
    ? (options.colours.get(session.workspaceName.toLowerCase()) ?? null)
    : null
  // A row with no code still shows the workspace mark, so the slot reads as a
  // colour rather than as an absent code.
  const slotText = cardCode ?? (slotColour ? NO_CARD_CODE_GLYPH : null)

  const indicator: IndicatorKind = showBell
    ? 'bell'
    : showHourglass
      ? 'hourglass'
      : isCardBound
        ? 'status'
        : isProjectBound
          ? 'project'
          : 'standalone'

  // The tooltip's state line mirrors the indicator's precedence, so it always
  // names what the reader can see in the row.
  const state = showBell
    ? { label: 'Waiting on you', kind: 'bell' as const, accent: true }
    : showHourglass
      ? {
          label: session.waitingOnMerge ? 'Merge scheduled' : 'Queued for review',
          kind: 'hourglass' as const,
          accent: false,
        }
      : isCardBound && session.cardStatusLabel
        ? { label: session.cardStatusLabel, kind: 'status' as const, accent: false }
        : null

  return {
    id: session.id,
    href: hrefFor(session),
    label,
    cardCode,
    slotText,
    slotColour,
    indicator,
    statusIconStyle: session.cardStatusIconStyle,
    statusColour: session.cardStatusColour,
    projectEmoji: session.projectEmoji,
    projectColour: session.projectColour,
    waitingOnMerge: session.waitingOnMerge,
    streaming,
    active,
    tooltip: {
      title: label,
      workspaceName: session.workspaceName,
      cardCode,
      colour: slotColour,
      state,
    },
  }
}

/**
 * Which conversations a dismissal clears.
 *
 * A card row stands for every conversation on that card, so dismissing it has
 * to clear the siblings too — otherwise the row snaps back to the next most
 * recent conversation on the same card.
 */
export function dismissalSiblings(
  sessions: readonly RecentSession[],
  sessionId: string,
): string[] {
  const clicked = sessions.find((session) => session.id === sessionId)
  if (!clicked) return [sessionId]
  if (clicked.cardId) {
    return sessions.filter((s) => s.cardId === clicked.cardId).map((s) => s.id)
  }
  if (clicked.kind === 'project' && clicked.projectId) {
    return sessions
      .filter((s) => s.kind === 'project' && s.projectId === clicked.projectId)
      .map((s) => s.id)
  }
  return [sessionId]
}

/**
 * Whether **Older** should offer a deeper page.
 *
 * Shown when the loaded pool deduped to more rows than fit, or when the fetch
 * came back full — a full pool means the server had at least a page and may
 * hold older conversations the fetch never reached. Going on the deduped count
 * alone hides **Older** whenever a run of conversations on one card collapses
 * the pool below the row count, even though older ones exist.
 */
export function mayHaveOlder(options: {
  expanded: boolean
  dedupedCount: number
  fetchedCount: number
  rowCount: number
  fetchLimit: number
}): boolean {
  if (options.expanded) return false
  return options.dedupedCount > options.rowCount || options.fetchedCount >= options.fetchLimit
}
