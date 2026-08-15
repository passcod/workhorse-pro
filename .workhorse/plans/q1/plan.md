# Remembered view selection

Notes from workshopping, ahead of a build checklist.

## What the app does with the view

Confirmed against the workhorse source, in `CardWorkspace.tsx`.

The File/Changes choice is `useState`, not a URL parameter.
A `useLayoutEffect` resets it on every file navigation to a per-file-type default: File for plans, breakdowns, test cases and working docs; Changes for specs; Changes for a code file only where a diff exists, File otherwise.
Its comment says the before-paint timing is deliberate, to avoid a one-frame flash when navigating to a File-first file.

So the app is not merely forgetting the reader's choice, it is actively overriding it every time.
This feature overrides that override.

## Why a synthetic click

There is no URL parameter to write.
`CardWorkspace.tsx` syncs only `session` to the URL, not `file` and not `view`.
Selecting a view means clicking the app's own segment, which is why the spec constrains it to that rather than leaving the mechanism open.

## The flash is deliberate

The app applies its default before paint and the reconcile loop runs after, so the app's choice is briefly visible before the remembered one replaces it.
Decided to accept this rather than hide the artefact until the remembered view lands, on the grounds that a blank reads as a page still loading.
Do not "fix" this later by hiding the view.

## Route.view looks dead

`route.ts` parses a `view` query parameter and nothing in the extension reads it.
Its doc comment claims the URL is a live reading of the current view, which does not hold for the card page.
Worth removing or correcting while in here, and not worth building on.
