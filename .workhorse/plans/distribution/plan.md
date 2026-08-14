# Distribution

How Workhorse Pro gets from a green build to an installed add-on that updates itself. The workflows are written; what is left needs an account or a repository setting.

## The shape

**Unlisted, self-distributed, signed by AMO.** Signing is not optional: release and beta Firefox refuse unsigned extensions, so the package goes through addons.mozilla.org either way. What listing would add is a public AMO page, full human review, screenshots and a privacy policy — ceremony for an audience of one, and a stored GitHub token would draw a reviewer's attention for no benefit. Unlisted uploads go through automated review and come back signed.

**release-please for versioning.** Conventional commits on `main`; the bot maintains a release pull request carrying the version bump and CHANGELOG; merging it tags and cuts the GitHub Release. Same model as release-plz, which it predates and inspired.

There is exactly one version to bump. `build.mjs` stamps `package.json`'s version into the manifest at build time, so release-please's stock `node` type is enough — no manifest plugin, no second bump script, and no way for the two to drift. Keep it that way.

## Things that stop being free after the first signed release

- **The extension id is its identity.** `workhorse-pro@bes.au` is what Firefox keys an installed add-on and its synced storage by. Renaming it after the first signed release orphans every install — they keep the old one, silently, and never see an update. It was renamed from `workhorse-expert@bes.au` while that cost nothing; that window closes at the first upload.
- **Versions only go up.** AMO rejects a re-upload of a version it has already signed, so a botched release is fixed by a new version, never by replacing one.
- **`update_url` has to be in the manifest before the version that needs it.** Firefox reads the update location from the installed copy. A version signed without it will never look for its successor — it checks AMO instead, finds nothing listed, and sits there. So the manifest key and the first signed release land together or the first release is a dead end.

## Prerequisites — yours to do

- [ ] AMO account, and an add-on API key — the JWT issuer and secret from `addons.mozilla.org/developers/addon/api/key/`
- [ ] Both stored as repository secrets (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`)
- [ ] GitHub Pages enabled on the repo, to host the update manifest
- [ ] Decide the conventional-commit prefixes worth releasing on, and note them in `AGENTS.md` so agents write commits that version correctly

## 1. Continuous integration

- [x] `.github/workflows/ci.yml` on push and pull request
- [x] `npm ci`, then `tsc --noEmit`, `npm test`, `npm run build`, `web-ext lint --source-dir dist/firefox`
- [x] Fail on lint errors; the Android `strict_min_version` warning is expected and not an error

All four already pass locally, so this is wiring rather than work.

## 2. Auto-update wiring

- [x] Add `browser_specific_settings.gecko.update_url` to the Firefox manifest, pointing at the Pages-hosted `updates.json`
- [x] Generate `updates.json` from the release: the extension id, the new version, and an HTTPS `update_link` to the release asset
- [x] Publish it to Pages as part of the release job
- [ ] Verify an installed older version actually picks up a newer one — this is the part that fails silently if any link in it is wrong

## 3. Release

- [x] `.github/workflows/release.yml`
- [x] release-please action maintaining the release pull request from conventional commits
- [x] On release creation: `npm ci`, `npm run build`
- [x] `web-ext sign --source-dir dist/firefox --channel unlisted`, with credentials passed as `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` rather than on the command line
- [x] Attach the signed `.xpi` from `web-ext-artifacts/` to the GitHub Release, under a name the workflow chooses so the update link is predictable
- [x] Regenerate and publish `updates.json`

Running `web-ext` directly rather than through a third-party action: Mozilla publishes none, the flags are stable, and it is one fewer thing to trust with the signing credentials.

## 4. First release

- [ ] Complete a browser pass first — see `.workhorse/plans/initial-build/plan.md`, which lists what has never been run
- [ ] Tag `0.1.0` only once the features have actually worked once

The first signed version should be one that has run. Signing is cheap; an install base on a version that never worked is not.

## Deferred: Chrome

Chromifying needs a Web Store developer account, its own review, and PNG icons — Chrome will not take the SVG the Firefox manifest uses. The Chrome manifest builds today but has never been loaded, so it is untested rather than supported. Worth doing only if a second browser is actually wanted.
