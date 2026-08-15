import { anchors } from '../content/anchors.ts'
import { el, ensure, ensureAfter, remove } from '../content/dom.ts'
import { MARK, type Context, type Feature } from '../content/reconcile.ts'
import { baseFile, cardDetail, cardFiles, diffSideFailed } from '../data/workhorse.ts'
import { hunkHeader, unifiedDiff, type Hunk } from '../lib/unifiedDiff.ts'

/**
 * A Diff segment on the toggle above a markdown artefact, rendering the
 * artefact against its base-branch version as a unified diff.
 *
 * The app's own two views both contain the whole document, so finding what
 * moved in a spec that runs to pages costs a scroll through everything that did
 * not. This is the view that shows only the changed passages. spec: DIFF
 */

const SEGMENT = 'diff-segment'
const PANEL = 'diff-panel'
/** Marks the toggle while Diff is selected, so the app's own highlight yields. */
const TOGGLE_ACTIVE = 'data-whp-diff-active'
/** Marks the app's artefact view while the extension is hiding it. */
const HIDDEN = 'data-whp-diff-hidden'

/**
 * The artefact Diff is selected for, or null.
 *
 * Held per artefact and forgotten when another opens, which is how the app
 * treats its own choice of view. Held in memory for the page session, so a
 * reload is a fresh start.
 */
let activeFor: string | null = null

/**
 * The most recent pass's way of asking for another.
 *
 * The click that leaves Diff can change nothing in the page — picking File
 * while the app is already in File is the case — so the observer has no
 * mutation to react to and the panel would sit there until something else
 * moved. Kept from the last pass rather than from registration, which is when
 * the feature is built and has none.
 */
let scheduleNext: (() => void) | null = null

/** The artefact the last pass found open, for handlers that run between passes. */
let openPath: string | null = null

function isMarkdown(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.md')
}

/** Put the app's own view back wherever it was hidden. */
function unhideAppView(): void {
  for (const node of document.querySelectorAll<HTMLElement>(`[${HIDDEN}]`)) {
    node.style.display = ''
    node.removeAttribute(HIDDEN)
  }
}

function clearToggleMark(): void {
  for (const node of document.querySelectorAll(`[${TOGGLE_ACTIVE}]`)) {
    node.removeAttribute(TOGGLE_ACTIVE)
  }
}

/** Everything this feature added or changed, gone. */
function teardown(): void {
  remove(SEGMENT)
  remove(PANEL)
  clearToggleMark()
  unhideAppView()
}

function hunkNode(hunk: Hunk): HTMLElement {
  const root = el('div', 'whp-diff-hunk')
  root.appendChild(el('div', 'whp-diff-header', hunkHeader(hunk)))
  const body = el('div', 'whp-diff-body')
  for (const line of hunk.lines) {
    const sign = line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '
    const row = el('div', `whp-diff-line whp-diff-${line.kind}`)
    row.appendChild(el('span', 'whp-diff-sign', sign))
    // The text goes in its own element so an empty line still occupies one, and
    // so the sign is not part of what a selection copies as content.
    const text = el('span', 'whp-diff-text')
    if (line.segments) {
      // A changed line paired with its counterpart: draw the words that differ
      // apart from the words held in common, wrapping only the former.
      for (const segment of line.segments) {
        if (segment.changed) text.appendChild(el('span', 'whp-diff-word', segment.text))
        else text.appendChild(document.createTextNode(segment.text))
      }
    } else {
      text.textContent = line.text
    }
    row.appendChild(text)
    body.appendChild(row)
  }
  root.appendChild(body)
  return root
}

/** A one-line state: loading, failed, or nothing to show. */
function noticeNode(text: string): HTMLElement {
  return el('p', 'whp-diff-notice', text)
}

/**
 * What the panel should contain, as a string that changes whenever the render
 * would. Rebuilding a panel that has not changed would cost the reader their
 * scroll position on every pass, and a pass runs on every change the app makes.
 *
 * The two sides are hashed rather than embedded: this key is written to the
 * DOM, and an artefact is far too big to put there twice over.
 */
function renderKey(filePath: string, state: string, base: string, current: string): string {
  return `${filePath} ${state} ${base.length}:${hash(base)} ${current.length}:${hash(current)}`
}

/** Cheap content hash, enough to tell one version of a document from another. */
function hash(text: string): string {
  let value = 5381
  for (let i = 0; i < text.length; i += 1) {
    value = ((value << 5) + value + text.charCodeAt(i)) | 0
  }
  return (value >>> 0).toString(36)
}

export function rawDiff(): Feature {
  watchForAppSegmentClick()

  return {
    name: 'rawDiff',
    reconcile({ prefs, route, schedule }: Context) {
      scheduleNext = schedule
      openPath = route.filePath

      if (!prefs.rawDiff || !route.workspace || !route.card || !route.filePath) {
        activeFor = null
        teardown()
        return
      }

      // Opening another artefact leaves the view to the app, so a stale
      // selection never follows the reader to the next document.
      if (activeFor !== null && activeFor !== route.filePath) activeFor = null

      const filePath = route.filePath
      const toggle = anchors.artefactToggle()
      // No toggle means the app is offering no choice of view here — a mockup,
      // or an artefact it excludes — so neither does the extension.
      if (!toggle || !isMarkdown(filePath)) {
        activeFor = null
        teardown()
        return
      }

      const selected = activeFor === filePath
      const segment = ensure(toggle, SEGMENT, () => {
        const button = el('button', 'whp-segment', 'Diff')
        button.type = 'button'
        // The handler reads which artefact is open when it runs rather than
        // closing over the one open when it was built: the toggle can outlive
        // the artefact it was built for, and a captured path would then select
        // Diff for a document the reader has already left.
        button.addEventListener('click', () => {
          if (!openPath) return
          activeFor = activeFor === openPath ? null : openPath
          scheduleNext?.()
        })
        return button
      })
      segment.setAttribute('aria-pressed', String(selected))

      const bar = anchors.artefactHeaderBar()
      if (!selected || !bar) {
        remove(PANEL)
        clearToggleMark()
        unhideAppView()
        return
      }

      // Exactly one segment reads as selected. The app's React state is
      // untouched by the extension, so it still marks File or Changes as its
      // own selection; this is what makes that treatment yield while Diff is
      // the view being shown.
      toggle.setAttribute(TOGGLE_ACTIVE, '')

      const view = anchors.artefactView()
      if (view && !view.hasAttribute(HIDDEN)) {
        view.setAttribute(HIDDEN, '')
        view.style.display = 'none'
      }

      const panel = ensureAfter(bar, PANEL, () => el('div', 'whp-diff'))
      renderInto(panel, route.workspace, route.card, filePath)
    },
  }
}

/** Build the panel's contents, leaving them alone when nothing has changed. */
function renderInto(
  panel: HTMLElement,
  workspace: string,
  card: string,
  filePath: string,
): void {
  const detail = cardDetail(workspace, card)
  const cardUuid = detail?.card?.id ?? null
  const files = cardFiles(workspace, card)
  const base = cardUuid ? baseFile(cardUuid, filePath) : null

  const write = (key: string, build: () => Node[]) => {
    if (panel.dataset.whpKey === key) return
    panel.dataset.whpKey = key
    panel.replaceChildren(...build())
  }

  if (diffSideFailed(workspace, card, cardUuid, filePath)) {
    write(renderKey(filePath, 'failed', '', ''), () => [
      noticeNode('The diff could not be built: this card’s files could not be read.'),
    ])
    return
  }

  const entry = files?.initialFiles.find((file) => file.filePath === filePath) ?? null
  if (!files || !base || !entry) {
    write(renderKey(filePath, 'loading', '', ''), () => [noticeNode('Loading the diff…')])
    return
  }

  const beforeText = base.content ?? ''
  const afterText = entry.content

  write(renderKey(filePath, 'diff', beforeText, afterText), () => {
    const hunks = unifiedDiff(beforeText, afterText)
    if (hunks.length === 0) {
      return [noticeNode('No changes against the base branch.')]
    }
    return hunks.map(hunkNode)
  })
}

/**
 * Leave Diff when the reader picks one of the app's own segments.
 *
 * A click on File while already in File changes nothing about the app's state
 * and so moves nothing in the URL, but it is still the reader asking for that
 * view — which is why this watches the segments rather than the route.
 */
function watchForAppSegmentClick(): void {
  document.addEventListener(
    'click',
    (event) => {
      if (activeFor === null) return
      const target = event.target as Element | null
      if (!target || target.closest(`[${MARK}]`)) return
      const toggle = anchors.artefactToggle()
      if (!toggle) return
      for (const button of anchors.artefactToggleSegments()) {
        if (button === target || button.contains(target)) {
          activeFor = null
          scheduleNext?.()
          return
        }
      }
    },
    true,
  )
}

/** Test seam. */
export function resetRawDiff(): void {
  activeFor = null
  openPath = null
  scheduleNext = null
}

/** Test seam: select Diff for the artefact currently open. */
export function selectRawDiff(filePath: string): void {
  activeFor = filePath
}
