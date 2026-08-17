# R1 — Remove all conversations and update PR section

Two independent pieces of work against the current upstream Workhorse (pulled to
`beyondessential/workhorse` @ `H25 … #752`).

## 1. Remove "all conversations" (cross-workspace conversations)

Upstream now ships an All conversations scope natively (`H25`, #752), so the
extension's own widened-list feature is redundant and is removed whole — feature,
its libraries, the session data plumbing it alone used, its preference, its spec,
and its tests.

### Delete outright (used only by this feature)
- [x] `src/features/conversationScope.ts`
- [x] `src/lib/conversationScope.ts`
- [x] `src/lib/conversations.ts`
- [x] `src/lib/colours.ts` (workspace colours + scope glyph, SCOP only)
- [x] `src/content/icons.ts` (row/status/scope glyphs, SCOP only)
- [x] `src/data/sse.ts` (session event stream, SCOP only)
- [x] `test/conversationScope.test.ts`, `test/conversations.test.ts`, `test/colours.test.ts`

### Edit (shared files — surgical removal)
- [x] `src/data/workhorse.ts` — drop `recentSessions`, `dismissSessions`, `sidebarData`, the `WIDENED_FETCH` import
- [x] `src/data/keys.ts` — drop `SIDEBAR_DATA_KEY`, `recentSessionsKey`, and the `/api/sidebar-data` + `/api/sessions` entries in `OBSERVED_PATHS`/`keyForUrl`
- [x] `src/data/observed.ts` — drop the `sidebar-data` and `sessions-recent` validators
- [x] `src/data/types.ts` — drop `RecentSession`, `SidebarData`, `SessionsResponse`, `SessionSummary`
- [x] `src/prefs.ts` — drop `crossWorkspaceConversations`, `scopeWide`, and the SWITCHES entry
- [x] `src/content/index.ts` — drop the `conversationScope` import + registration
- [x] `src/content/styles.css` — drop the scope/list/row/tooltip styles
- [x] `test/observed.test.ts`, `test/anchors.test.ts`, `test/reconcile.test.ts`, `test/fixtures/app.ts` — drop conversation anchors/fixtures/assertions

### Specs
- [x] Delete `.workhorse/specs/sidebar/conversation-scope.md` (SCOP)
- [x] `preferences.md` — remove the Cross-workspace conversations switch
- [x] `platform/data.md` — remove the recent-sessions + sidebar-data reads and the Session liveness section
- [x] `platform/injection.md` — remove conversations header/list from the anchor list

## 2. Update the PR section features

Upstream changed the PR section in two ways that reach the extension:

- The CI status the app returns dropped its `skipped` field
  (`getCheckStatus` now returns `{ status, total, running, failing }`), folding
  skipped/neutral/cancelled/stale suites into the pass count. Review Hero suites
  are also excluded from the counts — the extension's breakdown inherits that for
  free since it reads the app's counts.
- The collapsed PR bar no longer carries the `pr-detail-chevron` /
  `pr-create-chevron` test-ids the `prDetailToggle` fallback resolved through,
  and exposes no `data-wh-*` hook. The fallback is re-grounded on the current
  markup.

### Changes
- [x] `src/lib/checks.ts` — drop the `skipped` bucket from `checkBreakdown`; passed = total − running − failed
- [x] `src/data/types.ts` — drop `CheckStatus.skipped`
- [x] `src/features/statRows.ts` — drop the skipped part from `breakdownNodes`
- [x] `.workhorse/specs/card/stat-rows.md` (STAT) — drop the skipped bucket criteria
- [x] `src/content/anchors.ts` — re-ground `prDetailToggle` fallback: `button[title="Branch details"]` (pre-PR) or the collapsed bar's title button beside `a[title="Open on GitHub"]` (open/merged)
- [x] `test/fixtures/app.ts` — update `prSection` to the current bar markup (GitHub link + Branch details button, no chevron test-ids, no kebab)
- [x] `test/anchors.test.ts`, `test/checks.test.ts`, `test/statRows.test.ts` — update

### Known follow-up (flagged, not done here)
- Named jobs read from GitHub still include Review Hero jobs, which the app now
  excludes from its Checks count. The breakdown (app counts) and named jobs
  (GitHub, all suites) can therefore disagree while a Review Hero run is
  failing/running. Excluding them needs the extension to identify Review Hero
  suites (an Actions lookup + workflow/bot match) — larger than this card and
  left for a follow-up.

## Verify
- [x] `npm run build`, `npm run typecheck`/`tsc`, `npm test`, lint
