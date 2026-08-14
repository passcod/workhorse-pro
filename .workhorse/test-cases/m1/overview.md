# M1 — Checks row readings render

The Checks row is flat, not a disclosure. The check breakdown and the named
jobs hang beneath it as siblings, in view whenever the row is on screen. These
scenarios verify the readings actually render, which is what the old
disclosure-shaped fixture hid.

## Anchor resolution

- [x] The Checks row resolves to the flat row and carries no `aria-expanded` (verifies spec: INJ)
- [x] The Review Hero row still resolves as a disclosure, and its content resolves only while open (verifies spec: INJ)
- [x] The `data-wh-pr-row="checks"` hook still wins over the label fallback (verifies spec: INJ)

## Breakdown and named jobs

- [x] The breakdown lands as the Checks row's next sibling, showing the counts (verifies spec: STAT)
- [x] The named jobs hang beneath the breakdown, in order, whichever feature runs first (verifies spec: STAT)
- [x] A breakdown removed and re-added returns above the jobs (verifies spec: STAT)
- [x] Nothing is injected and no GitHub read is made when the checks row is off screen (verifies spec: GHUB, STAT)
- [ ] The breakdown shows nothing when every count is zero (verifies spec: STAT)
- [ ] Without a GitHub token, the breakdown still shows and the named jobs do not (verifies spec: GHUB)

## Auto-expand

- [x] With the switch off, the Review Hero row stays closed (verifies spec: AEXP)
- [x] With the switch on, the Review Hero row opens; the flat Checks row is left alone (verifies spec: AEXP)
- [x] Closing the Review Hero row by hand keeps it closed (verifies spec: AEXP)

## Manual (needs the real app)

- [ ] On a card with a pull request, expanding the detail shows the breakdown beneath the Checks row with no click (verifies spec: STAT)
- [ ] With a GitHub token set, the named failed/running jobs appear beneath the breakdown (verifies spec: STAT, GHUB)
- [ ] The readings follow the app's light and dark themes and match the row styling around them
