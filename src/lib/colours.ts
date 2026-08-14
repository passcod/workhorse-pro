/**
 * Workspace colours for the widened conversations list.
 *
 * Reproduces the app's own derivation exactly, so a workspace carries the same
 * colour in the extension's list as it does anywhere the app colours it. The
 * colours belong to the reader's own sidebar: they come from the set of
 * workspaces that reader can see, so the same workspace can read differently
 * for two people. spec: SCOP
 */

/**
 * The arc of OKLCH hues the design system allows, from pink through red,
 * orange, mustard, olive, green and teal to navy. The rest of the wheel is
 * violet and magenta, which the design system rules out.
 */
const HUE_START = 0
const HUE_END = 265

/** One lightness and chroma across every hue, so no workspace reads louder. */
const LIGHTNESS = 0.52
const CHROMA = 0.16

/** FNV-1a, 32-bit. Any stable hash does; this one is short and dependency-free. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function hueAt(index: number, count: number): number {
  if (count <= 1) return HUE_START
  return HUE_START + ((HUE_END - HUE_START) * index) / (count - 1)
}

function colourAt(index: number, count: number): string {
  return `oklch(${LIGHTNESS} ${CHROMA} ${hueAt(index, count).toFixed(1)})`
}

/**
 * Assign each workspace a colour, keyed by lower-cased name.
 *
 * Hues are spread evenly across the allowed arc over the number of
 * workspaces and each takes its own slot, so no two collide — which hashing
 * straight into N buckets could not guarantee. Which slot a workspace lands in
 * comes from hashing its name, so the ordering holds between visits rather
 * than following however the list happened to be sorted.
 */
export function workspaceColours(names: readonly string[]): Map<string, string> {
  const unique = [...new Set(names.map((n) => n.toLowerCase()))]
  const ordered = unique
    .map((name) => ({ name, key: hash(name) }))
    .sort((a, b) => a.key - b.key || a.name.localeCompare(b.name))
  return new Map(ordered.map((w, i) => [w.name, colourAt(i, ordered.length)]))
}

/**
 * The four colours the scope control's glyph carries, sampled evenly from the
 * assigned set so the control reads as a miniature of the colouring it turns on.
 */
export function scopeGlyphColours(colours: readonly string[]): string[] {
  const n = colours.length
  if (n === 0) return []
  return [0, 1, 2, 3].map((i) => colours[n >= 4 ? Math.round((i * n) / 4) : i % n]!)
}
