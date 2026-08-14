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

function renderSwitches(prefs: Prefs): void {
  const host = byId('switches')
  host.replaceChildren(
    ...SWITCHES.map(({ key, label, detail }) => {
      const row = document.createElement('div')
      row.className = 'switch'

      const input = document.createElement('input')
      input.type = 'checkbox'
      input.id = `switch-${key}`
      input.checked = prefs[key] === true
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

async function refreshTokenStatus(prefs: Prefs): Promise<void> {
  const status = await tokenStatus()
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
  let prefs = await loadPrefs()

  renderSwitches(prefs)
  byId('data-status').textContent = describeData()

  const token = byId<HTMLInputElement>('token')
  token.value = prefs.githubToken
  await refreshTokenStatus(prefs)

  byId('save-token').addEventListener('click', () => {
    void (async () => {
      await setPref('githubToken', token.value.trim())
      // A new token has not been tried yet, so any previous verdict is stale.
      await ext.storage.local.set({ [TOKEN_STATUS_KEY]: 'unknown' })
      prefs = await loadPrefs()
      await refreshTokenStatus(prefs)
    })()
  })

  byId('clear-token').addEventListener('click', () => {
    void (async () => {
      token.value = ''
      await setPref('githubToken', '')
      await ext.storage.local.set({ [TOKEN_STATUS_KEY]: 'unknown' })
      prefs = await loadPrefs()
      await refreshTokenStatus(prefs)
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
