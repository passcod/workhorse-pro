import { context, build } from 'esbuild'
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises'

const TARGETS = ['firefox', 'chrome']
const watch = process.argv.includes('--watch')

// Entry points are bundled separately rather than code-split: MV3 cannot load
// module content scripts, so each must be one self-contained file.
const ENTRIES = {
  content: 'src/content/index.ts',
  page: 'src/page/observe.ts',
  background: 'src/background.ts',
  options: 'src/options/options.ts',
}

const STATIC = [
  ['src/content/styles.css', 'styles.css'],
  ['src/options/options.html', 'options.html'],
]

const pkg = JSON.parse(await readFile('package.json', 'utf8'))

/** The manifest's version is the package's, so there is one place to bump it. */
async function writeManifest(target) {
  const manifest = JSON.parse(await readFile(`manifest.${target}.json`, 'utf8'))
  manifest.version = pkg.version
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
