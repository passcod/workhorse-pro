/**
 * Message names shared between worlds and scripts.
 *
 * Held apart from the modules that use them because importing a name from a
 * module with side effects would drag those effects into the importing bundle
 * — the page-world observer installs its `fetch` wrapper on import, which the
 * content script must not do.
 */

/** Page world → content script: a response the app fetched. */
export const OBSERVED_MESSAGE = 'workhorse-pro:observed'

/** Content script → page world: navigate without reloading. */
export const NAVIGATE_MESSAGE = 'workhorse-pro:navigate'

/**
 * Marks the document while the page-world script is installed.
 *
 * The content script cannot see anything the page world declares — separate
 * worlds, separate globals — but both see the DOM. Without this the content
 * script would have to swallow a click and hope something on the other side
 * was listening, and a click that reached nothing would be worse than a slow
 * one.
 */
export const PAGE_WORLD_FLAG = 'whpPage'
