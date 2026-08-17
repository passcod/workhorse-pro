import { anchors } from '../content/anchors.ts'
import { ensureOrdered, el, remove, statRow } from '../content/dom.ts'
import type { Context, Feature } from '../content/reconcile.ts'
import { branchStatus } from '../data/workhorse.ts'
import { checkRuns, workflowNames } from '../data/github.ts'
import {
  checkDisplayName,
  checkNameParts,
  formatDuration,
  parsePrUrl,
  rankChecks,
} from '../lib/github.ts'

/**
 * The jobs that failed or are still going, by name and by how long.
 *
 * These are *jobs*, where the app's own Latest run breakdown counts
 * *workflows* — Workhorse reads check suites, one per workflow run, while this
 * reads check runs, one per job. Three running workflows can be a hundred
 * running jobs, so the two are labelled rather than stacked and left to be
 * reconciled by the reader.
 *
 * The duration is what makes the list worth its space: it says both that work
 * is happening and which of it has been happening too long. spec: GHUB
 */

const CONTAINER = 'named-checks'
/** After the app's own readings inside the row. */
const ORDER = 20

export function namedChecks(): Feature {
  return {
    name: 'namedChecks',
    reconcile({ prefs, route }: Context) {
      // The jobs sit inside the Checks row's own disclosure, alongside the
      // readings the app puts there. That content block exists only while the
      // pull request detail is expanded and the row itself is open, so a
      // collapsed either way resolves nothing: no anchor, no GitHub request.
      // That is what keeps a section not on screen free. spec: GHUB
      const checksContent = anchors.checksContent()
      if (
        !prefs.namedChecks ||
        !prefs.githubToken ||
        !checksContent ||
        !route.card ||
        !route.workspace
      ) {
        remove(CONTAINER)
        return
      }

      const status = branchStatus(route.workspace, route.card)
      const pr = parsePrUrl(status?.prUrl)
      const runs = checkRuns(pr, prefs.githubToken)
      if (!runs) {
        remove(CONTAINER)
        return
      }

      // Named separately from the runs themselves: a check run carries the
      // suite it belongs to, but only a workflow run carries the workflow's
      // name. Empty when it cannot be read, which costs the prefix and nothing
      // else.
      const workflows = workflowNames(pr, prefs.githubToken)
      const ranked = rankChecks(runs, Date.now())
      if (ranked.shown.length === 0) {
        remove(CONTAINER)
        return
      }

      const container = ensureOrdered(checksContent, CONTAINER, ORDER, () => el('div', 'whp-checks'))

      // Name the unit, so the workflow counts above and the job rows below
      // cannot be read as the same thing disagreeing.
      const summary = statRow('Jobs')
      const parts: string[] = []
      if (ranked.failed > 0) parts.push(`${ranked.failed} failed`)
      if (ranked.running > 0) parts.push(`${ranked.running} running`)
      summary.value.textContent = parts.join(', ')

      const children: Node[] = [summary.root]

      for (const { run, state, elapsed } of ranked.shown) {
        // The whole row is the link: every job has a page on GitHub, and
        // wanting it is the reason to read this list at all — for a failure to
        // see why, and for a long-running one to see what it is stuck on.
        const row = run.html_url ? el('a', 'whp-check') : el('div', 'whp-check')
        if (run.html_url && row instanceof HTMLAnchorElement) {
          row.href = run.html_url
          row.target = '_blank'
          row.rel = 'noopener noreferrer'
        }
        const { workflow, job } = checkNameParts(run, workflows)
        const label = el(
          'span',
          state === 'failed' ? 'whp-check-name whp-amber' : 'whp-check-name',
        )
        // The workflow gives way before the job does: the job is what tells
        // one row from another, and truncating from the end would take it.
        if (workflow) label.appendChild(el('span', 'whp-check-workflow', `${workflow} /`))
        label.appendChild(el('span', 'whp-check-job', job))
        // Whatever the width takes, the whole name is still readable here.
        label.title = checkDisplayName(run, workflows)
        row.appendChild(label)

        const right = el('span', 'whp-check-right')
        // A job GitHub has not started has no elapsed time; saying "queued" is
        // more use than saying nothing, and more honest than saying "0s".
        right.appendChild(
          el('span', 'whp-check-time', elapsed === null ? 'queued' : formatDuration(elapsed)),
        )
        row.appendChild(right)
        children.push(row)
      }

      if (ranked.hidden > 0) {
        const more = el('div', 'whp-check whp-check-more')
        more.appendChild(el('span', 'whp-check-name', `${ranked.hidden} more`))
        children.push(more)
      }

      container.replaceChildren(...children)
    },
  }
}
