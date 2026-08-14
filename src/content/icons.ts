/**
 * SVG the extension draws, reproducing the app's own glyphs.
 *
 * These are copies, not approximations: a row in the widened list sits in the
 * same sidebar as rows the app drew, so a status ring that is nearly the app's
 * reads as a bug rather than as a variation. spec: SCOP
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

function svg(size: number, viewBox: string): SVGSVGElement {
  const node = document.createElementNS(SVG_NS, 'svg')
  node.setAttribute('viewBox', viewBox)
  node.setAttribute('fill', 'none')
  node.setAttribute('width', String(size))
  node.setAttribute('height', String(size))
  node.setAttribute('aria-hidden', 'true')
  return node
}

function child(
  parent: SVGSVGElement,
  tag: string,
  attributes: Record<string, string>,
): void {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  parent.appendChild(node)
}

/** Legacy status names the app still maps onto current glyphs. */
function normaliseStatus(style: string | null): string {
  switch (style) {
    case 'specifying':
      return 'started'
    case 'implementing':
      return 'almost-done'
    case 'complete':
      return 'done'
    case null:
    case undefined:
      return 'not-started'
    default:
      return style
  }
}

/**
 * A card's status ring.
 *
 * The arc grows with progress and the whole thing fills in when done. A custom
 * colour replaces the state's built-in accent, except on `cancelled`, which is
 * system-controlled and always renders muted.
 */
export function statusIcon(style: string | null, colour: string | null, size = 11): SVGSVGElement {
  const node = svg(size, '0 0 14 14')
  const sw = '2.25'
  const accent = (fallback: string) => colour || fallback

  switch (normaliseStatus(style)) {
    case 'started':
      child(node, 'circle', { cx: '7', cy: '7', r: '6', stroke: 'var(--border-default)', 'stroke-width': sw })
      child(node, 'path', { d: 'M7 1 A6 6 0 0 1 13 7', stroke: accent('var(--amber)'), 'stroke-width': sw, 'stroke-linecap': 'round' })
      break
    case 'halfway':
      child(node, 'circle', { cx: '7', cy: '7', r: '6', stroke: 'var(--border-default)', 'stroke-width': sw })
      child(node, 'path', { d: 'M7 1 A6 6 0 0 1 7 13', stroke: accent('var(--blue)'), 'stroke-width': sw, 'stroke-linecap': 'round' })
      break
    case 'almost-done':
      child(node, 'circle', { cx: '7', cy: '7', r: '6', stroke: 'var(--border-default)', 'stroke-width': sw })
      child(node, 'path', { d: 'M7 1 A6 6 0 1 1 1 7', stroke: accent('var(--teal)'), 'stroke-width': sw, 'stroke-linecap': 'round' })
      break
    case 'done':
      child(node, 'circle', { cx: '7', cy: '7', r: '6', fill: accent('var(--green)') })
      child(node, 'path', { d: 'M4.5 7.2 L6.2 8.8 L9.5 5.5', stroke: 'white', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      break
    case 'cancelled':
      child(node, 'circle', { cx: '7', cy: '7', r: '6', stroke: 'var(--text-muted)', 'stroke-width': sw })
      child(node, 'path', { d: 'M5 5 L9 9 M9 5 L5 9', stroke: 'var(--text-muted)', 'stroke-width': sw, 'stroke-linecap': 'round' })
      break
    default:
      child(node, 'circle', {
        cx: '7', cy: '7', r: '6',
        stroke: accent('var(--border-default)'),
        'stroke-width': sw,
        'stroke-dasharray': '3 2.5',
      })
  }
  return node
}

/** A direct call to action: the agent is waiting on the user. */
export function bellIcon(size = 11): SVGSVGElement {
  const node = svg(size, '0 0 24 24')
  node.setAttribute('stroke', 'var(--accent)')
  node.setAttribute('stroke-width', '2')
  node.setAttribute('stroke-linecap', 'round')
  node.setAttribute('stroke-linejoin', 'round')
  child(node, 'path', { d: 'M10.268 21a2 2 0 0 0 3.464 0' })
  child(node, 'path', { d: 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326' })
  return node
}

/**
 * An ambient wait — queued for review, or a scheduled merge.
 *
 * The merge variant layers a green dot onto the same glyph rather than forking
 * the icon, exactly as the app does.
 */
export function hourglassIcon(merge: boolean, size = 11): SVGSVGElement {
  const node = svg(size, '0 0 24 24')
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', '2')
  node.setAttribute('stroke-linecap', 'round')
  node.setAttribute('stroke-linejoin', 'round')
  node.style.color = 'var(--text-muted)'
  child(node, 'path', { d: 'M5 22h14' })
  child(node, 'path', { d: 'M5 2h14' })
  child(node, 'path', { d: 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22' })
  child(node, 'path', { d: 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2' })
  if (merge) child(node, 'circle', { cx: '20', cy: '4', r: '4', fill: 'var(--green)', stroke: 'none' })
  return node
}

/** A standalone conversation, bound to no card. */
export function messageIcon(size = 11): SVGSVGElement {
  const node = svg(size, '0 0 24 24')
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', '2')
  node.setAttribute('stroke-linecap', 'round')
  node.setAttribute('stroke-linejoin', 'round')
  node.style.color = 'var(--text-muted)'
  child(node, 'path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22z' })
  return node
}

/** The dismiss cross. */
export function closeIcon(size = 11): SVGSVGElement {
  const node = svg(size, '0 0 24 24')
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', '2')
  node.setAttribute('stroke-linecap', 'round')
  node.setAttribute('stroke-linejoin', 'round')
  child(node, 'path', { d: 'M18 6 6 18' })
  child(node, 'path', { d: 'm6 6 12 12' })
  return node
}

/**
 * The scope control's glyph: four squares, each turned about its own centre
 * while the grid they sit on stays orthogonal. Coloured while the list is
 * widened, plain otherwise.
 */
export function workspaceScopeIcon(colours: readonly string[], size = 12): SVGSVGElement {
  const node = svg(size, '0 0 24 24')
  node.setAttribute('fill', 'currentColor')
  const squares = [
    { x: 4, y: 4, cx: 7, cy: 7 },
    { x: 14, y: 4, cx: 17, cy: 7 },
    { x: 4, y: 14, cx: 7, cy: 17 },
    { x: 14, y: 14, cx: 17, cy: 17 },
  ]
  squares.forEach((square, index) => {
    child(node, 'rect', {
      x: String(square.x),
      y: String(square.y),
      width: '6',
      height: '6',
      transform: `rotate(45 ${square.cx} ${square.cy})`,
      fill: colours[index] ?? 'currentColor',
    })
  })
  return node
}
