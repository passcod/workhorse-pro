const reported = new Set<string>()

/**
 * Report a failure once per page session.
 *
 * A reconcile pass runs on every DOM change, so a feature that throws would
 * otherwise fill the console with the same trace hundreds of times and bury
 * anything else. The first occurrence is the informative one (spec: INJ).
 */
export function reportOnce(scope: string, error: unknown): void {
  if (reported.has(scope)) return
  reported.add(scope)
  console.warn(`[workhorse-pro] ${scope}`, error)
}

/** Test seam: forget what has been reported. */
export function resetReported(): void {
  reported.clear()
}
