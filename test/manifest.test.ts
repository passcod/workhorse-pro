import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * The manifests carry text that is read where nobody on the project looks —
 * the add-on's page on AMO, and its entry in about:addons. Drift there is
 * invisible until someone else sees it, so it is pinned to the readme instead
 * of trusted to stay in step.
 */

function json(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

const firefox = json('manifest.firefox.json')
const chrome = json('manifest.chrome.json')

/** The readme's opening line: its title, then the first paragraph. */
function readmeSummary(): string {
  const lines = readFileSync('README.md', 'utf8').split('\n')
  const summary = lines.find((line) => line.trim() && !line.startsWith('#'))
  assert.ok(summary, 'the readme has no opening paragraph to describe the add-on with')
  return summary.trim()
}

test('the add-on describes itself the way the readme does', () => {
  // Not a feature list. Features change; this text is seen by people deciding
  // what the thing is.
  assert.equal(firefox.description, readmeSummary())
})

test('both manifests say the same thing', () => {
  for (const field of ['name', 'description', 'manifest_version']) {
    assert.equal(chrome[field], firefox[field], `${field} differs between manifests`)
  }
})

test('the extension id is the one installs are keyed by', () => {
  // Changing it orphans every install: they keep the old add-on and silently
  // never update. Worth a test that fails loudly rather than a comment.
  const gecko = (firefox.browser_specific_settings as { gecko: Record<string, unknown> }).gecko
  assert.equal(gecko.id, 'workhorse-pro@bes.au')
})

test('the update location is set, since without it nothing ever updates', () => {
  // Firefox reads this from the installed copy. A version signed without it
  // checks AMO, finds nothing listed, and sits there forever.
  const gecko = (firefox.browser_specific_settings as { gecko: Record<string, unknown> }).gecko
  assert.match(String(gecko.update_url), /^https:\/\/.+\/updates\.json$/)
})

test('the extension asks for no host it does not need', () => {
  const hosts = firefox.host_permissions as string[]
  assert.deepEqual(hosts, [
    'https://workhorse.bes.au/*',
    'http://localhost:3000/*',
    'https://api.github.com/*',
  ])
  assert.deepEqual(firefox.permissions, ['storage'])
  // Anything optional would be requested at runtime, which this no longer does.
  assert.equal(firefox.optional_host_permissions, undefined)
})
