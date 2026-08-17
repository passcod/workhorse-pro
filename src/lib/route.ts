/**
 * What page the app is on, from the URL alone.
 *
 * Every route sits under `/[workspaceSlug]/…`, and the workspace slug is the
 * workspace's own name, so the card page supplies both parameters branch status
 * needs without the extension having to discover the card by any other means.
 * spec: DATA
 */

export interface Route {
  /** The workspace slug, which is also its name. Null off a workspace route. */
  workspace: string | null
  /** The card identifier, e.g. `WH-078`. Null when not on a card. */
  card: string | null
}

export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const workspace = segments[0] ?? null
  if (!workspace) return { workspace: null, card: null }

  // Cards are reachable from the board and from the inbox, and both carry the
  // identifier in the same position.
  const section = segments[1]
  const isCard = section === 'cards' || section === 'inbox'
  const card = isCard ? (segments[2] ?? null) : null

  return { workspace, card }
}
