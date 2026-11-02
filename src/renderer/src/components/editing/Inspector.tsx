/**
 * The details of one node, beside the graph rather than over it.
 *
 * M005's five fields — `title`, `nodeType`, `status`, `tags`, `notes` — plus
 * what R1 needs around them: where the node lives (with a way to move it), the
 * branch's counts, and the Finished declaration. The exclusions are as
 * deliberate as before: `priority`, `related`, `dependsOn`, `resources`,
 * `outputs`, `energy`, `taskType` and `successCriteria` are preserved through
 * every save and shown nowhere.
 *
 * Each field routes to the command that owns it — title/tags/notes through
 * `updateDetails`, type through `changeType`, status through `setStatus`,
 * Finished through `setFinished`. That split is not cosmetic: it is what stops
 * editing a title from canonicalising a status the user never touched (R2).
 */

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import type { NodeId } from '@shared/model/project'
import { WORK_STATUSES } from '@shared/model/workStatus'
import { ancestorIdsOf } from '@shared/model/nodeIndex'
import { regionStateOf } from '@shared/model/progress'
import { useCommands, useWorkspace } from '@renderer/state/workspaceContext'
import { useEditing } from '@renderer/state/editingContext'
import { presentationFor } from '@renderer/components/explorer/nodeKinds'
import { NODE_KIND_OPTIONS } from '@renderer/components/editing/nodeKindOptions'
import { WORK_STATUS_LABELS } from '@renderer/components/editing/workStatusLabels'
import { Icon, StatusIcon } from '@renderer/components/graph/GraphArt'
import { RegionChip } from '@renderer/components/graph/BranchPanel'
import { detailedCountWords, formatDay, today } from '@renderer/components/graph/graphText'
import { isWorkItem } from '@renderer/components/graph/graphLayout'
import '@renderer/components/graph/graph.css'

interface InspectorProps {
  nodeId: NodeId
  onClose: () => void
  /** Navigates to an ancestor from the "Lives in" path. Omitted where there is nowhere to go. */
  onReveal?: (nodeId: NodeId) => void
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="lpg-field">
      <span className="lpg-field-label">{label}</span>
      {children}
    </label>
  )
}

export function Inspector({ nodeId, onClose, onReveal }: InspectorProps): JSX.Element | null {
  const { projection, state, isEditable } = useWorkspace()
  const commands = useCommands()
  const { openDialog } = useEditing()

  const node = projection?.index.byId.get(nodeId)
  // `notes` is detail rather than something the tree renders, so it is not on
  // `ExplorerNode`. This is the one view that needs the model itself.
  const model = state.content?.mode === 'editable' ? state.content.state : null
  const modelNode = model?.nodesById.get(nodeId)

  /*
   * Text fields are held locally while they are being typed in and committed on
   * blur, rather than dispatching a command per keystroke — one revision per
   * edit, not per character. Status and type commit immediately, because
   * choosing from a list is already a deliberate single act.
   */
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (modelNode === undefined) return
    setTitle(modelNode.title)
    setTags(modelNode.tags.join(', '))
    setNotes(modelNode.notes)
  }, [nodeId, modelNode])

  /*
   * Edits typed but not yet committed, and which node they belong to.
   *
   * Closing the Inspector with Esc, or selecting another node, can unmount it
   * (or switch its node) while a field still holds an edit — and a `blur` is
   * not guaranteed on the way out. Only fields the user actually typed in are
   * recorded, so a remount can never write back a value nobody edited.
   */
  const edited = useRef<{ id: NodeId; title?: string; tags?: string; notes?: string } | null>(null)
  const latestModel = useRef(model)
  latestModel.current = model

  const record = (field: 'title' | 'tags' | 'notes', value: string): void => {
    const current = edited.current?.id === nodeId ? edited.current : { id: nodeId }
    edited.current = { ...current, [field]: value }
  }

  /** Writes whichever of the three fields differ from the stored node. */
  const commit = (id: NodeId, fields: { title?: string; tags?: string; notes?: string }): void => {
    const original = latestModel.current?.nodesById.get(id)
    if (original === undefined || !isEditable) return

    if (fields.title !== undefined) {
      const next = fields.title.trim()
      if (next.length > 0 && next !== original.title) commands.rename(id, next)
    }
    if (fields.tags !== undefined) {
      const next = fields.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
      // Element-wise, so a tag containing a separator cannot make two different
      // lists compare equal.
      const unchanged =
        next.length === original.tags.length &&
        next.every((tag, index) => tag === original.tags[index])
      if (!unchanged) commands.updateDetails(id, { tags: next })
    }
    if (fields.notes !== undefined && fields.notes !== original.notes) {
      commands.updateDetails(id, { notes: fields.notes })
    }

    if (edited.current?.id === id) {
      const rest = { ...edited.current }
      for (const key of Object.keys(fields) as (keyof typeof fields)[]) delete rest[key]
      edited.current = rest
    }
  }

  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => {
    const id = nodeId
    return () => {
      const pending = edited.current
      if (pending !== null && pending.id === id) commitRef.current(id, pending)
      edited.current = null
    }
  }, [nodeId])

  const commitTitle = (value: string): void => {
    commit(nodeId, { title: value })
    if (value.trim().length === 0 && modelNode !== undefined) setTitle(modelNode.title)
  }
  const commitTags = (value: string): void => commit(nodeId, { tags: value })
  const commitNotes = (value: string): void => commit(nodeId, { notes: value })

  if (node === undefined || projection === null) return null

  const presentation = presentationFor(node.kind)
  const carriesStatus = presentation.showsStatus && node.children.length === 0
  const isBranch = !isWorkItem(node)
  const summary = projection.progress.byId.get(nodeId)
  const region = regionStateOf(summary, node.finishedAt)
  const parentId = projection.index.parentIdOf.get(nodeId) ?? null
  const path = ancestorIdsOf(projection.index, nodeId)
  const readOnly = !isEditable || modelNode === undefined

  return (
    <aside aria-label="Details" className="lpg-inspector">
      <div className="flex items-center">
        <span className="lpg-lbl">{presentation.name}</span>
        <span className="lpg-grow" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          title="Close (Esc)"
          className="lpg-btn lpg-btn-ghost"
        >
          <Icon name="close" />
        </button>
      </div>

      <fieldset disabled={readOnly} className="contents">
        <Field label="Name">
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              record('title', event.target.value)
            }}
            onBlur={() => commitTitle(title)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTitle(title)
            }}
            className="lpg-input"
          />
        </Field>

        {carriesStatus && (
          <div className="lpg-field">
            <span className="lpg-field-label">Status</span>
            <div className="lpg-seg" role="group" aria-label="Status">
              {WORK_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={node.status === status}
                  onClick={() => commands.setStatus(nodeId, status)}
                >
                  <StatusIcon status={status} r={5} bg="#141922" decorative />
                  {WORK_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        )}

        {isBranch && (
          <div className="lpg-field">
            <span className="lpg-field-label">Progress inside</span>
            <span className="lpg-small">{detailedCountWords(summary)}</span>
            {region === 'nothingOpen' && (
              <RegionChip region={region} finishedAt={undefined} openCount={0} />
            )}
            {region === 'nothingOpen' && (
              <span className="lpg-small lpg-muted">
                Every known task is done. That is not the same as finished — new work may still turn
                up.
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {node.finishedAt === undefined ? (
                <button
                  type="button"
                  className="lpg-btn"
                  onClick={() => commands.setFinished(nodeId, today())}
                  title="Declare this finished. Nothing inside it changes."
                >
                  <Icon name="flag" />
                  Mark finished
                </button>
              ) : (
                <>
                  <span className="lpg-small lpg-sec">
                    You marked this finished on {formatDay(node.finishedAt)}.
                  </span>
                  <button
                    type="button"
                    className="lpg-btn"
                    onClick={() => commands.setFinished(nodeId, null)}
                  >
                    Reopen
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <Field label="Type">
          <select
            value={node.kind}
            onChange={(event) => commands.changeType(nodeId, event.target.value)}
            className="lpg-input"
          >
            {/*
              A kind the file uses but the registry does not know still has to be
              selectable, or opening this panel would silently retype the node.
            */}
            {NODE_KIND_OPTIONS.some((option) => option.kind === node.kind) ? null : (
              <option value={node.kind}>{node.kind}</option>
            )}
            {NODE_KIND_OPTIONS.map((option) => (
              <option key={option.kind} value={option.kind}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="lpg-field">
          <span className="lpg-field-label">Lives in</span>
          <div className="lpg-path">
            {path.length === 0 && <span>{projection.name ?? 'The top level'}</span>}
            {path.map((id, i) => (
              <span key={id} className="contents">
                {i > 0 && <span className="sep">›</span>}
                {onReveal === undefined ? (
                  <span>{projection.index.byId.get(id)?.label ?? 'Untitled'}</span>
                ) : (
                  <button type="button" onClick={() => onReveal(id)}>
                    {projection.index.byId.get(id)?.label ?? 'Untitled'}
                  </button>
                )}
              </span>
            ))}
          </div>
          <div>
            <button
              type="button"
              className="lpg-btn"
              onClick={() => openDialog({ kind: 'move', nodeId })}
            >
              <Icon name="move" />
              Move…
            </button>
          </div>
        </div>

        <Field label="Tags">
          <input
            value={tags}
            onChange={(event) => {
              setTags(event.target.value)
              record('tags', event.target.value)
            }}
            onBlur={() => commitTags(tags)}
            placeholder="Comma separated"
            className="lpg-input"
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value)
              record('notes', event.target.value)
            }}
            onBlur={() => commitNotes(notes)}
            rows={6}
            className="lpg-ta"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="lpg-btn"
            onClick={() => openDialog({ kind: 'addChild', parentId: nodeId })}
          >
            <Icon name="sub" />
            {isBranch ? 'Add inside' : 'Add subtask'}
          </button>
          <button
            type="button"
            className="lpg-btn"
            onClick={() => openDialog({ kind: 'addChild', parentId })}
          >
            <Icon name="plus" />
            Add beside
          </button>
        </div>
      </fieldset>
    </aside>
  )
}
