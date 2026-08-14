---
id: HIST
---

# Input history

The composer remembers messages the user has sent and steps back through them with the arrow keys.

History is global rather than per conversation.
Recalling an instruction issued on a different card is the common case, and a single list makes that work without the user having to remember where they said it.

## Recording

- [ ] A message is recorded when it is sent, before it leaves the composer, so it survives a send that fails
- [ ] Consecutive identical messages are recorded once
- [ ] Empty messages are not recorded
- [ ] The list is capped, with the oldest dropped first

The extension cannot see whether a send will be accepted, so a send the app refuses records text that stays in the composer and is recorded again when it is really sent.
Recording consecutive duplicates once absorbs this exactly.

- [ ] History accumulated by the app before the extension was installed is adopted on first run, ordered oldest to newest, so nothing is lost

## Recalling

Recall is bound to Ctrl with an arrow key, so the arrow keys on their own always move the caret and a multi-line message reads and edits normally. The binding steps whether or not recall is already in progress.

- [ ] Ctrl+Up steps to an older message
- [ ] Ctrl+Down steps to a newer message
- [ ] Recall does nothing when there is nothing to recall
- [ ] A recalled message arrives with the caret at its end

Recall may be entered from a composer that already has text in it.

- [ ] Entering recall from a composer with text in it holds that text aside
- [ ] Stepping newer past the most recent message restores the held text rather than emptying the composer
- [ ] Editing the composer leaves recall, and the text becomes an ordinary draft — a subsequent recall holds that instead
- [ ] Sending leaves recall

## Protecting the draft

Recalled text goes through the composer, which means the app records it as the conversation's draft.
Recall is a way of looking at what was said before, so it must not cost the user the text they were writing.

- [ ] When recall ends by a route the user did not choose, the held text is written back as the conversation's draft
- [ ] This covers the tab being closed, the page being navigated away from, and the composer being removed by a move to another part of the app
- [ ] The held text is written directly, ahead of any delay the app applies to recording drafts, so it is not overtaken

The result is that the composer shows history while the user's own work survives every exit from recall.

Recorded history is cleared from the preferences page — see `preferences.md`.
