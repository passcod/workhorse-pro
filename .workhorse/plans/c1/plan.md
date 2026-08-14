# Revert a queued message into the input

A queued message (one typed while the agent is working, waiting to be delivered) carries a discard control on hover. This card adds a revert control beside it that folds the message's text back into the composer and drops it from the queue, instead of discarding it outright.

## Approach

The app renders each queued message's discard control as `button[aria-label="Discard queued message"]`. The extension anchors on that button, injects a revert button as its preceding sibling, and on click reads the message text, writes it into the composer, then triggers the app's own discard so the queue heals the same way it would from a plain discard.

A draft already in the composer is parked on the stash rather than folded in around the reverted message: the reverted message arrives alone, and the draft comes back through the stash badge. The write therefore lives in `features/composer.ts` as `stashDraftAndWrite`, not in the revert feature — during recall the draft worth parking is the text held aside, which only that module can see.

Because the badge is the only way back to a parked draft, it now shows whenever either the stash or the revert control is on. Without that, a revert with the stash switch off would swallow the draft silently.

## Checklist

- [x] `stashDraftAndWrite` in `features/composer.ts`, and widen the badge's gate
- [x] Pure helper in `lib/queuedRevert.ts`: `renderedMessageText`
- [x] `queuedDiscards()` anchor
- [x] `cornerDownLeftIcon` in `content/icons.ts`
- [x] `queuedRevert` feature + registration
- [x] `queuedRevert` preference + options switch
- [x] Styles for the revert control, revealed on the message's hover
- [x] Spec `composer/queued-revert.md` (QRV)
- [x] Tests: pure helpers, feature under jsdom, anchor fixture
- [x] Test cases file
