# Revert a queued message

Scenarios covering the revert control the extension adds beside a queued message's discard control.

## The control

- [x] A revert control is injected before each queued message's discard control (verifies spec: QRV)
- [x] A header message and a grouped message each get a control, the grouped one floating (verifies spec: QRV)
- [x] The message container is marked so the control reveals on the message's hover (verifies spec: QRV)
- [x] Turning the preference off injects no control and leaves the discard alone (verifies spec: QRV)
- [x] A control whose message has been delivered is removed on the next pass (verifies spec: QRV)
- [x] A second reconcile pass injects no duplicate
- [ ] The control is revealed on hover and hidden otherwise, and reads visibly against the message (verifies spec: QRV)
- [ ] The control matches the discard control's size and shape, tinting to the accent on hover

## Reverting

- [x] Reverting folds the message above an existing draft, separated by a blank line, and drops it from the queue (verifies spec: QRV)
- [x] Reverting into an empty composer leaves just the message (verifies spec: QRV)
- [x] `renderedMessageText` joins paragraphs with a blank line and reads a single paragraph as its text (verifies spec: QRV)
- [ ] The composer takes focus with the caret at the end after a revert (verifies spec: QRV)
- [ ] Reverting one of several queued messages leaves the others in order (verifies spec: QRV)
- [ ] The discard fires against the app's real React handler, removing the row (verifies spec: QRV)

## Preference

- [x] The revert preference defaults on and drives the options switch
