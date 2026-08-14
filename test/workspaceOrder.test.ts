import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'
import { workspaceSwitcher } from './fixtures/app.ts'

installDom()
const { workspaceOrder } = await import('../src/features/workspaceOrder.ts')
const { compareWorkspaceNames, sortByName } = await import('../src/lib/workspaceOrder.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const { anchors } = await import('../src/content/anchors.ts')

const feature = workspaceOrder()

function reconcile(overrides: Partial<typeof PREF_DEFAULTS> = {}): void {
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS, ...overrides },
    route: { workspace: 'workhorse', card: null, filePath: null, view: null },
    schedule: () => {},
  })
}

/** The names the menu currently reads, top to bottom. */
function menuOrder(): string[] {
  return anchors.workspaceSwitcherRows().map((row) => anchors.workspaceRowName(row))
}

/** What the menu holds, rows included, as a tag-per-child sketch. */
function menuShape(): string[] {
  const menu = anchors.workspaceSwitcherMenu()!
  return [...menu.children].map((child) => child.tagName.toLowerCase())
}

// ── The ordering rule ────────────────────────────────────────────────────

test('names order alphabetically, ignoring case', () => {
  assert.ok(compareWorkspaceNames('alpha', 'Beta') < 0)
  assert.ok(compareWorkspaceNames('Beta', 'alpha') > 0)
  assert.equal(compareWorkspaceNames('tamanu', 'Tamanu'), 0)
})

test('digits in a name order by value', () => {
  assert.ok(compareWorkspaceNames('Site 2', 'Site 10') < 0)
})

test('names that order the same keep the order they came in', () => {
  const rows = [{ name: 'Tamanu' }, { name: 'tamanu' }, { name: 'TAMANU' }]
  assert.deepEqual(
    sortByName(rows, (row) => row.name).map((row) => row.name),
    ['Tamanu', 'tamanu', 'TAMANU'],
  )
})

test('sorting leaves the input alone', () => {
  const rows = [{ name: 'Tupaia' }, { name: 'Tamanu' }]
  sortByName(rows, (row) => row.name)
  assert.deepEqual(
    rows.map((row) => row.name),
    ['Tupaia', 'Tamanu'],
  )
})

// ── The menu ─────────────────────────────────────────────────────────────

beforeEach(() => {
  setBody(workspaceSwitcher({ names: ['Tupaia', 'Tamanu', 'Workhorse Pro'] }))
})

test('an open menu is put in name order', () => {
  assert.deepEqual(menuOrder(), ['Tupaia', 'Tamanu', 'Workhorse Pro'])
  reconcile()
  assert.deepEqual(menuOrder(), ['Tamanu', 'Tupaia', 'Workhorse Pro'])
})

test('the divider and the add-workspace control keep the end of the menu', () => {
  reconcile()
  assert.deepEqual(menuShape(), ['a', 'a', 'a', 'div', 'button'])
})

test('the switcher trigger is not one of the rows', () => {
  reconcile()
  // The trigger reads a workspace name too, so a mis-resolved row selector
  // would either sort it into the menu or leave a row behind.
  assert.equal(anchors.workspaceSwitcherRows().length, 3)
  assert.equal(
    document.querySelector('.sidebar-header > .relative > button > span')?.textContent?.trim(),
    'Tupaia',
  )
})

test('a menu already in order is not touched', () => {
  reconcile()
  const menu = anchors.workspaceSwitcherMenu()!
  const observer = new MutationObserver(() => {})
  observer.observe(menu, { childList: true })
  reconcile()
  // Re-inserting nodes that are already in place costs a click or a hover in
  // progress, and a pass runs on every change the app makes anywhere.
  assert.deepEqual(observer.takeRecords(), [])
  observer.disconnect()
  assert.deepEqual(menuOrder(), ['Tamanu', 'Tupaia', 'Workhorse Pro'])
})

test('rows are moved, not rebuilt', () => {
  const before = anchors.workspaceSwitcherRows()
  const tupaia = before[0]!
  reconcile()
  const after = anchors.workspaceSwitcherRows()
  assert.equal(after[1], tupaia, 'the row was replaced by an equivalent')
})

test('a row keeps what it carries across the move', () => {
  setBody(
    workspaceSwitcher({
      names: ['Tupaia', 'Tamanu'],
      active: 'Tupaia',
      unread: { Tamanu: 3 },
    }),
  )
  reconcile()
  const [first, second] = anchors.workspaceSwitcherRows()
  assert.equal(anchors.workspaceRowName(first!), 'Tamanu')
  assert.equal(first!.querySelector('.badge')?.textContent, '3')
  assert.equal(second!.dataset.active, 'true')
  assert.equal(second!.getAttribute('href'), '/tupaia')
})

test('an unread count does not sort as part of the name', () => {
  setBody(workspaceSwitcher({ names: ['Zulu', 'Alpha'], unread: { Alpha: 9 } }))
  reconcile()
  assert.deepEqual(menuOrder(), ['Alpha', 'Zulu'])
})

test('the switch turns it off', () => {
  reconcile({ sortWorkspaces: false })
  assert.deepEqual(menuOrder(), ['Tupaia', 'Tamanu', 'Workhorse Pro'])
})

test('a closed menu is nothing to order', () => {
  setBody(workspaceSwitcher({ open: false }))
  reconcile()
  assert.equal(anchors.workspaceSwitcherMenu(), null)
})

test('a single workspace is nothing to order', () => {
  setBody(workspaceSwitcher({ names: ['Tamanu'] }))
  reconcile()
  assert.deepEqual(menuShape(), ['a', 'div', 'button'])
})

test('a page with no switcher is not an error', () => {
  setBody('<div></div>')
  reconcile()
  assert.equal(anchors.workspaceSwitcherMenu(), null)
})

test('the attribute is preferred over the label fallback', () => {
  setBody(`
    <div class="menu" data-wh-workspace-switcher>
      <a href="/tupaia"><span>Tupaia</span></a>
      <a href="/tamanu"><span>Tamanu</span></a>
    </div>
    <div class="other"><button type="button">Add workspace…</button></div>
  `)
  reconcile()
  assert.deepEqual(menuOrder(), ['Tamanu', 'Tupaia'])
})
