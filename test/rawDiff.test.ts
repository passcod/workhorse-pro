import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, installExtStub, setBody } from './dom.ts'
import { artefactPane, composerArea } from './fixtures/app.ts'

const dom = installDom()
installExtStub()

const FILE = '.workhorse/specs/platform/injection.md'

const BASE = ['# Injection', '', 'one', 'two', 'three'].join('\n')
const CURRENT = ['# Injection', '', 'one', 'two!', 'three'].join('\n')

/** Swapped by tests to drive the reads. */
let baseContent: string | null = BASE
let currentContent = CURRENT
let failing: string | null = null
let markdownPath = FILE
const requested: string[] = []

;(globalThis as unknown as Record<string, unknown>).fetch = async (input: unknown) => {
  const url = String(input)
  requested.push(url)
  if (failing && url.includes(failing)) {
    return { ok: false, status: 500, json: async () => ({}) }
  }
  if (url.includes('/api/card-detail')) {
    return { ok: true, status: 200, json: async () => ({ card: { id: 'card-uuid' } }) }
  }
  if (url.includes('/api/card-files')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        initialFiles: [
          { filePath: markdownPath, isNew: false, isDeleted: false, content: currentContent },
        ],
      }),
    }
  }
  if (url.includes('/api/base-file')) {
    return { ok: true, status: 200, json: async () => ({ content: baseContent }) }
  }
  return { ok: false, status: 404, json: async () => ({}) }
}

const { rawDiff, resetRawDiff, selectRawDiff } = await import('../src/features/rawDiff.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const store = await import('../src/data/store.ts')

const feature = rawDiff()
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

interface Options {
  enabled?: boolean
  filePath?: string | null
  card?: string | null
}

function pass({ enabled = true, filePath = FILE, card = 'WH-078' }: Options = {}): void {
  feature.reconcile({
    prefs: { ...PREF_DEFAULTS, rawDiff: enabled },
    route: { workspace: 'workhorse', card, filePath, view: 'changes' },
    schedule: () => {},
  })
}

/** Passes until the reads have landed, as the store's own notify would. */
async function settle(options: Options = {}): Promise<void> {
  pass(options)
  await tick()
  pass(options)
  await tick()
  pass(options)
}

function segment(): HTMLElement | null {
  return document.querySelector<HTMLElement>('button.whp-segment')
}

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.whp-diff')
}

function lines(): string[] {
  return [...document.querySelectorAll('.whp-diff-line')].map((line) => {
    const sign = line.querySelector('.whp-diff-sign')?.textContent ?? ''
    const text = line.querySelector('.whp-diff-text')?.textContent ?? ''
    return `${sign}${text}`.replace(/^ /, ' ')
  })
}

beforeEach(() => {
  setBody(artefactPane())
  store.reset()
  resetRawDiff()
  baseContent = BASE
  currentContent = CURRENT
  failing = null
  markdownPath = FILE
  requested.length = 0
})

test('the segment lands in the app’s own toggle, after its two', () => {
  pass()
  const toggle = document.querySelector('.segmented')!
  assert.deepEqual(
    [...toggle.children].map((child) => child.textContent),
    ['File', 'Changes', 'Diff'],
  )
  assert.equal(segment()?.getAttribute('aria-pressed'), 'false')
})

test('nothing is rendered until the segment is chosen', () => {
  pass()
  assert.equal(panel(), null)
  const view = document.querySelector<HTMLElement>('.artifact-view')
  assert.equal(view?.style.display, '')
})

test('choosing Diff renders the unified diff in place of the app’s view', async () => {
  selectRawDiff(FILE)
  await settle()

  assert.equal(segment()?.getAttribute('aria-pressed'), 'true')
  const view = document.querySelector<HTMLElement>('.artifact-view')
  assert.equal(view?.style.display, 'none', 'the app’s own view is hidden')
  assert.ok(panel())
  assert.deepEqual(lines(), [' # Injection', ' ', ' one', '-two', '+two!', ' three'])
})

test('the changed words of a replaced line are wrapped for emphasis', async () => {
  selectRawDiff(FILE)
  await settle()
  const added = [...document.querySelectorAll('.whp-diff-add')].find(
    (line) => line.textContent?.replace(/^\+?/, '').trim() === 'two!',
  )!
  const words = [...added.querySelectorAll('.whp-diff-word')].map((node) => node.textContent)
  // Only the added "!" is the edit; "two" carried through and is left unwrapped.
  assert.deepEqual(words, ['!'])
  // The line still reads back whole, so selection and copy are unaffected.
  assert.equal(added.querySelector('.whp-diff-text')?.textContent, 'two!')
})

test('the hunk header carries the heading the change falls under', async () => {
  selectRawDiff(FILE)
  await settle()
  const header = document.querySelector('.whp-diff-header')?.textContent ?? ''
  assert.match(header, /^@@ -\d+,\d+ \+\d+,\d+ @@ # Injection$/)
})

test('the app’s own segments read as unselected while Diff is showing', async () => {
  selectRawDiff(FILE)
  await settle()
  const toggle = document.querySelector('.segmented')
  assert.ok(toggle?.hasAttribute('data-whp-diff-active'))
})

test('leaving Diff restores the app’s view and its own selection', async () => {
  selectRawDiff(FILE)
  await settle()
  resetRawDiff()
  pass()

  assert.equal(panel(), null)
  assert.equal(document.querySelector<HTMLElement>('.artifact-view')?.style.display, '')
  assert.equal(document.querySelector('.segmented')?.hasAttribute('data-whp-diff-active'), false)
  assert.equal(segment()?.getAttribute('aria-pressed'), 'false')
})

test('an unchanged artefact says so rather than rendering nothing', async () => {
  // The segment is offered regardless, so an empty diff is an answer. spec: DIFF
  currentContent = BASE
  selectRawDiff(FILE)
  await settle()

  assert.equal(document.querySelectorAll('.whp-diff-line').length, 0)
  assert.match(document.querySelector('.whp-diff-notice')?.textContent ?? '', /No changes/)
})

test('an artefact absent from the base branch reads as entirely added', async () => {
  baseContent = null
  selectRawDiff(FILE)
  await settle()

  const rendered = lines()
  assert.ok(rendered.length > 0)
  assert.ok(
    rendered.every((line) => line.startsWith('+')),
    `expected all additions, got ${JSON.stringify(rendered)}`,
  )
})

test('a failed read is reported in place rather than left blank', async () => {
  // Unlike every other feature, this one is behind a segment the reader
  // clicked, so rendering nothing would read as a broken control. spec: DIFF
  failing = '/api/base-file'
  selectRawDiff(FILE)
  await settle()

  assert.ok(panel())
  assert.match(document.querySelector('.whp-diff-notice')?.textContent ?? '', /could not/)
})

test('a pass that changes nothing leaves the rendered nodes in place', async () => {
  // A re-render costs the reader their scroll position, and a pass runs on
  // every change the app makes anywhere. spec: INJ
  selectRawDiff(FILE)
  await settle()

  const before = [...document.querySelectorAll('.whp-diff-line')]
  pass()
  pass()
  const after = [...document.querySelectorAll('.whp-diff-line')]

  assert.equal(before.length, after.length)
  assert.ok(before.every((node, index) => node === after[index]), 'nodes were replaced')
})

test('content changing while the diff is open is reflected in it', async () => {
  selectRawDiff(FILE)
  await settle()
  assert.ok(lines().includes('+two!'))

  currentContent = ['# Injection', '', 'one', 'two?', 'three'].join('\n')
  store.reset()
  await settle()

  assert.ok(lines().includes('+two?'), `got ${JSON.stringify(lines())}`)
})

test('turning the feature off removes everything it added', async () => {
  selectRawDiff(FILE)
  await settle()
  assert.ok(panel())

  pass({ enabled: false })
  assert.equal(panel(), null)
  assert.equal(segment(), null)
  assert.equal(document.querySelector<HTMLElement>('.artifact-view')?.style.display, '')
})

test('a mockup gets no segment, because its toggle selects a device', () => {
  setBody(artefactPane({ segments: ['Desktop', 'Tablet', 'Mobile'] }))
  pass({ filePath: '.workhorse/design/mockups/d1/intake.html' })
  assert.equal(segment(), null)
})

test('a non-markdown artefact gets no segment', () => {
  pass({ filePath: 'src/content/anchors.ts' })
  assert.equal(segment(), null)
})

test('no artefact open means nothing is added', () => {
  pass({ filePath: null })
  assert.equal(segment(), null)
  assert.equal(panel(), null)
})

test('off a card page nothing is added', () => {
  setBody(composerArea())
  pass({ card: null, filePath: null })
  assert.equal(segment(), null)
})

test('opening another artefact leaves the view to the app', async () => {
  selectRawDiff(FILE)
  await settle()
  assert.ok(panel())

  const other = '.workhorse/specs/platform/data.md'
  pass({ filePath: other })

  assert.equal(panel(), null, 'the selection did not follow the reader to the next document')
  assert.equal(segment()?.getAttribute('aria-pressed'), 'false')
})

test('the base read is keyed by the card’s own id, not its identifier', async () => {
  selectRawDiff(FILE)
  await settle()
  const baseRead = requested.find((url) => url.includes('/api/base-file'))
  assert.ok(baseRead, 'no base-file read was made')
  assert.match(baseRead, /cardId=card-uuid/)
})

test('the diff is never read for a peeked pull request', async () => {
  // Peeking is deliberately out of scope, so no read may carry a PR number.
  selectRawDiff(FILE)
  await settle()
  assert.ok(!requested.some((url) => url.includes('prNumber')))
})

test('the diff says it is loading before either side has landed', () => {
  // Not "no changes": two sides that have not arrived are not two sides that
  // agree, and saying so would be wrong rather than merely early. spec: DIFF
  selectRawDiff(FILE)
  pass()

  assert.ok(panel())
  assert.equal(document.querySelectorAll('.whp-diff-line').length, 0)
  assert.match(document.querySelector('.whp-diff-notice')?.textContent ?? '', /Loading/)
})

test('an artefact the app renders no toggle for gets no segment', () => {
  // A deleted artefact is the case: the app drops the whole toggle, so there is
  // nothing to add a segment to and nothing to decide. spec: DIFF
  setBody(`
    <div class="artifact-column">
      <div class="header-bar">
        <button type="button" title="Previous file">^</button>
      </div>
      <div class="artifact-view"></div>
    </div>
  `)
  pass()
  assert.equal(segment(), null)
  assert.equal(panel(), null)
})

test('picking the app’s own segment leaves Diff even when nothing else moves', async () => {
  // Clicking File while the app is already in File changes nothing in the page,
  // so nothing would schedule a pass and the panel would sit there. spec: DIFF
  selectRawDiff(FILE)
  await settle()
  assert.ok(panel())

  const fileSegment = [...document.querySelectorAll<HTMLElement>('.segmented > button')].find(
    (button) => button.textContent === 'File',
  )!
  fileSegment.dispatchEvent(new dom.window.Event('click', { bubbles: true }))
  pass()

  assert.equal(panel(), null)
  assert.equal(segment()?.getAttribute('aria-pressed'), 'false')
})

test('a markdown file outside the workhorse tree gets the segment too', async () => {
  // README.md and its like sit in the app's Code changes section but render
  // with the markdown views and carry their content in the same listing, so
  // they get the same diff. spec: DIFF
  const readme = 'README.md'
  currentContent = ['# Readme', '', 'body!'].join('\n')
  baseContent = ['# Readme', '', 'body'].join('\n')
  markdownPath = readme

  selectRawDiff(readme)
  await settle({ filePath: readme })

  assert.equal(segment()?.getAttribute('aria-pressed'), 'true')
  assert.ok(lines().includes('+body!'), `got ${JSON.stringify(lines())}`)
})
