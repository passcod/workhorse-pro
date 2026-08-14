# Workhorse Pro

A Firefox extension that adds density to the [Workhorse](https://github.com/beyondessential/workhorse) web app: expanded pull request detail, check and review stats, composer history and a draft stash, and a conversations list that spans every workspace.

It is read-only against Workhorse. It re-reads the endpoints the app already calls and renders extra rows; it never writes to the API.

## Installing

Open the [latest release](https://github.com/passcod/workhorse-pro/releases/latest) in Firefox and click the `.xpi`. Firefox will ask to confirm, and it installs like any add-on.

Updates arrive on their own. The extension is signed by Mozilla but **not listed** on addons.mozilla.org — it has no public page there and cannot be found or installed from it. Firefox checks this repository's own update manifest instead.

Firefox 140 or later, desktop.

## What it does

Every part can be turned off on its own, in the add-on's preferences.

- **Auto-expand** the pull request section and branch dropdown when a card opens, and optionally the Checks and Review Hero rows as well
- **Check breakdown** — passed, failed, running and skipped, under the Checks row
- **Named jobs** — the jobs that failed or have been running longest, by workflow and name, with how long each has taken and a link to its page on GitHub. Needs a GitHub token, set in preferences; a fine-grained token with read-only Checks access is enough
- **Review run stats** — run count and last run findings, under the Review Hero row
- **Input history** — recall messages you have sent, across every conversation, with the arrow keys
- **Composer stash** — park drafts on a stack and bring them back, with bindings you choose
- **Cross-workspace conversations** — widen the sidebar list past the active workspace

## Developing

```sh
npm install
npm test          # 192 tests
npm run build     # dist/firefox and dist/chrome
npm run watch     # rebuild on save
npm run package   # a loadable zip in web-ext-artifacts/
```

Load `dist/firefox/manifest.json` through `about:debugging` → **This Firefox** → **Load Temporary Add-on**.

Under a sandboxed Firefox (Flatpak, Snap) the file picker hands over a handle to `manifest.json` alone, so its siblings are unreachable and nothing loads. Either pick the zip from `npm run package` instead, or give the sandbox access to the repository:

```sh
flatpak override --user --filesystem=$PWD org.mozilla.firefox
```

## Layout

- `src/content/` — the reconcile loop, DOM anchors, and injected styles
- `src/features/` — one module per feature
- `src/data/` — cached reads against Workhorse and GitHub
- `src/page/` — the part that runs in the app's own context
- `.workhorse/specs/` — what the extension does, and why
- `docs/workhorse-hooks.md` — optional hooks Workhorse can offer to retire the fragile parts

## Chrome

The Chrome manifest builds but has never been loaded. See the deferred section of `.workhorse/plans/distribution/plan.md`.
