# R1 — Remove all conversations and update PR section

Work against upstream Workhorse at `origin/main` = `06835cda` (L26, #761).

## A note on how upstream was read

The local mirror at `beyondessential/workhorse` has a `readonly` worktree whose
**files on disk did not match its own HEAD**. A first pass read that worktree and
drew two wrong conclusions — that the app had dropped `CheckStatus.skipped`, and
that the PR bar had lost its chevron test-ids. Both were false. Everything below
is verified against `git show origin/main:<path>` instead, which is the only
reliable way to read that mirror.

## 1. Remove "all conversations" (cross-workspace conversations)

Upstream ships an All conversations scope natively (`H25`, #752), so the
extension's widened-list feature is redundant and is removed whole.

### Deleted
- [x] `src/features/conversationScope.ts`, `src/lib/conversationScope.ts`, `src/lib/conversations.ts`
- [x] `src/lib/colours.ts`, `src/content/icons.ts`, `src/data/sse.ts` (all SCOP-only)
- [x] `src/page/navigate.ts` — the page-world router existed only to route the widened list's rows
- [x] `test/conversationScope.test.ts`, `test/conversations.test.ts`, `test/colours.test.ts`
- [x] `.workhorse/specs/sidebar/conversation-scope.md` (SCOP)

### Edited
- [x] `src/data/workhorse.ts`, `keys.ts`, `observed.ts`, `types.ts` — drop the session and sidebar reads
- [x] `src/prefs.ts` — drop `crossWorkspaceConversations` and `scopeWide`
- [x] `src/content/index.ts`, `styles.css`, `anchors.ts` — drop registration, styles, conversation anchors
- [x] `src/lib/messages.ts`, `src/page/index.ts` — drop the navigate message and flag
- [x] `preferences.md`, `platform/data.md`, `platform/injection.md`

## 2. Remove the raw diff toggle

Upstream added its own raw/pretty diff toggle to the Changes view (`M25`, #740):
`lib/hooks/usePrettyDiff.ts`, `RawDiffContent.tsx`, `UnifiedDiffLines.tsx`, and
its own `lib/unifiedDiff.ts`, reached from `ArtifactMenu`. The extension's Diff
segment does the same job, so it goes.

- [x] Delete `src/features/rawDiff.ts`, `src/lib/unifiedDiff.ts`, their tests, and `card/raw-diff.md` (DIFF)
- [x] Drop the artefact anchors (`artefactToggle`, `artefactToggleSegments`, `artefactHeaderBar`, `artefactView`) and the `artefactPane` fixture
- [x] Drop the card-files, card-detail, and base-file reads, their keys, observers, and types
- [x] Drop `filePath`/`view` from `Route` — nothing else read them
- [x] Drop `store.failed()` and the raw-diff CSS
- [x] Drop the `rawDiff` switch

## 3. Update the PR section features

Upstream now renders both of the readings the extension's `statRows` added:

- `ChecksBreakdown` — the Checks row's **Latest run** stat (passed/failed/running/skipped),
  revealed on failure or in flight
- The Review Hero row's **Runs** and **Latest run** stats, revealed when not clean

Both rows are now `DisclosureRow`s carrying `data-testid` (`pr-checks-row`,
`pr-review-hero-row`) and holding their readings inside. So:

- [x] Delete `src/features/statRows.ts`, `src/lib/checks.ts`, their tests, and `card/stat-rows.md` (STAT)
- [x] Drop the `checksBreakdown` and `reviewStats` switches
- [x] Narrow `BranchStatusData` to what the named jobs still need (`prUrl`)

### Named jobs kept, and re-grounded

Upstream counts *workflows*; the named jobs list individual *jobs* with durations
and links, which upstream has no equivalent for. Kept, and moved inside the
Checks disclosure where the app now puts its own readings.

- [x] `namedChecks` hangs inside `checksContent()` rather than after the row
- [x] New `card/named-jobs.md` (NJOB) — the criteria that lived in the STAT spec, updated for the new placement
- [x] `autoExpand` opens the Checks row too, since the jobs now sit behind its chevron

### Anchors re-grounded against the true tip

- [x] `prDetailToggle` — reverted to the chevron test-ids, which still exist (L26 restored the bar's overflow menu)
- [x] `checksRow` — now a disclosure; prefers `[data-testid="pr-checks-row"]`, plus `checksContent()`
- [x] `reviewRow` — prefers `[data-testid="pr-review-hero-row"]`
- [x] `branchDropdown` — `"Advanced branch controls"` is gone; now `[data-testid="pr-branch-chevron"]` climbing to the row, falling back to `[title="Branch detail"]`
- [x] `prDetailExpanded` — reads from the branch disclosure's presence
- [x] `test/fixtures/app.ts` — `prSection` rebuilt to the current markup

## What the extension is left with

autoExpand, namedChecks, composer (history + stash), workspaceOrder, branding.

## 4. Rebased onto main (`16eb3a1`, Q1 #12)

Q1 landed a spec-only feature, **Remembered view selection** (`card/remembered-view.md`,
VIEW): the reader's choice of File or Changes carries to the next artefact opened.
No implementation on main yet.

Hard conflicts, both resolved to this card's side:

- [x] `card/raw-diff.md` — Q1 edited a criterion; this card deleted the file. Kept deleted
- [x] `preferences.md` — kept this card's removals, took Q1's Remembered view line

Soft conflict: the VIEW spec was written against a Diff segment that no longer exists.
Three criteria updated so the spec describes the system as it now stands:

- [x] Dropped "The Diff segment is remembered alongside the app's own two"
- [x] The can't-offer-that-view example now cites a code file with nothing to compare, not a missing Diff segment
- [x] "switchable independently of the raw diff view" → "has its own switch"

The feature itself is untouched: remembering File vs Changes stands on its own, and
upstream's own raw/pretty toggle already persists across files (`workhorse:pretty-diff`).

**Left for whoever implements VIEW:** this card deleted the artefact anchors
(`artefactToggle`, `artefactToggleSegments`, `artefactHeaderBar`, `artefactView`) along
with the raw diff feature that was their only caller. VIEW will need the toggle and its
segments back. They were not kept, because dead code held for an unimplemented spec is
worse than a deletion git can restore — see `f9b6e57:src/content/anchors.ts`.

## Verify
- [x] `tsc --noEmit` clean, `node --test` 161 pass / 0 fail, `node build.mjs` clean
- [ ] Manual pass with `web-ext run` — see test cases
