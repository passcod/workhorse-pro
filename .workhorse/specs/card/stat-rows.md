---
id: STAT
---

# Pull request stat rows

Two readings hang beneath the rows they belong to in the pull request section, each showing the detail behind that row's own verdict.
They are supplementary: the row above already carries the answer everyone needs, and these say how it was arrived at.

Each row has its own switch, and each is rendered from the branch status the extension holds for the card on screen.

Where two of these sit under the same row, they keep a fixed order — one that is removed and added back does not return below its neighbour.

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

### Named jobs

A count says something failed; it does not say which, or how long the rest have been going.

These are jobs, where the breakdown above counts workflows — a handful of running workflows can be a hundred running jobs.
The two are named rather than left stacked for the reader to reconcile.

- [ ] The jobs are listed beneath the breakdown, under a count of their own that names them as jobs
- [ ] Only jobs that have failed or are still running are listed, since those are the ones worth acting on and a full suite would bury them
- [ ] Each job shows how long it has been going, or how long it ran before it settled
- [ ] A job that has not started yet says so, rather than reporting no time at all
- [ ] Failed jobs are listed first, and the rest longest-running first, so the list reports both that work is happening and which of it has been happening too long
- [ ] The list is capped, and says how many jobs it left out — some repositories run over a hundred, and the section does not scroll
- [ ] A failed job links to its own logs
- [ ] A failed job takes the same colouring as the failed count above it
- [ ] The list appears only while the checks row is expanded, so a collapsed row reads nothing from GitHub
- [ ] Without GitHub access the breakdown shows its counts alone, which is a loss of detail rather than of function

See `platform/github.md` for how that access is supplied and what it costs.

## Review run stats

- [ ] The run count and the last run's findings hang beneath the review row, visible when that row is expanded
- [ ] The run count is the live round while a review loop is running, and the last completed round otherwise
- [ ] The run count is omitted when no rounds have run
- [ ] The last run's findings are omitted when no review has completed
- [ ] A completed review with no findings reads as having found no issues
- [ ] A completed review with findings reads as a total, followed by the critical count when there is one, with the critical count coloured

