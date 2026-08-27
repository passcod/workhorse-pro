import { ext } from '../ext.ts'
import { BINDINGS, loadPrefs, setPref, SWITCHES, type Prefs } from '../prefs.ts'
import { bindingFromEvent, bindingProblem, formatBinding, isModifierKey } from '../lib/keys.ts'
import {
  clearHistory,
  clearStash,
  clearUsage,
  getHistory,
  getStash,
  getUsageSamples,
  loadLocalData,
} from '../localData.ts'
import { TOKEN_STATUS_KEY, verifyToken, type TokenStatus } from '../data/github.ts'

/**
 * The preferences page. spec: PREF
 */

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`missing #${id}`)
  return element as T
}

/**
 * Why a token-gated switch cannot do anything yet, or null when it can.
 *
 * The page verifies a token against GitHub as it is saved, so "verified" is
 * settled here rather than waiting on the feature to run — which means a
 * switch can be held closed until the token is known to work without that
 * being circular.
 */
function tokenBlocker(prefs: Prefs, status: TokenStatus): string | null {
  if (!prefs.githubToken) return 'Needs a GitHub token — add one below.'
  if (status === 'rejected') return 'GitHub refused the token below.'
  if (status !== 'ok') return 'Token not verified — save it again to retry.'
  return null
}

function renderSwitches(prefs: Prefs, status: TokenStatus): void {
  const host = byId('switches')
  host.replaceChildren(
    ...SWITCHES.map(({ key, label, detail, needsToken }) => {
      const blocker = needsToken ? tokenBlocker(prefs, status) : null

      const row = document.createElement('div')
      row.className = blocker ? 'switch switch-blocked' : 'switch'

      const input = document.createElement('input')
      input.type = 'checkbox'
      input.id = `switch-${key}`
      input.checked = prefs[key] === true
      input.disabled = blocker !== null
      input.addEventListener('change', () => {
        void setPref(key, input.checked as Prefs[typeof key])
      })

      const text = document.createElement('div')
      const name = document.createElement('label')
      name.htmlFor = input.id
      name.textContent = label
      const description = document.createElement('div')
      description.className = 'detail'
      description.textContent = detail
      text.append(name, description)

      if (blocker) {
        const note = document.createElement('div')
        note.className = 'detail blocked-note'
        note.textContent = blocker
        text.append(note)
      }

      row.append(input, text)
      return row
    }),
  )
}

/**
 * The binding editor: click to record, then press the combination.
 *
 * Capturing the press is the only honest way to do this — a text field would
 * make the user spell a binding in a notation they have to learn, and get
 * wrong. Escape leaves recording without changing anything, since a user who
 * opened it by accident needs a way out that is not a binding.
 */
function renderBindings(prefs: Prefs): void {
  const host = byId('bindings')
  host.replaceChildren(
    ...BINDINGS.map(({ key, label, detail }) => {
      const row = document.createElement('div')
      row.className = 'binding'

      const name = document.createElement('span')
      name.className = 'name'
      name.textContent = label

      const capture = document.createElement('button')
      capture.type = 'button'
      capture.className = 'binding-capture'
      capture.textContent = prefs[key] || 'Unbound'

      const problem = document.createElement('div')
      problem.className = 'problem'

      const stopRecording = () => {
        capture.dataset.recording = 'false'
        capture.textContent = prefs[key] || 'Unbound'
        document.removeEventListener('keydown', onKey, true)
      }

      function onKey(event: KeyboardEvent) {
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') {
          stopRecording()
          return
        }
        // A modifier on its own is the user still reaching for the key.
        if (isModifierKey(event.key)) return

        const text = formatBinding(bindingFromEvent(event))
        const complaint = bindingProblem(text)
        if (complaint) {
          problem.textContent = complaint
          capture.textContent = text
          return
        }
        problem.textContent = ''
        void setPref(key, text).then(refresh)
        stopRecording()
      }

      capture.addEventListener('click', () => {
        problem.textContent = ''
        capture.dataset.recording = 'true'
        capture.textContent = 'Press a combination…'
        document.addEventListener('keydown', onKey, true)
      })

      const clear = document.createElement('button')
      clear.type = 'button'
      clear.textContent = 'Unbind'
      clear.addEventListener('click', () => {
        void setPref(key, '').then(refresh)
      })

      const description = document.createElement('div')
      description.className = 'detail'
      description.textContent = detail

      row.append(name, capture, clear, description, problem)
      return row
    }),
  )
}

async function tokenStatus(): Promise<TokenStatus> {
  try {
    const stored = await ext.storage.local.get(TOKEN_STATUS_KEY)
    const value = stored[TOKEN_STATUS_KEY]
    return value === 'ok' || value === 'rejected' ? value : 'unknown'
  } catch {
    return 'unknown'
  }
}

function describeToken(token: string, status: TokenStatus): string {
  if (!token) return 'No token set — checks show counts only.'
  if (status === 'rejected') return 'GitHub refused this token.'
  if (status === 'ok') return 'Verified.'
  return 'Could not reach GitHub to check this token.'
}

/**
 * Re-read everything and repaint.
 *
 * The token's verdict is written by the content script the first time it calls
 * GitHub, so this page has to be able to catch up while it is open — otherwise
 * a token pasted here reads as unverified until the page is reopened.
 */
async function refresh(): Promise<void> {
  const prefs = await loadPrefs()
  const status = await tokenStatus()
  renderSwitches(prefs, status)
  renderBindings(prefs)
  const element = byId('token-status')
  element.textContent = describeToken(prefs.githubToken, status)
  element.dataset.state = prefs.githubToken ? status : 'unknown'
}

function describeData(): string {
  return (
    `${getHistory().length} messages, ${getStash().length} stashed, ` +
    `${getUsageSamples().length} usage readings`
  )
}

async function main(): Promise<void> {
  await loadLocalData()
  const prefs = await loadPrefs()

  byId('data-status').textContent = describeData()

  const token = byId<HTMLInputElement>('token')
  token.value = prefs.githubToken
  await refresh()

  // The content script records the token's verdict as it uses it, and the
  // switches follow from that, so repaint when either area changes.
  ext.storage.onChanged.addListener(() => void refresh())

  byId('save-token').addEventListener('click', () => {
    void (async () => {
      const value = token.value.trim()
      const status = byId('token-status')
      status.textContent = value ? 'Checking…' : ''
      status.dataset.state = 'unknown'
      await setPref('githubToken', value)
      // Settle the verdict here rather than leaving it to the first card the
      // user opens.
      await ext.storage.local.set({ [TOKEN_STATUS_KEY]: await verifyToken(value) })
      await refresh()
    })()
  })

  byId('clear-token').addEventListener('click', () => {
    void (async () => {
      token.value = ''
      await setPref('githubToken', '')
      await ext.storage.local.set({ [TOKEN_STATUS_KEY]: 'unknown' })
      await refresh()
    })()
  })

  byId('clear-history').addEventListener('click', () => {
    void clearHistory().then(() => {
      byId('data-status').textContent = describeData()
    })
  })

  byId('clear-stash').addEventListener('click', () => {
    void clearStash().then(() => {
      byId('data-status').textContent = describeData()
    })
  })

  byId('clear-usage').addEventListener('click', () => {
    void clearUsage().then(() => {
      byId('data-status').textContent = describeData()
    })
  })
}

void main()
