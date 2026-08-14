/**
 * The order workspaces read in. spec: WSRT
 *
 * Pure, so the rule is testable without a DOM: the feature reads names off the
 * app's rows and asks this where they go.
 */

/**
 * Compare two workspace names as a person reading the list would.
 *
 * The locale is pinned rather than left to the runtime's default, so the order
 * is the same on every machine — and the same in a test as in a browser.
 *
 * `base` sensitivity ignores case and accents, which is what makes the order
 * independent of how a workspace was capitalised. Names that compare equal
 * under it are left to the caller's sort to keep in place.
 */
export function compareWorkspaceNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })
}

/**
 * The rows in name order.
 *
 * A copy: the input is the live order, which the caller compares against to
 * decide whether anything needs moving at all. `sort` is stable, so two rows
 * whose names compare equal keep the order the app gave them.
 */
export function sortByName<T>(rows: readonly T[], nameOf: (row: T) => string): T[] {
  return [...rows].sort((a, b) => compareWorkspaceNames(nameOf(a), nameOf(b)))
}
