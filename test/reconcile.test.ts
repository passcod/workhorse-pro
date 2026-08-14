import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'

const dom = installDom()
const { Reconciler, marked } = await import('../src/content/reconcile.ts')
const { ensure, ensureOrdered, el, remove } = await import('../src/content/dom.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const { resetReported } = await import('../src/log.ts')

/** Let jsdom deliver mutation records and run any scheduled frames. */
function settle(): Promise<void> {
  return new Promise((resolve) => dom.window.setTimeout(resolve, 30))
}

beforeEach(() => {
  setBody('<div id="host"></div>')
  resetReported()
})

function host(): Element {
  return document.getElementById('host')!
}

test('a pass injects, and running it again changes nothing', () => {
  const reconciler = new Reconciler({ ...PREF_DEFAULTS })
  reconciler.register({
    name: 'test',
    reconcile() {
      ensure(host(), 'thing', () => el('div', undefined, 'hello'))
    },
  })

  reconciler.pass()
  assert.equal(host().children.length, 1)
  reconciler.pass()
  reconciler.pass()
  assert.equal(host().children.length, 1)
  assert.equal(host().textContent, 'hello')
})

test('turning a feature off removes what it added', () => {
  // Removal needs no teardown code: the desired state becomes nothing, and the
  // next pass reconciles to it. spec: PREF
  const prefs = { ...PREF_DEFAULTS }
  const reconciler = new Reconciler(prefs)
  reconciler.register({
    name: 'test',
    reconcile({ prefs: current }) {
      if (current.checksBreakdown) ensure(host(), 'thing', () => el('div'))
      else remove('thing')
    },
  })

  reconciler.pass()
  assert.equal(host().children.length, 1)

  reconciler.setPrefs({ ...prefs, checksBreakdown: false })
  reconciler.pass()
  assert.equal(host().children.length, 0)

  reconciler.setPrefs({ ...prefs, checksBreakdown: true })
  reconciler.pass()
  assert.equal(host().children.length, 1)
})

test('a feature that throws is skipped and the others still run', () => {
  const reconciler = new Reconciler({ ...PREF_DEFAULTS })
  let ran = 0
  reconciler.register({
    name: 'broken',
    reconcile() {
      throw new Error('deliberate')
    },
  })
  reconciler.register({
    name: 'working',
    reconcile() {
      ran++
      ensure(host(), 'thing', () => el('div'))
    },
  })

  reconciler.pass()
  reconciler.pass()
  assert.equal(ran, 2)
  assert.equal(host().children.length, 1)
})

test('a feature that throws is reported once, not once per pass', () => {
  const warnings: unknown[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    const reconciler = new Reconciler({ ...PREF_DEFAULTS })
    reconciler.register({
      name: 'broken',
      reconcile() {
        throw new Error('deliberate')
      },
    })
    for (let i = 0; i < 5; i++) reconciler.pass()
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1)
})

test('the loop converges rather than feeding on its own injections', async () => {
  // Without the guard, an injected node is a childList mutation, which
  // schedules a pass, which re-checks the injection, forever. spec: INJ
  const reconciler = new Reconciler({ ...PREF_DEFAULTS })
  let passes = 0
  reconciler.register({
    name: 'test',
    reconcile() {
      passes++
      ensure(host(), 'thing', () => el('div', undefined, 'x'))
    },
  })

  reconciler.start()
  await settle()
  const afterFirst = passes
  await settle()
  assert.equal(passes, afterFirst, 'passes kept coming with no page change')
  assert.ok(afterFirst <= 3, `expected the loop to settle quickly, got ${afterFirst}`)
  reconciler.stop()
})

test("a change the app makes does schedule a pass", async () => {
  const reconciler = new Reconciler({ ...PREF_DEFAULTS })
  let passes = 0
  reconciler.register({
    name: 'test',
    reconcile() {
      passes++
    },
  })

  reconciler.start()
  await settle()
  const before = passes

  // Something the app rendered, not the extension.
  host().appendChild(document.createElement('span'))
  await settle()

  assert.ok(passes > before, 'the extension ignored a change it did not make')
  reconciler.stop()
})

test('ordered injections keep their order however they arrive', () => {
  // Appending alone leaves the order to whichever feature injected first, so a
  // row removed and re-added comes back below its neighbour.
  ensureOrdered(host(), 'second', 20, () => el('div', undefined, 'B'))
  ensureOrdered(host(), 'first', 10, () => el('div', undefined, 'A'))
  assert.equal(host().textContent, 'AB')

  remove('first', host())
  assert.equal(host().textContent, 'B')

  ensureOrdered(host(), 'first', 10, () => el('div', undefined, 'A'))
  assert.equal(host().textContent, 'AB', 'the re-added row came back in the wrong place')
})

test('ordering leaves the app’s own children where they are', () => {
  host().appendChild(el('div', undefined, 'app'))
  ensureOrdered(host(), 'ours', 10, () => el('div', undefined, 'X'))
  assert.equal(host().textContent, 'appX')
})

test('an already-ordered set is not rearranged', () => {
  const a = ensureOrdered(host(), 'first', 10, () => el('div', undefined, 'A'))
  ensureOrdered(host(), 'second', 20, () => el('div', undefined, 'B'))
  const before = host().innerHTML
  ensureOrdered(host(), 'first', 10, () => el('div', undefined, 'A'))
  assert.equal(host().innerHTML, before)
  assert.equal(host().firstElementChild, a, 'the node was replaced rather than kept')
})

test('marked nodes are recognised as the extension’s own', () => {
  const node = marked(document.createElement('div'))
  assert.equal(node.hasAttribute('data-whp'), true)
})
