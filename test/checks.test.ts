import { test } from 'node:test'
import assert from 'node:assert/strict'
import { breakdownIsEmpty, checkBreakdown, formatReviewCounts } from '../src/lib/checks.ts'
import type { CheckStatus } from '../src/data/types.ts'

function ci(overrides: Partial<CheckStatus>): CheckStatus {
  return {
    status: null,
    total: 0,
    running: 0,
    failing: 0,
    repoRunsChecks: true,
    ...overrides,
  }
}

test('a clean run is all passed', () => {
  // The app folds suites settled without running their work into the total, so
  // they land in the passed count rather than being singled out.
  assert.deepEqual(checkBreakdown(ci({ status: 'passing', total: 12 })), {
    passed: 12,
    failed: 0,
    running: 0,
  })
})

test('a failure verdict with no detail still reports one failure', () => {
  // A breakdown reading "3 passed" under a row reading "1 failed" would not
  // merely disagree with the row, it would count the failure as a pass.
  assert.deepEqual(checkBreakdown(ci({ status: 'failing', total: 3, failing: 0 })), {
    passed: 2,
    failed: 1,
    running: 0,
  })
})

test('a pending verdict with no detail still reports one running', () => {
  assert.deepEqual(checkBreakdown(ci({ status: 'pending', total: 3, running: 0 })), {
    passed: 2,
    failed: 0,
    running: 1,
  })
})

test('the passed count never goes negative', () => {
  // The counts come from two endpoints and a floor above may have raised one,
  // so a total that cannot accommodate them must not render as a negative.
  assert.deepEqual(checkBreakdown(ci({ status: 'failing', total: 0, failing: 0 })), {
    passed: 0,
    failed: 1,
    running: 0,
  })
})

test('an all-zero breakdown renders nothing', () => {
  assert.equal(breakdownIsEmpty(checkBreakdown(ci({ total: 0 }))), true)
  assert.equal(breakdownIsEmpty(checkBreakdown(ci({ status: 'passing', total: 1 }))), false)
})

test('a review with no findings reads as no issues', () => {
  const summary = formatReviewCounts({ critical: 0, suggestion: 0, nit: 0 })
  assert.equal(summary.text, 'No issues')
  assert.equal(summary.critical, 0)
})

test('a review with findings reads as a total, with the critical count apart', () => {
  assert.equal(formatReviewCounts({ critical: 0, suggestion: 1, nit: 0 }).text, '1 issue')
  const many = formatReviewCounts({ critical: 2, suggestion: 1, nit: 3 })
  assert.equal(many.text, '6 issues')
  assert.equal(many.critical, 2)
})
