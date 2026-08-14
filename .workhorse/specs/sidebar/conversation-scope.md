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

## The control

- [ ] The scope control sits among the header's own row controls, alongside the button that starts a conversation
- [ ] Its glyph carries the workspace colours while the list is widened and is plain otherwise, so the control reads as a miniature of the colouring it turns on
- [ ] It stays visible while the list is widened, and is revealed on hover like the header's other controls otherwise
- [ ] The widened list can always be narrowed again from the control, without reloading

## The widened list

The widened list is the app's list made wider, not a different list. It is the same rows, showing the same things, with the same behaviours.

- [ ] While the scope is wide, the app's own conversations list is hidden and the extension's list takes its place
- [ ] The app's list is hidden rather than removed, so turning the scope back to narrow restores it intact
- [ ] The widened list holds conversations from every workspace the user can see, most recently active first
- [ ] Conversations on the same card collapse to one row, showing the most recent, and conversations on the same project likewise
- [ ] A standalone conversation keeps a row of its own

## What a row shows

A row usually stands for a card rather than a conversation, so it carries the card's identity.

- [ ] A row reads as the card's status, then the card's title, then the card's code
- [ ] The title is the card's, falling back to the project's name and then the conversation's, and truncates rather than wrapping
- [ ] The code is the card's identifier, in mono
- [ ] The code carries the row's workspace colour, derived the same way the app derives it so a workspace reads the same in both lists
- [ ] A row with no card code shows a mark in the code's place instead, so the slot reads as a workspace colour rather than as a missing code
- [ ] The leading glyph is the card's status, the project's identity, or a conversation mark, according to what the row stands for
- [ ] A row whose agent is running pulses its glyph
- [ ] A row awaiting the user shows that in place of its usual glyph, and an ambient wait — a review queue or a scheduled merge — shows likewise, with a direct call to action taking precedence over an ambient one
- [ ] A running agent suppresses both, because the pulsing glyph already carries the state
- [ ] The call to action clears on the row the user is looking at
- [ ] Opening a row opens the card with that conversation selected, or the project's home, or the conversation on its own where it belongs to neither

## Dismissing a row

- [ ] Hovering a row reveals a control in the code's place that dismisses it
- [ ] Dismissing a row dismisses every conversation it stands for, so the row does not return as the next most recent conversation on the same card
- [ ] A dismissal that fails restores the row, because the conversation is still there

## The hover card

- [ ] Hovering any part of a row shows a card beside it with the row's full title, its workspace, its card code, and what its glyph is carrying
- [ ] The workspace and code carry the workspace's colour
- [ ] The card sits beside the row, moving to the row's other side when there is no room, and stays within the window
- [ ] The card is not clipped by the sidebar's scrolling

## Depth

- [ ] The list shows a bounded number of rows and offers to show older ones
- [ ] Older conversations are fetched at the same scope as the list, so widening pages across every workspace
- [ ] Further pages can be loaded until there are none, up to a bound
- [ ] A page that fails to load says so and can be retried
- [ ] Narrowing or widening the scope discards the pages loaded at the previous scope

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
