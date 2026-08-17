# Prohorse wordmark

Replace the app's brand lockup in the sidebar's top corner with a horse emoji and the word "Prohorse".

## What the app renders

From `src/components/Sidebar.tsx` in the Workhorse source:

- The header lockup is a flex row: the `Logo` svg (26px, `aria-hidden`), then
  `<span class="text-[15px] font-bold tracking-[-0.03em]">Workhorse</span>`, then a
  right-aligned control cluster.
- The retracted rail, shown when the sidebar is minimised on a regular-width viewport, carries the
  same `Logo` svg above `button[title="Show sidebar"]`. No wordmark text there.

## The treatment, and why

Workshopped as seven options across three mockups. The pick is **C**: the app's own tile, in the
app's accent, carrying 🐴 at 15px in place of the "W".

- **The tile stays.** A bare emoji has nothing holding the corner in the retracted rail, where the
  mark stands with no wordmark beside it.
- **Horse face over racing horse.** 🐎 fills the square better, but reads too busy at 26px.
- **No edge treatment.** White halo, outline and drop-shadow were all tried against the glyph. They
  do lift it off the accent, but every one of them reads as a sticker, and the details blending
  slightly is the better trade. Worth knowing if this is revisited: `filter` belongs on a span
  around the glyph, not on the tile, or it haloes the square instead.

## Approach

- **Rewrite the text, hide the mark.** The wordmark span's text is set to "Prohorse"; the app's svg
  mark is hidden with an inline style and the extension's own emoji node is inserted beside it.
  Removing a React-owned node risks React throwing when it later unmounts it, so nothing the app
  rendered is ever detached.
- **React does not fight this.** The wordmark's text is a static literal, so a re-render diffs it
  against itself and writes nothing. Where React does rebuild the subtree, the fresh node reads
  "Workhorse" again and the next pass rewrites it — the reconcile loop already covers that.
- **Restoring needs the original text**, so the span records it in a data attribute when first
  rewritten. Turning the switch off restores from that attribute, unhides the mark, and removes the
  emoji.
- **The rail is in scope.** It is the same mark in the same corner, and leaving a "W" square there
  would show the app's branding whenever the sidebar is collapsed.

## Steps

- [x] Anchors for the wordmark span, the header mark, and the rail mark
- [x] `branding` feature, registered in the content entry point
- [x] `proWordmark` preference and its switch
- [x] Styles for the emoji mark, sized against the app's own
- [x] Fixture for the sidebar header and the retracted rail
- [x] Tests: anchor resolution, rewrite, idempotence, restore on disable, rail
- [x] Spec, and the switch added to the preferences spec
- [x] `data-wh-wordmark` and `data-wh-brand-mark` added to the hooks doc
