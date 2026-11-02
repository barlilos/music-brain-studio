/**
 * The words the graph prints beside its shapes. Counts, never percentages.
 *
 * Done is always written first and as an absolute number, so discovering more
 * work can only make the *open* number grow — it never makes finished work look
 * smaller (handoff 003, "discovery is progress").
 */

import type { ProgressSummary, RegionState } from '@shared/model/progress'
import { openCount } from '@shared/model/progress'

/** `18 done · 28 open`, or `nothing yet` for an empty branch. */
export function countWords(summary: ProgressSummary | undefined): string {
  if (summary === undefined) return 'nothing yet'
  const open = openCount(summary)
  const parts: string[] = []
  if (summary.done > 0) parts.push(`${summary.done} done`)
  if (open > 0) parts.push(`${open} open`)
  return parts.length > 0 ? parts.join(' · ') : 'nothing yet'
}

/** `4 done · 1 in progress · 7 to do` — the long form, for panel headers. */
export function detailedCountWords(summary: ProgressSummary | undefined): string {
  if (summary === undefined) return 'nothing inside yet'
  const parts: string[] = []
  if (summary.done > 0) parts.push(`${summary.done} done`)
  if (summary.inProgress > 0) parts.push(`${summary.inProgress} in progress`)
  if (summary.todo > 0) parts.push(`${summary.todo} to do`)
  return parts.length > 0 ? parts.join(' · ') : 'nothing inside yet'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-03-14` → `14 Mar 2026`. Anything unparseable is shown as written. */
export function formatDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  if (match === null) return day
  const month = MONTHS[Number(match[2]) - 1]
  return month === undefined ? day : `${Number(match[3])} ${month} ${match[1]}`
}

/** Today, in the user's own time zone, as `YYYY-MM-DD`. */
export function today(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The short state line under a bubble. */
export function regionWords(
  state: RegionState,
  summary: ProgressSummary | undefined,
  finishedAt: string | undefined
): string {
  switch (state) {
    case 'finished':
      return `Finished ${formatDay(finishedAt ?? '')}`
    case 'nothingOpen':
      return `${summary?.done ?? 0} done · nothing open right now`
    case 'open':
      return countWords(summary)
    case 'empty':
      return 'nothing yet'
  }
}
