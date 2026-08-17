# Prohorse wordmark — test cases

Covered by `test/branding.test.ts` under jsdom unless noted. The manual cases are the ones the
fixtures cannot prove: the fixtures are hand-written from a reading of `Sidebar.tsx`, so only a
running Workhorse shows whether the anchors match what the app actually renders.

## The lockup

- [x] The name in the sidebar's top corner reads "Prohorse" (verifies spec: BRND)
- [x] A horse stands beside that name, where the app's mark stood (verifies spec: BRND)
- [x] The mark is marked decorative, as the app's own is (verifies spec: BRND)
- [x] The controls sharing that corner keep their place (verifies spec: BRND)
- [ ] Against a running Workhorse, the mark is the same square, radius and accent as the app's, and
      nothing in the header shifts (verifies spec: BRND)
- [ ] The horse reads clearly against the accent at 26px on a standard-density display, where the
      glyph's own colours sit close to the tile's (verifies spec: BRND)
- [ ] The lockup reads correctly in both the light and the dark theme

## The retracted rail

- [x] Collapsing the sidebar shows the horse rather than the app's mark (verifies spec: BRND)
- [x] The control that reveals the sidebar keeps its place beneath it (verifies spec: BRND)
- [ ] Against a running Workhorse, collapsing and expanding the sidebar repeatedly leaves one horse
      in each place (verifies spec: BRND)

## Holding the change

- [x] The wordmark is rewritten again after the app has rebuilt that corner (verifies spec: BRND)
- [x] A pass over a corner already branded mutates nothing (verifies spec: BRND)
- [x] The mark is not replaced by an equivalent on a later pass (verifies spec: INJ)
- [x] The app's own mark is hidden in place rather than detached (verifies spec: BRND)
- [ ] Against a running Workhorse, navigating between cards, projects and workspaces never restores
      the app's branding and never leaves React throwing in the console (verifies spec: BRND)

## Anchors

- [x] The hook attributes are preferred over the label fallbacks (verifies spec: INJ)
- [x] A workspace named `Workhorse` is not mistaken for the wordmark (verifies spec: BRND)
- [x] The rail's hook does not also resolve as the header's mark (verifies spec: BRND)
- [x] A page with no branding on it is not an error (verifies spec: INJ)
- [ ] Against a running Workhorse, the fallbacks resolve on the sign-in, welcome and about screens
      without branding anything that is not the sidebar's wordmark

## The switch

- [x] The switch off leaves the app's own branding untouched (verifies spec: PREF)
- [x] Turning the switch off restores the app's name and mark in the header (verifies spec: PREF)
- [x] Turning the switch off restores the rail's mark (verifies spec: PREF)
- [x] Turning it off and on again restores the extension's branding (verifies spec: PREF)
- [ ] Toggling the switch in the preferences page takes effect on an open Workhorse tab without a
      reload (verifies spec: PREF)
