import { anchors } from '../content/anchors.ts'
import type { Context, Feature } from '../content/reconcile.ts'
import { sortByName } from '../lib/workspaceOrder.ts'

/**
 * Put the workspace switcher's menu in alphabetical order.
 *
 * The app renders the rows in membership order, which reads as arbitrary. This
 * moves the app's own rows rather than rendering a menu of its own, so a row
 * keeps its unread count, its active styling, its link, and the app's own click
 * handling — and keyboard order matches what is on screen, which ordering by
 * style alone would not give. spec: WSRT
 */

export function workspaceOrder(): Feature {
  return {
    name: 'workspaceOrder',
    reconcile({ prefs }: Context) {
      if (!prefs.sortWorkspaces) return

      const menu = anchors.workspaceSwitcherMenu()
      if (!menu) return
      const rows = anchors.workspaceSwitcherRows()
      if (rows.length < 2) return

      const sorted = sortByName(rows, (row) => anchors.workspaceRowName(row))
      // Moving nodes that are already in place would cost a click or a hover in
      // progress, and a pass runs on every change the app makes anywhere.
      if (sorted.every((row, index) => row === rows[index])) return

      // Insert ahead of whatever follows the last row, so the rows stay the
      // leading block of the menu and the divider and add-workspace control
      // keep the end of it. Null when the rows are last, which appends.
      const after = rows[rows.length - 1]!.nextSibling
      for (const row of sorted) menu.insertBefore(row, after)

      // React re-renders this menu on its own account — an unread count
      // landing, say. Where that re-render moves rows back, it produces a DOM
      // change, which schedules the pass that orders them again. Nothing here
      // needs to detect it. spec: INJ
    },
  }
}
