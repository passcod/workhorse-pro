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

/** The segments of a line, as `text` with changed runs wrapped in `[ ]`. */
function marked(line: { text: string; segments?: { text: string; changed: boolean }[] }): string {
  if (!line.segments) return line.text
  return line.segments.map((seg) => (seg.changed ? `[${seg.text}]` : seg.text)).join('')
}

/** The single changed line of the given kind in a one-hunk diff. */
function only(base: string, next: string, kind: 'add' | 'remove') {
  const hunk = unifiedDiff(base, next)[0]!
  return hunk.lines.find((line) => line.kind === kind)!
}

test('an edit within a line marks only the words that differ', () => {
  const base = ['a', 'b', 'the quick brown fox', 'c', 'd'].join('\n')
  const next = ['a', 'b', 'the quick red fox', 'c', 'd'].join('\n')
  assert.equal(marked(only(base, next, 'remove')), 'the quick [brown] fox')
  assert.equal(marked(only(base, next, 'add')), 'the quick [red] fox')
})

test('a segmented line reproduces its text exactly, spacing and all', () => {
  const base = ['x', 'call(foo, bar)  # note', 'y'].join('\n')
  const next = ['x', 'call(foo, baz)  # note!', 'y'].join('\n')
  for (const kind of ['remove', 'add'] as const) {
    const line = only(base, next, kind)
    assert.equal(line.segments!.map((seg) => seg.text).join(''), line.text)
  }
})

test('a pair sharing no word is left marked whole', () => {
  const base = ['keep', 'the quick brown fox', 'keep'].join('\n')
  const next = ['keep', 'a slow green turtle', 'keep'].join('\n')
  assert.equal(only(base, next, 'remove').segments, undefined)
  assert.equal(only(base, next, 'add').segments, undefined)
})

test('a shared word survives even when the rest is rewritten', () => {
  const base = ['keep', 'send the report today', 'keep'].join('\n')
  const next = ['keep', 'archive the file now', 'keep'].join('\n')
  // Only "the" and the spacing carry through, so it is still an edit, not a rewrite.
  assert.equal(marked(only(base, next, 'remove')), '[send] the [report] [today]')
})

test('a multi-line replacement pairs lines by position', () => {
  const base = ['top', 'alpha one', 'beta two', 'bottom'].join('\n')
  const next = ['top', 'alpha ONE', 'beta TWO', 'bottom'].join('\n')
  const hunk = unifiedDiff(base, next)[0]!
  const removes = hunk.lines.filter((line) => line.kind === 'remove').map(marked)
  const adds = hunk.lines.filter((line) => line.kind === 'add').map(marked)
  assert.deepEqual(removes, ['alpha [one]', 'beta [two]'])
  assert.deepEqual(adds, ['alpha [ONE]', 'beta [TWO]'])
})

test('a line with no counterpart carries no segments', () => {
  // One line becomes two: the first pairs, the pure insertion does not.
  const base = ['top', 'alpha one', 'bottom'].join('\n')
  const next = ['top', 'alpha ONE', 'brand new line', 'bottom'].join('\n')
  const hunk = unifiedDiff(base, next)[0]!
  const adds = hunk.lines.filter((line) => line.kind === 'add')
  assert.equal(marked(adds.find((line) => line.text === 'alpha ONE')!), 'alpha [ONE]')
  assert.equal(adds.find((line) => line.text === 'brand new line')!.segments, undefined)
})

test('word marks reproduce a unicode line unchanged', () => {
  const base = ['x', 'café au lait', 'y'].join('\n')
  const next = ['x', 'café au crème', 'y'].join('\n')
  const line = only(base, next, 'add')
  assert.equal(line.segments!.map((seg) => seg.text).join(''), 'café au crème')
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
