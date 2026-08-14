---
id: WSRT
---

# Workspace switcher order

The sidebar's workspace switcher lists every workspace the user can see.
That list arrives in the order the server holds memberships in, which reads as arbitrary to anyone with more than a handful, so the extension orders the open menu by name.

## Ordering

- [ ] The menu's workspace rows read in alphabetical order by name
- [ ] Ordering ignores case, so how a workspace is capitalised does not decide where it sits
- [ ] Digits in a name order by value, so a workspace numbered 2 sits before one numbered 10
- [ ] Two names that order the same keep the order the app gave them
- [ ] Rows are moved rather than restyled, so keyboard order matches the order on screen
- [ ] The menu is ordered whenever it is open, including after the app has re-rendered it

## What is left alone

- [ ] Only workspace rows move: the divider and the control that adds a workspace keep their place at the end of the menu
- [ ] A row keeps everything it carries, including its unread count, its active styling, and where it goes
- [ ] The switcher's own trigger, and the unread mark it carries, are untouched
- [ ] A menu already in order is left as it is rather than rebuilt, so a click or a hover in progress survives the pass
- [ ] The extension orders the menu the app rendered rather than rendering a menu of its own

## Preferences

- [ ] Ordering has its own switch
- [ ] Turning the switch off stops further ordering, and the app's own order is back the next time the menu is opened, because the app builds the menu afresh each time
