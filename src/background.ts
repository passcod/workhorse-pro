import { ext } from './ext.ts'
import { OPEN_OPTIONS_MESSAGE } from './lib/messages.ts'

/**
 * The background script exists for one reason: a content script cannot call
 * `runtime.openOptionsPage`, so the offer to grant device access asks for the
 * page to be opened from here. Nothing else lives here. spec: PKG
 */
ext.runtime.onMessage.addListener((message: unknown) => {
  const typed = message as { type?: unknown } | null
  if (typed?.type !== OPEN_OPTIONS_MESSAGE) return
  void ext.runtime.openOptionsPage()
})
