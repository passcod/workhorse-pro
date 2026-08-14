# Raw diff view

Adds a Diff segment to the app's File/Changes toggle above a markdown artefact, rendering a unified diff of the artefact against its base-branch version. spec: DIFF

## What the app gives us

Established by reading the Workhorse source rather than guessing:

- The toggle is `SegmentedToggle`, rendered by `SpecHeaderBar`. It carries no `data-*` or `aria-*` attributes, so the anchor identifies it by its segment labels. The same component with `Desktop/Tablet/Mobile` segments sits above a mockup, which is why matching on labels rather than position is what keeps the segment off mockups.
- The header bar always renders prev/next file buttons carrying `title="Previous file"`. That gives the header bar a structural signature: it is the toggle's nearest ancestor that also contains that button. The artefact view is the header bar's next sibling.
- The URL carries `?file=<path>` for the open artefact and `?view=file|changes` for the mode. Mockups get no `view` param. This is written with `history.replaceState` on every artefact click and every toggle, so the route is a live reading of what is open.
- Current content comes from `/api/card-files?cardId=<identifier>&workspace=<slug>` → `{ initialFiles: [{ filePath, isNew, isDeleted, content }] }`.
- Base content comes from `/api/base-file?cardId=<uuid>&filePath=<path>` → `{ content: string | null }`. This one takes the card's **UUID**, not its identifier, so the UUID has to be resolved first.
- `/api/card-detail?cardId=<identifier>&workspace=<slug>` → `{ card: { id } }` supplies that UUID. The app fetches it on the card page anyway, so it is worth observing.

## Steps

- [x] Unified diff library: line diff, hunks with context, hunk headings
- [x] Response types for card files, base file, and card detail
- [x] Cache keys and observation entries for the three endpoints
- [x] Reads in `data/workhorse.ts`
- [x] A way to tell "not landed yet" from "read failed", which the store does not currently expose
- [x] Route carries the open artefact path and the app's view mode
- [x] Anchors for the toggle, the header bar, and the artefact view
- [x] The feature itself: segment injection, selection, panel rendering
- [x] Styles for the segment and the diff panel
- [x] Preference switch
- [x] Register the feature
- [x] Fixtures and tests

## Notes

**The app's own segment stays highlighted.** Selecting Diff cannot change the app's React state, so the app still marks File or Changes as selected. Rather than fight the re-render by rewriting the app's `className`, the extension marks the toggle with a data attribute and suppresses the app's selected treatment from its own stylesheet. React leaves unknown attributes alone on re-render, and the reconcile pass re-applies it if the node is rebuilt. This is the one place the extension's stylesheet has to out-specify the app's utility classes.

**Diff is per-artefact and forgotten on the way out**, matching how the app treats its own choice of view. The record is the artefact path Diff is active for, so opening another artefact leaves the app to decide the view.

**The diff is computed with prefix/suffix trimming around an LCS.** A spec is small, but an artefact is not guaranteed to be, so the LCS table is guarded by a cell budget and falls back to reporting the whole changed region as a removal followed by an addition. That degrades the presentation of a pathological file rather than hanging the page.
