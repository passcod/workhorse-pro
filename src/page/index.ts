/**
 * The page-world entry point.
 *
 * Runs in the application's own context at document start, where it can see
 * the app's `fetch` and React's tree — neither of which is reachable from the
 * isolated world the rest of the extension lives in.
 */
import './observe.ts'
