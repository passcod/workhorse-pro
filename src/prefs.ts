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
  /** Open the Checks and Review Hero rows, where the extension's readings sit. */
  autoExpandRows: boolean
  checksBreakdown: boolean
  reviewStats: boolean
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
  // Off by default: it opens two rows the app leaves closed, which is a
  // stronger change to the section's shape than the other two.
  autoExpandRows: false,
  checksBreakdown: true,
  reviewStats: true,
  namedChecks: true,
  inputHistory: true,
  composerStash: true,
  crossWorkspaceConversations: true,
  deviceOverlay: true,
  observeFetches: true,
  githubToken: '',
  scopeWide: false,
}

export interface SwitchInfo {
  key: keyof Prefs
  label: string
  detail: string
  /** Does nothing without a working GitHub token, so the page says so. */
  needsToken?: boolean
}

/** The switches the preferences page renders, in the order it renders them. */
export const SWITCHES: SwitchInfo[] = [
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
    key: 'autoExpandRows',
    label: 'Auto-expand Checks and Review Hero',
    detail:
      'Open both rows when a card is shown, so the readings below sit in view without a click.',
  },
  {
    key: 'checksBreakdown',
    label: 'Check breakdown',
    detail:
      'Passed, failed, running and skipped counts under the Checks row. Shown when that row is open.',
  },
  {
    key: 'namedChecks',
    label: 'Named checks',
    detail:
      'List the checks that failed or are still running, by name, with links to their logs.',
    needsToken: true,
  },
  {
    key: 'reviewStats',
    label: 'Review run stats',
    detail:
      'Run count and last run findings under the Review Hero row. Shown when that row is open.',
  },
  {
    key: 'inputHistory',
    label: 'Input history',
    detail:
      'Recall messages you have sent, across every conversation: Up for older, Down for newer. ' +
      'Recall starts when the caret is on the composer’s first line, so arrow keys still move ' +
      'the caret inside a multi-line draft. Your unsent text is held aside and comes back when ' +
      'you step past the newest message.',
  },
  {
    key: 'composerStash',
    label: 'Composer stash',
    detail:
      'Park drafts on a stack and bring them back later, across any conversation. ' +
      'Alt+Down stashes what is in the composer and clears it; Alt+Up brings the last one back. ' +
      'Popping into a composer that already has text swaps the two, so nothing is lost.',
  },
  {
    key: 'crossWorkspaceConversations',
    label: 'Cross-workspace conversations',
    detail:
      'Add a control to the sidebar’s Conversations header that widens the list to every ' +
      'workspace you can see. Each row’s card code takes its workspace’s colour.',
  },
  {
    key: 'deviceOverlay',
    label: 'Live device state',
    detail:
      'In the widened conversations list, show your paired device’s own view of rows whose card ' +
      'is checked out to it — those lag the shared record until a turn ends. Does nothing ' +
      'without a paired device, and needs the access granted below.',
  },
  {
    key: 'observeFetches',
    label: 'Reuse the app’s own responses',
    detail:
      'Read data the app has already fetched instead of fetching it again. Turning this off ' +
      'changes nothing you can see; the extension just makes its own requests.',
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
