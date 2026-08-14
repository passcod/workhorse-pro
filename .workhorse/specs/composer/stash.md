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
- [ ] The count is also how a draft is restored, so the stash can be used without remembering a binding
- [ ] It names the binding that does the same thing, so the binding is learned from using it

## Keys

Every binding worth having is one something else already claims — a browser, a desktop, another editor — so the bindings are the user's to set rather than the extension's to insist on.

- [ ] Stashing and restoring each have a binding the user can change
- [ ] A binding is set by pressing the combination, not by writing it out
- [ ] A binding is shown in one spelling however it was pressed
- [ ] Either action can be left unbound
- [ ] A binding without a modifier is refused, because it would swallow ordinary typing
- [ ] Both bindings are swallowed when they fire, so whatever else they would have done does not happen over the app
- [ ] The bindings cannot take the unmodified arrow keys, which belong to recall

Out of the box, stashing is the save gesture — parking a draft is a save — and restoring takes a key that no one presses on a Workhorse page for its usual purpose.

## Preferences

- [ ] The stash has its own switch, and turning it off leaves stashed drafts in place rather than discarding them
- [ ] The preferences page can clear the stash
