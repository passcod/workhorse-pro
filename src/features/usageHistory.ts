import { anchors } from '../content/anchors.ts'
import { el, ensureBefore, remove } from '../content/dom.ts'
import type { Context, Feature } from '../content/reconcile.ts'
import { subscriptionUsage } from '../data/workhorse.ts'
import { getUsageSamples, recordUsage } from '../localData.ts'
import {
  buildStack,
  markGeometry,
  ROWS,
  runoutAt,
  type MarkSegment,
  type Row,
} from '../lib/usageHistory.ts'

/**
 * Expand the sidebar's Claude usage bar into ten half-hourly bars.
 *
 * The app's bar states the position now and nothing about how it was reached, so
 * a window spent in twenty minutes and one spent steadily over four hours read
 * identically. The stack says when the allowance went.
 *
 * The app's own bar is hidden and all ten rows are drawn here, the bottom one in
 * its place. Redrawing the lot rather than building around it is what keeps the
 * clock mark one unbroken line: the app's notch is upright, and replacing only
 * that would mean anchoring an element inside the track that carries nothing
 * naming it.
 *
 * Nothing the app rendered is ever detached, and nothing is hidden with
 * `display`. The bar and the head row keep the space they occupy, because losing
 * it would move the bar and shift the navigation above — the one thing the
 * footer's fixed height exists to prevent. spec: UHST
 */

/** Where the extension records what the app's tooltip said, so it can go back. */
const TITLE_ORIGINAL = 'data-whp-usage-title'

const STACK_ID = 'usage-stack'

/** Matches the app's own bar, so the bottom row lands exactly on it. */
const ROW_H = 5
const GAP = 4
const PITCH = ROW_H + GAP
/** The nine rows above the bar, gaps between them included. */
const HISTORY_H = (ROWS - 1) * PITCH - GAP
/** The bar's own notch, and the mark once it is leaning. */
const NOTCH_W = 3
const MARK_W = 4

/** Claude's asterisk, as the app draws it beside the label. */
function claudeMark(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2.2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('whp-usage-asterisk')
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', 'M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4')
  svg.appendChild(path)
  return svg
}

/** A local wall-clock time, as the app renders the reset. */
function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function buildRow(index: number): HTMLDivElement {
  const row = el('div', 'whp-usage-row')
  row.style.setProperty('--i', String(index))
  row.appendChild(el('div', 'whp-usage-fill'))
  row.appendChild(el('div', 'whp-usage-mark'))
  return row
}

/**
 * The stack's fixed skeleton.
 *
 * A zero-height box sitting immediately before the bar, so its own bottom edge
 * *is* the bar's top edge — no measuring, and no positioning written onto the
 * app's block. The live row is placed back over the bar from there, and the nine
 * history rows grow upward out of a clipped window.
 *
 * Built once and updated in place. Rebuilding per pass would drop the hover that
 * opened it, and a pass runs on every change the app makes anywhere. spec: INJ
 */
function buildStackNode(): HTMLDivElement {
  const root = el('div', 'whp-usage')

  const head = el('div', 'whp-usage-head')
  const label = el('span', 'whp-usage-label')
  label.appendChild(claudeMark())
  label.appendChild(el('span', undefined, 'Claude usage'))
  head.appendChild(label)
  head.appendChild(el('span', 'whp-usage-value'))
  root.appendChild(head)

  const window_ = el('div', 'whp-usage-rows')
  const inner = el('div', 'whp-usage-rows-inner')
  for (let i = 0; i < ROWS - 1; i++) inner.appendChild(buildRow(i))
  window_.appendChild(inner)
  root.appendChild(window_)

  const live = buildRow(ROWS - 1)
  live.classList.add('whp-usage-live')
  // The reading the app's meter announced, which is hidden while this is on.
  live.setAttribute('role', 'meter')
  live.setAttribute('aria-valuemin', '0')
  live.setAttribute('aria-valuemax', '100')
  live.setAttribute('aria-label', 'Claude plan usage')
  root.appendChild(live)

  return root
}

/** Write a property only when it differs: a write is a mutation. spec: INJ */
function setVar(node: HTMLElement, name: string, value: string): void {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value)
}

function setClass(node: HTMLElement, name: string, on: boolean): void {
  if (node.classList.contains(name) !== on) node.classList.toggle(name, on)
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}

/**
 * Where a segment's line sits, and the shape of the mask over it.
 *
 * One angle for the whole segment, so every row's slice is a piece of the same
 * straight line rather than a mark of its own. The mask is measured across the
 * line, which is why it widens as the line runs shallower. spec: UHST
 */
function segmentGeometry(segment: MarkSegment, barWidth: number) {
  const topY = segment.from * PITCH
  const height = (segment.to - segment.from) * PITCH + ROW_H
  const span = (segment.bottomAt - segment.topAt) * barWidth
  const { widthPx, skewDeg } = markGeometry(span, height, MARK_W)
  return {
    widthPx,
    skewDeg,
    /** The line's centre at a stack-space y, in pixels across the bar. */
    at(y: number): number {
      const along = height <= 0 ? 1 : (y - topY) / height
      return (segment.topAt + (segment.bottomAt - segment.topAt) * along) * barWidth
    },
  }
}

function paintRow(row: HTMLElement, data: Row): void {
  // A row with nothing recorded for its window shows bare track. Not the same as
  // zero, which is a window that was open and untouched.
  setClass(row, 'whp-usage-blank', data.percent === null)
  setClass(row, 'whp-usage-over', data.over)
  setClass(row, 'whp-usage-past', data.past)
  const fill = row.querySelector<HTMLElement>('.whp-usage-fill')
  if (fill) setVar(fill, '--w', `${data.percent ?? 0}%`)
}

function paint(
  stack: HTMLElement,
  slot: HTMLElement,
  rows: Row[],
  segments: MarkSegment[],
  barWidth: number,
): void {
  // Document order is the nine history rows then the live one, which is the
  // order the stack reads in: oldest at the top, the present at the bottom.
  const nodes = stack.querySelectorAll<HTMLElement>('.whp-usage-row')

  for (const [index, data] of rows.entries()) {
    const node = nodes[index]
    if (node) paintRow(node, data)
  }

  const live = rows[ROWS - 1]
  const liveNode = nodes[ROWS - 1]
  if (live && liveNode && live.percent !== null) {
    liveNode.setAttribute('aria-valuenow', String(Math.round(live.percent)))
  }

  // The clock mark, one straight line per window. Its pivot is that window's own
  // clock, so closing folds every slice back into a single upright notch rather
  // than a staircase. spec: UHST
  for (const segment of segments) {
    const geometry = segmentGeometry(segment, barWidth)
    const pivot = segment.bottomAt * barWidth
    for (let index = segment.from; index <= segment.to; index++) {
      const mark = nodes[index]?.querySelector<HTMLElement>('.whp-usage-mark')
      if (!mark) continue
      const centre = geometry.at(index * PITCH + ROW_H)
      setVar(mark, '--x', `${centre.toFixed(2)}px`)
      setVar(mark, '--w', `${geometry.widthPx.toFixed(2)}px`)
      setVar(mark, '--a', `${geometry.skewDeg.toFixed(2)}deg`)
      // Closed: upright, at the notch's own width, gathered on the pivot.
      setVar(mark, '--dx', `${(pivot - centre).toFixed(2)}px`)
      setVar(mark, '--s', (NOTCH_W / geometry.widthPx).toFixed(4))
    }
  }

  // On the slot, because the backdrop that covers the navigation is drawn by the
  // slot's own pseudo-element and has to grow by the same amount.
  setVar(slot, '--whp-rows-h', `${HISTORY_H}px`)
  setVar(slot, '--whp-gap', `${GAP}px`)
  setVar(slot, '--whp-row-h', `${ROW_H}px`)
}

function paintHead(stack: HTMLElement, rows: Row[], resetsAt: number, now: number): void {
  const head = stack.querySelector<HTMLElement>('.whp-usage-head')
  const value = stack.querySelector<HTMLElement>('.whp-usage-value')
  if (!head || !value) return

  setClass(head, 'whp-usage-head-over', rows[ROWS - 1]?.over ?? false)

  // Once the allowance is expected to go before the window turns over, when it
  // runs out is the actionable time and the reset is not. spec: UHST
  const runout = runoutAt(getUsageSamples(), resetsAt, now)
  setText(value, runout === null ? `resets ${timeOf(resetsAt)}` : `runout est ${timeOf(runout)}`)
}

/**
 * Hide what the extension draws over, and silence the app's tooltip.
 *
 * `visibility` rather than `display` throughout: the bar and the head row keep
 * the space they occupy, so hiding them moves nothing. The tooltip is blanked
 * rather than removed, because React rewrites the attribute only when its own
 * computed value changes — an empty string it did not write survives its
 * re-renders, and the reconcile observer does not watch attributes.
 */
function takeOver(bar: HTMLElement, slot: HTMLElement): void {
  if (bar.style.visibility !== 'hidden') bar.style.visibility = 'hidden'
  setClass(slot, 'whp-usage-slot', true)

  const appHead = bar.previousElementSibling
  if (appHead instanceof HTMLElement && appHead.style.visibility !== 'hidden') {
    appHead.style.visibility = 'hidden'
  }

  // Recorded on the app's own element, not held aside: the app can rebuild this
  // block at any time, and a value kept in the extension would then be restored
  // onto the wrong node. Same reasoning as the wordmark's. spec: BRND
  if (!slot.hasAttribute(TITLE_ORIGINAL)) {
    slot.setAttribute(TITLE_ORIGINAL, slot.getAttribute('title') ?? '')
  }
  if (slot.getAttribute('title') !== '') slot.setAttribute('title', '')
}

function restore(bar: HTMLElement | null, slot: HTMLElement | null): void {
  if (bar) {
    bar.style.removeProperty('visibility')
    const appHead = bar.previousElementSibling
    if (appHead instanceof HTMLElement) appHead.style.removeProperty('visibility')
  }
  if (!slot) return
  setClass(slot, 'whp-usage-slot', false)
  if (slot.hasAttribute(TITLE_ORIGINAL)) {
    const original = slot.getAttribute(TITLE_ORIGINAL) ?? ''
    if (original === '') slot.removeAttribute('title')
    else slot.setAttribute('title', original)
    slot.removeAttribute(TITLE_ORIGINAL)
  }
}

/** Put everything back and take the stack off the page. */
function stand_down(bar: HTMLElement | null, slot: HTMLElement | null): void {
  restore(bar, slot)
  remove(STACK_ID)
}

export function usageHistory(): Feature {
  return {
    name: 'usageHistory',
    reconcile({ prefs }: Context) {
      const bar = anchors.usageBar()
      const slot = anchors.usageSlot()

      // Off, or nothing to expand. The app renders no meter when the five-hour
      // figure could not be read, so a footer stating a reason resolves here
      // exactly as a page with no footer does. spec: UHST
      if (!prefs.usageHistory || !bar || !slot) {
        stand_down(bar, slot)
        return
      }

      const usage = subscriptionUsage()
      const report = usage?.report ?? null
      const resetsAt = report?.resetsAt ? Date.parse(report.resetsAt) : Number.NaN
      if (report?.percent == null || !Number.isFinite(resetsAt)) {
        // A reading is on its way, or this one carries no figure. The app's own
        // bar stands until there is something better to draw.
        stand_down(bar, slot)
        return
      }

      const now = Date.now()
      // Stamped by the device where it can be. Falling back to our own clock
      // keeps recording working against a build that sends no stamp, at the cost
      // of bucketing by when we saw it rather than when it was taken.
      const readAt = usage?.readAt ? Date.parse(usage.readAt) : now
      recordUsage({
        window: resetsAt,
        at: Number.isFinite(readAt) ? readAt : now,
        percent: report.percent,
      })

      takeOver(bar, slot)

      // Measured, not assumed: the bar's width follows the sidebar's, and both
      // the mask's angle and its width across the line depend on it.
      const barWidth = bar.clientWidth
      if (barWidth <= 0) return

      const stack = ensureBefore(bar, STACK_ID, buildStackNode)
      const { rows, segments } = buildStack(getUsageSamples(), resetsAt, now)
      paint(stack, slot, rows, segments, barWidth)
      paintHead(stack, rows, resetsAt, now)
    },
  }
}
