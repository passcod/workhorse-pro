# Workhorse Pro — initial build

Scenarios verifying the extension against its specs. Automated where the logic is pure or reachable under jsdom; manual where it needs a real browser and a live Workhorse.

## Packaging (PKG)

- [ ] A clean build produces a Firefox add-on that loads without warnings and a Chrome directory with the service-worker manifest
- [ ] The Firefox manifest carries a Gecko application id, and settings persist across a browser restart because of it
- [ ] The extension requests only the Workhorse origins, GitHub's API host, and storage, and asks for nothing at runtime
- [ ] Visiting a non-Workhorse site produces no injected nodes and no network activity

## Reconciliation (INJ)

- [x] Running a reconcile pass twice against an unchanged page produces no second set of injections
- [x] A feature that throws is skipped and the remaining features still inject
- [x] A feature that throws is reported once, not once per pass
- [x] Mutations caused solely by the extension's own nodes do not schedule a further pass
- [ ] Soft-navigating between cards re-renders injections against the new card without a reload
- [x] An anchor that resolves to nothing leaves the page untouched and raises nothing

## Anchors (INJ)

The fixture the suite runs against is hand-written from a reading of the app's components, not captured from a running Workhorse. It catches a selector broken by an edit to the anchors module; it cannot catch one broken by a change to the app. Replacing it with a real capture is what the first two scenarios below are owed.

- [ ] Each anchor resolves against a captured snapshot of the app's current markup
- [x] Each anchor resolves when its `data-wh-*` attribute is present, in preference to the fallback
- [ ] An anchor whose fallback no longer matches the captured markup fails the suite

## Auto-expand (AEXP)

- [ ] Opening a card with collapsed pull request detail expands it
- [x] Opening a card with a collapsed branch dropdown expands it (against a fixture)
- [ ] Opening a card with a collapsed branch dropdown expands it
- [x] Collapsing a section by hand leaves it collapsed for that card until reload
- [x] Collapsing a section by hand on one card does not suppress expansion on another
- [x] Turning off a switch stops expansion and leaves open sections open
- [x] An already-open section is left alone
- [x] Re-opening a section by hand lets the extension resume expanding it
- [ ] With the rows switch on, the Checks and Review Hero rows open when a card is shown
- [ ] The rows switch is off unless turned on
- [x] Closing one of those rows by hand keeps it closed, without affecting the other
- [ ] A card whose conflicts cause the app to force a section open is not fought by the extension

## Check breakdown (STAT)

- [x] A clean run shows a passed count alone, with no zero buckets
- [ ] A failing run shows the failed count in the failure colour
- [x] A response with no skipped field yields finite counts rather than nonsense
- [x] A status reporting failure with a zero failing count still shows at least one failed
- [x] A status reporting work in progress with a zero running count still shows at least one running
- [x] The passed count never goes negative when the other buckets exceed the total
- [x] A run with every bucket at zero renders nothing

## Review run stats (STAT)

- [ ] A running loop shows its live round
- [ ] A settled loop shows the last completed round
- [ ] No rounds run means no run count is shown
- [x] A completed review with no findings reads as no issues
- [x] A completed review with findings shows the total and the critical count, critical coloured
- [ ] No completed review means no last-run row

## Named checks (GHUB, STAT)

- [ ] With a token, a failing suite lists the failing jobs by name with links to their logs
- [ ] With a token, running jobs are listed by name
- [x] Passed and skipped jobs are not listed
- [x] Each job shows how long it has been going, or ran for
- [x] A job that has not started says so rather than showing a duration
- [x] Failed jobs sort first, then the longest running
- [x] The list is capped and says how many it left out
- [ ] The job count is labelled as jobs, distinctly from the workflow counts above
- [x] Rows under one disclosure keep a fixed order however they are added
- [ ] Without a token, the breakdown shows counts alone
- [ ] A collapsed checks row issues no GitHub request
- [ ] A card with no GitHub link yet shows counts alone
- [ ] A rejected token is reported on the preferences page and the app falls back to counts
- [ ] Approaching the rate limit backs off rather than continuing to poll
- [x] Repo and ref parse correctly out of the app's GitHub links

## Input history (HIST)

- [x] Sending a message records it
- [x] Sending the same message twice in a row records it once
- [x] An empty message is not recorded
- [x] A send the app refuses, then retried successfully, records one entry
- [x] History exceeding the cap drops the oldest first
- [ ] History written by the app before installation is adopted once, oldest first
- [x] Up from an empty composer recalls the most recent message
- [x] Up again steps to the message before it
- [x] Down steps back towards the most recent
- [x] Up with the caret below the first line moves the caret instead of recalling
- [x] Down with the caret above the last line moves the caret instead of recalling
- [x] A selection in the composer suppresses recall
- [x] Recall with no history does nothing
- [ ] A recalled message arrives with the caret at its end
- [x] Up from a composer with text holds that text and recalls
- [x] Down past the newest message restores the held text rather than emptying
- [x] Editing during recall leaves recall, and a further up holds the edited text
- [x] Sending during recall leaves recall
- [x] Closing the tab during recall leaves the held draft as the conversation's draft
- [x] Soft-navigating away during recall leaves the held draft as the conversation's draft
- [ ] The restored draft survives the app's own delayed draft write

## Stash (STSH)

- [x] Pushing moves the composer's text onto the stack and empties the composer
- [x] Popping returns the top entry to the composer
- [x] Pushing then popping returns the composer to its starting text
- [x] Pushing an empty composer does nothing
- [x] Popping an empty stack does nothing
- [x] Popping into a composer with text exchanges the two and loses neither
- [ ] Restored text arrives with the caret at its end
- [x] The stack drops the oldest entry when it exceeds its cap
- [x] Pushing during recall stashes the recalled message and hands back the held draft
- [ ] Pushing and popping leave recall
- [x] The depth indicator shows the count and disappears at zero
- [ ] Stashed drafts survive a browser restart
- [ ] Turning the stash off leaves stashed drafts in place
- [x] The stash keys do not collide with recall's arrow keys

## Cross-workspace conversations (SCOP)

- [x] The scope control appears among the header's own row controls
- [x] The scope control can be pressed again to narrow the list, without a reload
- [x] Narrow scope leaves the app's sidebar untouched
- [x] Wide scope hides the app's list and shows conversations from every workspace
- [x] The widened list renders when the app is rendering no list at all
- [x] The widened list survives the app's list appearing and disappearing
- [x] Toggling still works after the app has rendered no list
- [x] An anchor never resolves to something the extension injected
- [x] Returning to narrow scope restores the app's own list intact
- [x] Two conversations on one card render as a single row
- [ ] Two conversations on one project render as a single row
- [x] A row shows the card's title and the card's code, not the conversation's title
- [x] A row leads with the card's status glyph
- [x] A row links to the card with that conversation selected
- [x] Each row's card code carries its workspace's colour, matching the colour the app gives that workspace
- [ ] A row with no card code shows the workspace mark in the code's place
- [ ] A row whose agent is running pulses its glyph
- [ ] A row awaiting the user shows a call to action in place of its glyph
- [ ] An ambient wait shows an hourglass, with the merge variant distinguished
- [ ] A running agent suppresses both indicators
- [x] Hovering a row shows a hover card with title, workspace, card code and state
- [x] The hover card is placed outside the sidebar so its scrolling cannot clip it
- [x] The hover card is removed on leaving the row
- [ ] The hover card flips to the row's other side when there is no room
- [x] Hovering a row reveals a dismiss control in the card code's place
- [x] Dismissing a row dismisses every conversation on its card
- [ ] A dismissal that fails restores the row
- [ ] The list bounds its rows and offers older ones
- [ ] Older pages are fetched unscoped, matching the widened list
- [ ] A failed page load says so and can be retried
- [ ] Changing scope discards pages loaded at the previous scope
- [ ] Scope state survives a reload
- [ ] A conversation whose agent starts is marked as running, and unmarked when it stops
- [ ] A conversation's preview and timestamp update without the list refetching
- [ ] A dropped event stream leaves rows rendering, losing only the running indicator
- [ ] A dropped event stream reconnects, and repeated failures lengthen the wait

## Data (DATA)

- [x] A read served from a fresh cache entry issues no request
- [x] Concurrent reads of the same key issue one request
- [ ] Cached data refreshes on the app's own interval
- [ ] No refresh occurs while the document is hidden
- [x] An observed response populates the cache and suppresses the extension's own request
- [ ] Observation never alters or consumes the response the app receives
- [x] An observed payload of the wrong shape is discarded
- [x] A response from a path outside the allowlist is ignored
- [x] A message from an origin other than the app's is ignored
- [ ] With observation off, every read is the extension's own request and all features still work
- [ ] With observation silently broken, features behave as they do without it

## Preferences (PREF)

- [ ] Every switch defaults on, except opening the Checks and Review Hero rows
- [ ] A switch needing a GitHub token reads as unavailable until one is supplied
- [ ] A switch whose token was refused reads as unavailable
- [ ] A supplied but unverified token leaves its switch available
- [ ] The page notices a token being verified while it is open
- [ ] Each switch's description says what it does, including any keys it binds
- [x] Turning a switch off removes what its feature added, on the open page, without a reload
- [x] Turning a switch back on restores it without a reload
- [ ] Turning off auto-expansion leaves already-open sections open
- [ ] Switch settings and the token follow a synced browser profile
- [ ] Input history and stashed drafts stay on the device that wrote them
- [ ] The page clears input history, the stash, and the token independently
- [ ] The page reports whether the GitHub token works
