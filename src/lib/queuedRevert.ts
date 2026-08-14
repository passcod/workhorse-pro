/**
 * Reverting a queued message into the composer.
 *
 * The pure part of the feature: pulling the message's text back out of the
 * markup the app rendered it into. spec: QRV
 */

/**
 * The text of a rendered queued message, close to what the user typed.
 *
 * The app renders the message as markdown, so the exact source cannot be
 * recovered — but joining the top-level blocks with blank lines brings back the
 * paragraph structure of an ordinary prompt, which is what a reverted message
 * is. Descends through the single wrapper the message body puts around the
 * rendered markdown, then joins its block children; falls back to the whole
 * text when there are none.
 */
export function renderedMessageText(body: Element): string {
  let host = body
  while (
    host.children.length === 1 &&
    host.firstElementChild!.children.length > 0
  ) {
    host = host.firstElementChild!
  }
  const blocks = [...host.children]
  const source = blocks.length > 0 ? blocks : [host]
  return source
    .map((node) => (node.textContent ?? '').trim())
    .filter((text) => text.length > 0)
    .join('\n\n')
    .trim()
}
