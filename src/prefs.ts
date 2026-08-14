import { ext } from './ext.ts'
import { reportOnce } from './log.ts'

/**
 * Everything held in the synced area: the feature switches, the GitHub token,
 * and the conversation scope control's own state.
 *
 * Synced rather than device-local because these are small and are the same
 * wherever the user works — including the token, which is entered once rather
 * than per browser (spec: PREF, GHUB). Input history and stashed drafts are
 * deliberately not here: they are working state at a scale the synced area is
 * not sized for. They live in `localData.ts`.
 */
export interface Prefs {
  autoExpandPrDetail: boolean
  autoExpandBranchDropdown: boolean
  checksBreakdown: boolean
  reviewStats: boolean
  effectiveBaseBranch: boolean
  namedChecks: boolean
  inputHistory: boolean
  composerStash: boolean
  crossWorkspaceConversations: boolean
  deviceOverlay: boolean
  observeFetches: boolean
  /** Read-only, checks-scoped. Empty when the user has not supplied one. */
  githubToken: string
  /** Whether the conversations list is currently widened past the active workspace. */
  scopeWide: boolean
}

export const PREF_DEFAULTS: Prefs = {
  autoExpandPrDetail: true,
  autoExpandBranchDropdown: true,
  checksBreakdown: true,
  reviewStats: true,
  effectiveBaseBranch: true,
  namedChecks: true,
  inputHistory: true,
  composerStash: true,
  crossWorkspaceConversations: true,
  deviceOverlay: true,
  observeFetches: true,
  githubToken: '',
  scopeWide: false,
}

/** The switches the preferences page renders, in the order it renders them. */
export const SWITCHES: { key: keyof Prefs; label: string; detail: string }[] = [
  {
    key: 'autoExpandPrDetail',
    label: 'Auto-expand pull request detail',
    detail: 'Open the pull request section when a card is shown.',
  },
  {
    key: 'autoExpandBranchDropdown',
    label: 'Auto-expand branch dropdown',
    detail: 'Open the branch diagnostics when a card is shown.',
  },
  {
    key: 'checksBreakdown',
    label: 'Check breakdown',
    detail: 'Passed, failed, running and skipped counts under the Checks row.',
  },
  {
    key: 'namedChecks',
    label: 'Named checks',
    detail: 'List failing and running checks by name. Needs a GitHub token.',
  },
  {
    key: 'reviewStats',
    label: 'Review run stats',
    detail: 'Run count and last run findings under the Review Hero row.',
  },
  {
    key: 'effectiveBaseBranch',
    label: 'Effective base branch',
    detail: 'The branch a card is really cut from, when it differs from its label.',
  },
  {
    key: 'inputHistory',
    label: 'Input history',
    detail: 'Recall previously sent messages with the arrow keys.',
  },
  {
    key: 'composerStash',
    label: 'Composer stash',
    detail: 'Park drafts on a stack and bring them back later.',
  },
  {
    key: 'crossWorkspaceConversations',
    label: 'Cross-workspace conversations',
    detail: 'Widen the sidebar list past the active workspace.',
  },
  {
    key: 'deviceOverlay',
    label: 'Live device state',
    detail: 'Show the paired device’s view of conversations it is running.',
  },
  {
    key: 'observeFetches',
    label: 'Reuse the app’s own responses',
    detail: 'Read data the app has already fetched instead of fetching it again.',
  },
]

function withDefaults(stored: Record<string, unknown>): Prefs {
  const out = { ...PREF_DEFAULTS }
  for (const key of Object.keys(PREF_DEFAULTS) as (keyof Prefs)[]) {
    const value = stored[key]
    if (typeof value === typeof PREF_DEFAULTS[key]) {
      // Narrowing per key would need a discriminated map for two value types;
      // the typeof check above is the guard, and the cast carries it across.
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  return out
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const stored = await ext.storage.sync.get(Object.keys(PREF_DEFAULTS))
    return withDefaults(stored)
  } catch (error) {
    // An unavailable storage area must not stop the extension working — it
    // falls back to defaults, which is every feature on (spec: WXP).
    reportOnce('prefs.load', error)
    return { ...PREF_DEFAULTS }
  }
}

export async function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): Promise<void> {
  try {
    await ext.storage.sync.set({ [key]: value })
  } catch (error) {
    reportOnce('prefs.set', error)
  }
}

/** Call `fn` whenever any synced preference changes, with the full new set. */
export function onPrefsChanged(fn: (prefs: Prefs) => void): () => void {
  const listener = (
    changes: Record<string, browser.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'sync') return
    if (!Object.keys(changes).some((key) => key in PREF_DEFAULTS)) return
    void loadPrefs().then(fn)
  }
  ext.storage.onChanged.addListener(listener)
  return () => ext.storage.onChanged.removeListener(listener)
}
