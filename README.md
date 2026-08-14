# Workhorse Pro

A Firefox extension that adds density to the [Workhorse](https://github.com/beyondessential/workhorse) web app — more detail on a card's pull request, more reach in the sidebar, and more in the composer.

It is read-only against Workhorse: it re-reads the endpoints the app already calls and renders extra rows, and never writes to the API.

## Install

Open the [latest release](https://github.com/passcod/workhorse-pro/releases/latest) in Firefox and click the `.xpi`. Confirm, and it installs like any add-on.

Updates arrive on their own.

Firefox 140 or later, desktop.

## Settings

Everything the extension adds can be turned off on its own, in the add-on's preferences — `about:addons` → **Workhorse Pro** → **Preferences**. That is also where the keyboard bindings are set, and where a GitHub token goes if you want the parts that need one.

## Signing

The extension is signed by Mozilla but **not listed** on addons.mozilla.org: it has no page there, cannot be searched for, and cannot be installed from it. Firefox checks this repository for updates instead.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
