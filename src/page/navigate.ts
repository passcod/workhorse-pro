import { NAVIGATE_MESSAGE, PAGE_WORLD_FLAG } from '../lib/messages.ts'

/**
 * Client-side navigation for rows the extension renders.
 *
 * A plain link works but reloads the whole application, which for a sidebar
 * row is a heavy answer to a light request. The App Router deliberately
 * exposes no global router — `next/router`'s default export is gone, and
 * `history.pushState` is patched to update the URL and the location hooks
 * *without* rendering the new route, which would leave the address bar lying
 * about what is on screen.
 *
 * So this tries, in order:
 *
 * 1. A navigate hook the app provides. Supported, stable, and the reason the
 *    layer below is a stopgap rather than a fixture.
 * 2. The router held in React's own tree, reached by walking fibers. This
 *    couples to React internals and may stop working on any React release.
 * 3. A full navigation, which is what a plain link would have done.
 *
 * The third step is what makes the second acceptable: its failure costs the
 * behaviour the extension had before any of this, not the feature. spec: SCOP
 */

interface AppRouter {
  push(href: string): void
}

interface WithHook {
  __workhorse?: { navigate?: (href: string) => void }
}

/** Whether a value looks like the App Router rather than any other context. */
function isRouter(value: unknown): value is AppRouter {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.push === 'function' &&
    typeof candidate.replace === 'function' &&
    typeof candidate.refresh === 'function'
  )
}

interface Fiber {
  return: Fiber | null
  memoizedProps?: { value?: unknown } | null
}

function fiberOf(node: Element): Fiber | null {
  for (const key of Object.keys(node)) {
    if (key.startsWith('__reactFiber$')) {
      return (node as unknown as Record<string, Fiber>)[key] ?? null
    }
  }
  return null
}

/**
 * Walk up from a node the app rendered, looking for a context provider whose
 * value is the router. Providers sit above the tree they serve, so anything
 * deep enough finds it.
 */
function routerFromTree(): AppRouter | null {
  const roots = [
    document.querySelector('nav'),
    document.querySelector('aside'),
    document.querySelector('main'),
    document.body.firstElementChild,
  ]
  for (const root of roots) {
    if (!root) continue
    let fiber = fiberOf(root)
    let depth = 0
    // Bounded so a cycle or a pathological tree cannot hang the page.
    while (fiber && depth < 200) {
      const value = fiber.memoizedProps?.value
      if (isRouter(value)) return value
      fiber = fiber.return
      depth++
    }
  }
  return null
}

function navigate(href: string): void {
  try {
    const hook = (window as unknown as WithHook).__workhorse?.navigate
    if (typeof hook === 'function') {
      hook(href)
      return
    }
    const router = routerFromTree()
    if (router) {
      router.push(href)
      return
    }
  } catch {
    // Any failure falls through to the plain navigation below.
  }
  window.location.href = href
}

function install(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return
    const data = event.data as { source?: unknown; href?: unknown } | null
    if (!data || typeof data !== 'object') return
    if (data.source !== NAVIGATE_MESSAGE) return
    if (typeof data.href !== 'string') return
    // Same-origin only: this turns a message into a navigation, and the page
    // can post to itself.
    let target: URL
    try {
      target = new URL(data.href, window.location.origin)
    } catch {
      return
    }
    if (target.origin !== window.location.origin) return
    navigate(target.pathname + target.search + target.hash)
  })

  // Tell the other world we are here, so it only swallows a click it can act
  // on. Set on the element rather than a global: the two worlds share the DOM
  // and nothing else.
  document.documentElement.dataset[PAGE_WORLD_FLAG] = '1'
}

install()
