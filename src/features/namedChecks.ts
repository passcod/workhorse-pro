import { anchors } from '../content/anchors.ts'
import { ensureOrdered, el, remove, statRow } from '../content/dom.ts'
import type { Context, Feature } from '../content/reconcile.ts'
import { branchStatus } from '../data/workhorse.ts'
import { checkRuns } from '../data/github.ts'
import { formatDuration, parsePrUrl, rankChecks } from '../lib/github.ts'

/**
 * The jobs that failed or are still going, by name and by how long.
 *
 * These are *jobs*, where the breakdown above counts *workflows* — Workhorse
 * reads check suites, one per workflow run, while this reads check runs, one
 * per job. Three running workflows can be a hundred running jobs, so the two
 * are labelled rather than stacked and left to be reconciled by the reader.
 *
 * The duration is what makes the list worth its space: it says both that work
 * is happening and which of it has been happening too long. spec: STAT, GHUB
 */

const CONTAINER = 'named-checks'
/** After the breakdown, which counts the workflows these jobs belong to. */
const ORDER = 20

export function namedChecks(): Feature {
  return {
    name: 'namedChecks',
    reconcile({ prefs, route }: Context) {
      const content = anchors.checksContent()
      // Reading only while the row is expanded is what keeps a collapsed row
      // free: no anchor, no GitHub request. spec: GHUB
      if (!prefs.namedChecks || !prefs.githubToken || !content || !route.card || !route.workspace) {
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

      const ranked = rankChecks(runs, Date.now())
      if (ranked.shown.length === 0) {
        remove(CONTAINER)
        return
      }

      const container = ensureOrdered(content, CONTAINER, ORDER, () => el('div', 'whp-checks'))

      // Name the unit, so the workflow counts above and the job rows below
      // cannot be read as the same thing disagreeing.
      const summary = statRow('Jobs')
      const parts: string[] = []
      if (ranked.failed > 0) parts.push(`${ranked.failed} failed`)
      if (ranked.running > 0) parts.push(`${ranked.running} running`)
      summary.value.textContent = parts.join(', ')

      const children: Node[] = [summary.root]

      for (const { run, state, elapsed } of ranked.shown) {
        const row = el('div', 'whp-check')
        row.appendChild(
          el('span', state === 'failed' ? 'whp-check-name whp-amber' : 'whp-check-name', run.name),
        )

        const right = el('span', 'whp-check-right')
        // A job GitHub has not started has no elapsed time; saying "queued" is
        // more use than saying nothing, and more honest than saying "0s".
        right.appendChild(
          el('span', 'whp-check-time', elapsed === null ? 'queued' : formatDuration(elapsed)),
        )
        if (state === 'failed' && run.html_url) {
          const link = el('a', undefined, 'Logs')
          link.href = run.html_url
          link.target = '_blank'
          link.rel = 'noopener noreferrer'
          right.appendChild(link)
        }
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
