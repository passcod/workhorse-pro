import { ext } from '../ext.ts'
import { loadPrefs, setPref, SWITCHES, type Prefs } from '../prefs.ts'
import { clearHistory, clearStash, getHistory, getStash, loadLocalData } from '../localData.ts'
import { TOKEN_STATUS_KEY, type TokenStatus } from '../data/github.ts'
import { INSTANCE_URL_KEY, requestDeviceAccess } from '../data/device.ts'

/**
 * The preferences page.
 *
 * Also where host access to a paired device is granted: a permission request
 * must come from a click on an extension's own page, which is the one thing a
 * content script cannot supply. spec: PREF, PKG
 */

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`missing #${id}`)
  return element as T
}

/**
 * Why a token-gated switch cannot do anything yet, or null when it can.
 *
 * A rejected token is treated as blocking because the feature genuinely cannot
 * work until it is replaced. A token that has simply not been used yet is not:
 * greying that out would prevent the very request that would verify it.
 */
function tokenBlocker(prefs: Prefs, status: TokenStatus): string | null {
  if (!prefs.githubToken) return 'Needs a GitHub token — add one below.'
  if (status === 'rejected') return 'GitHub rejected the token below.'
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
  if (status === 'rejected') return 'GitHub rejected this token.'
  if (status === 'ok') return 'Working.'
  return 'Saved. Not used yet.'
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
  const element = byId('token-status')
  element.textContent = describeToken(prefs.githubToken, status)
  element.dataset.state = prefs.githubToken ? status : 'unknown'
}

/** The paired device's address, if the app has told us about one. */
async function pairedInstanceUrl(): Promise<string | null> {
  try {
    const stored = await ext.storage.local.get(INSTANCE_URL_KEY)
    const value = stored[INSTANCE_URL_KEY]
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

function describeData(): string {
  return `${getHistory().length} messages, ${getStash().length} stashed`
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
      await setPref('githubToken', token.value.trim())
      // A new token has not been tried yet, so any previous verdict is stale.
      await ext.storage.local.set({ [TOKEN_STATUS_KEY]: 'unknown' })
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

  const deviceStatus = byId('device-status')
  const instanceUrl = await pairedInstanceUrl()
  deviceStatus.textContent = instanceUrl
    ? 'A device is paired.'
    : 'No paired device seen yet — open Workhorse first.'

  byId('grant-device').addEventListener('click', () => {
    void (async () => {
      const url = await pairedInstanceUrl()
      if (!url) {
        deviceStatus.textContent = 'No paired device seen yet — open Workhorse first.'
        return
      }
      const granted = await requestDeviceAccess(url)
      deviceStatus.textContent = granted ? 'Access granted.' : 'Access declined.'
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
}

void main()
