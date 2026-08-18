/**
 * Add many entries at once, one per line.
 *
 * The capture case this exists for is a set list, a track list, or a page of
 * notes typed during a session — things that arrive as a block and would
 * otherwise be added one dialog at a time.
 *
 * **One transaction, not N.** The whole block goes through a single
 * `createNodes`, so fifty tasks are one revision, one dirty step, one canvas
 * reframe and — once undo exists — one undo. Adding them in a loop would be
 * fifty of each, and a failure halfway through would leave half a list behind.
 *
 * Lines are trimmed, empty ones are discarded, and order is preserved exactly as
 * typed.
 */

import { useMemo, useState, type JSX } from 'react'
import type { NodeId } from '@shared/model/project'
import { useCommands } from '@renderer/state/workspaceContext'
import { Dialog, DialogButton } from '@renderer/components/editing/Dialog'
import {
  DEFAULT_NEW_KIND,
  NODE_KIND_OPTIONS,
  initialStatusFor
} from '@renderer/components/editing/nodeKindOptions'
import { parseBulkLines } from '@renderer/components/editing/bulkAdd'

interface BulkAddDialogProps {
  parentId: NodeId | null
  parentName: string
  onClose: () => void
  onCreated: (nodeIds: NodeId[]) => void
}

export function BulkAddDialog({
  parentId,
  parentName,
  onClose,
  onCreated
}: BulkAddDialogProps): JSX.Element {
  const commands = useCommands()
  const [text, setText] = useState('')
  const [kind, setKind] = useState(DEFAULT_NEW_KIND)

  const titles = useMemo(() => parseBulkLines(text), [text])

  function submit(): void {
    if (titles.length === 0) return

    const status = initialStatusFor(kind)
    const ids = commands.addChildren(
      parentId,
      titles.map((title) => ({ title, kind, status }))
    )

    onClose()
    onCreated(ids)
  }

  return (
    <Dialog
      wide
      title={`Add many to ${parentName}`}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton primary onClick={submit} disabled={titles.length === 0}>
            {titles.length === 1 ? 'Add 1' : `Add ${titles.length}`}
          </DialogButton>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-400 dark:border-neutral-600 dark:bg-neutral-900"
          >
            {NODE_KIND_OPTIONS.map((option) => (
              <option key={option.kind} value={option.kind}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
            One per line
          </span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={12}
            placeholder={'Tune the snare\nRe-amp the DI\nBounce a rough mix'}
            className="w-full resize-y rounded-md border border-neutral-300 px-2 py-1 font-mono text-sm outline-none focus:border-indigo-400 dark:border-neutral-600 dark:bg-neutral-900"
          />
        </label>

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Blank lines are ignored. Order is kept.
        </p>
      </div>
    </Dialog>
  )
}
