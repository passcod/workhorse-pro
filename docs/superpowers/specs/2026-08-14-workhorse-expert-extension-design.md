# Workhorse Expert — browser extension design

Date: 2026-08-14
Status: approved design, not yet implemented

## Purpose

Workhorse is removing its expert mode. Several density features go with it —
features that exist for one user (the author) and don't earn their place in a
product surface. This extension restores them as a personal overlay, so the app
can shed the complexity without the author losing the affordances.

The extension is read-only with respect to Workhorse's data: it re-fetches
endpoints the app already calls and renders extra rows. It never writes to the
Workhorse API. The one write it performs is to the app's own draft store in
`localStorage`, and only to protect the user's unsent text (see Input history).

Firefox is the primary target. Chrome is supported by the same source, with the
differences confined to the manifest.

## What is being restored

Four features, in build order:

1. Auto-expand — the PR detail section and branch dropdown open by default
2. Stat rows — Checks breakdown, Review Hero run stats, effective base branch
3. Input history — recall previously sent messages in the composer
4. Cross-workspace conversations — widen the sidebar list past the active workspace

Not restored: PR title editing. That stays in Workhorse, promoted to normal mode.

## Non-goals

- Intercepting or proxying the app's own network calls. The extension issues its
  own GETs to the same endpoints. This is simpler and survives changes to how the
  app fetches.
- Reimplementing anything the app still does. Where the app keeps a feature, the
  extension leaves it alone.
- Any GitHub token, scope, or background network activity. Authentication is
  free: content-script fetches to the app origin carry the session cookie.

## Architecture

### Repository layout

```
manifest.firefox.json
manifest.chrome.json
build.mjs
package.json
src/
  content/
    index.ts        bootstrap and reconcile loop
    anchors.ts      DOM anchor resolution
    styles.css      whx- classes over the app's CSS variables
  features/
    autoExpand.ts
    statRows.ts
    inputHistory.ts
    conversationScope.ts
  data/
    api.ts          cached GETs against the app origin
    sse.ts          EventSource client for session liveness
    localOverlay.ts paired-device overlay (separable)
    types.ts        response shapes copied from Workhorse
  options/
    options.html
    options.ts
  background.ts     opens the options page on request from the content script
  prefs.ts          preference schema and storage access
```

The background script exists for one reason: a content script cannot call
`runtime.openOptionsPage()`, so the "grant device access" affordance messages the
background script to open it. Nothing else lives there.

### Build

TypeScript compiled by esbuild into one IIFE bundle per entry point (content
script, options page, background). npm scripts only; no framework. A bundler is
required regardless of language choice, because MV3 content scripts cannot be
declared as ES modules in the manifest — multi-file source must be bundled into
a single file either way. Given that, TypeScript costs almost nothing and catches
the failure mode that matters most here: the extension reads field paths out of
the app's JSON responses (`status.ci.repoRunsChecks`, `loop.round`), and a typo
or a renamed field otherwise fails silently and renders a blank row.

Response shapes are copied from Workhorse into `data/types.ts` rather than
imported. The two repositories are independent; a copied type that drifts is
caught by a fixture test (see Testing).

### Manifest and permissions

Both manifests are MV3 and identical except:

- Firefox: `background.scripts`, plus `browser_specific_settings.gecko.id`
- Chrome: `background.service_worker`

Permissions:

- `host_permissions`: `https://workhorse.bes.au/*`, `http://localhost:3000/*`
- `storage`
- `optional_host_permissions`: `*://*/*`, requested only for the paired-device
  overlay, and only from the options page (see below)

Nothing else. No tabs, no webRequest, no cookies permission — the session cookie
travels on same-origin fetches from the content script without one.

The content script is declared against the same two origins with `matches` on all
paths, injected at `document_idle`. It applies itself per page from the URL; a
page carrying none of its anchors simply produces empty reconcile passes.

`options_ui` embeds the preferences page in the browser's own add-on UI
(`open_in_tab: false`).

### The reconcile loop

A single `MutationObserver` on `document.body` (`childList: true, subtree:
true`), coalesced to at most one pass per animation frame.

A pass is idempotent reconciliation, not event handling. Each enabled feature is
handed the current DOM and asked to make its injections match the desired state:
add what is missing, update what is stale, remove what should no longer be there.
Nothing in the extension needs to know that a route changed, that a card was
swapped, or that a disclosure row opened — those all produce a DOM that the next
pass reconciles against.

This is what makes the extension viable against a Next.js App Router
application. There are no page loads to hook, and React re-creates subtrees on
state changes the extension cannot predict. A design that reacted to specific
mutations would accumulate special cases indefinitely; reconciliation collapses
them into one question asked repeatedly.

Two consequences fall out of this shape:

- Disabling a feature needs no teardown code. Its desired state becomes empty
  and the next pass removes its nodes. The exception is auto-expand, which is a
  one-shot action rather than an injection: disabling it stops further expansion
  but does not re-collapse anything, which is the correct behaviour.
- Each feature's pass is wrapped in `try`/`catch`. A feature that throws is
  skipped for that pass and logged once; it cannot stop the other features or
  break the app.

Injected nodes carry a `data-whx` attribute. Mutation records whose added and
removed nodes are all `[data-whx]` are discarded before scheduling a pass, so the
observer cannot feed itself.

Preference changes subscribe via `storage.onChanged` and schedule a pass, so
toggling a feature takes effect without a reload.

### DOM anchors

All coupling to the app's markup lives in `content/anchors.ts`, which exposes
`anchor(name)`. Each name resolves by preferring a stable `data-*` hook and
falling back to a documented structural or text heuristic:

| Anchor | Hook | Fallback |
|---|---|---|
| composer | `[data-wh-composer]` | the `textarea` within the composer form |
| PR detail toggle | `[data-wh-pr-toggle]` | `button[title="Branch details"]`, else the collapsed-bar button |
| PR detail expanded? | `[data-wh-pr-expanded]` | presence of the branch-details block |
| branch dropdown | `[data-wh-branch-toggle]` | the row carrying `aria-expanded` (already stable) |
| Checks row | `[data-wh-pr-row="checks"]` | disclosure row whose label reads `Checks` |
| Review Hero row | `[data-wh-pr-row="review-hero"]` | label reads `Review Hero` |
| Based-on row | `[data-wh-pr-row="based-on"]` | label reads `Based on` |
| conversations header | `[data-wh-conversations]` | nav row containing `Conversations` |
| conversations list | `[data-wh-conversations-list]` | the list element following that header |

Workhorse is expected to grow these hooks over time; they are useful to it
independently, for UI testing. Each fallback is therefore a deletion waiting to
happen, not permanent code. When a hook lands, its row loses a branch.

Anchors never use Tailwind class names. Class strings such as
`text-[11px] font-medium italic text-[var(--text-muted)]` only exist in the
compiled stylesheet because some component uses them; deleting the component
stops Tailwind emitting them.

### Styling

The extension ships its own stylesheet using `whx-` prefixed classes that
reference the app's design tokens (`--text-muted`, `--amber`, `--border-subtle`,
and so on), which are real custom properties on `:root`. Injected rows therefore
match the design system and track light and dark themes without the extension
knowing which is active, and without depending on which utilities Tailwind
happened to generate.

Injected rows carry a subtle marker distinguishing them from the app's own: a
dotted 2px left rule in `--border-subtle`.

### Data layer

All reads are same-origin GETs carrying the session cookie.

| Endpoint | Used for |
|---|---|
| `GET /api/card-branch-status?cardId=<identifier>&workspace=<slug>` | stat rows |
| `GET /api/sidebar-data` | workspace list (colours), paired-device instance |
| `GET /api/sessions?recent=true&limit=<n>` | unscoped conversation list |
| `POST /api/local-mode/bearer-token` | token for the device overlay |
| `GET <instanceUrl>/api/sessions-summary?ids=…` | device overlay (cross-origin) |
| `GET /api/sidebar-events` | SSE session liveness |

Both branch-status parameters come straight off the card route,
`/[workspaceSlug]/cards/[cardId]`, where the second segment is the card
identifier.

Responses are held in a `Map` with a 10s TTL, matching the app's own
`staleTime`. In-flight promises are deduplicated by cache key. Branch status
refreshes on a 15s interval while the document is visible and not at all while
hidden, mirroring the app's `refetchIntervalInBackground: false`.

This roughly doubles the branch-status request rate on a card page. The
alternative — reading the app's React Query cache — is not available to a content
script, which runs in an isolated world with no access to the page's JavaScript
heap. Reaching into the page world to read it would be exactly the fragile
interception this design rejects. The extra GET is accepted.

## Features

### 1. Auto-expand

Preferences: `autoExpandPrDetail`, `autoExpandBranchDropdown` (both default on).

On each pass, for the card page:

- If the PR detail section is collapsed and this card is not in the
  collapsed-by-user set, click its chevron.
- If the branch dropdown reports `aria-expanded="false"` and this card is not in
  the set, click it.

Synthetic clicks are flagged for the duration of the call, so the click listener
can tell the extension's clicks from the user's. A user-initiated collapse adds
the card identifier to an in-memory set, held for the page session, which
suppresses further auto-expansion of that card. This is what stops the feature
fighting the user.

The extension only ever opens, never closes. Workhorse's conflict-driven force-
open therefore cannot conflict with it.

### 2. Stat rows

Preferences: `checksBreakdown`, `reviewHeroStats`, `effectiveBaseBranch` (all
default on).

Three injections on the card page, each rendered from the cached branch-status
response:

**Checks breakdown**, injected into the Checks disclosure's content. Recomputes
the four buckets exactly as Workhorse's `checkBreakdown` does, including its two
non-obvious guards: `skipped` is coerced through `Number.isFinite` because a
response cached from before that field existed would otherwise turn every bucket
into `NaN`, and `failed`/`running` take a floor of 1 when the overall status says
failing/pending. Only non-zero buckets render. Only the failure count is
coloured, in `--amber`.

**Review Hero stats**, injected into the Review Hero disclosure's content. `Runs`
shows `loop.active ? loop.round : lastReview?.round ?? 0`, and is omitted when
that is zero. `Last run` is omitted when there is no last review at all;
when there is one it reads `No issues` at zero counts, otherwise the total
followed by the critical count in `--amber` when non-zero — matching the app's
`formatReviewCounts` exactly.

**Effective base branch**, injected under the Based-on row as `↳ <branch>` in
mono, shown only when `effectiveBaseBranch` is non-null.

The two disclosure contents only exist in the DOM while their row is open, so
these targets appear and disappear as the user opens and closes rows. The
reconcile loop handles that without special-casing.

### 3. Input history

Preference: `inputHistory` (default on).

History is **global** — a single list of sent messages across all conversations,
not keyed per conversation as the removed hook was. This is both simpler and
more useful: recalling an instruction issued on a different card is the common
case.

Storage: `browser.storage.local`, capped at 200 entries, oldest dropped first.
Consecutive duplicates are recorded once.

**Migration.** On first run the extension reads
`localStorage['workhorse:input-history']`, flattens every conversation's entries
in `updatedAt` order into the global list, and marks the migration done. Existing
history carries over rather than starting empty. The app's key is left in place;
nothing clears it.

**Capture.** A capture-phase listener on the composer records the textarea's
value on Enter-without-shift and on send-button clicks, reading it before React
clears it. The extension cannot know whether a send will actually go through —
`disabled`, `sendBlocked` and `isUploading` are React state it cannot see — so a
blocked send records text that stays in the composer and gets recorded again on
the real send. Consecutive-duplicate suppression absorbs this exactly.

**Recall.** ↑ and ↓ on the composer, with one uniform caret rule: ↑ steps to an
older entry when nothing before the caret contains a newline (the caret is on the
first line); ↓ steps to a newer entry when nothing after the caret contains a
newline (the caret is on the last line). Otherwise the arrow moves the caret as
normal. A selection suppresses recall entirely.

Recall may be entered from a non-empty composer. Doing so stashes the current
text. Stepping down past the newest entry restores the stash rather than clearing
to empty. Editing while recalling exits recall and discards the stash — the text
is now a draft, and a subsequent ↑ stashes that instead.

**Writing to the composer.** Recalled text is applied through the native
`HTMLTextAreaElement.prototype.value` setter followed by a synthetic bubbling
`input` event, so React's `onChange` runs and the app's draft retention and
auto-resize behave normally.

**Protecting the draft.** Because recall must write through `onChange`, each
recalled message also lands in `localStorage['workhorse:chat-drafts']` as the
conversation's draft. Under the removed hook's "empty composer only" entry rule
there was never a draft to destroy; under the rule above there is. So when recall
ends by a route the user did not choose, the extension writes the stashed draft
back to that store directly, beating the app's 300ms debounce:

- on `pagehide` — tab close and hard navigation
- on composer unmount, which the reconcile loop already detects and is what a
  soft navigation looks like

Recall therefore behaves as a peek: the composer shows history while the user's
actual work survives every exit except a browser crash. This is the extension's
only write to app-owned storage.

### 4. Cross-workspace conversations

Preferences: `crossWorkspaceConversations` (default on), `deviceOverlay` (default
on but inert until permission is granted). The scope toggle's own on/off state is
a separate stored value, in `browser.storage.sync`.

A scope toggle is injected at the Conversations header. With it off, the feature
does nothing at all — the app's list is untouched.

With it on, the app's conversation list is hidden with `display: none` and the
extension renders its own in the same position. The app's nodes are hidden, never
removed: React continues to own them, so the extension is not fighting the
virtual DOM and turning the toggle off restores the app's list intact.

**Data.** `GET /api/sessions?recent=true` with no `workspace` parameter returns
sessions across every workspace the user can see. Workspace glyph colours are
computed with the same pure function the app uses over the workspace-name list
from `/api/sidebar-data`, so colours match the app's exactly.

**Liveness.** The extension opens its own `EventSource('/api/sidebar-events')`.
That endpoint is same-origin, cookie-authenticated, and scoped to the user rather
than the active workspace, so it already carries everything a cross-workspace
list needs. `active_sessions` seeds the active set; `agent_start` and
`agent_stop` maintain it, driving the per-row activity pulse. `session_updated`
frames update row previews and timestamps in place, so rows stay current without
polling. Reconnection uses exponential backoff from 1s to a 30s ceiling,
mirroring the app's client.

Cost: one additional SSE connection per tab.

**Paired-device overlay.** Sessions whose card is checked out to the user's own
device lag the device's state mid-turn, because the cloud row is only updated at
turn boundaries. The app corrects this by stitching in a read from the device.
The extension can do the same: `POST /api/local-mode/bearer-token` is
same-origin, and `myLocalInstance` comes from `/api/sidebar-data`. The follow-up
`GET <instanceUrl>/api/sessions-summary?ids=…` is cross-origin to an address that
is only known at runtime, which is why `optional_host_permissions` exists.

That permission cannot be requested from the content script: content scripts are
restricted to `storage`, `runtime`, `i18n` and part of `extension`, and
`permissions` is not among them. A background script cannot request it either,
because `permissions.request()` requires a user gesture. The grant therefore
lives on the options page, where a button click supplies the gesture. When the
overlay is enabled, a device is paired, and the permission is missing, the
extension surfaces a single unobtrusive line offering to open the options page.

Without the permission the rows fall back to cloud values, which is exactly what
the app shows when no device is paired. `localOverlay.ts` is kept separable so
the whole mechanism can be dropped if it proves not to earn its complexity.

Polling matches the app: 5s while there is anything to overlay, none otherwise,
last-known values retained across a transient failure rather than flashing back
to stale cloud values.

## Preferences page

An options page embedded in the browser's own add-on UI, with one switch per
feature or change:

- Auto-expand PR detail
- Auto-expand branch dropdown
- Checks breakdown
- Review Hero stats
- Effective base branch
- Input history
- Cross-workspace conversations
- Paired-device live state — with the permission grant button, showing current
  grant status

All default to on. Stored in `browser.storage.sync`, read by the content script
at startup and re-read on `storage.onChanged`, which schedules a reconcile pass.
Turning a feature off removes its injections on that pass.

The page also carries a "clear input history" action, since history is the only
data the extension accumulates.

Known risk to verify during implementation: permission prompts raised from an
options page embedded in `about:addons` have historically been unreliable in
Firefox. If the grant fails there, the button opens the options page in a tab
instead, where the prompt is well-supported.

## Error handling

The governing rule is that the extension must never degrade the app.

- Every feature pass is individually wrapped. A throwing feature is skipped for
  that pass and logged once per session, not per pass.
- A failed fetch means the affected rows are absent. There is no error UI: these
  are supplementary reads, and an error row in the app's chrome would be worse
  than a missing one.
- SSE failures reconnect with backoff. While disconnected the list still renders
  from the last fetch; only the liveness pulse is lost.
- Storage failures are ignored, matching the app's own handling of a full or
  unavailable `localStorage`.
- An anchor that resolves to nothing means the feature is skipped for that pass.
  This is the expected state on pages the feature does not apply to, so it is not
  an error condition.

## Testing

`node:test`, matching Workhorse's own test style.

Unit-tested pure logic:

- history append and step semantics, including the caret rule, stash and restore
- check-bucket recomputation, including the `Number.isFinite` and floor guards
- workspace colour mapping, verified against Workhorse's expected output
- preference defaults and migration of legacy history

Fixture-tested DOM coupling: anchor resolution runs under jsdom against captured
HTML snapshots of the real app. A fallback that stops matching fails a test
rather than silently rendering nothing — this is the test that earns its keep,
because it is the failure mode the hybrid anchor strategy exists to manage.

Reconcile-loop behaviour is tested under jsdom: idempotence over repeated
passes, removal on feature disable, and the self-feeding guard.

Browser-level behaviour — synthetic clicks against real React handlers, the
native-setter write path, SSE, permissions — is verified manually with
`web-ext run`. Chrome's manifest ships but is not verified unless asked.

## Deferred

- Restoring the removed keyboard-shortcuts modal entry for history recall. The
  extension can find and extend that modal, but the shortcut is known to its only
  user.
- Any Chrome-specific verification.
