# M1 — Checks row: the app's row is not a disclosure

The extension modelled the Checks row as an expandable disclosure. The app has
never rendered it as one: `ChecksRow` in Workhorse's `PrSection.tsx` is a flat
`<div>` with a label and a value, sitting as a sibling of the genuine Review
Hero disclosure inside the pull request detail. So `anchors.checksRow()` fell
back to `disclosureByLabel('Checks')`, never matched, `checksContent()` was
always null, and everything hanging off it rendered nothing.

## Decision

Option 1 (the only option): treat the flat row as the anchor. Inject the
breakdown and the named jobs as siblings after the Checks row rather than inside
a content block, and drop the "only while expanded" rule. The checks row itself
is rendered only while the pull request detail is expanded, so that expansion
remains the natural cost boundary for the GitHub read.

## Build steps

- [x] Anchors: `checksRow()` resolves the flat row by its label (new
      `rowByLabel`, no `aria-expanded` requirement); drop `checksContent()`.
      Keep `disclosureByLabel`/`disclosureContent` for Review Hero.
- [x] dom: add `ensureAfterOrdered` — find-or-create a sibling after a reference
      row, keeping the extension's ordered nodes contiguous and in order.
- [x] `statRows.ts`: inject the breakdown after the checks row via
      `ensureAfterOrdered`; drop the expansion condition.
- [x] `namedChecks.ts`: inject the jobs after the checks row the same way;
      rewrite the "only while expanded" comment to the new cost boundary.
- [x] `autoExpand.ts`: stop trying to open the Checks row (not a disclosure);
      keep opening Review Hero.
- [x] Fixture `app.ts`: render the Checks row flat — no `aria-expanded`, no
      content block. Drop the `checksOpen` option.
- [x] Specs: STAT (breakdown/jobs no longer expansion-gated), GHUB (cost
      boundary is the detail on screen), AEXP (only Review Hero is opened).
- [x] prefs: retarget the `autoExpandRows` switch copy to Review Hero only; fix
      the check-breakdown switch copy.
- [x] Tests: update anchors and autoExpand tests to the flat-row model; add
      DOM-level coverage that the breakdown and jobs land beneath the checks row
      with no disclosure.
- [x] Test cases file for the card.

## Verify by hand

The tests cannot reach the app's real React rendering. `web-ext run` against a
live Workhorse, on a card with a pull request: expand the pull request detail
and confirm the check breakdown appears beneath the Checks row, and — with a
GitHub token set — the named failed/running jobs beneath it. Both should be
present without any Checks-row click, since the row is not a disclosure.
