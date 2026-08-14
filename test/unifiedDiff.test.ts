import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { hunkHeader, splitLines, unifiedDiff } from '../src/lib/unifiedDiff.ts'

/** The rendered text of a hunk, as `+`/`-`/` ` prefixed lines. */
function render(hunk: { lines: { kind: string; text: string }[] }): string[] {
  return hunk.lines.map(
    (line) => `${line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}${line.text}`,
  )
}

test('splitLines treats a trailing newline as a terminator', () => {
  assert.deepEqual(splitLines('a\nb\n'), ['a', 'b'])
  assert.deepEqual(splitLines('a\nb'), ['a', 'b'])
  assert.deepEqual(splitLines(''), [])
  assert.deepEqual(splitLines('\n'), [''])
})

test('identical texts produce no hunks', () => {
  assert.deepEqual(unifiedDiff('one\ntwo\n', 'one\ntwo\n'), [])
})

test('a file absent from the base branch reads as entirely added', () => {
  const hunks = unifiedDiff('', 'one\ntwo\n')
  assert.equal(hunks.length, 1)
  assert.deepEqual(render(hunks[0]!), ['+one', '+two'])
  // An empty side starts at zero by unified-diff convention.
  assert.equal(hunks[0]!.beforeStart, 0)
  assert.equal(hunks[0]!.beforeCount, 0)
  assert.equal(hunks[0]!.afterStart, 1)
  assert.equal(hunks[0]!.afterCount, 2)
})

test('unchanged stretches between changes are left out', () => {
  const base = ['a', ...Array.from({ length: 40 }, (_, i) => `line ${i}`), 'z'].join('\n')
  const next = ['a!', ...Array.from({ length: 40 }, (_, i) => `line ${i}`), 'z!'].join('\n')

  const hunks = unifiedDiff(base, next)
  assert.equal(hunks.length, 2, 'two changes far apart are two hunks')
  // Each hunk is the change plus its context, nowhere near the 42 lines total.
  for (const hunk of hunks) {
    assert.ok(hunk.lines.length <= 8, `hunk had ${hunk.lines.length} lines`)
  }
})

test('changes closer together than twice the context merge into one hunk', () => {
  const base = ['a', 'b', 'c', 'd', 'e'].join('\n')
  const next = ['A', 'b', 'c', 'd', 'E'].join('\n')
  const hunks = unifiedDiff(base, next)
  assert.equal(hunks.length, 1)
})

test('context is three lines either side', () => {
  const base = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n')
  const next = base.replace('line 10', 'line ten')
  const hunks = unifiedDiff(base, next)
  assert.equal(hunks.length, 1)
  assert.deepEqual(render(hunks[0]!), [
    ' line 7',
    ' line 8',
    ' line 9',
    '-line 10',
    '+line ten',
    ' line 11',
    ' line 12',
    ' line 13',
  ])
})

test('a hunk carries the heading it falls under', () => {
  const base = ['# Title', '', 'intro', '', '## Failure isolation', '', 'one', 'two'].join('\n')
  const next = base.replace('two', 'three')
  const hunks = unifiedDiff(base, next)
  assert.equal(hunks.length, 1)
  assert.equal(hunks[0]!.heading, '## Failure isolation')
  assert.match(hunkHeader(hunks[0]!), /^@@ -\d+(,\d+)? \+\d+(,\d+)? @@ ## Failure isolation$/)
})

test('a change above the first heading carries none', () => {
  const base = ['intro', 'more', '', '## Later'].join('\n')
  const next = ['intro!', 'more', '', '## Later'].join('\n')
  const hunks = unifiedDiff(base, next)
  assert.equal(hunks[0]!.heading, null)
  assert.ok(!hunkHeader(hunks[0]!).includes('##'))
})

test('the heading comes from the base side, as git reads it', () => {
  // The section is renamed and a line under it changes. The reader is orienting
  // against the document they know, which is the one on the base branch.
  const base = ['## Old name', '', 'body'].join('\n')
  const next = ['## New name', '', 'body!'].join('\n')
  const hunks = unifiedDiff(base, next)
  assert.equal(hunks[0]!.heading, '## Old name')
})

test('a new file takes its heading from the side that has one', () => {
  const hunks = unifiedDiff('', ['## Section', '', 'body'].join('\n'))
  assert.equal(hunks[0]!.heading, '## Section')
})

test('a setext-style or non-heading line is not mistaken for a heading', () => {
  const base = ['#hashtag', 'body'].join('\n')
  const next = ['#hashtag', 'body!'].join('\n')
  assert.equal(unifiedDiff(base, next)[0]!.heading, null)
})

test('hunk header omits the count for a single-line side', () => {
  const hunks = unifiedDiff('only\n', 'only!\n')
  assert.equal(hunkHeader(hunks[0]!), '@@ -1 +1 @@')
})

test('line numbers count the whole document, not the hunk', () => {
  const base = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n')
  const next = base.replace('line 20', 'line twenty')
  const hunk = unifiedDiff(base, next)[0]!
  // line 20 is the 21st line; three lines of context put the hunk at 18.
  assert.equal(hunk.beforeStart, 18)
  assert.equal(hunk.afterStart, 18)
})

test('a deletion of every line reads as entirely removed', () => {
  const hunks = unifiedDiff('one\ntwo\n', '')
  assert.deepEqual(render(hunks[0]!), ['-one', '-two'])
  assert.equal(hunks[0]!.afterCount, 0)
  assert.equal(hunks[0]!.afterStart, 0)
})

test('an insertion in the middle keeps both sides numbered correctly', () => {
  const hunks = unifiedDiff('a\nb\n', 'a\nnew\nb\n')
  const hunk = hunks[0]!
  assert.deepEqual(render(hunk), [' a', '+new', ' b'])
  assert.equal(hunk.beforeCount, 2)
  assert.equal(hunk.afterCount, 3)
})

test('a pathological pair still returns a true diff', () => {
  // Past the alignment budget the changed region is reported coarsely, as a
  // removal followed by an addition, rather than the page hanging on it.
  const base = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n')
  const next = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n')
  const started = Date.now()
  const hunks = unifiedDiff(base, next)
  assert.ok(Date.now() - started < 5_000, 'took too long')
  const lines = hunks.flatMap((hunk) => hunk.lines)
  assert.equal(lines.filter((line) => line.kind === 'remove').length, 3000)
  assert.equal(lines.filter((line) => line.kind === 'add').length, 3000)
})

test('a realistic spec edit produces a small diff', () => {
  const base = [
    '---',
    'id: INJ',
    '---',
    '',
    '# Injection',
    '',
    'Some preamble that does not change.',
    '',
    '## Reconcile passes',
    '',
    '- [ ] One',
    '- [ ] Two',
    '',
    '## Failure isolation',
    '',
    '- [ ] Three',
  ].join('\n')
  const next = base.replace('- [ ] Two', '- [ ] Two\n- [ ] Two and a half')

  const hunks = unifiedDiff(base, next)
  assert.equal(hunks.length, 1)
  assert.equal(hunks[0]!.heading, '## Reconcile passes')
  assert.deepEqual(
    render(hunks[0]!).filter((line) => line.startsWith('+')),
    ['+- [ ] Two and a half'],
  )
})
