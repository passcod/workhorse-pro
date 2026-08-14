/**
 * Markup fixtures standing in for the Workhorse app.
 *
 * WHAT THESE PROVE, AND WHAT THEY DO NOT
 *
 * These are hand-written from a reading of the app's components — the pull
 * request section's disclosure rows and collapsed bar, and the sidebar's
 * conversations header. They pin the anchors against a model of that markup,
 * which catches a selector broken by an edit to `anchors.ts`.
 *
 * They do NOT prove the anchors match the app as it actually renders. Only
 * markup captured from a running Workhorse does that. Replacing the strings
 * below with a real capture is the intended upgrade, and the tests should not
 * need to change when it happens.
 *
 * The shapes reproduced here:
 *
 * - A disclosure row is a header carrying `aria-expanded` whose first child is
 *   the label, followed by a content div when open.
 * - The branch dropdown carries `aria-expanded` and `title="Advanced branch
 *   controls"`, and renders only inside the expanded detail.
 * - Before a pull request exists, the detail is opened by
 *   `button[title="Branch details"]`; afterwards by the collapsed bar's own
 *   button, which sits in a row with `a[title="Open on GitHub"]`.
 *
 * spec: INJ
 */

function disclosure(label: string, open: boolean, right = ''): string {
  return `
    <div tabindex="0" aria-expanded="${open}">
      <span>${label}</span>
      <span>${right}</span>
    </div>
    ${open ? '<div class="disclosure-content"></div>' : ''}
  `
}

export interface PrSectionOptions {
  hasPr?: boolean
  detailExpanded?: boolean
  branchDropdownOpen?: boolean
  checksOpen?: boolean
  reviewOpen?: boolean
}

export function prSection(options: PrSectionOptions = {}): string {
  const {
    hasPr = true,
    detailExpanded = false,
    branchDropdownOpen = false,
    checksOpen = false,
    reviewOpen = false,
  } = options

  const collapsedBar = hasPr
    ? `<div class="bar">
         <button type="button"><span>Add the thing</span><span>#78</span></button>
         <a href="https://github.com/o/r/pull/78" title="Open on GitHub">↗</a>
       </div>`
    : `<div class="bar">
         <button type="button">Create PR</button>
         <button type="button" title="Branch details">v</button>
       </div>`

  const detail = detailExpanded
    ? `<div class="detail">
         ${disclosure('Review Hero', reviewOpen, 'Run')}
         ${disclosure('Checks', checksOpen, 'Passing')}
         <div tabindex="0" aria-expanded="${branchDropdownOpen}" title="Advanced branch controls">
           <span>wh-078-add-the-thing</span>
         </div>
         <div class="based-on">
           <span>Based on</span>
           <span><button type="button">main</button></span>
         </div>
         <div class="status-row"><span>Local</span><span>Clean</span></div>
       </div>`
    : ''

  return `<div class="pr-section">${collapsedBar}${detail}</div>`
}

/**
 * The Conversations section of the sidebar.
 *
 * Shape reproduced from `NavRow` and `ConversationsList`: the row is a div
 * wrapping a label element and a trailing cluster of control buttons, and the
 * list is the row's *sibling*, not its child. The scope control belongs in
 * that cluster — anywhere else and it either inherits the label's layout or,
 * inside the label's link, navigates instead of toggling.
 */
export function sidebar(options: { withList?: boolean } = {}): string {
  const { withList = true } = options
  return `
    <aside>
      <nav>
        <div class="nav-section">
          <div class="nav-row group">
            <span class="nav-label">
              <svg class="icon"></svg>
              <span class="truncate">Conversations</span>
            </span>
            <div class="nav-controls">
              <button type="button" title="New">+</button>
            </div>
          </div>
          ${
            withList
              ? `<div class="conversations-list">
            <div class="row"><a href="/workhorse/cards/WH-1?session=one">One</a></div>
            <div class="row"><a href="/workhorse/cards/WH-2?session=two">Two</a></div>
          </div>`
              : ''
          }
        </div>
      </nav>
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

/**
 * The artefact column: the header bar over the view the artefact renders into.
 *
 * Shape reproduced from `SpecHeaderBar` and the artifact column around it. The
 * parts the anchors depend on:
 *
 * - The toggle is a wrapper of `button[type="button"]`, carrying no attribute
 *   of its own. Only its segment labels distinguish it, which is why the
 *   mockup variant below matters: it is the same component, in the same corner
 *   of the same bar, with `Desktop/Tablet/Mobile` in it.
 * - The bar always renders the file-stepping controls, and
 *   `button[title="Previous file"]` is what identifies it.
 * - The artefact renders into the bar's next sibling.
 *
 * spec: DIFF
 */
export function artefactPane(
  options: { segments?: string[]; selected?: string } = {},
): string {
  const { segments = ['File', 'Changes'], selected = segments[0] } = options
  const buttons = segments
    .map(
      (label) =>
        `<button type="button" class="${label === selected ? 'bg-[var(--bg-surface)]' : 'text-[var(--text-muted)]'}">${label}</button>`,
    )
    .join('')

  return `
    <div class="artifact-column">
      <div class="header-bar">
        <button type="button" title="Previous file">^</button>
        <button type="button" title="Next file">v</button>
        <span class="file-name">overview.md</span>
        <div class="segmented mr-1">${buttons}</div>
        <button type="button" title="Expand">[]</button>
      </div>
      <div class="artifact-view"><p>rendered artefact</p></div>
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
