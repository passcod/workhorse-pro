# Hooks Workhorse can offer

Everything here is optional. The extension works without any of it — each hook
replaces a heuristic or an internals-coupling with something stable, and the
fallback it replaces is deleted when the hook lands.

Nothing here changes what Workhorse does. They are attributes and one function.

## Navigation

The one hook worth adding first, because its fallback is the most fragile
thing in the extension.

Rows in the widened conversations list are the extension's own markup, so a
click on one is a plain link: a full page load. The App Router exposes no
global router — `next/router` is gone in app dir, and `history.pushState` is
patched to change the URL and the location hooks *without* rendering the new
route, so it cannot be used for this.

Without a hook the extension walks React's fiber tree in the page world to find
the router, falling back to a full navigation when it cannot. That works but
couples to React internals and can break on any React release.

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Lets a browser extension route without reloading the application. */
export function NavigationBridge() {
  const router = useRouter()
  useEffect(() => {
    const w = window as unknown as { __workhorse?: { navigate?: (href: string) => void } }
    w.__workhorse = { ...w.__workhorse, navigate: (href: string) => router.push(href) }
    return () => {
      delete w.__workhorse?.navigate
    }
  }, [router])
  return null
}
```

Mounted once under the main layout. The extension prefers it over the fiber
walk, so the walk can be deleted from `src/page/navigate.ts` once it ships.

## Stable attributes

Each of these replaces a fallback in `src/content/anchors.ts`. The fallbacks
match on visible label text and document structure, which is why a copy change
in Workhorse can silently stop a row from rendering.

| Attribute | On | Replaces |
|---|---|---|
| `data-wh-composer` | the composer textarea | "the only textarea on the page" |
| `data-wh-pr-toggle` | the control expanding the pull request detail | `button[title="Branch details"]`, else the button beside the GitHub link |
| `data-wh-pr-expanded` | `"true"`/`"false"` on the pull request section | inferring it from the branch controls existing |
| `data-wh-branch-toggle` | the branch dropdown | `[title="Advanced branch controls"]` |
| `data-wh-pr-row="checks"` | the Checks disclosure row | a row whose label reads `Checks` |
| `data-wh-pr-row="review-hero"` | the Review Hero disclosure row | a row whose label reads `Review Hero` |
| `data-wh-conversations` | the Conversations header row | a `span` reading `Conversations`, then its containing div |
| `data-wh-conversations-controls` | that header's control cluster | the parent of `button[title="New"]` |
| `data-wh-conversations-list` | the conversations list | the header's next sibling that is not a paragraph |

They are useful to Workhorse independently: the same attributes are what UI
tests would target, for the same reason — a test that finds a row by its label
text breaks when the copy changes.
