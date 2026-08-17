---
id: BRND
---

# Branding wordmark

The app brands its sidebar's top corner with a mark and its own name.
Someone running the extension is working in Workhorse Pro rather than in plain Workhorse, so that corner carries the extension's branding instead: a horse, and the word "Prohorse".

The mark keeps the shape the app gives it and changes only what is on it.
A corner that abandoned the mark's square would stop reading as Workhorse at a glance, and the square is also what holds the corner in the minimised sidebar, where the mark stands with no name beside it.

This is the one place the extension changes something the app renders for its own sake rather than adding to it, which is why it is a switch of its own and why everything it touches is put back when that switch is off.

## The lockup

- [ ] The name in the sidebar's top corner reads "Prohorse"
- [ ] The mark beside that name is the app's own square, in the app's accent, carrying a horse in place of the "W"
- [ ] The mark sits where the app's sat, at the same size, so nothing around it moves
- [ ] The horse sits well inside the square rather than filling it, so the square still reads as the mark
- [ ] The mark is decorative, as the app's own is, and the name beside it is what is read aloud
- [ ] The controls sharing that corner with the wordmark keep their place and their behaviour

## While the sidebar is minimised

The retracted rail carries the same mark with no name beside it, and it is the only branding on show once the sidebar is collapsed.

- [ ] The rail shows the same mark, so the corner holds without a name beside it
- [ ] The control that reveals the sidebar again keeps its place beneath it

## Holding the change

- [ ] The branding is applied again after the app has rebuilt that corner
- [ ] A pass over a corner already branded leaves it exactly as it is
- [ ] Nothing the app rendered is detached: the app's own mark is hidden in place, so the app is never made to fail by finding its own markup gone
- [ ] A workspace named the same as the app is not mistaken for the wordmark, so the workspace switcher keeps the name it is meant to show

## Preferences

- [ ] The branding has its own switch
- [ ] Turning the switch off restores the app's own name and mark in both the header and the rail, without a reload
