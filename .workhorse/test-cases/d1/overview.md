# Raw diff view

Scenarios verifying the Diff segment on the artefact toggle and the unified diff it renders. spec: DIFF

## The segment

- [x] The segment appears after File and Changes on a markdown artefact, and reads as unselected (verifies spec: DIFF)
- [x] Choosing Diff selects it and puts the diff where the app's artefact view was (verifies spec: DIFF)
- [x] While Diff is showing, the app's own segments read as unselected (verifies spec: DIFF)
- [x] Leaving Diff restores the app's view and its own selection (verifies spec: DIFF)
- [x] A mockup gets no segment, because its toggle selects a device rather than a view (verifies spec: DIFF)
- [x] A non-markdown artefact gets no segment (verifies spec: DIFF)
- [x] A markdown file from the repository itself, not the workhorse tree, gets the segment and a diff (verifies spec: DIFF)
- [x] Opening another artefact leaves the view to the app rather than carrying the selection over (verifies spec: DIFF)
- [x] No artefact open, and no card page at all, add nothing (verifies spec: DIFF)
- [x] A deleted artefact gets no segment, because the app renders no toggle for one (verifies spec: DIFF)
- [x] Clicking File while the app is already in File still leaves Diff, though nothing in the page moved (verifies spec: DIFF)

## The diff

- [x] Only changed passages and a few lines either side appear, and unchanged stretches between them are left out (verifies spec: DIFF)
- [x] Each hunk is headed with the ranges it covers and the heading it falls under (verifies spec: DIFF)
- [x] A change above the first heading carries no heading on its hunk (verifies spec: DIFF)
- [x] The heading is read from the base side, as git reads it (verifies spec: DIFF)
- [x] An artefact with no version on the base branch reads as entirely added (verifies spec: DIFF)
- [x] An artefact identical on both sides says there are no changes rather than the segment being withheld (verifies spec: DIFF)
- [x] Line numbers count the whole document rather than restarting per hunk (verifies spec: DIFF)
- [x] The markdown is shown as source, so a heading level or checkbox marker that changed is visible (verifies spec: DIFF)
- [ ] A change to a link target or a table row renders readably rather than wrapping into nonsense

## Reading the two sides

- [x] The base read is keyed by the card's own id rather than its identifier (verifies spec: DIFF)
- [x] No read carries a pull request number, peeking being out of scope for this card (verifies spec: DIFF)
- [x] A failed read is reported in place rather than leaving the panel blank (verifies spec: DIFF)
- [x] Content changing while the diff is open is reflected without leaving the view and returning (verifies spec: DIFF)
- [x] The diff says it is loading while a side is still on its way, rather than flashing "no changes" (verifies spec: DIFF)

## Injection

- [x] A pass that changes nothing leaves the rendered nodes in place (verifies spec: INJ)
- [x] Turning the switch off removes the segment, the panel, and the hiding of the app's view (verifies spec: PREF)
- [ ] The reconcile loop does not feed itself while the diff is open

## Manual

These need a running Workhorse and a real browser, and cannot be covered headlessly.

- [ ] The segment is indistinguishable from the app's own two: same height, radius, type, and selected treatment
- [ ] Added and removed lines take the app's own diff colours, and follow the light and dark themes
- [ ] The panel scrolls independently and does not push the header bar off screen
- [ ] Switching between File, Changes and Diff repeatedly leaves no stale panel and no hidden artefact view
- [ ] An agent turn landing while Diff is open updates the diff in place, without losing scroll position
- [ ] A spec running to several pages renders quickly, and the hunks are small enough to be the point of the view
