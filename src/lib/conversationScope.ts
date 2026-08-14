/**
 * How long the conversations list runs while widened, and how deep the fetch
 * behind it goes. Copied from the app so the widened list is the same length
 * there and here. spec: SCOP
 */

/** Rows shown before **Older** while the list spans every workspace. */
export const WIDENED_ROWS = 8

/**
 * Sessions fetched to fill the list. Larger than the row count because rows
 * collapse to one per card and one per project, so a run of conversations on
 * the same card yields a single row.
 */
export const WIDENED_FETCH = 20

/** Pages requested by **Older** and **Load more**. */
export const PAGE_SIZE = 50

/** Ceiling on paged-in rows, so an endless list cannot grow without bound. */
export const MAX_EXTRA = 200
