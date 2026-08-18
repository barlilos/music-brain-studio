/**
 * Add one entry under something.
 *
 * Two fields, because capture has to be cheap: a title, and what kind of thing
 * it is. Everything else a node can carry is left to the Inspector — asking for
 * tags and notes at the moment of capture is how a quick thought becomes a form
 * to fill in, and the thought does not get written down.
 */

import { useState, type JSX } from 'react'
import type { NodeId } from '@shared/model/project'
import { useCommands } from '@renderer/state/workspaceContext'
import { Dialog, DialogButton } from '@renderer/components/editing/Dialog'
import {
  DEFAULT_NEW_KIND,
  NODE_KIND_OPTIONS,
  initialStatusFor
} from '@renderer/components/editing/nodeKindOptions'

interface AddChildDialogProps {
  parentId: NodeId | null
  /** What the new entry is going under, for the title. */
  parentName: string
  onClose: () => void
  /** Called with the new node's id, so the caller can select it. */
  onCreated: (nodeId: NodeId) => void
}

export function AddChildDialog({
  parentId,
  parentName,
  onClose,
  onCreated
}: AddChildDialogProps): JSX.Element {
  const commands = useCommands()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState(DEFAULT_NEW_KIND)

  const canSubmit = title.trim().length > 0

  function submit(): void {
    if (!canSubmit) return

    const id = commands.addChild(parentId, {
      title,
      kind,
      status: initialStatusFor(kind)
    })

    onClose()
    if (id !== null) onCreated(id)
  }

  return (
    <Dialog
      title={`Add to ${parentName}`}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton primary onClick={submit} disabled={!canSubmit}>
            Add
          </DialogButton>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-400 dark:border-neutral-600 dark:bg-neutral-900"
          />
        </label>

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

        {/* Enter submits the form; the visible action is in the footer. */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Dialog>
  )
}
