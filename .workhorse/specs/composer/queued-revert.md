---
id: QRV
---

# Revert a queued message

Messages typed into the composer while a turn is running are queued and delivered when it ends.
The app reveals a discard control on each queued message that drops it from the queue.
Beside that control sits a revert control that takes the message back into the composer instead of dropping it, for a message queued too soon or worth editing before it is sent.

## The control

- [ ] Every queued message carries a revert control beside its discard control
- [ ] The control is revealed on the message's hover, like the discard control beside it
- [ ] It matches the discard control's size and shape, and tints toward the accent on hover rather than the discard's red
- [ ] Only an undelivered queued message carries the control; a delivered message carries neither control

## Reverting

- [ ] Reverting puts the message's text into the composer and removes the message from the queue
- [ ] The text is folded in above whatever the composer already holds, separated by a blank line, so a draft in progress is not lost
- [ ] The composer takes focus with the caret at the end of its text
- [ ] The message leaves the queue through the app's own discard, so the remaining queued messages keep their order

The message is rendered from markdown, so the reverted text is the message's prose rather than its exact source.

## Preference

- [ ] The revert control has its own switch, and turning it off leaves the app's discard control alone
