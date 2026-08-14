---
id: WXP
---

# Workhorse Expert

Workhorse Expert is a browser extension that adds density to the Workhorse web app.
It surfaces detail the app deliberately keeps out of its own chrome — check breakdowns, review run counts, resolved base branches — and adds composer and sidebar affordances for people who work in Workhorse all day.

The extension is an overlay, not a fork.
It reads the same endpoints the app reads, renders extra rows into the app's own layout, and never writes to the Workhorse API.

## Audiences

- **Heavy Workhorse users** — the only audience. Every feature trades approachability for information density, which is why it lives outside the product.

## Primary concepts

- **Reconcile pass** — the extension's unit of work: given the current page, make its injections match what preferences say they should be. See `platform/injection.md`.
- **Anchor** — a named handle onto a piece of the app's markup, resolved by a stable attribute where one exists and by structure or label text where one does not. See `platform/injection.md`.
- **Observation** — reading a response the app already fetched, rather than fetching it again. An optimisation over the extension's own reads, never a replacement for them. See `platform/data.md`.
- **Recall** — stepping backwards through previously sent messages in the composer. See `composer/input-history.md`.
- **Stash** — a stack of composer drafts the user parks and restores deliberately. See `composer/stash.md`.

## Guiding decisions

- **Read-only against Workhorse.** The extension issues GETs and renders UI. It holds no tokens, requests no GitHub scope, and performs no background network activity. Authentication is free: fetches to the app origin carry the session cookie.
- **Degrade to absent, never to broken.** Every feature is skipped when the page does not support it, when a read fails, or when an anchor does not resolve. A missing row is an acceptable outcome; a broken app is not.
- **Prefer the app's own work.** Where the app already holds data or already renders something correctly, the extension reads it or leaves it alone rather than duplicating it.
- **Every feature is optional.** Each behaviour has its own switch, and turning one off removes its effect. See `preferences.md`.

## Acceptance criteria

- [ ] The extension applies only to the Workhorse origins it is configured for, and does nothing on any other site
- [ ] A feature that fails is skipped for that pass and logged once, leaving every other feature working
- [ ] The extension never prevents, delays, or alters any action the app itself performs
