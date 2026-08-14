import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setBody } from './dom.ts'
import { prSection } from './fixtures/app.ts'

installDom()
const { statRows } = await import('../src/features/statRows.ts')
const { namedChecks } = await import('../src/features/namedChecks.ts')
const { anchors } = await import('../src/content/anchors.ts')
const { PREF_DEFAULTS } = await import('../src/prefs.ts')
const store = await import('../src/data/store.ts')
const { branchStatusKey, checkRunsKey, workflowRunsKey } = await import('../src/data/keys.ts')
import type { BranchStatusData, CheckRun } from '../src/data/types.ts'

/**
 * The Checks row is flat, so the breakdown and the named jobs hang beneath it
 * as siblings rather than inside a content block. This is what the card fixes:
 * the anchor never matched a disclosure, so the readings rendered nothing while
 * the tests, run against a disclosure fixture, stayed green.
 */

const WS = 'workhorse'
const CARD = 'WH-078'
const PR = 'https://github.com/beyondessential/workhorse/pull/78'
const SHA = 'deadbeef'

const breakdownFeature = statRows()
const jobsFeature = namedChecks()

function status(overrides: Partial<BranchStatusData> = {}): BranchStatusData {
  return {
    prUrl: PR,
    prNumber: 78,
    ci: { status: 'passing', total: 12, running: 0, failing: 0, skipped: 0, repoRunsChecks: true },
    branch: { name: 'wh-078' },
    loop: { active: false, round: 0, paused: false },
    lastReview: null,
    ...overrides,
  }
}

function reconcileBreakdown(overrides: Partial<typeof PREF_DEFAULTS> = {}): void {
  breakdownFeature.reconcile({
    prefs: { ...PREF_DEFAULTS, ...overrides },
    route: { workspace: WS, card: CARD, filePath: null, view: null },
    schedule: () => {},
  })
}

function reconcileJobs(overrides: Partial<typeof PREF_DEFAULTS> = {}): void {
  jobsFeature.reconcile({
    prefs: { ...PREF_DEFAULTS, githubToken: 'gho_x', ...overrides },
    route: { workspace: WS, card: CARD, filePath: null, view: null },
    schedule: () => {},
  })
}

function failedRun(id: number, name: string): CheckRun {
  return {
    id,
    name,
    status: 'completed',
    conclusion: 'failure',
    html_url: `${PR}/checks/${id}`,
    started_at: '2020-01-01T00:00:00Z',
    completed_at: '2020-01-01T00:01:00Z',
    check_suite: { id },
  }
}

/** Seed every GitHub read the named jobs make, so the test stays off the wire. */
function seedGithub(runs: CheckRun[]): void {
  store.put('pr-head:beyondessential/workhorse#78', SHA)
  store.put(checkRunsKey('beyondessential', 'workhorse', SHA), { check_runs: runs })
  store.put(workflowRunsKey('beyondessential', 'workhorse', SHA), { workflow_runs: [] })
}

beforeEach(() => {
  setBody(prSection({ detailExpanded: true }))
  store.reset()
})

// Stop the store's background ticker so the process exits promptly.
after(() => store.reset())

test('the breakdown lands as the checks row next sibling', () => {
  store.put(branchStatusKey(WS, CARD), status())
  reconcileBreakdown()

  const row = anchors.checksRow()!.nextElementSibling
  assert.equal(row?.className, 'whp-stat-row')
  assert.equal(row?.querySelector('.whp-stat-value')?.textContent, '12 passed')
})

test('nothing is injected when the checks row is off screen', () => {
  // A collapsed pull request detail renders no checks row, so the breakdown has
  // nowhere to hang and the named jobs make no GitHub read. spec: GHUB
  setBody(prSection({ detailExpanded: false }))
  store.put(branchStatusKey(WS, CARD), status())
  seedGithub([failedRun(1, 'build')])

  reconcileBreakdown()
  reconcileJobs()

  assert.equal(document.querySelector('.whp-stat-row'), null)
  assert.equal(document.querySelector('.whp-checks'), null)
})

test('the named jobs hang beneath the breakdown, in order', () => {
  store.put(branchStatusKey(WS, CARD), status({ ci: { status: 'failing', total: 3, running: 0, failing: 1, skipped: 0, repoRunsChecks: true } }))
  seedGithub([failedRun(1, 'build')])

  // Whichever feature runs first, the breakdown stays above the jobs.
  reconcileJobs()
  reconcileBreakdown()

  const checks = anchors.checksRow()!
  const breakdown = checks.nextElementSibling
  const jobs = breakdown?.nextElementSibling
  assert.equal(breakdown?.className, 'whp-stat-row')
  assert.equal(jobs?.className, 'whp-checks')
  assert.ok(jobs?.querySelector('a.whp-check'))
})

test('a breakdown removed and re-added returns above the jobs', () => {
  store.put(branchStatusKey(WS, CARD), status({ ci: { status: 'failing', total: 3, running: 0, failing: 1, skipped: 0, repoRunsChecks: true } }))
  seedGithub([failedRun(1, 'build')])

  reconcileBreakdown()
  reconcileJobs()
  // Turn the breakdown off, then back on: it must not come back below the jobs.
  reconcileBreakdown({ checksBreakdown: false })
  assert.equal(anchors.checksRow()!.nextElementSibling?.className, 'whp-checks')
  reconcileBreakdown()

  assert.equal(anchors.checksRow()!.nextElementSibling?.className, 'whp-stat-row')
})
