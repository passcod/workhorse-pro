# Revert a queued message into the input

A queued message (one typed while the agent is working, waiting to be delivered) carries a discard control on hover. This card adds a revert control beside it that folds the message's text back into the composer and drops it from the queue, instead of discarding it outright.

## Approach

The app renders each queued message's discard control as `button[aria-label="Discard queued message"]`. The extension anchors on that button, injects a revert button as its preceding sibling, and on click reads the message text, folds it into the composer, then triggers the app's own discard so the queue heals the same way it would from a plain discard.

The composer write reuses the native-value-setter path already in the composer feature, lifted into a shared `writeComposer` helper. The fold rule (text above any existing draft, blank line between) mirrors the app's own "Stop returns queued text to the composer" behaviour.

## Checklist

- [x] Lift the composer's native-setter write into `content/dom.ts` as `writeComposer`, and point the composer feature at it
- [x] Pure helpers in `lib/queuedRevert.ts`: `foldReturnedText` and `renderedMessageText`
- [x] `queuedDiscards()` anchor
- [x] `cornerDownLeftIcon` in `content/icons.ts`
- [x] `queuedRevert` feature + registration
- [x] `queuedRevert` preference + options switch
- [x] Styles for the revert control, revealed on the message's hover
- [x] Spec `composer/queued-revert.md` (QRV)
- [x] Tests: pure helpers, feature under jsdom, anchor fixture
- [x] Test cases file
