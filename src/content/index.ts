import { loadPrefs, onPrefsChanged, type Prefs } from '../prefs.ts'
import { loadLocalData } from '../localData.ts'
import { Reconciler } from './reconcile.ts'
import { startObserving } from '../data/observed.ts'
import { subscribe } from '../data/store.ts'
import { autoExpand } from '../features/autoExpand.ts'
import { statRows } from '../features/statRows.ts'
import { namedChecks } from '../features/namedChecks.ts'
import { composerFeature } from '../features/composer.ts'
import { conversationScope } from '../features/conversationScope.ts'
import { workspaceOrder } from '../features/workspaceOrder.ts'
import { reportOnce } from '../log.ts'

/**
 * Content script entry point.
 *
 * Loads what the features need to read synchronously — preferences, history,
 * the stash — then registers each feature and starts the reconcile loop.
 * Everything after that is driven by the page changing, data arriving, or a
 * preference being toggled, all of which schedule a pass. spec: INJ
 */

let stopObserving: (() => void) | null = null

function applyObservation(prefs: Prefs): void {
  if (prefs.observeFetches && !stopObserving) {
    stopObserving = startObserving()
    return
  }
  if (!prefs.observeFetches && stopObserving) {
    stopObserving()
    stopObserving = null
  }
}

async function main(): Promise<void> {
  const prefs = await loadPrefs()
  await loadLocalData()

  const reconciler = new Reconciler(prefs)
  reconciler.register(autoExpand())
  reconciler.register(statRows())
  reconciler.register(namedChecks())
  reconciler.register(composerFeature())
  reconciler.register(conversationScope())
  reconciler.register(workspaceOrder())

  applyObservation(prefs)
  // Data landing means a pass can now render something it could not before.
  subscribe(reconciler.schedule)
  onPrefsChanged((next) => {
    applyObservation(next)
    reconciler.setPrefs(next)
  })

  reconciler.start()
}

main().catch((error: unknown) => reportOnce('bootstrap', error))
