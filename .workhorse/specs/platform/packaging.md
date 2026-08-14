---
id: PKG
---

# Packaging and permissions

The extension ships as a Manifest V3 add-on from a single source tree.
Firefox is the primary target; Chrome builds from the same source with the differences confined to the manifest.

## Browsers

- [ ] One source tree produces both builds, with no browser conditionals outside the manifest
- [ ] The manifests differ only in the Gecko block the Firefox one carries
- [ ] The Gecko application id is required rather than cosmetic, because settings that follow the user across devices are keyed by it
- [ ] Firefox builds are verified before release; Chrome builds ship unverified unless verification is asked for

## Permissions

The extension asks for the least it can, and asks for the rest only when a feature that needs it is used.

- [ ] The extension requests host access to the configured Workhorse origins and to GitHub's API host, plus access to extension storage, and nothing else
- [ ] Every permission it holds is declared up front; it asks for nothing at runtime
- [ ] The session cookie travels on same-origin fetches without a cookies permission, so none is requested

## Origins

- [ ] The extension runs against the production Workhorse origin and against a local development origin
- [ ] The content script matches all paths on those origins and applies itself per page, so a page carrying none of its anchors simply does nothing

## Build

- [ ] Source is TypeScript, bundled into one file per entry point, with no framework and no dependencies beyond the bundler and type definitions
- [ ] Response shapes from Workhorse are declared as types in this repo rather than imported from it, and drift is caught by tests rather than by the compiler

Bundling is not a preference: content scripts cannot be declared as modules in the manifest, so multi-file source must be bundled regardless of language.
Given that, types are close to free, and they catch the failure that matters most here — a renamed or mistyped response field renders an empty row rather than raising an error.

