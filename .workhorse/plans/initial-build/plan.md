# Workhorse Expert — initial build

Greenfield build of the extension from the spec set. No prior code, so the sequence is scaffolding → core machinery → data → features → preferences → tests.

## Tech notes

**Bundle layout.** Four entry points, each bundled to a single IIFE: `content` (isolated world), `page` (MAIN world, fetch observation), `background` (opens the options page), `options`. MV3 forbids module content scripts, hence the bundle.

**Reconcile over reaction.** `content/index.ts` owns one `MutationObserver` and an rAF-coalesced pass. Features expose `reconcile(ctx)` and are pure functions of (DOM, prefs, data). No feature holds a subscription to the DOM.

**Anchors are the only markup coupling.** Everything in `content/anchors.ts`. Each anchor tries a `data-wh-*` attribute, then a documented fallback. Fixture tests pin the fallbacks.

**Data is pull-with-cache.** `data/store.ts` holds a TTL map keyed by request. Reads go `get(key)` → fresh? serve : fetch. The MAIN-world observer populates the same map, so it is an optimisation with no separate code path. Nothing detects observation failing.

**Async in a sync pass.** Reconcile is synchronous; data reads are not. Features read from the cache synchronously and, on a miss, kick off a fetch that schedules another pass on arrival. So a pass renders what is known now and re-runs when more is known.

## 1. Scaffolding

- [x] `package.json` with npm scripts only — build, watch, test, run:firefox, lint via tsc
- [x] `tsconfig.json` strict, DOM + ES2022 libs, no emit (esbuild does the emit)
- [x] `build.mjs` — esbuild four entry points, copy the right manifest and static assets into `dist/{firefox,chrome}/`
- [x] `manifest.firefox.json` and `manifest.chrome.json`
- [x] `.gitignore` for `dist/`, `node_modules/`
- [x] Verify a clean build validates — `web-ext lint` reports zero errors
- [ ] Load it in a browser and confirm it runs

## 2. Core machinery

- [x] `prefs.ts` — schema, defaults (all on), sync-area read/write, change subscription
- [x] `localData.ts` — history and stash in the local area, loaded into memory for synchronous reads
- [x] `content/styles.css` — `whx-` classes over app design tokens
- [x] `content/anchors.ts` — named anchors, attribute-first with fallbacks
- [x] `content/dom.ts` — `ensure`/`ensureAfter`/`remove`, which is what makes features idempotent
- [x] `content/reconcile.ts` — observer, rAF coalescing, self-injection guard, per-feature isolation
- [x] `content/index.ts` — bootstrap: load prefs, register features, start observer

## 3. Data

- [x] `data/types.ts` — branch status, sidebar data, sessions, check runs
- [x] `data/keys.ts` — cache keys and the URL-to-key mapping both directions share
- [x] `data/store.ts` — TTL cache, in-flight dedupe, visibility-aware refresh, error backoff, subscriber notify
- [x] `data/workhorse.ts` — the app endpoint reads
- [x] `page/observe.ts` — MAIN-world fetch wrapper, allowlisted paths, postMessage out
- [x] `data/observed.ts` — isolated-world receiver, origin and shape validation, feeds the store
- [x] `data/sse.ts` — session event stream, running-session set, revisions, backoff reconnect
- [x] `data/github.ts` — check runs by head sha, rate-limit backoff, token status
- [x] `data/device.ts` — bearer token, permission check, sessions-summary overlay

## 4. Features

- [x] `features/autoExpand.ts` — open PR detail and branch dropdown, synthetic-click flagging, per-card user-collapse memory, click cooldown
- [x] `features/statRows.ts` — check breakdown with its guards, review run stats, effective base branch
- [x] `features/namedChecks.ts` — failing and running checks by name, only while the row is expanded
- [x] `features/composer.ts` — history and stash together
- [x] `features/conversationScope.ts` — scope toggle, hide app list, render widened list, liveness, device overlay

**Drift from the plan.** Input history and the stash were built as one module
rather than two. Pushing while recalling has to stash the recalled message and
hand back the held draft, which means both features read and write the same
recall state — splitting them would have meant one exporting its internals to
the other. The specs stay separate; the module does not.

## 5. Preferences

- [x] `options/options.html` + `options.ts` — switches, GitHub token field with validity readout, device permission grant, stored-data clearing
- [x] `background.ts` — open options page on message

## 6. Tests

- [x] `test/` — node:test suites for the pure logic
- [x] Fixture-based anchor resolution under jsdom
- [x] Reconcile-loop tests: idempotence, removal on disable, self-feeding guard, failure isolation
- [x] Store tests: freshness, dedupe, observation, failure backoff
- [x] Composer tests: recall, the caret rule, stash, draft protection
- [x] Tick matching scenarios in `.workhorse/test-cases/initial-build/overview.md`

## 7. Verify

- [x] `npm test` green (101 tests), `tsc --noEmit` clean, `web-ext lint` zero errors
- [ ] Manual `web-ext run` pass against a live Workhorse

## Outstanding

The unticked boxes above are the honest state: nothing has been run in a
browser against a real Workhorse. Everything below needs that pass, and none of
it is covered by the automated suite:

- [ ] Auto-expand end to end — synthetic clicks against the app's real React handlers
- [ ] The native-setter write path — that the app's draft retention and auto-resize react to it
- [ ] The page-world `fetch` wrapper — that MAIN-world injection works and the app is unaffected
- [ ] The event stream — connection, running indicators, reconnect
- [ ] The widened conversations list — hiding the app's list and restoring it intact
- [ ] The device permission grant from the preferences page, embedded in `about:addons`
- [ ] Named checks against a real token and a real failing suite
- [ ] Anchor fallbacks against real markup rather than the hand-written fixture
