# Contributing

## Getting started

```sh
npm install
npm test          # node:test, no framework
npm run build     # dist/firefox and dist/chrome
npm run watch     # rebuild on save, unminified with sourcemaps
npm run typecheck
npm run lint:addon
npm run package   # a loadable zip in web-ext-artifacts/
```

Node 24. npm — not pnpm, not yarn.

## Loading it in Firefox

`about:debugging` → **This Firefox** → **Load Temporary Add-on**, then pick `dist/firefox/manifest.json`. **Reload** re-reads from disk, so `npm run watch` plus Reload plus a tab refresh is the whole cycle. Temporary add-ons go away when Firefox restarts.

Under a sandboxed Firefox — Flatpak, Snap — the file picker hands the browser a handle to `manifest.json` alone, so its siblings are unreachable and nothing loads. Either pick the zip from `npm run package`, or give the sandbox access to the repository:

```sh
flatpak override --user --filesystem=$PWD org.mozilla.firefox
```

If the picker still returns a `/run/user/…/doc/…` path afterwards, set `widget.use-xdg-desktop-portal.file-picker` to `2` in `about:config` to force Firefox's own picker.

Content script logs go to the Workhorse page's console, prefixed `[workhorse-pro]`. The preferences page has its own console, through **Inspect** in `about:debugging`.

## How it is put together

- `src/content/` — the reconcile loop, the DOM anchors, and the injected stylesheet
- `src/features/` — one module per feature, each a `reconcile(context)` function
- `src/data/` — cached reads against Workhorse and GitHub
- `src/page/` — the part that runs in the application's own context
- `src/lib/` — pure logic, where most of the tests point
- `.workhorse/specs/` — what the extension does, and why

Three ideas carry most of the design, and are worth reading `.workhorse/specs/platform/injection.md` and `data.md` for:

**Reconciliation, not reaction.** One observer, one pass per animation frame, and each feature makes the page match a desired state. Nothing detects that a route changed. A pass that finds nothing to change must leave the existing nodes alone — replacing a node with an identical one throws away hover, focus, and any click in progress.

**Anchors are the only coupling to the app's markup**, all in `src/content/anchors.ts`. Each prefers a `data-wh-*` attribute and falls back to structure or label text. An anchor never resolves to something the extension itself injected.

**Reads degrade rather than fail.** Observed responses fall back to the extension's own fetches; GitHub detail falls back to the tokenless form; in-app navigation falls back to a full page load. Where something reaches into the app's internals, the fallback is what makes that acceptable.

`docs/workhorse-hooks.md` lists the hooks Workhorse could offer to retire the fragile parts, with the code to add.

## Tests

`npm test`. Pure logic is tested directly; DOM behaviour under jsdom against fixtures in `test/fixtures/`.

Those fixtures are hand-written from a reading of Workhorse's components, not captured from a running app. They catch a selector broken by an edit here. They cannot catch one broken by a change over there.

When fixing a bug, check the test against the unfixed code first. A regression test that passes before the fix reports the bug as covered when it is not.

## Changes to behaviour

Behaviour lives in `.workhorse/specs/`. A change to what the extension does changes the spec too, in the same commit — the specs are the record of why, and a spec that describes something the extension no longer does is worse than no spec.

Specs describe the system as it should be, not the change being made. Prose acceptance criteria, one sentence per line.

## Commits and releases

Conventional commits. `feat:` and `fix:` reach the changelog and drive the version; `chore:`, `docs:`, `refactor:` and `test:` do not.

[release-please](https://github.com/googleapis/release-please) keeps a release pull request up to date from those commits. Merging it tags the release, which signs the add-on through AMO's unlisted channel, attaches the `.xpi` to the GitHub release, and republishes the update manifest.

There is one version to bump: `build.mjs` stamps `package.json`'s version into the manifests at build time. Keep it that way — a second place to bump is a second place to drift.

Three things stop being free once a version is signed, and are worth knowing before touching them:

- **The extension id is its identity.** Renaming `workhorse-pro@bes.au` orphans every install — they keep the old add-on and silently never update.
- **Versions only go up.** AMO refuses a version it has already signed, so a bad release is fixed by another release.
- **`update_url` must be in the manifest before the version that needs it.** Firefox reads the update location from the installed copy.

`.workhorse/plans/distribution/plan.md` has the whole picture.
