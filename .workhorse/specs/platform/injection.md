---
id: INJ
---

# Injection and reconciliation

The extension renders into an application that owns its own DOM and re-creates parts of it without warning.
Everything the extension puts on the page is therefore expressed as a desired state and continuously reconciled towards, rather than as a reaction to any particular event.

## Reconcile passes

- [ ] A single observer watches the document for structural changes and schedules at most one reconcile pass per animation frame
- [ ] A pass hands each enabled feature the current page and asks it to make its injections match the desired state — adding what is missing, updating what is stale, and removing what should no longer be there
- [ ] Passes are idempotent: running one repeatedly against an unchanged page produces no further changes
- [ ] A pass that finds nothing to change leaves the existing nodes in place rather than replacing them with equivalents
- [ ] Nothing in the extension needs to detect that a route changed, a card was swapped, or a disclosure opened — each of those produces a page the next pass reconciles against

Replacing a node with an identical one is not a no-op.
Hover, focus and a click in progress are all held by the node itself, and a pass runs on every change the app makes anywhere — so rebuilding on each pass makes rows impossible to click and hovers impossible to hold.

This is what makes the extension viable against an application that soft-navigates.
There are no page loads to hook, and subtrees are re-created on state changes the extension cannot see, so a design that responded to particular mutations would accumulate special cases without end.

- [ ] Injected nodes are marked as the extension's own, and changes involving only those nodes do not schedule a further pass

## Failure isolation

- [ ] Each feature's work within a pass is isolated, so a feature that fails is skipped for that pass without affecting the others
- [ ] A failing feature is reported once per session rather than once per pass
- [ ] An anchor that does not resolve means the feature is skipped rather than that something has gone wrong, because that is the normal state on pages the feature does not apply to

## Anchors

All coupling to the app's markup is confined to one place, so that the app changing shape has one blast radius rather than many.

- [ ] Every handle onto the app's markup is a named anchor resolved in a single module
- [ ] An anchor prefers a stable attribute placed on the app's own element, and falls back to structure or visible label text when no attribute is present
- [ ] Each fallback records what it stands in for, so it can be deleted when the app grows the attribute
- [ ] Anchors never match on utility class names, because those exist in the compiled stylesheet only for as long as some component uses them

Anchors are needed for the composer, the pull request detail toggle and its expanded state, the branch dropdown, the checks row, the review row, the base row, the conversations header, and the conversations list.

## Styling

- [ ] Injected markup is styled by the extension's own stylesheet, using its own class names
- [ ] Injected rows take their colours, spacing, and type from the app's design tokens, so they match the design system and follow the light and dark themes without the extension knowing which is active
- [ ] Injected rows carry a subtle marker distinguishing them from rows the app renders itself
