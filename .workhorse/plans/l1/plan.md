# L1: PR section update in workhorse breaks extension

## Diagnosis

Workhorse commit **B25 (#732) "Move the PR title editor onto the PR bar behind a kebab menu"** reworked the collapsed PR bar and removed both elements `anchors.prDetailToggle()` fell back to:

- `button[title="Branch details"]` — the pre-PR chevron, now a shared `BarTitleRow` button with no title.
- `a[title="Open on GitHub"]` — the standalone GitHub link, folded into a new kebab `button[title="More"]` (its menu item relabelled "Open in GitHub").

With both gone, `prDetailToggle()` returned null in every PR state, silently disabling the auto-expand-PR-detail feature and its user-collapse tracking. Other PR-section anchors survived: `title="Advanced branch controls"` (branch dropdown / expanded state) and the Review Hero disclosure are unchanged.

## Fix

`prDetailToggle()` now resolves through the bar's chevron, which carries the app's own stable `data-testid` (`pr-create-chevron` before a PR, `pr-detail-chevron` after — not stripped in production), and climbs to its button. This keeps the whole title row as the hit area and never returns the neighbouring Create or kebab buttons. Fixture and anchor tests updated to the new bar markup.

## Open observation (separate from this card)

Workhorse's Checks row (`ChecksRow` in `PrSection.tsx`) is a flat, non-expandable `<div>` and has been since it was introduced (H20), whereas the extension models it as an `aria-expanded` disclosure (`anchors.checksRow`/`checksContent`, the STAT spec, the autoExpand rows). Against the real app the checks breakdown and named-jobs stat rows never resolve an anchor, so they render nothing. This predates B25 and is not what the card reports; flagged for a separate decision rather than folded into this fix.
