/**
 * Write the update manifest Firefox polls for a self-distributed add-on.
 *
 * Without this — and without the matching `update_url` in the extension's own
 * manifest — Firefox asks addons.mozilla.org whether a newer *listed* version
 * exists, finds nothing because the add-on is unlisted, and never updates.
 * There is no error; installs simply stay where they are.
 *
 * Usage: node scripts/updates-json.mjs <version> <xpi-url> <out-file>
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const [version, url, out] = process.argv.slice(2)
if (!version || !url || !out) {
  console.error('usage: updates-json.mjs <version> <xpi-url> <out-file>')
  process.exit(1)
}
if (!url.startsWith('https://')) {
  // Firefox refuses a plain-HTTP update link, and would do so silently.
  console.error(`update_link must be https, got: ${url}`)
  process.exit(1)
}

const manifest = {
  addons: {
    'workhorse-pro@bes.au': {
      updates: [{ version, update_link: url }],
    },
  },
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(`wrote ${out} for ${version}`)
