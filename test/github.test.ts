import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkRunState,
  elapsedMs,
  formatDuration,
  parsePrUrl,
  rankChecks,
} from '../src/lib/github.ts'

test('owner, repo and number parse out of a pull request URL', () => {
  assert.deepEqual(parsePrUrl('https://github.com/beyondessential/workhorse/pull/78'), {
    owner: 'beyondessential',
    repo: 'workhorse',
    number: 78,
  })
})

test('a card with no pull request yet yields nothing rather than throwing', () => {
  assert.equal(parsePrUrl(null), null)
  assert.equal(parsePrUrl(undefined), null)
  assert.equal(parsePrUrl(''), null)
})

test('URLs that are not github pull requests are refused', () => {
  assert.equal(parsePrUrl('not a url'), null)
  assert.equal(parsePrUrl('https://example.com/o/r/pull/1'), null)
  assert.equal(parsePrUrl('https://github.com/o/r'), null)
  assert.equal(parsePrUrl('https://github.com/o/r/issues/1'), null)
  assert.equal(parsePrUrl('https://github.com/o/r/pull/notanumber'), null)
  assert.equal(parsePrUrl('https://github.com/o/r/pull/0'), null)
})

test('a check still going is running', () => {
  assert.equal(checkRunState({ status: 'queued', conclusion: null }), 'running')
  assert.equal(checkRunState({ status: 'in_progress', conclusion: null }), 'running')
})

test('conclusions that mean failure are failures', () => {
  for (const conclusion of ['failure', 'timed_out', 'action_required']) {
    assert.equal(checkRunState({ status: 'completed', conclusion }), 'failed')
  }
})

test('conclusions that settled without running are skipped', () => {
  for (const conclusion of ['skipped', 'neutral', 'cancelled', 'stale']) {
    assert.equal(checkRunState({ status: 'completed', conclusion }), 'skipped')
  }
})

test('an unrecognised conclusion is read as passed', () => {
  // The same way the passed count is whatever remains: a conclusion this does
  // not name must not become a failure the user cannot explain.
  assert.equal(checkRunState({ status: 'completed', conclusion: 'success' }), 'passed')
  assert.equal(checkRunState({ status: 'completed', conclusion: 'something_new' }), 'passed')
})

// ── Durations and ranking ────────────────────────────────────────────────

const NOW = Date.parse('2026-08-14T12:00:00.000Z')

function run(overrides: Partial<{
  name: string
  status: string
  conclusion: string | null
  html_url: string | null
  started_at: string | null
  completed_at: string | null
}> = {}) {
  return {
    name: 'job',
    status: 'in_progress',
    conclusion: null,
    html_url: null,
    started_at: '2026-08-14T11:59:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

test('a running job has been going since it started', () => {
  assert.equal(elapsedMs(run(), NOW), 60_000)
})

test('a settled job reports how long it ran, not how long ago', () => {
  const settled = run({
    started_at: '2026-08-14T11:00:00.000Z',
    completed_at: '2026-08-14T11:05:00.000Z',
  })
  assert.equal(elapsedMs(settled, NOW), 300_000)
})

test('a job that has not started has no elapsed time', () => {
  // Reporting one would make a queue look like work.
  assert.equal(elapsedMs(run({ started_at: null }), NOW), null)
  assert.equal(elapsedMs(run({ started_at: 'nonsense' }), NOW), null)
})

test('a clock skewed backwards does not produce a negative duration', () => {
  assert.equal(elapsedMs(run({ started_at: '2026-08-14T12:00:30.000Z' }), NOW), 0)
})

test('durations read at the coarseness that matters', () => {
  assert.equal(formatDuration(3_000), '3s')
  assert.equal(formatDuration(59_000), '59s')
  assert.equal(formatDuration(60_000), '1m')
  assert.equal(formatDuration(134_000), '2m14s')
  assert.equal(formatDuration(3_600_000), '1h')
  assert.equal(formatDuration(3_780_000), '1h3m')
})

test('only failures and running jobs are listed', () => {
  const ranked = rankChecks(
    [
      run({ name: 'passed', status: 'completed', conclusion: 'success' }),
      run({ name: 'skipped', status: 'completed', conclusion: 'skipped' }),
      run({ name: 'going' }),
    ],
    NOW,
  )
  assert.deepEqual(ranked.shown.map((r) => r.run.name), ['going'])
  assert.equal(ranked.running, 1)
  assert.equal(ranked.failed, 0)
})

test('failures come first, then the longest running', () => {
  const ranked = rankChecks(
    [
      run({ name: 'short', started_at: '2026-08-14T11:59:30.000Z' }),
      run({ name: 'long', started_at: '2026-08-14T11:00:00.000Z' }),
      run({
        name: 'broke',
        status: 'completed',
        conclusion: 'failure',
        completed_at: '2026-08-14T11:59:10.000Z',
      }),
    ],
    NOW,
  )
  assert.deepEqual(ranked.shown.map((r) => r.run.name), ['broke', 'long', 'short'])
})

test('a queued job sorts below one that is actually running', () => {
  const ranked = rankChecks(
    [run({ name: 'queued', status: 'queued', started_at: null }), run({ name: 'going' })],
    NOW,
  )
  assert.deepEqual(ranked.shown.map((r) => r.run.name), ['going', 'queued'])
})

test('a long list is capped, and says how much it left out', () => {
  // Some repositories run over a hundred jobs, and the section does not scroll.
  const many = Array.from({ length: 112 }, (_, i) =>
    run({ name: `job-${i}`, started_at: new Date(NOW - i * 1000).toISOString() }),
  )
  const ranked = rankChecks(many, NOW)
  assert.equal(ranked.shown.length, 5)
  assert.equal(ranked.hidden, 107)
  assert.equal(ranked.running, 112)
  // The five shown are the five that have been going longest.
  assert.deepEqual(
    ranked.shown.map((r) => r.run.name),
    ['job-111', 'job-110', 'job-109', 'job-108', 'job-107'],
  )
})

test('nothing to report leaves an empty list rather than a zero row', () => {
  const ranked = rankChecks([run({ status: 'completed', conclusion: 'success' })], NOW)
  assert.equal(ranked.shown.length, 0)
  assert.equal(ranked.hidden, 0)
})
