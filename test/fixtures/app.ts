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

export function sidebar(): string {
  return `
    <aside>
      <div class="nav-section">
        <a class="nav-row" href="/workhorse/sessions"><span>Conversations</span></a>
        <div class="conversations-list">
          <a href="/workhorse/sessions/one">One</a>
          <a href="/workhorse/sessions/two">Two</a>
        </div>
      </div>
    </aside>
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
