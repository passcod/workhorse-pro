import { anchors } from '../content/anchors.ts'
import { ensure, el, remove } from '../content/dom.ts'
import type { Context, Feature } from '../content/reconcile.ts'
import { branchStatus } from '../data/workhorse.ts'
import { checkRuns } from '../data/github.ts'
import { checkRunState, parsePrUrl } from '../lib/github.ts'

/**
 * The checks that are not passing, by name.
 *
 * A count says a job failed; it does not say which one, and which one is what
 * you act on. Passed and skipped runs stay as counts — a full suite listed out
 * would bury the two rows worth reading. spec: STAT, GHUB
 */

const CONTAINER = 'named-checks'

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

      const interesting = runs.filter((run) => {
        const state = checkRunState(run)
        return state === 'failed' || state === 'running'
      })
      if (interesting.length === 0) {
        remove(CONTAINER)
        return
      }

      const container = ensure(content, CONTAINER, () => el('div'))
      container.replaceChildren(
        ...interesting.map((run) => {
          const row = el('div', 'whx-check')
          const state = checkRunState(run)
          const name = el(
            'span',
            state === 'failed' ? 'whx-check-name whx-amber' : 'whx-check-name',
            run.name,
          )
          row.appendChild(name)
          if (state === 'failed' && run.html_url) {
            const link = el('a', undefined, 'Logs')
            link.href = run.html_url
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
            row.appendChild(link)
          } else if (state === 'running') {
            row.appendChild(el('span', undefined, 'running'))
          }
          return row
        }),
      )
    },
  }
}
