import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRunState, parsePrUrl } from '../src/lib/github.ts'

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
