---
id: AEXP
---

# Auto-expanded pull request detail

The pull request section and its branch dropdown open on their own when a card is shown, so the detail is in front of the user rather than behind two chevrons.

## Expanding

- [ ] When a card is shown with its pull request detail collapsed, the extension opens it
- [ ] When a card is shown with its branch dropdown collapsed, the extension opens it
- [ ] When a card is shown, the Checks and Review Hero rows can be opened too — each holds its readings behind a chevron, so opening them is what puts those in view without a click
- [ ] Opening those rows is off unless asked for, because it changes the shape of the section more than opening the section itself does
- [ ] Each row keeps its own record of a deliberate collapse, so closing one does not hold the other closed
- [ ] Each is governed by its own switch

## Never fighting the user

Automatic expansion is only useful if it yields to a deliberate collapse.

- [ ] A section the user collapses stays collapsed for that card until the page is reloaded
- [ ] The extension can tell its own expansion from the user's, so opening a section does not read as the user having chosen to open it
- [ ] The extension only ever opens a section and never closes one, so it cannot conflict with the app opening a section on its own

The app opens both the pull request detail and the branch dropdown when it detects upstream conflicts.
Because the extension never closes anything, that behaviour is unaffected.

- [ ] Turning either switch off stops further expansion and leaves anything already open as it is
