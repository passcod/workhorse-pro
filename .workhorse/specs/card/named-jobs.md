---
id: NJOB
---

# Named jobs

The Checks row reports a verdict, and its own Latest run reading reports the counts behind it.
Neither says which job failed, or how long the rest have been going.

These are jobs, where the reading above them counts workflows — a handful of running workflows can be a hundred running jobs.
The two are named rather than left stacked for the reader to reconcile.

The list sits inside the Checks row's own disclosure, alongside the readings the app puts there, and has its own switch.

## The list

- [ ] The jobs are listed inside the Checks row, under a count of their own that names them as jobs
- [ ] A job is named by its workflow and then itself, as GitHub names it, because jobs from a reusable or matrix workflow share a name and say nothing on their own
- [ ] Where the workflow is unknown, or is the job's own name, the job stands alone
- [ ] Given too little width the workflow gives way before the job does, since the job is what tells one row from another, and the whole name stays available
- [ ] Only jobs that have failed or are still running are listed, since those are the ones worth acting on and a full suite would bury them
- [ ] Each job shows how long it has been going, or how long it ran before it settled
- [ ] A job that has not started yet says so, rather than reporting no time at all
- [ ] Failed jobs are listed first, and the rest longest-running first, so the list reports both that work is happening and which of it has been happening too long
- [ ] The list is capped, and says how many jobs it left out — some repositories run over a hundred, and the section does not scroll
- [ ] Every job links to its own page on GitHub — for a failure to see why, and for a long-running one to see what it is stuck on
- [ ] A failed job is coloured as the row's own failure verdict is

## What it costs

- [ ] The list is read from GitHub only when the Checks row is open, so a pull request detail left collapsed, or a row left closed, reads nothing from GitHub
- [ ] Without GitHub access the row keeps the readings the app renders, which is a loss of detail rather than of function

See `platform/github.md` for how that access is supplied and what it costs.
