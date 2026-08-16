---
id: GHUB
---

# GitHub access

Some detail exists only on GitHub.
Workhorse reports how many checks passed and failed, but not which ones — and when a suite fails, which job failed is the thing worth knowing.
The extension reads that directly from GitHub, using a token the user supplies.

GitHub access is additive.
Every feature that uses it works without it, in a less detailed form, so a user who does not want to hand the extension a credential loses detail rather than function.

## The token

- [ ] The token is entered on the preferences page and held in extension storage
- [ ] The token follows the user across devices wherever they have browser sync enabled, so it is entered once rather than per browser
- [ ] The preferences page explains the narrowest access that works — a fine-grained token, read-only, limited to checks on the repositories the user works in
- [ ] A token is checked against GitHub as it is saved, so whether it works is settled there rather than on the next card opened
- [ ] The check asks only whether the credential is valid, which needs no permission on the token itself
- [ ] A token that cannot be checked because GitHub is unreachable reads as unchecked, not as refused
- [ ] The preferences page can clear the token, and clearing it returns every feature to its tokenless form
- [ ] The token is sent only to GitHub's API, and to nothing else

## Reading

- [ ] The repository and branch a request needs are derived from the GitHub links the app already renders, so no additional Workhorse endpoint is required
- [ ] A card with no such link yet shows the tokenless form, the same as a card read without a token
- [ ] GitHub is read only for detail that is currently on screen, so a section not on screen costs nothing
- [ ] Where naming something needs a second read, that read is cached and shared the same way, and its absence costs the name rather than the row
- [ ] Responses are cached the same way Workhorse responses are, and shared between rows that need the same data

## When it fails

- [ ] A rejected token is reported once on the preferences page rather than repeatedly in the app
- [ ] A failed or rate-limited read leaves the tokenless form in place
- [ ] Rate limit headroom is respected: the extension backs off rather than continuing to poll into a limit
