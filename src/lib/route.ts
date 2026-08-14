/**
 * What page the app is on, from the URL alone.
 *
 * Every route sits under `/[workspaceSlug]/…`, and the workspace slug is the
 * workspace's own name — the same value the sessions endpoint filters by — so
 * the card page supplies both parameters branch status needs without the
 * extension having to discover the card by any other means. spec: DATA
 *
 * The open artefact and the view it is being read in come from the query, which
 * the app keeps current on every artefact click and every toggle. That makes
 * the URL a live reading of what is on screen rather than only how the page was
 * entered. spec: DIFF
 */

export interface Route {
  /** The workspace slug, which is also its name. Null off a workspace route. */
  workspace: string | null
  /** The card identifier, e.g. `WH-078`. Null when not on a card. */
  card: string | null
  /** Path of the artefact on screen, or null when none is open. */
  filePath: string | null
  /**
   * Which of the app's own two views it is showing.
   *
   * Absent for an artefact that has no such toggle — a mockup, whose toggle
   * selects a device instead.
   */
  view: 'file' | 'changes' | null
}

export function parseRoute(pathname: string, search = ''): Route {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const workspace = segments[0] ?? null
  if (!workspace) return { workspace: null, card: null, filePath: null, view: null }

  // Cards are reachable from the board and from the inbox, and both carry the
  // identifier in the same position.
  const section = segments[1]
  const isCard = section === 'cards' || section === 'inbox'
  const card = isCard ? (segments[2] ?? null) : null

  const params = new URLSearchParams(search)
  const filePath = card ? params.get('file') : null
  const viewParam = params.get('view')
  const view = viewParam === 'file' || viewParam === 'changes' ? viewParam : null

  return { workspace, card, filePath: filePath || null, view: filePath ? view : null }
}
