/**
 * Message names shared between worlds and scripts.
 *
 * Held apart from the modules that use them because importing a name from a
 * module with side effects would drag those effects into the importing bundle
 * — the page-world observer installs its `fetch` wrapper on import, which the
 * content script must not do.
 */

/** Page world → content script: a response the app fetched. */
export const OBSERVED_MESSAGE = 'workhorse-expert:observed'

/** Content script → background: open the preferences page. */
export const OPEN_OPTIONS_MESSAGE = 'workhorse-expert:open-options'
