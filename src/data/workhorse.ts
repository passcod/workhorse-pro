import { failed, read } from './store.ts'
import {
  baseFileKey,
  branchStatusKey,
  cardDetailKey,
  cardFilesKey,
} from './keys.ts'
import type {
  BaseFileData,
  BranchStatusData,
  CardDetailData,
  CardFilesData,
} from './types.ts'

/**
 * Reads against the app's own endpoints. Same-origin, so the session cookie
 * travels without the extension holding any credential. spec: DATA
 */

/** Matches the staleness the app applies to branch status, and its poll. */
const BRANCH_STATUS = { ttl: 10_000, poll: 15_000 }
/** The app polls the file listing tightly to keep the sidebar live during a turn. */
const CARD_FILES = { ttl: 5_000, poll: 10_000 }
/** A card's own id never changes, so this is read once and kept. */
const CARD_DETAIL = { ttl: 300_000 }
/** The base branch moves only on a merge, which the card page does not sit through. */
const BASE_FILE = { ttl: 60_000, poll: 120_000 }

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return (await response.json()) as T
}

export function branchStatus(workspace: string, card: string): BranchStatusData | null {
  const path =
    `/api/card-branch-status?cardId=${encodeURIComponent(card)}` +
    `&workspace=${encodeURIComponent(workspace)}`
  return read<BranchStatusData>(
    branchStatusKey(workspace, card),
    () => getJson<BranchStatusData>(path),
    BRANCH_STATUS,
  )
}

/**
 * The card's artefacts with their content on the card's branch — the "after"
 * side of the raw diff. spec: DIFF
 */
export function cardFiles(workspace: string, card: string): CardFilesData | null {
  const path =
    `/api/card-files?cardId=${encodeURIComponent(card)}` +
    `&workspace=${encodeURIComponent(workspace)}`
  return read<CardFilesData>(
    cardFilesKey(workspace, card),
    () => getJson<CardFilesData>(path),
    CARD_FILES,
  )
}

/** Read for the card's own id, which the base-file read is keyed by. */
export function cardDetail(workspace: string, card: string): CardDetailData | null {
  const path =
    `/api/card-detail?cardId=${encodeURIComponent(card)}` +
    `&workspace=${encodeURIComponent(workspace)}`
  return read<CardDetailData>(
    cardDetailKey(workspace, card),
    () => getJson<CardDetailData>(path),
    CARD_DETAIL,
  )
}

/**
 * An artefact's content on the base branch — the "before" side.
 *
 * Takes the card's own id rather than its identifier, which is what the
 * endpoint is keyed by. Peeking a pull request is not asked for here, so the
 * comparison is always against the base branch.
 */
export function baseFile(cardId: string, filePath: string): BaseFileData | null {
  const path =
    `/api/base-file?cardId=${encodeURIComponent(cardId)}` +
    `&filePath=${encodeURIComponent(filePath)}`
  return read<BaseFileData>(
    baseFileKey(cardId, filePath),
    () => getJson<BaseFileData>(path),
    BASE_FILE,
  )
}

/** Whether either side of the diff has failed outright rather than not landed. */
export function diffSideFailed(
  workspace: string,
  card: string,
  cardId: string | null,
  filePath: string,
): boolean {
  if (failed(cardFilesKey(workspace, card))) return true
  if (failed(cardDetailKey(workspace, card))) return true
  return cardId !== null && failed(baseFileKey(cardId, filePath))
}

/**
 * Mint a bearer for the user's paired device. Returns null when there is no
 * device or no session, which are both ordinary states rather than errors.
 */
export async function deviceToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/local-mode/bearer-token', {
      method: 'POST',
      credentials: 'same-origin',
    })
    if (!response.ok) return null
    const data = (await response.json()) as { token?: string }
    return data.token ?? null
  } catch {
    return null
  }
}
