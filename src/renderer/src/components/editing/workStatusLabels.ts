/**
 * What the three work states are called on screen.
 *
 * In the renderer, beside the kind registry, for the same reason: this is
 * product vocabulary, and `src/shared` deliberately carries none of it. The
 * model's values are `todo` / `in_progress` / `done`; what a person reads is
 * decided here and nowhere else.
 */

import type { WorkStatus } from '@shared/model/workStatus'

export const WORK_STATUS_LABELS: Readonly<Record<WorkStatus, string>> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done'
}
