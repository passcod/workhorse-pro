# Session usage graph — working notes

Workshop notes for V1. Decisions and findings, ahead of specs.

## Feature 2 is already fixed upstream — drop it

The card's second ask, stopping the bar switching to weekly usage, needs no work.
Workhorse `V27` (#823, 26 Aug 2026) changed the resolver to always read the payload's top-level `five_hour` block rather than whichever window the endpoint marks active, for the reason the card gives: a weekly figure sits low while the session window that is about to bind sits high, so switching changed what the bar measured without saying so.

Confirm against the live deploy before closing it out, but there is nothing to build.

## Where the reading comes from

`GET /api/me/subscription-usage`, same-origin JSON, `{ report, unavailable, readAt }`.
The app polls it about every 100s while a reading is live, so this is an observation target in the `DATA` sense — captured response, shallow shape check, into the store, with the extension's own GET as the fallback that needs no credential. No DOM scraping.

Fields the feature needs:

- `report.percent` — 0 to 100, five-hour window, integer-rounded by the endpoint
- `report.resetsAt` — ISO, window end
- `report.windowMinutes` — 300
- `readAt` — when the paired device took the reading

The paired device reads every 5 minutes, so a full window is about 60 samples on integer steps.

**Window identity is free.** Each window's `resetsAt` is unique, so bucketing samples by it gives window boundaries with no heuristics, and `readAt` dedupes repeat samples of one reading. Consecutive windows' `resetsAt` differ by exactly five hours when contiguous and by more when there was a gap, so adjacency is computable.

**Anchor.** The bar is reachable semantically as `role="meter"` with `aria-label="Claude plan usage"` — stable, and not a utility class. The element is absent when `percent` is null, which is the degrade-to-absent case for free.

**Storage.** Device-local alongside input history and the stash, per `PREF`: a sampled series is working state at a scale the synced area is not sized for.

## Par is the app's clock mark

Par is not something to invent. It is `windowElapsedFraction`, the notch cut out of the bar: how far through the five-hour window the clock has reached. Par at any moment is elapsed fraction, so within a window it runs 0 to 100% linearly.

The over-par colour rule is the app's own, `percent/100 >= clock`, so the feature inherits a crossing rather than nominating a threshold like 80%.

## Shape: the bar, repeated

The expansion is a stack of bars, not a line chart.

- **One row per half hour**, ten rows always, oldest at the top, the present at the bottom where the bar already sits
- **Percent stays on x in every row**, so each row is the instrument people already read
- **Each row is the running total** at the end of its half hour, not that half hour's consumption. Forced: the bottom row has to be the app's bar, and per-half-hour deltas would put par at a constant 10% on every row, killing the sweep and breaking the correspondence
- **Each row takes its colour from its own crossing at that time**, so the stack turns amber at the row where the window went over. This is the concept's real win over a curve: it names the half hour rather than just reporting the current verdict

### The clock mark becomes a mask

- **One line per window**, from where the window opened at the top left to where its clock stands at the bottom right, masked through the rows it crosses
- **3px measured across the line**, matching the bar's own notch. That needs a wider horizontal offset the shallower the line runs, computed from the stack's dimensions rather than hard-coded — at seven rows it is about 7.9px, at two rows about 10.2px
- **Vertical edges, not a stroke.** A 3px SVG stroke is perpendicular by definition but only spans about 3.2px of a 5px row at this angle, leaving slivers of fill above and below. Vertical edges guarantee a full-height gap at every point, which is what the app's notch does
- **The line's snap back to the left is the reset**, and it is the only thing marking it. Rows are evenly pitched throughout: the fill dropping back to near nothing and the mark jumping left already say where the window turned over, so a wider gap or a rule between the two windows would be restating it

A single straight line per window cannot be exact on every row, because rows are not uniformly spaced in time — there are gaps between them, and the bottom row occupies a full row's height while representing only part of its half hour. Accepted: each row's own fill colour carries the verdict independently of where the line falls, and the line's job is to show the clock sweeping.

### Why not a line chart

Explored and rejected across two mockups. Percent on y with time on x reads naturally but cannot align with the bar, which is a percent instrument — so the bar's fill edge sat ahead of the curve's endpoint. Transposing to percent on x fixes the alignment but puts time on y, which reads wrong in both directions: now floats mid-plot with time upward, and with time downward the y scale has to rescale as the window runs, so no two moments are comparable.

The stack sidesteps all of it. No axis moves, and nothing has to travel as it opens.

## History

Ten rows always, running back through the reset, so the stack is a rolling five hours rather than this window alone. The reset climbs the stack as the window runs, leaving less of the previous one.

- Constant height, which also solves the expansion being nearly empty for the first hour
- **Rows before the reset are faded well back** (about 30% fill opacity), so they read as context rather than as the position. Without this the footer's first read was "amber" from a spent previous window while the current position was fine. Each past row still takes the colour its own crossing gives it; the fade applies to whichever that is
- **Non-adjacent windows are left as they are.** The next window opens when work resumes, so the row above the reset could be twenty minutes or three days old, and the stack renders both the same. Deliberate: the gap reads as "a while ago" and precision is not the point. Revisit only if it misleads in practice

Knock-on: with the previous window visible by default, a separate "look back at previous windows" mode has little left to do. It likely collapses into how many windows of history the stack holds.

The typical-curve idea needs rethinking under this shape — a faint curve behind a live curve does not translate to a stack of bars. Possibly a per-row marker of typical usage at that point in a window.

## Interaction

- **Hover opens it**, not click.
- **Overlay, not reflow.** Anchored to the slot's own bottom edge and grown upward over the nav. The slot's fixed height exists so the nav never moves as data states swap, and an in-place expansion would break that.
- **The bar becomes the bottom row.** One instrument, not a bar plus a panel: the head row and the freshness row carry through.
- **"Update now" stays available in the open state.** The expansion covers the slot, so its copy forwards the click synthetically to the app's real button — the pattern `autoExpand` already uses, and on the manual-verify list.
- **No prediction line.** The head row states it in words instead: `resets 4:59 pm` becomes `runout est 3:30 pm`, and only once a runout is actually expected before the reset.
- No axis labels.

### The tooltip goes

The app's `title` on the slot says no more than the stack does.

It does not need stripping from the app's markup. The reconcile observer watches `childList` and `subtree` only, so a stripped attribute would not be self-maintaining: React rewrites `title` whenever the computed string changes, roughly every three minutes as the rounded clock figure ticks, and it would sit there until an unrelated structural change scheduled a pass. Teaching the observer about attributes would also mean reworking its self-feeding guard, which treats an attribute record as not-ours by construction.

Instead the expansion carries `title=""`, which suppresses the ancestor tooltip while the pointer is anywhere in the footer. Since hover is the trigger, the overlay is up well inside Firefox's tooltip delay. No app markup touched.

`title=""` suppressing an ancestor's tooltip is to be confirmed under `web-ext` rather than trusted from the spec.

## Missing samples

A row needs a sample at or near its end, and the extension only samples while a Workhorse tab is open and visible — the store does not refresh while the document is hidden. A half hour spent with the tab closed has no sample of its own.

The running total carries forward, so such a row shows the last known percent and understates. Accepted deliberately, on the same reasoning as choosing a continuous line earlier: this is a staging ground for a feature intended to graduate into Workhorse itself, where the device polls continuously and the gaps do not exist. Design for the graduated shape.

## Colour

Injected markup takes the app's tokens, so over par uses the app's `--amber` (`#b45309`) rather than Prohorse's brighter `--accent` (`#c2410c`) — the stack is the bar's own crossing repeated and should agree with it. Under par takes `--text-quiet` (`#938b84`), the fill colour the bar already uses.

## Open

- [ ] How reactive the runout estimate's moving average is. A 20-minute mean makes it jump; an hour makes it sluggish
- [ ] Whether a row's increment should be marked within its cumulative fill, to recover the burn-rate reading a curve gave directly
- [ ] How many windows of history to retain, and what evicts them
- [ ] What the stack shows before ten rows of history exist at all — empty tracks, or fewer rows
