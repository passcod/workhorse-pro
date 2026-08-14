---
id: STSH
---

# Composer stash

A draft can be parked and brought back later.
The stash is a stack: drafts are pushed onto it and popped off in reverse order, so a half-written message can be set aside to deal with something else and picked up afterwards.

The stash is global rather than per conversation, so a draft parked on one card can be brought back on another.
Entries persist across browser restarts, because a parked draft that a crash can destroy does not do the job a stash is for.

## Pushing and popping

- [ ] Pushing takes the composer's text, puts it on top of the stack, and leaves the composer holding whatever it held before that text
- [ ] Popping takes the top entry off the stack and puts it in the composer
- [ ] Pushing an empty composer does nothing
- [ ] Popping an empty stack does nothing

Pushing and popping in turn returns the composer to where it started.

- [ ] Popping into a composer that already has text pushes that text first, so the two exchange places and nothing is lost
- [ ] Restored text arrives with the caret at its end
- [ ] The stack is capped, with the oldest entry dropped first

The phrase "whatever it held before" is what makes pushing behave sensibly during recall.
In the ordinary case the composer had nothing before the draft, so pushing empties it.
During recall the composer was holding the user's own draft before the recalled message replaced it, so pushing the recalled message hands the draft back — which is what setting aside an old message in order to keep writing should mean.

- [ ] Pushing while recalling leaves recall
- [ ] Popping leaves recall

## Showing the stack

- [ ] The composer shows how many drafts are stashed, and shows nothing when the stack is empty
- [ ] The indicator is unobtrusive enough to sit in the app's composer without competing with it

## Keys

- [ ] Stashing is bound to the save gesture, and restoring to the same gesture with shift
- [ ] Both are swallowed, so the browser's own save dialog does not open over the app
- [ ] The bindings do not collide with recall, which keeps the unmodified arrow keys

Parking a draft is a save, so it takes the save keys — and those are the ones already in the user's hands from the tools they work in.

## Preferences

- [ ] The stash has its own switch, and turning it off leaves stashed drafts in place rather than discarding them
- [ ] The preferences page can clear the stash
