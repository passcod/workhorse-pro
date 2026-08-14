---
id: DATA
---

# Reading Workhorse data

Almost everything the extension renders comes from endpoints the app itself calls.
Those reads are same-origin and carry the session cookie, so they need no credential of their own.

Detail Workhorse does not carry is read from GitHub instead — see `platform/github.md`.

## What is read

- [ ] Branch status for the card on screen supplies the check counts and the review run state
- [ ] Sidebar data supplies the workspace list the row colours are derived from
- [ ] The recent-sessions list, requested without a workspace, supplies conversations across every workspace the user can see
- [ ] The card's file listing supplies the current content of the artefact on screen, and the base-file read supplies the same artefact's content on the base branch, which are the two sides of the raw diff

Both branch-status parameters are taken from the card route, so the extension never has to discover which card it is looking at by any other means.

## Cache

- [ ] Responses are held in memory under a key derived from the request, and served from there while fresh
- [ ] Freshness matches the staleness window the app itself applies to the same data, so the extension never shows something the app would already have replaced
- [ ] Concurrent reads of the same key share one request rather than issuing several
- [ ] Cached data refreshes on the same interval the app polls at, and does not refresh while the document is hidden

## Observation

The app fetches branch status on its own schedule.
Where the extension needs the same response, it prefers to observe the one the app already received rather than ask for it again.

- [ ] Responses the app fetches for endpoints the extension cares about are captured and used to populate the cache
- [ ] Observation runs in the page's own context, declared as such rather than injected as a script tag, so the page's content security policy does not apply to it
- [ ] Capturing a response never alters, delays, or consumes the response the app receives
- [ ] Captured data is validated against the expected shape before it is used, and discarded if it does not match
- [ ] Observation is confined to an explicit list of endpoints

Observation is an optimisation over the extension's own reads, never a replacement for them.

- [ ] A read is satisfied from the cache when something fresh is there, and by the extension's own request when nothing is
- [ ] When observation supplies nothing — because the app has stopped polling, or because the mechanism has ceased to work — the extension's own requests take over with no change in behaviour and nothing to detect or repair
- [ ] Observation has its own switch, and turning it off leaves every feature working

The failure mode is what makes this acceptable.
Reading the app's internal query cache would mean coupling to framework internals with no supported access path and no graceful failure; observing responses couples only to a stable platform interface, and its worst case is the behaviour the extension has without it.

## Session liveness

Conversation rows show whether an agent is currently running.
That state arrives as a stream rather than by polling.

- [ ] The extension subscribes to the app's session event stream on its own connection
- [ ] The stream is scoped to the user rather than to the active workspace, so it already covers conversations in every workspace
- [ ] The set of running agents is seeded from the stream's initial frame and maintained by the start and stop frames that follow
- [ ] Session update frames refresh the affected row's preview and timestamp in place, without refetching the list
- [ ] A dropped stream reconnects with a backoff that lengthens on repeated failure up to a ceiling
- [ ] While the stream is disconnected, rows still render from the last read and only the running indicator is lost

