/**
 * What a collapsed explorer row shows on its right-hand edge.
 *
 * The row has one small slot there and two things that could go in it: how many
 * children are inside, and how much work is left. Work wins when there is any,
 * because "is there anything in here" is a question you ask once and "how much
 * is left" is one you ask every day.
 *
 * Restraint is the whole design. One number, not three; the full breakdown lives
 * in the tooltip, and on the canvas card where there is room for it. No
 * percentage, ever — see `@shared/model/progress` for why that matters more than
 * it looks.
 */

import type { ProgressSummary } from '@shared/model/progress'
import { hasKnownWork } from '@shared/model/progress'

export interface RowBadge {
  /** The number on screen. */
  text: string
  /** The full picture, on hover. */
  title: string
}

/**
 * @param summary Work below this node, or `undefined` when it is not known.
 * @param childCount How many direct children the node has.
 */
export function rowBadgeFor(
  summary: ProgressSummary | undefined,
  childCount: number
): RowBadge | null {
  if (summary !== undefined && hasKnownWork(summary)) {
    const parts: string[] = []
    if (summary.todo > 0) parts.push(`${summary.todo} open`)
    if (summary.inProgress > 0) parts.push(`${summary.inProgress} in progress`)
    if (summary.done > 0) parts.push(`${summary.done} done`)

    // The open count is the one that answers "what is left". A node whose work
    // is entirely finished shows nothing rather than a zero, which would read
    // as a warning rather than as an achievement.
    return summary.todo + summary.inProgress > 0
      ? { text: String(summary.todo + summary.inProgress), title: parts.join(' · ') }
      : { text: '✓', title: parts.join(' · ') }
  }

  if (childCount > 0) {
    return { text: String(childCount), title: `${childCount} inside` }
  }

  return null
}
