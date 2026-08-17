/**
 * Markup fixtures standing in for the Workhorse app.
 *
 * WHAT THESE PROVE, AND WHAT THEY DO NOT
 *
 * These are hand-written from a reading of the app's components — the pull
 * request section's disclosure rows and collapsed bar. They pin the anchors
 * against a model of that markup, which catches a selector broken by an edit to
 * `anchors.ts`.
 *
 * They do NOT prove the anchors match the app as it actually renders. Only
 * markup captured from a running Workhorse does that. Replacing the strings
 * below with a real capture is the intended upgrade, and the tests should not
 * need to change when it happens.
 *
 * The shapes reproduced here:
 *
 * - A disclosure row (`DisclosureRow`) is a header carrying `aria-expanded` and
 *   the app's own test id, whose first child is the label, followed by a content
 *   div when open. Checks and Review Hero are both ones, and each holds its own
 *   readings inside — which is where the extension's named jobs join them.
 * - The branch disclosure (`IdentityRow`) carries `aria-expanded` and
 *   `title="Branch detail"`, with `data-testid="pr-branch-chevron"` on its
 *   chevron. It renders only inside the expanded detail, which is what makes its
 *   presence the detail's own expanded state.
 * - The detail is opened by the bar's title row: a button carrying no title of
 *   its own, whose chevron carries the app's own test id — `pr-create-chevron`
 *   before a pull request exists, `pr-detail-chevron` once one does. Beside it
 *   sit the Create button (before a PR) and the bar's overflow menu trigger.
 *
 * spec: INJ
 */

/** A `DisclosureRow`: header with the app's test id, content div when open. */
function disclosure(label: string, testId: string, open: boolean, right = ''): string {
  return `
    <div tabindex="0" aria-expanded="${open}" data-testid="${testId}">
      <span>${label}</span>
      <span>${right}<svg data-testid="${testId}-chevron"></svg></span>
    </div>
    ${open ? `<div class="disclosure-content" data-content="${testId}"></div>` : ''}
  `
}

/** The bar's expand toggle: a button wrapping the title and a chevron that
 *  carries the app's own test id. */
function barTitleRow(chevronTestId: string, inner: string): string {
  return `
    <button type="button">
      ${inner}
      <svg data-testid="${chevronTestId}"></svg>
    </button>
  `
}

/** The bar's overflow menu trigger, which L26 restored beside the title row. */
const barMenu = `<button type="button" data-testid="pr-bar-menu-trigger">⋯</button>`

export interface PrSectionOptions {
  hasPr?: boolean
  detailExpanded?: boolean
  branchDropdownOpen?: boolean
  reviewOpen?: boolean
  checksOpen?: boolean
}

export function prSection(options: PrSectionOptions = {}): string {
  const {
    hasPr = true,
    detailExpanded = false,
    branchDropdownOpen = false,
    reviewOpen = false,
    checksOpen = false,
  } = options

  const collapsedBar = hasPr
    ? `<div class="bar">
         ${barTitleRow('pr-detail-chevron', '<span>Add the thing</span><span>#78</span>')}
         ${barMenu}
       </div>`
    : `<div class="bar">
         <button type="button">Create PR</button>
         ${barTitleRow('pr-create-chevron', '<span>Add the thing</span>')}
         ${barMenu}
       </div>`

  const detail = detailExpanded
    ? `<div class="detail">
         ${disclosure('Review Hero', 'pr-review-hero-row', reviewOpen, 'Run')}
         ${disclosure('Checks', 'pr-checks-row', checksOpen, 'Passing')}
         <div tabindex="0" aria-expanded="${branchDropdownOpen}" title="Branch detail">
           <span data-testid="pr-merge-into-row">Merge into</span>
           <span><button type="button">main</button></span>
           <svg data-testid="pr-branch-chevron"></svg>
         </div>
         <div class="status-row"><span>Local</span><span>Clean</span></div>
       </div>`
    : ''

  return `<div class="pr-section">${collapsedBar}${detail}</div>`
}

/**
 * The branding in the sidebar's top corner.
 *
 * Shape reproduced from `Sidebar`: the header lockup is a flex row holding the
 * `Logo` svg, then a span carrying the app's name, then a right-aligned cluster
 * of controls. The `Logo` is `aria-hidden` — the name beside it is what carries
 * the accessible name.
 *
 * The retracted rail, rendered instead of the header's lockup while the sidebar
 * is minimised on a regular-width viewport, stacks the same `Logo` above the
 * control that reveals the sidebar again. It carries no name at all, so there
 * is no wordmark in it to resolve a mark from.
 *
 * spec: BRND
 */
export function branding(options: { collapsed?: boolean } = {}): string {
  const { collapsed = false } = options

  if (collapsed) {
    return `
      <div class="rail">
        <svg class="logo" width="26" height="26" aria-hidden="true"></svg>
        <button type="button" title="Show sidebar"><svg class="panel"></svg></button>
      </div>
    `
  }

  return `
    <aside>
      <div class="px-3 pt-4 pb-2">
        <div class="flex items-center gap-2 px-1 mb-3">
          <svg class="logo" width="26" height="26" aria-hidden="true"></svg>
          <span class="text-[15px] font-bold">Workhorse</span>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" title="Hide sidebar"><svg class="panel"></svg></button>
          </div>
        </div>
      </div>
    </aside>
  `
}

/**
 * The sidebar's workspace switcher.
 *
 * Shape reproduced from the header's switcher: a trigger button carrying the
 * active workspace's name and a chevron, and — only while it is open — an
 * overlay plus the menu itself. The menu is a row per workspace, each a link
 * whose first child is the name and which can carry an unread count after it,
 * then a divider and the add-workspace control.
 *
 * The trigger's own label matters: it reads a workspace name too, so a
 * selector for the rows that reached it would sort the trigger into the menu.
 *
 * spec: WSRT
 */
export function workspaceSwitcher(
  options: { open?: boolean; names?: string[]; active?: string; unread?: Record<string, number> } = {},
): string {
  const {
    open = true,
    names = ['Tupaia', 'Tamanu', 'Workhorse Pro'],
    active = names[0] ?? '',
    unread = {},
  } = options

  const rows = names
    .map((name) => {
      const count = unread[name] ?? 0
      return `<a href="/${encodeURIComponent(name.toLowerCase())}" data-active="${name === active}">
          <span class="truncate min-w-0">${name}</span>
          ${count > 0 ? `<span class="badge">${count}</span>` : ''}
        </a>`
    })
    .join('')

  const menu = open
    ? `<div class="fixed inset-0" data-overlay></div>
       <div class="menu">
         ${rows}
         <div class="divider"></div>
         <button type="button"><svg class="plus"></svg>Add workspace…</button>
       </div>`
    : ''

  return `
    <div class="sidebar-header">
      <div class="relative">
        <button type="button">
          <span class="truncate">${active}</span>
          <span><svg class="chevron"></svg></span>
        </button>
        ${menu}
      </div>
    </div>
  `
}

export function composerArea(): string {
  return `
    <div class="composer">
      <textarea placeholder="Continue the conversation..."></textarea>
      <div class="composer-actions"><button type="button">Send</button></div>
    </div>
  `
}
