/**
 * Composer stash logic — a stack of parked drafts, newest last. No DOM or
 * storage dependency. spec: STSH
 */

export const MAX_STASH = 50

export interface StashResult {
  stack: readonly string[]
  /** What the composer should hold afterwards. */
  composer: string
  /** False when the action was a no-op and nothing should be written. */
  changed: boolean
}

/**
 * Push the composer's text onto the stack, leaving the composer holding
 * whatever it held before that text.
 *
 * `previous` is empty in the ordinary case. During recall it is the user's own
 * draft, held aside when recall began — so pushing a recalled message hands
 * the draft back, which is what setting an old message aside in order to keep
 * writing should mean. One rule covers both. spec: STSH
 */
export function pushStash(
  stack: readonly string[],
  text: string,
  previous = '',
  max = MAX_STASH,
): StashResult {
  if (!text.trim()) return { stack, composer: text, changed: false }
  const next = [...stack, text]
  return {
    stack: next.length > max ? next.slice(next.length - max) : next,
    composer: previous,
    changed: true,
  }
}

/**
 * Take the top entry off the stack and into the composer.
 *
 * When the composer already holds text, that text is pushed first, so the two
 * exchange places and neither is lost. Pushing and popping in turn therefore
 * returns the composer to where it started.
 */
export function popStash(stack: readonly string[], text = ''): StashResult {
  if (stack.length === 0) return { stack, composer: text, changed: false }
  const top = stack[stack.length - 1]!
  const rest = stack.slice(0, -1)
  if (text.trim()) return { stack: [...rest, text], composer: top, changed: true }
  return { stack: rest, composer: top, changed: true }
}

/**
 * The preview shown as the composer's placeholder while something is stashed:
 * the first line of the most recent draft, so what a restore would bring back
 * is visible before restoring it. Empty when the stack is empty. spec: STSH
 */
export function stashPlaceholder(stack: readonly string[]): string {
  const top = stack[stack.length - 1]
  if (top === undefined) return ''
  const newline = top.indexOf('\n')
  return newline === -1 ? top : top.slice(0, newline)
}
