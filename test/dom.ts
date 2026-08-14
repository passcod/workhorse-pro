import { JSDOM } from 'jsdom'

/**
 * A DOM for tests that exercise injection.
 *
 * The globals are installed on `globalThis` because the extension's modules
 * reference `document`, `window` and friends directly — as they must, running
 * as a content script. Modules that read a global at import time (the
 * composer's native value setter, for one) have to be imported after this runs,
 * which is why tests needing them use a dynamic import.
 */
export function installDom(body = ''): JSDOM {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    url: 'https://workhorse.bes.au/workhorse/cards/WH-078',
    pretendToBeVisual: true,
  })

  const globals = globalThis as unknown as Record<string, unknown>
  globals.window = dom.window
  globals.document = dom.window.document
  globals.location = dom.window.location
  globals.Node = dom.window.Node
  globals.Element = dom.window.Element
  globals.HTMLElement = dom.window.HTMLElement
  globals.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  globals.HTMLAnchorElement = dom.window.HTMLAnchorElement
  globals.MutationObserver = dom.window.MutationObserver
  globals.Event = dom.window.Event
  globals.CSS = dom.window.CSS
  globals.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
  globals.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)

  return dom
}

/** Replace the document body, as a soft navigation would. */
export function setBody(html: string): void {
  document.body.innerHTML = html
}

export interface ExtStub {
  area: Map<string, unknown>
  sync: Map<string, unknown>
}

/**
 * A minimal in-memory stand-in for the extension API.
 *
 * `ext.ts` resolves the namespace once at import time, so this has to be
 * installed before anything that imports it — hence the dynamic imports in the
 * tests that need it.
 */
export function installExtStub(): ExtStub {
  const local = new Map<string, unknown>()
  const sync = new Map<string, unknown>()

  const areaFor = (store: Map<string, unknown>) => ({
    get: async (keys: string | string[]) => {
      const wanted = typeof keys === 'string' ? [keys] : keys
      const out: Record<string, unknown> = {}
      for (const key of wanted) if (store.has(key)) out[key] = store.get(key)
      return out
    },
    set: async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) store.set(key, value)
    },
  })

  const globals = globalThis as unknown as Record<string, unknown>
  globals.browser = {
    storage: {
      local: areaFor(local),
      sync: areaFor(sync),
      onChanged: { addListener() {}, removeListener() {} },
    },
    runtime: { sendMessage: async () => undefined, openOptionsPage: async () => undefined },
    permissions: { contains: async () => false, request: async () => false },
  }

  return { area: local, sync }
}
