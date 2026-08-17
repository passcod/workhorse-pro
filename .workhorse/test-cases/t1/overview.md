# Input stash placeholder and tab restoration

Scenarios covering the stash preview placeholder and the Tab restore gesture, plus the existing Ctrl+P swap the card leans on.

## Placeholder preview

- [x] With a draft stashed, the empty composer's placeholder shows the first line of the most recent draft (verifies spec: STSH)
- [x] A multi-line stashed draft previews only its first line (verifies spec: STSH)
- [x] Emptying the stack puts the app's own placeholder back (verifies spec: STSH)
- [ ] The preview reads correctly against the real app's composer, not just the fixture textarea
- [ ] Turning the composer stash preference off leaves the app's placeholder untouched

## Tab restoration

- [x] Tab in an empty composer restores the most recent stashed draft (verifies spec: STSH)
- [x] Tab with an empty stash does nothing and is not swallowed (verifies spec: STSH)
- [x] Tab while the composer holds a draft keeps its ordinary behaviour and leaves the stash alone (verifies spec: STSH)
- [ ] Tab fires against the app's real composer without the browser moving focus first

## Ctrl+P swap

- [x] Ctrl+P into a composer that already holds text swaps the text and the stashed draft (verifies spec: STSH)
- [ ] Ctrl+P is swallowed so the browser's print dialog does not open over the app
