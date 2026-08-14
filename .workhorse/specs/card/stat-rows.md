---
id: STAT
---

# Pull request stat rows

Three readings hang beneath the rows they belong to in the pull request section, each showing the detail behind that row's own verdict.
They are supplementary: the row above already carries the answer everyone needs, and these say how it was arrived at.

Each row has its own switch, and each is rendered from the branch status the extension holds for the card on screen.

## Check breakdown

The checks row reports a verdict.
The breakdown reports the counts behind it.

- [ ] The breakdown hangs beneath the checks row, visible when that row is expanded
- [ ] Runs are counted into passed, failed, running, and skipped
- [ ] Only non-zero counts appear, so an ordinary clean run reads as a passed count alone rather than padding three zeroes around it
- [ ] Only the failed count is coloured, taking the same treatment the checks row gives its own failure verdict
- [ ] The breakdown shows nothing at all when every count is zero

The counts must agree with the row above them for the same head, which constrains how they are derived.

- [ ] A missing skipped count is read as none, so a response that predates the field does not turn every count into nonsense
- [ ] When the overall status reports failure, the failed count is at least one, and when it reports work in progress, the running count is at least one
- [ ] The passed count is whatever remains after the other three, and never falls below zero

## Review run stats

- [ ] The run count and the last run's findings hang beneath the review row, visible when that row is expanded
- [ ] The run count is the live round while a review loop is running, and the last completed round otherwise
- [ ] The run count is omitted when no rounds have run
- [ ] The last run's findings are omitted when no review has completed
- [ ] A completed review with no findings reads as having found no issues
- [ ] A completed review with findings reads as a total, followed by the critical count when there is one, with the critical count coloured

## Effective base branch

A card stacked on a merged parent inherits the parent's own base, so the branch it is really cut from can differ from what the base row names.

- [ ] The resolved base branch hangs beneath the base row, in mono
- [ ] It appears only when the resolved branch differs from what the base row implies
