---
id: WXP
---

# Prohorse

A browser extension that adds UI experiments to the Workhorse web app. Every experiment has a feature flag in extension settings to be turned on/off.

## Primary concepts

- **Reconcile pass** — the extension's unit of work: given the current page, make its injections match what preferences say they should be. See `platform/injection.md`.
- **Anchor** — a named handle onto a piece of the app's markup, resolved by a stable attribute where one exists and by structure or label text where one does not. See `platform/injection.md`.
- **Observation** — reading a response the app already fetched, rather than fetching it again. An optimisation over the extension's own reads, never a replacement for them. See `platform/data.md`.
- **Recall** — stepping backwards through previously sent messages in the composer. See `composer/input-history.md`.
- **Stash** — a stack of composer drafts the user parks and restores deliberately. See `composer/stash.md`.

## Guiding decisions

- **Credentials are opt-in.** The extension can hold a GitHub token the user supplies for detail Workhorse does not carry. See `platform/github.md`.
- **Degrade to absent, never to broken.** Every feature is skipped when the page does not support it, when a read fails, or when an anchor does not resolve. A missing row is an acceptable outcome; a broken app is not.
- **Prefer the app's own work.** Where the app already holds data or already renders something correctly, the extension reads it or leaves it alone rather than duplicating it.
- **Every feature is optional.** Each behaviour has its own switch, and turning one off removes its effect. See `preferences.md`.
