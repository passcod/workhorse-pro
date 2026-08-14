import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, installExtStub, setBody } from './dom.ts'
import { sidebar } from './fixtures/app.ts'

const dom = installDom()
const ext = installExtStub()

// The feature opens an event stream; jsdom has no EventSource.
;(globalThis as unknown as Record<string, unknown>).EventSource = class {
  close(): void {}
}

const sessions = [
  {
    id: 's1',
    title: null,
    lastMessagePreview: null,
    messageCount: 3,
    lastMessageAt: '2026-08-14T02:00:00.000Z',
    cardId: 'card-1',
    kind: 'card',
    waitingOnUser: false,
    waitingOnExternal: false,
    waitingOnMerge: false,
    cardIdentifier: 'WH-078',
    cardTitle: 'Replace the PR bar with a section',
    cardStatusIconStyle: 'almost-done',
    cardStatusColour: null,
    cardStatusLabel: 'Almost done',
    projectId: null,
    projectName: null,
    projectHash: null,
    projectEmoji: null,
    projectColour: null,
    workspaceName: 'Workhorse',
  },
  {
    id: 's2',
    title: null,
    lastMessagePreview: null,
    messageCount: 1,
    lastMessageAt: '2026-08-14T01:00:00.000Z',
    cardId: 'card-1',
    kind: 'card',
    waitingOnUser: false,
    waitingOnExternal: false,
    waitingOnMerge: false,
    cardIdentifier: 'WH-078',
    cardTitle: 'Replace the PR bar with a section',
    cardStatusIconStyle: 'almost-done',
    cardStatusColour: null,
    cardStatusLabel: 'Almost done',
    projectId: null,
    projectName: null,
    projectHash: null,
    projectEmoji: null,
    projectColour: null,
    workspaceName: 'Workhorse',
  },
]

const patched: string[] = []
;(globalThis as unknown as Record<string, unknown>).fetch = async (input: unknown, init?: RequestInit) => {
  const url = String(input)
  if (init?.method === 'PATCH') {
    patched.push(url)
    return { ok: true, status: 200, json: async () => ({ dismissedIds: ['s1', 's2'] }) }
  }
  if (url.includes('/api/sidebar-data')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        workspaces: [{ id: 'w1', name: 'Workhorse' }, { id: 'w2', name: 'Tamanu' }],
        recentSessions: [],
        myLocalInstance: null,
      }),
    }
  }
  if (url.includes('/api/sessions')) {
    return { ok: true, status: 200, json: async () => ({ sessions, nextCursor: null }) }
  }
  return { ok: false, status: 404, json: async () => ({}) }
}

const { conversationScope, resetConversationScope } = await import(
  '../src/features/conversationScope.ts'
)
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const store = await import('../src/data/store.ts')

const feature = conversationScope()
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

async function render(scopeWide: boolean): Promise<void> {
  const context = {
    prefs: { ...PREF_DEFAULTS, scopeWide },
    route: { workspace: 'workhorse', card: null },
    schedule: () => {},
  }
  feature.reconcile(context)
  await tick()
  feature.reconcile(context)
}

function rows(): Element[] {
  return [...document.querySelectorAll('.whp-row')]
}

beforeEach(() => {
  setBody(sidebar())
  store.reset()
  resetConversationScope()
  patched.length = 0
})

test('the scope control lands in the header’s control cluster', async () => {
  // Not beside the label: inside the label's link a click navigates, which is
  // what would leave no way back to the narrow list without a reload.
  await render(false)
  const toggle = document.querySelector('.whp-scope')
  assert.ok(toggle)
  assert.equal(toggle.parentElement?.className, 'nav-controls')
  assert.equal(toggle.getAttribute('aria-pressed'), 'false')
})

test('the narrow scope leaves the app’s list alone', async () => {
  await render(false)
  const appList = document.querySelector<HTMLElement>('.conversations-list')
  assert.equal(appList?.style.display, '')
  assert.equal(rows().length, 0)
})

test('the widened scope hides the app’s list and renders its own', async () => {
  await render(true)
  const appList = document.querySelector<HTMLElement>('.conversations-list')
  assert.equal(appList?.style.display, 'none')
  assert.ok(rows().length > 0)
})

test('narrowing again restores the app’s list intact', async () => {
  await render(true)
  await render(false)
  const appList = document.querySelector<HTMLElement>('.conversations-list')
  assert.equal(appList?.style.display, '')
  assert.equal(appList?.children.length, 2, 'the app’s own rows must be untouched')
  assert.equal(rows().length, 0)
})

test('two conversations on one card render as one row', async () => {
  await render(true)
  assert.equal(rows().length, 1)
})

test('a row shows the card title and the card code, not the conversation', async () => {
  await render(true)
  const row = rows()[0]!
  assert.equal(
    row.querySelector('.whp-row-label')?.textContent,
    'Replace the PR bar with a section',
  )
  assert.equal(row.querySelector('.whp-row-code')?.textContent, 'WH-078')
})

test('a row leads with the card’s status glyph', async () => {
  await render(true)
  const indicator = rows()[0]?.querySelector('.whp-row-indicator svg')
  assert.ok(indicator, 'the row has no status icon')
  assert.equal(indicator.getAttribute('viewBox'), '0 0 14 14')
})

test('a row links to the card with the conversation selected', async () => {
  await render(true)
  const link = rows()[0]?.querySelector<HTMLAnchorElement>('.whp-row-link')
  assert.match(link?.getAttribute('href') ?? '', /\/workhorse\/cards\/WH-078\?session=s1$/)
})

test('a row carries a dismiss control', async () => {
  await render(true)
  assert.ok(rows()[0]?.querySelector('.whp-row-dismiss-button'))
})

test('dismissing a row clears it and every conversation on its card', async () => {
  await render(true)
  const button = rows()[0]!.querySelector<HTMLElement>('.whp-row-dismiss-button')!
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await tick()
  await render(true)

  assert.equal(patched.length, 1)
  assert.match(patched[0]!, /\/api\/sessions\/s1$/)
  assert.equal(rows().length, 0, 'the row survived its own dismissal')
})

test('hovering a row shows a hover card beside it, and leaving removes it', async () => {
  await render(true)
  const row = rows()[0]!
  row.dispatchEvent(new dom.window.Event('pointerenter'))

  const tooltip = document.querySelector('.whp-tooltip')
  assert.ok(tooltip, 'no hover card appeared')
  assert.equal(tooltip.querySelector('.whp-tooltip-title')?.textContent, 'Replace the PR bar with a section')
  assert.equal(tooltip.querySelector('.whp-tooltip-code')?.textContent, 'WH-078')
  assert.match(tooltip.querySelector('.whp-tooltip-state')?.textContent ?? '', /Almost done/)
  // On the body, not inside the row: the sidebar scrolls and would clip it.
  assert.equal(tooltip.parentElement, document.body)

  row.dispatchEvent(new dom.window.Event('pointerleave'))
  assert.equal(document.querySelector('.whp-tooltip'), null)
})

test('turning the feature off removes everything it added', async () => {
  await render(true)
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS, crossWorkspaceConversations: false, scopeWide: true },
    route: { workspace: 'workhorse', card: null },
    schedule: () => {},
  })
  assert.equal(document.querySelector('.whp-scope'), null)
  assert.equal(rows().length, 0)
  assert.equal(document.querySelector<HTMLElement>('.conversations-list')?.style.display, '')
})

test('rendering twice changes nothing', async () => {
  await render(true)
  const before = document.querySelectorAll('.whp-scope').length
  await render(true)
  assert.equal(document.querySelectorAll('.whp-scope').length, before)
  assert.equal(before, 1)
})

function clickRow(row: Element): MouseEvent {
  const event = new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  })
  row.querySelector('.whp-row-link')!.dispatchEvent(event)
  return event as unknown as MouseEvent
}

test('a row click is handed to the page world when it is listening', async () => {
  document.documentElement.dataset.whpPage = '1'
  const posted: unknown[] = []
  const original = dom.window.postMessage
  ;(dom.window as unknown as Record<string, unknown>).postMessage = (data: unknown) => {
    posted.push(data)
  }
  try {
    await render(true)
    const event = clickRow(rows()[0]!)
    assert.equal(event.defaultPrevented, true, 'the browser was left to navigate')
    assert.equal((posted[0] as { source: string }).source, 'workhorse-pro:navigate')
    assert.match((posted[0] as { href: string }).href, /\/workhorse\/cards\/WH-078/)
  } finally {
    ;(dom.window as unknown as Record<string, unknown>).postMessage = original
    delete document.documentElement.dataset.whpPage
  }
})

test('a row click is left alone when the page world is absent', async () => {
  // Swallowing a click nothing is listening for would be worse than a slow
  // navigation, so the link is allowed to behave as a link.
  delete document.documentElement.dataset.whpPage
  await render(true)
  assert.equal(clickRow(rows()[0]!).defaultPrevented, false)
})

test('a modified click is left alone, so it can open a tab', async () => {
  document.documentElement.dataset.whpPage = '1'
  try {
    await render(true)
    const link = rows()[0]!.querySelector('.whp-row-link')!
    for (const mod of ['ctrlKey', 'metaKey', 'shiftKey']) {
      const event = new dom.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        [mod]: true,
      })
      link.dispatchEvent(event)
      assert.equal(event.defaultPrevented, false, `${mod} was swallowed`)
    }
  } finally {
    delete document.documentElement.dataset.whpPage
  }
})

test('the toggle flips both ways, not just on', async () => {
  // Its click handler is built once, so reading the scope from the pass that
  // built it would pin the control to widening and never back.
  await render(false)
  const toggle = document.querySelector<HTMLElement>('.whp-scope')!
  toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await tick()
  assert.equal(ext.sync.get('scopeWide'), true)

  await render(true)
  document
    .querySelector<HTMLElement>('.whp-scope')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await tick()
  assert.equal(ext.sync.get('scopeWide'), false, 'the toggle only ever widened')
})

test('a pass that changes nothing leaves the rows themselves alone', async () => {
  // Node identity is what carries hover, focus and a click in progress. A pass
  // runs on every DOM change the app makes anywhere, so rebuilding
  // unconditionally means rows are replaced out from under the pointer.
  await render(true)
  const before = rows()[0]!
  await render(true)
  assert.equal(rows()[0], before, 'the row was rebuilt despite nothing changing')
})

test('a row that does change is rebuilt', async () => {
  await render(true)
  const before = rows()[0]!
  sessions[0]!.cardTitle = 'A different title'
  store.reset()
  await render(true)
  assert.notEqual(rows()[0], before)
  assert.equal(rows()[0]?.querySelector('.whp-row-label')?.textContent, 'A different title')
  sessions[0]!.cardTitle = 'Replace the PR bar with a section'
})
