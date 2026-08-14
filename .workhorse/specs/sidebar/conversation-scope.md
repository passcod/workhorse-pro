---
id: SCOP
---

# Cross-workspace conversations

The sidebar's conversations list covers the active workspace.
A scope control widens it to every workspace the user can see, for people whose work spans several at once.

## The control

- [ ] A scope control sits at the conversations header
- [ ] Its state persists across sessions and devices
- [ ] While the scope is narrow, the extension leaves the sidebar entirely alone

## The widened list

- [ ] While the scope is wide, the app's own conversations list is hidden and the extension's list takes its place
- [ ] The app's list is hidden rather than removed, so turning the scope back to narrow restores it intact
- [ ] The widened list holds conversations from every workspace the user can see, most recently active first
- [ ] Each row shows which workspace it belongs to, by a colour glyph
- [ ] Glyph colours are derived the same way the app derives them, so a workspace has the same colour in both lists

## Liveness

The widened list is not a static rendering.
A conversation with a running agent must read as running here exactly as it does in the app's own list.

- [ ] A row whose agent is running is marked as such, and stops being marked when the agent stops
- [ ] A row's preview and timestamp update as its conversation progresses, without the list being refetched
- [ ] Rows continue to render from the last read while the event stream is unavailable, losing only the running indicator

## Live device state

A conversation on a card checked out to the user's own device knows more than the shared record does until the turn ends.

- [ ] Rows for conversations on cards held by the user's device show the device's own view of them
- [ ] This requires access to the device, which is granted from the preferences page
- [ ] Without that access rows show the shared record's values, which is what the app shows when no device is paired
- [ ] The extension asks for the access once and does not press the point

## Preferences

- [ ] The widened scope has its own switch, separate from the scope control's own state
- [ ] Live device state has its own switch
- [ ] Turning the feature off restores the app's own list
