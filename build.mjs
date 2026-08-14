import { context, build } from 'esbuild'
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises'

const TARGETS = ['firefox', 'chrome']
const watch = process.argv.includes('--watch')

// Entry points are bundled separately rather than code-split: MV3 cannot load
// module content scripts, so each must be one self-contained file.
const ENTRIES = {
  content: 'src/content/index.ts',
  page: 'src/page/index.ts',
  options: 'src/options/options.ts',
}

const STATIC = [
  ['src/content/styles.css', 'styles.css'],
  ['src/options/options.html', 'options.html'],
  // Firefox takes SVG icons directly. Chrome does not — chromifying means
  // rasterising this to PNGs and adding an `icons` block to its manifest.
  ['src/icons/icon.svg', 'icon.svg'],
]

const pkg = JSON.parse(await readFile('package.json', 'utf8'))

/**
 * The version the build stamps into the manifests.
 *
 * Releases pass it in: the version lives in the git tags rather than in a
 * committed file, so that releasing does not mean pushing a bump back to the
 * branch that triggers releases. `package.json` is the local default, and the
 * starting point before the first tag exists.
 */
const version = process.env.VERSION || pkg.version

/** One version, stamped into both manifests, so the two cannot drift. */
async function writeManifest(target) {
  const manifest = JSON.parse(await readFile(`manifest.${target}.json`, 'utf8'))
  manifest.version = version
  await writeFile(
    `dist/${target}/manifest.json`,
    JSON.stringify(manifest, null, 2) + '\n',
  )
}

async function copyStatic(target) {
  for (const [from, to] of STATIC) {
    await copyFile(from, `dist/${target}/${to}`)
  }
}

async function buildTarget(target) {
  await mkdir(`dist/${target}`, { recursive: true })
  await writeManifest(target)
  await copyStatic(target)

  const options = {
    entryPoints: Object.fromEntries(
      Object.entries(ENTRIES).map(([name, path]) => [name, path]),
    ),
    outdir: `dist/${target}`,
    bundle: true,
    format: 'iife',
    target: target === 'firefox' ? 'firefox140' : 'chrome111',
    sourcemap: watch ? 'inline' : false,
    minify: !watch,
    logLevel: 'info',
    define: { __TARGET__: JSON.stringify(target) },
  }

  if (watch) {
    const ctx = await context(options)
    await ctx.watch()
    return
  }
  await build(options)
}

if (!watch) await rm('dist', { recursive: true, force: true })
for (const target of TARGETS) await buildTarget(target)
if (watch) console.log('watching…')
