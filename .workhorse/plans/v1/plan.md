# Session usage graph — working notes

Workshop notes for V1. Decisions and findings, ahead of specs.

## Feature 2 is already fixed upstream — drop it

The card's second ask, stopping the bar switching to weekly usage, needs no work.
Workhorse `V27` (#823, 26 Aug 2026) changed the resolver to always read the payload's top-level `five_hour` block rather than whichever window the endpoint marks active, for the reason the card gives: a weekly figure sits low while the session window that is about to bind sits high, so switching changed what the bar measured without saying so.

Confirm against the live deploy before closing it out, but there is nothing to build.

## Where the reading comes from

`GET /api/me/subscription-usage`, same-origin JSON, `{ report, unavailable, readAt }`.
The app polls it about every 100s while a reading is live, so this is an observation target in the `DATA` sense — captured response, shallow shape check, into the store, with the extension's own GET as the fallback that needs no credential. No DOM scraping.

Fields the graph needs:

- `report.percent` — 0 to 100, five-hour window, integer-rounded by the endpoint
- `report.resetsAt` — ISO, window end
- `report.windowMinutes` — 300
- `readAt` — when the paired device took the reading

The paired device reads every 5 minutes, so a full window is about 60 samples on integer steps. Enough for a shape and a projection, too coarse for a smooth curve.

**Session identity is free.** Each window's `resetsAt` is unique, so bucketing samples by it gives window boundaries with no heuristics, and `readAt` dedupes repeat samples of one reading.

**Anchor.** The bar is reachable semantically as `role="meter"` with `aria-label="Claude plan usage"` — stable, and not a utility class. The element is absent when `percent` is null, which is the degrade-to-absent case for free.

**Storage.** Device-local alongside input history and the stash, per `PREF`: a sampled series is working state at a scale the synced area is not sized for.

## Par is the app's clock mark

Par is not something to invent. It is `windowElapsedFraction`, the notch cut out of the bar: how far through the five-hour window the clock has reached.

Because x is the window and y is 0 to 100%, **par is the diagonal** and needs no computing. The over-par colour rule is the app's own, `percent/100 >= clock`, so the graph inherits a crossing rather than nominating a threshold like 80%.

The graph is therefore the notch unrolled over time: the bar shows one point of a two-dimensional reading, the graph shows the path taken to it.

## Interaction

- **Hover opens it**, not click.
- **Overlay, not reflow.** Anchored to the slot's own bottom edge and grown upward over the nav. The slot's fixed height exists so the nav never moves as data states swap, and an in-place expansion would break that.
- **The bar becomes the graph.** One instrument, not a bar plus a panel: the head row and the freshness row carry through, and the track's width becomes the plot's width.
- **"Update now" stays available in the open state.** The expansion covers the slot, so its copy forwards the click synthetically to the app's real button — the pattern `autoExpand` already uses, and on the manual-verify list.
- No x-axis labels; `resets <time>` in the head row is enough. No projected-time sentence.

### Alignment

The bar and the graph do not share an x-axis: the bar puts percent along x, the graph puts time along x and percent along y. They reconcile on the notch.

- The plot and the track are the same width and inset, so **the clock mark and the graph's now-point are the same x**. That is the fixed point the expansion pivots around.
- The **fill edge has no natural resting place** — 78% across in the bar against a curve ending at 63% across — so it travels backwards to meet the curve's endpoint as the track grows into the plot. Short, but it is the one place the axis change shows as motion.
- Rejected: re-encoding the collapsed bar as a time-axis sparkline so the open is a pure scale-up. It makes the transition free but costs the collapsed bar its "how much is gone" reading, and replaces the app's instrument rather than growing out of it.

### The tooltip goes

The app's `title` on the slot says no more than the graph does.

It does not need stripping from the app's markup. The reconcile observer watches `childList` and `subtree` only, so a stripped attribute would not be self-maintaining: React rewrites `title` whenever the computed string changes, roughly every three minutes as the rounded clock figure ticks, and it would sit there until an unrelated structural change scheduled a pass. Teaching the observer about attributes would also mean reworking its self-feeding guard, which treats an attribute record as not-ours by construction.

Instead the expansion carries `title=""`, which suppresses the ancestor tooltip while the pointer is anywhere in the footer. Since hover is the trigger, the overlay is up well inside Firefox's tooltip delay. No app markup touched.

`title=""` suppressing an ancestor's tooltip is to be confirmed under `web-ext` rather than trusted from the spec.

## History

Past windows are retained. `resetsAt` gives window identity for nothing, so the storage cost is negligible.

Three switches, so the concept can be refined by turning parts off:

- [ ] The session graph itself
- [ ] **Typical curve** — a faint curve from retained windows behind the live one, answering "is this session unusual?"
- [ ] **Look back** — stepping to previous windows

Utility of the latter two is unproven and expected to be minor; they ship switchable so they can be judged and dropped.

## Gaps in the series

The line is continuous across gaps rather than broken.

The extension only samples while a Workhorse tab is open and visible — the store does not refresh while the document is hidden — so closing the tab leaves a hole, and a straight segment across it understates a burst. Accepted deliberately: this is a staging ground for a feature intended to graduate into Workhorse itself, where the device polls continuously and the gaps do not exist. Design for the graduated shape.

## Colour

Injected markup takes the app's tokens, so:

- Over par uses the app's `--amber` (`#b45309`), not Prohorse's brighter `--accent` (`#c2410c`) — the graph is the bar's own crossing unrolled and should agree with it
- Par is drawn in `--text-primary`, not literal black: black vanishes in the dark theme, and `--text-primary` is `#1c1917` in light so it reads as black there and flips on its own

## Open

- [ ] How reactive the prediction's moving average is. A 20-minute mean makes the dotted line jump; an hour makes it sluggish
- [ ] How many past windows to retain, and what evicts them
