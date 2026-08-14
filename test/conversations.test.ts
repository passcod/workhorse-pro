import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeSessions,
  dismissalSiblings,
  mayHaveOlder,
  NO_CARD_CODE_GLYPH,
  projectNameSlug,
  rowModel,
} from '../src/lib/conversations.ts'
import type { RecentSession } from '../src/data/types.ts'

function session(overrides: Partial<RecentSession> = {}): RecentSession {
  return {
    id: 's1',
    title: null,
    lastMessagePreview: null,
    messageCount: 1,
    lastMessageAt: '2026-08-14T00:00:00.000Z',
    cardId: null,
    kind: null,
    waitingOnUser: false,
    waitingOnExternal: false,
    waitingOnMerge: false,
    cardIdentifier: null,
    cardTitle: null,
    cardStatusIconStyle: null,
    cardStatusColour: null,
    cardStatusLabel: null,
    projectId: null,
    projectName: null,
    projectHash: null,
    projectEmoji: null,
    projectColour: null,
    workspaceName: 'workhorse',
    ...overrides,
  }
}

const NO_OPTIONS = {
  colours: new Map<string, string>(),
  activeSessionId: null,
  streaming: new Set<string>(),
}

// ── Rows are cards, not conversations ────────────────────────────────────

test('conversations on one card collapse to a single row', () => {
  const rows = dedupeSessions([
    session({ id: 'a', cardId: 'card-1' }),
    session({ id: 'b', cardId: 'card-1' }),
    session({ id: 'c', cardId: 'card-2' }),
  ])
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'c'],
  )
})

test('the most recent conversation on a card is the one that survives', () => {
  // The server orders newest-first, so the first occurrence wins.
  const rows = dedupeSessions([
    session({ id: 'newest', cardId: 'card-1' }),
    session({ id: 'older', cardId: 'card-1' }),
  ])
  assert.equal(rows[0]?.id, 'newest')
})

test('project conversations collapse per project', () => {
  const rows = dedupeSessions([
    session({ id: 'a', kind: 'project', projectId: 'p1' }),
    session({ id: 'b', kind: 'project', projectId: 'p1' }),
    session({ id: 'c', kind: 'project', projectId: 'p2' }),
  ])
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'c'],
  )
})

test('standalone conversations each keep their own row', () => {
  const rows = dedupeSessions([session({ id: 'a' }), session({ id: 'b' })])
  assert.equal(rows.length, 2)
})

// ── What a row shows ─────────────────────────────────────────────────────

test('a card row shows the card title and the card code, not the conversation', () => {
  const row = rowModel(
    session({
      cardId: 'c1',
      cardIdentifier: 'WH-078',
      cardTitle: 'Replace the PR bar',
      title: 'a conversation title nobody wants here',
    }),
    NO_OPTIONS,
  )
  assert.equal(row.label, 'Replace the PR bar')
  assert.equal(row.cardCode, 'WH-078')
})

test('a card row links to the card with the conversation selected', () => {
  const row = rowModel(
    session({ id: 's9', cardId: 'c1', cardIdentifier: 'WH-078', workspaceName: 'Workhorse' }),
    NO_OPTIONS,
  )
  assert.equal(row.href, '/workhorse/cards/WH-078?session=s9')
})

test('a project row links to the project home', () => {
  const row = rowModel(
    session({
      id: 's9',
      kind: 'project',
      projectId: 'p1',
      projectName: 'Local Mode',
      projectHash: 'abc123',
    }),
    NO_OPTIONS,
  )
  assert.equal(row.href, '/workhorse/projects/local-mode-abc123?session=s9')
  assert.equal(row.label, 'Local Mode')
})

test('a standalone row falls back to the conversation surface and title', () => {
  const row = rowModel(session({ id: 's9', title: 'Some chat' }), NO_OPTIONS)
  assert.equal(row.href, '/workhorse/sessions/s9')
  assert.equal(row.label, 'Some chat')
})

test('a conversation with no name at all still reads as something', () => {
  assert.equal(rowModel(session(), NO_OPTIONS).label, 'New conversation')
})

// ── The trailing slot ────────────────────────────────────────────────────

test("the workspace colour lands on the card code, not a leading dot", () => {
  const colours = new Map([['workhorse', 'oklch(0.52 0.16 40.0)']])
  const row = rowModel(
    session({ cardId: 'c1', cardIdentifier: 'WH-078', workspaceName: 'Workhorse' }),
    { ...NO_OPTIONS, colours },
  )
  assert.equal(row.slotText, 'WH-078')
  assert.equal(row.slotColour, 'oklch(0.52 0.16 40.0)')
})

test('a row with no card code shows the workspace mark in the slot', () => {
  const colours = new Map([['workhorse', 'oklch(0.52 0.16 40.0)']])
  const row = rowModel(session({ title: 'Standalone' }), { ...NO_OPTIONS, colours })
  assert.equal(row.slotText, NO_CARD_CODE_GLYPH)
})

test('a row with no code and no colour leaves the slot empty', () => {
  const row = rowModel(session({ title: 'Standalone', workspaceName: null }), NO_OPTIONS)
  assert.equal(row.slotText, null)
})

// ── The indicator ────────────────────────────────────────────────────────

test('a card row at rest shows its status', () => {
  const row = rowModel(
    session({ cardId: 'c1', cardIdentifier: 'WH-1', cardStatusIconStyle: 'almost-done' }),
    NO_OPTIONS,
  )
  assert.equal(row.indicator, 'status')
  assert.equal(row.statusIconStyle, 'almost-done')
})

test('a bell beats an hourglass', () => {
  const row = rowModel(
    session({ cardId: 'c1', waitingOnUser: true, waitingOnExternal: true }),
    NO_OPTIONS,
  )
  assert.equal(row.indicator, 'bell')
})

test('streaming suppresses both, since the pulsing status takes the slot', () => {
  const row = rowModel(
    session({ id: 's1', cardId: 'c1', waitingOnUser: true, waitingOnExternal: true }),
    { ...NO_OPTIONS, streaming: new Set(['s1']) },
  )
  assert.equal(row.indicator, 'status')
  assert.equal(row.streaming, true)
})

test('the bell clears on the row the user is already looking at', () => {
  const row = rowModel(session({ id: 's1', cardId: 'c1', waitingOnUser: true }), {
    ...NO_OPTIONS,
    activeSessionId: 's1',
  })
  assert.equal(row.indicator, 'status')
  assert.equal(row.active, true)
})

test('an hourglass distinguishes a scheduled merge from a review queue', () => {
  const queued = rowModel(session({ cardId: 'c1', waitingOnExternal: true }), NO_OPTIONS)
  assert.equal(queued.tooltip.state?.label, 'Queued for review')

  const merging = rowModel(
    session({ cardId: 'c1', waitingOnExternal: true, waitingOnMerge: true }),
    NO_OPTIONS,
  )
  assert.equal(merging.tooltip.state?.label, 'Merge scheduled')
})

// ── The hover card ───────────────────────────────────────────────────────

test('the hover card names the workspace, the code, and what the row shows', () => {
  const colours = new Map([['workhorse', 'colour']])
  const row = rowModel(
    session({
      cardId: 'c1',
      cardIdentifier: 'WH-078',
      cardTitle: 'Replace the PR bar',
      cardStatusLabel: 'Almost done',
      workspaceName: 'Workhorse',
    }),
    { ...NO_OPTIONS, colours },
  )
  assert.equal(row.tooltip.title, 'Replace the PR bar')
  assert.equal(row.tooltip.workspaceName, 'Workhorse')
  assert.equal(row.tooltip.cardCode, 'WH-078')
  assert.equal(row.tooltip.colour, 'colour')
  assert.equal(row.tooltip.state?.label, 'Almost done')
})

test('a row whose indicator carries no state omits the state line', () => {
  const row = rowModel(session({ title: 'Standalone' }), NO_OPTIONS)
  assert.equal(row.tooltip.state, null)
})

// ── Dismissal ────────────────────────────────────────────────────────────

test('dismissing a card row clears every conversation on that card', () => {
  // Otherwise the row snaps back to the next most recent conversation.
  const sessions = [
    session({ id: 'a', cardId: 'c1' }),
    session({ id: 'b', cardId: 'c1' }),
    session({ id: 'c', cardId: 'c2' }),
  ]
  assert.deepEqual(dismissalSiblings(sessions, 'a').sort(), ['a', 'b'])
})

test('dismissing a standalone row clears only itself', () => {
  const sessions = [session({ id: 'a' }), session({ id: 'b' })]
  assert.deepEqual(dismissalSiblings(sessions, 'a'), ['a'])
})

test('dismissing a project row clears the project’s conversations', () => {
  const sessions = [
    session({ id: 'a', kind: 'project', projectId: 'p1' }),
    session({ id: 'b', kind: 'project', projectId: 'p1' }),
  ]
  assert.deepEqual(dismissalSiblings(sessions, 'a').sort(), ['a', 'b'])
})

// ── Paging ───────────────────────────────────────────────────────────────

test('Older shows when more rows exist than fit', () => {
  assert.equal(
    mayHaveOlder({ expanded: false, dedupedCount: 12, fetchedCount: 12, rowCount: 8, fetchLimit: 20 }),
    true,
  )
})

test('Older shows when the fetch came back full, even if rows collapsed below the count', () => {
  // A run of conversations on one card can dedupe the pool below the row count
  // while the server still holds older ones.
  assert.equal(
    mayHaveOlder({ expanded: false, dedupedCount: 3, fetchedCount: 20, rowCount: 8, fetchLimit: 20 }),
    true,
  )
})

test('Older stays hidden when everything is on screen', () => {
  assert.equal(
    mayHaveOlder({ expanded: false, dedupedCount: 3, fetchedCount: 5, rowCount: 8, fetchLimit: 20 }),
    false,
  )
})

test('Older is gone once expanded', () => {
  assert.equal(
    mayHaveOlder({ expanded: true, dedupedCount: 99, fetchedCount: 20, rowCount: 8, fetchLimit: 20 }),
    false,
  )
})

test('project slugs match the app’s', () => {
  assert.equal(projectNameSlug('Local Mode'), 'local-mode')
  assert.equal(projectNameSlug('  Weird   Name!! '), 'weird-name')
  assert.equal(projectNameSlug('!!!'), 'project')
})
