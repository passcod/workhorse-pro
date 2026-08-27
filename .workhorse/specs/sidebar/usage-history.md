---
id: UHST
---

# Claude usage history

The app's sidebar footer carries a bar reading the Claude plan's five-hour window: a fill for how much of the allowance is spent, and a notch cut out of it marking how far through the window the clock has reached.
It states the position now and nothing about how it was arrived at, so a window that was spent in twenty minutes and one spent steadily over four hours read identically.

Hovering the footer expands that bar into a stack of bars, one per half hour, which says when the allowance went.

The stack is the bar repeated rather than a chart. Every row is the same instrument, measuring the same thing along the same axis, so nothing has to be learned to read one — and the live bar is the stack's own bottom row rather than a separate object beside it.

## The stack

- [ ] The stack holds ten rows, one per half hour, evenly spaced
- [ ] Rows run oldest at the top to the present at the bottom
- [ ] The bottom row is the live bar itself, in the place the app already draws it
- [ ] Each row spans the same width as the bar and reads the same way: the fill is the proportion of the window's allowance spent, measured from the left
- [ ] A row's fill is the total spent as at the end of its half hour, so fills grow down the stack within a window
- [ ] Ten rows reach back five hours, which is longer than one window, so the stack carries the tail of the window before the current one

Each row is a running total rather than what that half hour alone consumed.
The bottom row has to be the live bar, and the bar is a running total; a row measuring one half hour's consumption would put the ideal mark at a tenth of the width on every row and break the correspondence.

## Reading against the clock

The bar's notch marks how far through the window the clock has reached. Consumption level with the notch is spending at exactly the rate the window refills, and past it is spending faster.

- [ ] Each row takes its colour from its own crossing at the time that row ended: the app's quiet fill while under the mark, and the app's warning colour once at or past it
- [ ] The stack therefore turns colour at the row where the window began to be overspent, which is the half hour a reader is looking for

The threshold is a crossing rather than a chosen percentage, which is what lets it carry a colour without anyone having nominated where concern begins.

### The clock mark

- [ ] The notch becomes one continuous line per window, running from where that window opened to where its clock stands now
- [ ] The line is masked out of the rows it crosses, in the sidebar's own colour, so it reads as a gap cut through them exactly as the bar's notch does
- [ ] The line is centred on the clock's position, as the bar's notch is
- [ ] The line's thickness measured across itself is a little wider than the bar's notch, because the angle makes a mark of equal width read as narrower
- [ ] The mask's edges are vertical, so the gap spans each row's full height wherever the line crosses it
- [ ] Rows either side of a window's reset are spaced no differently from any other pair

A window's reset needs nothing drawn to mark it.
The fill collapses back to almost nothing and the clock mark jumps to the left edge, and each of those says where the window turned over; a gap or a rule between the rows would only restate it.

## The window before this one

- [ ] Rows belonging to a window that has already reset are faded well back
- [ ] A faded row keeps whichever colour its own crossing gives it, rather than taking one colour for being in the past

Fading is what keeps the footer readable.
A spent previous window fills most of the stack with the warning colour while the current position may be perfectly comfortable, and at a glance the footer would report the wrong window.

## Opening and closing

- [ ] Hovering the footer opens the stack, and leaving it closes it again
- [ ] The stack is drawn over the navigation above the footer, and nothing already on screen moves to accommodate it
- [ ] The live bar stays exactly where it is throughout; what moves is the label row above, riding up as the stack grows
- [ ] With the stack open, the proportion of the window used stands where the reading's age does, and the age returns when it closes
- [ ] The row carrying that reading keeps its shape either way, so the control beside it does not move
- [ ] The control that asks for a fresh reading stays available while the stack is open, and acts on the app's own control

The age gives way rather than making room.
With the series on screen the figure is the more useful of the two, and the age is already what the closed bar carries.
- [ ] The app's own tooltip on the footer does not appear while the stack is open or opening, because the stack states everything the tooltip did

The footer holds its height as data states swap so that the navigation above never moves, and an expansion that pushed the navigation would give that up.

### Motion

- [ ] Opening and closing are the same transition run in either direction, eased in and out
- [ ] Each row appears whole rather than being wiped or grown, one after another from the live bar upward
- [ ] Closing reveals in reverse, from the top row down, so the stack peels away from its far end rather than collapsing into the bar
- [ ] The clock mark starts as the bar's own upright notch and tilts back into the line as the stack opens, reversing on close
- [ ] Where the reader has asked for reduced motion there is no animation at all: the stack is present when open and absent when closed, with the mark already angled

## What the head row says

The bar's head row names the reading and states when the window resets.

- [ ] With the stack closed, the head row states the reset
- [ ] With the stack open, it states when the allowance is expected to run out, whenever that is expected before the reset
- [ ] Where no runout is expected before the reset, the reset stands in both states
- [ ] The expected runout is derived from the rate of recent readings

The runout replaces the reset rather than joining it, and only while the stack is open.
Once the allowance is going to be gone before the window turns over, when it runs out is the actionable time and the reset is not — but that figure is read off the recorded series, so it belongs with the series rather than standing in the closed bar, where the app's own reading is the reset.

## Recorded readings

- [ ] Readings are recorded as they arrive, identified by the window they belong to and the time they were taken
- [ ] A reading identical to the one already recorded for that moment is not recorded again

A window's identity is not the reset time it states.
That time moves while a window is live, and a reading whose stated reset has merely moved belongs to the window already running.

- [ ] A reading joins the window the previous reading belonged to unless its stated reset has moved far enough that the window must have turned over
- [ ] How far the stated reset has moved is judged between consecutive readings, so many small movements never accumulate into a turnover that did not happen
- [ ] A window keeps one identity for its whole life, while what is drawn against it — how far the clock has reached, and when the allowance returns — follows the most recent reset stated for it

Treating each stated reset as its own window is the failure this guards.
It presents as a session's whole history appearing under a window that had already reset and a live window that has just begun, which is indistinguishable from history the feature could not have recorded.
- [ ] Recordings survive the tab and the browser closing
- [ ] At most two windows are kept: the one running and the one before it
- [ ] A window older than that is discarded

Two is every window the stack can display, so a third would be data nothing can show.
Persistence is what makes the feature work at all: the stack is built up over hours, and the periods it most needs to cover are the ones where the tab was closed.

- [ ] Recordings stay on the device that wrote them

They are working state tied to what the reader was doing on that machine, at a scale the synced area is not sized for — the same reasoning as recorded input history and stashed drafts.

### Where a half hour has no reading

The extension records only while a Workhorse tab is open, so a half hour can pass with nothing recorded for it.

- [ ] A row with no reading of its own shows the last total known before it

The running total is carried forward rather than the row being left out or drawn as a gap.
A row so filled understates what was spent, which is accepted: the reading it stands in for is not recoverable, and a stack with holes in it would be harder to read than one that is briefly conservative.

## When there is nothing to expand

- [ ] The stack is absent wherever the app draws no bar, and the footer is left exactly as the app rendered it
- [ ] A footer stating why there is no reading rather than showing one does not expand

## Preferences

- [ ] The usage history has its own switch
- [ ] Turning the switch off leaves the app's footer as it is, including its own tooltip
- [ ] The recorded readings can be cleared, independently of the other stored data
