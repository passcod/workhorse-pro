---
id: PREF
---

# Preferences

Every behaviour the extension adds is optional and independently switchable.
The extension changes an application the user did not install it into, so any part of it must be removable without removing the rest.

Preferences live in the browser's own add-on settings rather than in a panel the extension injects into the app.

## Switches

- [ ] Auto-expanded pull request detail
- [ ] Auto-expanded branch dropdown
- [ ] Auto-expanded Checks and Review Hero rows
- [ ] Check breakdown
- [ ] Review run stats
- [ ] Input history
- [ ] Composer stash
- [ ] Cross-workspace conversations
- [ ] Alphabetical workspace switcher
- [ ] Raw diff view for markdown artefacts
- [ ] The extension's own branding wordmark in the sidebar's top corner
- [ ] Named checks, alongside where the GitHub token is entered and a reading of whether it currently works
- [ ] Reading responses the app has already fetched

- [ ] Every switch starts on, except opening the Checks and Review Hero rows
- [ ] Switch settings and the GitHub token follow the user across devices wherever browser sync is enabled

Each switch says what turning it on does, in enough detail to be acted on — including any keys it binds, so a feature driven entirely by a keystroke is not left undiscoverable.

## What a switch needs

- [ ] A switch that cannot do anything without a GitHub token reads as unavailable until one is supplied, and says which
- [ ] A switch whose token GitHub has refused reads the same way, because it cannot work until the token is replaced
- [ ] A switch stays unavailable until its token has been checked and found to work
- [ ] The page checks a token as it is saved, so a switch becomes available without leaving the page

## Taking effect

- [ ] A switch takes effect on the open page without a reload
- [ ] Turning a switch off removes what that feature had added

Removal is not a separate mechanism.
A feature that is off has nothing as its desired state, and the reconcile pass that follows removes its rows for the same reason it adds them when the feature is on.

- [ ] Turning off automatic expansion stops further expansion without collapsing anything already open, since expansion is an action rather than something rendered
- [ ] Turning off an ordering stops further ordering, and the app's own order returns as soon as the app next renders the thing that was ordered

## Bindings

- [ ] The page lists every action that has a keyboard binding, with its current one
- [ ] A binding is changed by pressing the combination while the page is listening
- [ ] Listening can be abandoned without changing anything
- [ ] A binding the extension will not accept is reported with the reason rather than silently ignored
- [ ] Any action can be unbound

## Stored data

- [ ] The preferences page reports what the extension has stored and can clear the recorded input history, the stash, and the GitHub token independently
- [ ] Recorded input history and stashed drafts stay on the device that wrote them

History and stashed drafts are working state at a scale that synced settings storage is not sized for, and they are tied to what the user was doing on that machine.
Settings and the token are small and are the same wherever the user works, so they follow.

