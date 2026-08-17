# R1 — Remove all conversations and update PR section

Scenarios verifying the three removals and the anchor re-grounding against
upstream `06835cda`.

## Cross-workspace conversations removed

- [ ] On a real card, the sidebar's Conversations header shows no extension scope control, and the app's own All conversations scope works untouched
- [ ] The preferences page lists no Cross-workspace conversations switch (verifies spec: PREF)
- [ ] A stored `scopeWide`/`crossWorkspaceConversations` value from a previous version is ignored rather than read
- [ ] The page-world script still observes branch-status responses with the navigate router gone (verifies spec: DATA)

## Raw diff toggle removed

- [ ] On a real markdown artefact, the File/Changes toggle carries no Diff segment, and upstream's own raw/pretty toggle in the artefact menu works untouched
- [ ] The preferences page lists no Raw diff view switch (verifies spec: PREF)
- [ ] Opening a mockup still shows the device toggle unaltered

## PR section: breakdown and review stats removed

- [ ] On a card with a failing suite, the Checks row shows exactly one Latest run reading — the app's — with no duplicate from the extension (verifies spec: PREF)
- [ ] On a card mid-review, the Review Hero row shows one Runs and one Latest run reading, both the app's
- [ ] The preferences page lists no Check breakdown or Review run stats switch

## Named jobs kept and re-placed

- [x] The jobs render inside the Checks disclosure content rather than after the row (anchors.test.ts, verifies spec: NJOB)
- [ ] On a card with a failing suite and a token, the jobs list sits inside the open Checks row, below the app's own readings (verifies spec: NJOB)
- [ ] With the Checks row closed, no GitHub request is made (verifies spec: NJOB, GHUB)
- [ ] Without a token, the row keeps the app's readings and loses only the jobs list (verifies spec: NJOB)
- [ ] A failed job links to its own page on GitHub and opens in a new tab

## Anchors against the current app

- [x] `prDetailToggle` resolves through `pr-create-chevron` before a PR and `pr-detail-chevron` after, not the overflow menu (anchors.test.ts, verifies spec: INJ)
- [x] The Checks row resolves as a disclosure carrying its own expanded state (anchors.test.ts, verifies spec: INJ)
- [x] Each row's content resolves only while that row is open (anchors.test.ts, verifies spec: INJ)
- [x] The branch disclosure resolves by its chevron test id and is not mistaken for a stat row (anchors.test.ts, verifies spec: INJ)
- [x] Auto-expand opens both Checks and Review Hero, and a collapse of one does not hold the other closed (autoExpand.test.ts, verifies spec: AEXP)
- [ ] On a real card, auto-expand opens the PR detail, the branch disclosure, and both rows, and yields to a deliberate collapse (verifies spec: AEXP)

## Regression watch

- [ ] Composer history and stash still work on a real card
- [ ] The workspace switcher still sorts alphabetically
- [ ] The Prohorse wordmark still renders in both the header and the retracted rail
