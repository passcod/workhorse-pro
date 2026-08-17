# R1 — Remove all conversations and update PR section

Scenarios verifying the cross-workspace-conversations removal and the PR-section
realignment to the current upstream Workhorse.

## Cross-workspace conversations removed

- [x] The check breakdown, named jobs, and review run stats still render — nothing the removal touched broke the other PR-section readings (statRows.test.ts)
- [ ] On a real card, the sidebar's Conversations header shows no extension scope control, and the app's own All conversations scope works untouched
- [ ] The preferences page lists no Cross-workspace conversations switch, and every other switch still renders in order (verifies spec: PREF)
- [ ] A stored `scopeWide`/`crossWorkspaceConversations` value from a previous version is ignored rather than read

## Check breakdown without the skipped bucket

- [x] A clean run reads as a passed count alone, with no skipped part (checks.test.ts, verifies spec: STAT)
- [x] Suites the app folded into the total — skipped, neutral, cancelled, stale — land in the passed count rather than being singled out (checks.test.ts, verifies spec: STAT)
- [x] A failure or pending verdict with no detail still floors at one failed / one running (checks.test.ts, verifies spec: STAT)
- [x] The passed count never renders negative (checks.test.ts, verifies spec: STAT)
- [ ] On a real card, the breakdown agrees with the app's Checks row for the same head, with Review Hero suites excluded from both

## PR detail toggle re-grounded

- [x] `prDetailToggle` resolves to the Branch details button before a PR exists (anchors.test.ts, verifies spec: INJ)
- [x] `prDetailToggle` resolves to the collapsed bar's title button once a PR exists, not the Open on GitHub link (anchors.test.ts, verifies spec: INJ)
- [ ] On a real card, auto-expand opens the PR detail and the branch dropdown, and yields to a deliberate collapse (verifies spec: AEXP)

## Known gap (not covered here)

- Named jobs read from GitHub still include Review Hero jobs, which the app now
  excludes from its Checks count — left for a follow-up (see plan).
