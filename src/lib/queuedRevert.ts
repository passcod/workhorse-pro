/**
 * Reverting a queued message into the composer.
 *
 * The pure parts of the feature: the rule for folding the message's text in
 * above any draft already in the composer, and pulling that text back out of
 * the rendered message. spec: QRV
 */

/**
 * Fold reverted text into the composer above whatever it already holds.
 *
 * Matches the app's own behaviour when a Stop returns undelivered queued text
 * to the composer: the returned text goes above the existing draft, separated
 * by a blank line, so a draft in progress is not lost.
 */
export function foldReturnedText(existing: string, returned: string): string {
  return existing.trim() ? `${returned}\n\n${existing}` : returned
}

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
