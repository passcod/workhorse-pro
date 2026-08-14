---
id: DIFF
---

# Raw diff view

Markdown artefacts in the card workspace are read through a toggle offering File and Changes.
Both render the whole document: File as the editor, Changes as a tracked-changes render with insertions and deletions marked in place.

A third segment renders the same comparison as a unified diff, showing changed passages and their immediate surroundings and nothing else.

A spec that runs to pages is the case this exists for.
Finding what moved in one otherwise costs a scroll through everything that did not, and neither of the app's own views can be asked for less.

## The segment

- [ ] A third segment labelled Diff sits after Changes in the toggle above a markdown artefact
- [ ] The segment is part of the app's own toggle rather than a second control beside it, and takes the same selected and unselected treatment the app gives its own segments
- [ ] Exactly one segment reads as selected, so choosing Diff deselects whichever was selected before, and choosing File or Changes deselects Diff
- [ ] Selecting Diff puts the unified diff where the app's own artefact view was, and selecting File or Changes gives that view back
- [ ] The segment appears on every markdown artefact the toggle itself appears on — specs, plans, breakdowns, test cases and working docs alike
- [ ] Where the app renders no toggle, none is added, so an artefact the app excludes is excluded here too
- [ ] A mockup is never given the segment, because the toggle above one selects a device rather than a view

The toggle above a mockup is the same control with different segments, so a segment appended by position alone would land there.

- [ ] Choosing Diff holds while that artefact stays open, the same way choosing File or Changes does
- [ ] Opening a different artefact leaves the choice of view to the app, so the reader lands wherever the app would have put them

## The comparison

- [ ] The diff compares the artefact's content on the card's branch against its content on the base branch — the same two sides the Changes view compares
- [ ] An artefact with no version on the base branch reads as entirely added
- [ ] An artefact whose two sides are identical says so, rather than the segment being withheld

Saying so is the point.
A segment that disappears when there is nothing to show cannot be told apart from a feature that has broken, whereas an empty diff answers the question that was asked.

## What the diff shows

- [ ] Added and removed lines are marked and coloured as such, with a few lines of unchanged context around each change
- [ ] Unchanged stretches between changes are left out
- [ ] Each hunk is headed with the range it covers on each side, followed by the heading that hunk falls under, so a change can be placed in a long document without reading back to find out where it is
- [ ] The markdown is shown as source rather than rendered, so what changed is visible as it is written

Showing source is what separates this from the view beside it.
A rendered diff cannot show a change to a heading level, a link target, or a checkbox marker, and those are changes worth seeing.

## Reading the two sides

- [ ] Both sides are read from the app's own endpoints and cached the way every other Workhorse response is
- [ ] The diff reports that it is loading while a side is still on its way
- [ ] A side that cannot be read is reported in place, naming that the diff could not be built

A failed read is reported rather than skipped, unlike every other feature the extension adds.
The others render detail nobody asked for, so their absence costs nothing; this one is behind a segment the reader clicked, and a click that produces nothing at all reads as a broken control.

- [ ] Content changing while the diff is open is reflected there without leaving the view and returning

An agent turn landing and an edit made in File view both change the side being compared, and the diff is stale until it follows.
