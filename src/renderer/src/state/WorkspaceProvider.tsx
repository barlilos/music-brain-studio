/**
 * The workspace, wired to the outside world.
 *
 * The reducer in `./workspace` is pure and knows nothing about files. This is
 * where the impure half lives: loading, saving, minting identities, and the
 * dirty flag the main process needs in order to guard a window close.
 *
 * Components never see any of it. They get read selectors and named commands
 * through context, so no component builds a node, orders a child list, calls
 * `window.projectApi`, or has heard of a token.
 *
 * **Why ids are minted here.** `createNode` takes an id factory, and a reducer
 * cannot call one — it must be pure. So the provider generates the ids, passes
 * them into the action, and hands them straight back to the caller. "Add a child
 * and select it" therefore stays one synchronous call, and UI code still never
 * creates or parses an identity: it receives an opaque string and passes it on.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type JSX,
  type ReactNode
} from 'react'
import type { NodeId } from '@shared/model/project'
import type { NodeInput } from '@shared/model/projectMutations'
import { projectProjection, type ProjectProjection } from '@shared/model/projectProjection'
import { indexNodes } from '@shared/model/nodeIndex'
import { summarizeProgress } from '@shared/model/progress'
import { exportProject } from '@shared/persistence/projectCodec'
import type { LoadProjectResult, RequestedSaveOutcome } from '@shared/types'
import {
  canSave,
  editableContentOf,
  initialWorkspace,
  isDirty,
  workspaceReducer
} from '@renderer/state/workspace'
import {
  WorkspaceContext,
  type WorkspaceCommands,
  type WorkspaceContextValue
} from '@renderer/state/workspaceContext'

export function WorkspaceProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspace)

  /*
   * The current state, readable from a callback without making that callback
   * change identity on every edit.
   *
   * `save` needs the model as it is *now*, and it is passed to the main process
   * as a close handler that is registered once. Reading through a ref keeps that
   * registration stable while still saving the latest work.
   */
  const latest = useRef(state)
  latest.current = state

  /*
   * One projection per revision.
   *
   * `content` is replaced by the reducer exactly when the model changes, so
   * memoizing on it runs this once per mutation rather than once per render —
   * and never at all while the user is only clicking around.
   */
  const projection = useMemo((): ProjectProjection | null => {
    const content = state.content
    if (content === null) return null

    if (content.mode === 'editable') return projectProjection(content.state)

    // A read-only project is already an `ExplorerProject`; it just needs the
    // same two derived structures so that everything below this point can be
    // written once.
    return {
      name: content.project.name,
      roots: content.project.roots,
      index: indexNodes(content.project.roots),
      progress: summarizeProgress(content.project.roots)
    }
  }, [state.content])

  const applyLoad = useCallback((result: LoadProjectResult): void => {
    switch (result.status) {
      case 'opened':
        dispatch({ type: 'opened', project: result.project })
        return
      case 'invalid':
        dispatch({
          type: 'openFailed',
          message: `${result.fileName} is not valid JSON. ${result.message}`
        })
        return
      case 'failed':
        dispatch({ type: 'openFailed', message: result.message })
        return
    }
  }, [])

  // Open straight into the default project: the application is single-project
  // for now and is meant to be opened daily.
  useEffect(() => {
    let cancelled = false

    void window.projectApi.loadDefault().then((result) => {
      if (!cancelled) applyLoad(result)
    })

    return () => {
      cancelled = true
    }
  }, [applyLoad])

  /**
   * Writes the project, and reports what happened.
   *
   * Returns an outcome rather than nothing because the main process's close
   * guard needs to know whether it is safe to close the window.
   */
  const runSave = useCallback(async (): Promise<RequestedSaveOutcome> => {
    const current = latest.current
    const content = editableContentOf(current)

    if (content === null || current.source === null || !isDirty(current)) return 'nothingToSave'
    if (current.isSaving) return 'failed'

    // Captured before the await: this is the revision being serialized, and it
    // is what gets marked saved. Anything edited while the write is in flight
    // has a higher revision and correctly stays dirty.
    const modelRevision = content.state.revision

    dispatch({ type: 'saveStarted' })

    const result = await window.projectApi.save({
      projectToken: current.source.token,
      expectedRevision: current.source.diskRevision,
      modelRevision,
      document: exportProject(content.state, content.preservation)
    })

    switch (result.status) {
      case 'saved':
        dispatch({
          type: 'saved',
          diskRevision: result.diskRevision,
          modelRevision: result.modelRevision
        })
        return 'saved'
      case 'conflict':
        dispatch({ type: 'saveConflicted' })
        return 'failed'
      case 'unknownProject':
        dispatch({ type: 'saveFailed', message: 'That project is no longer open.' })
        return 'failed'
      case 'failed':
        dispatch({ type: 'saveFailed', message: `Could not save: ${result.message}` })
        return 'failed'
    }
  }, [])

  // Tell the main process whether closing the window would lose anything. It is
  // the only side that can intercept a close, and it cannot ask us at the time.
  const dirty = isDirty(state)
  useEffect(() => {
    window.projectApi.setDirty(dirty)
  }, [dirty])

  // Registered once. `runSave` reads through the ref, so it always saves the
  // current model without this effect having to re-run on every edit.
  useEffect(() => window.projectApi.onSaveRequested(runSave), [runSave])

  const commands = useMemo<WorkspaceCommands>(() => {
    /** Ids are minted here so the reducer stays pure and the caller learns them. */
    const mint = (count: number): NodeId[] =>
      Array.from({ length: count }, () => crypto.randomUUID())

    const addChildren = (parentId: NodeId | null, inputs: readonly NodeInput[]): NodeId[] => {
      if (inputs.length === 0) return []
      const ids = mint(inputs.length)
      dispatch({ type: 'createNodes', parentId, inputs, ids })
      return ids
    }

    return {
      addChildren,
      addChild: (parentId, input) => addChildren(parentId, [input])[0] ?? null,
      rename: (nodeId, title) => dispatch({ type: 'updateNode', nodeId, patch: { title } }),
      updateDetails: (nodeId, patch) => dispatch({ type: 'updateNode', nodeId, patch }),
      changeType: (nodeId, kind) => dispatch({ type: 'changeNodeType', nodeId, kind }),
      setStatus: (nodeId, status) => dispatch({ type: 'setNodeStatus', nodeId, status }),
      move: (nodeId, newParentId, index) =>
        dispatch({ type: 'moveNode', nodeId, newParentId, index }),

      save: async () => {
        await runSave()
      },

      reload: async () => {
        const token = latest.current.source?.token
        if (token === undefined) return
        applyLoad(await window.projectApi.reload(token))
      },

      openAnotherProject: async () => {
        const result = await window.projectApi.open()
        // The user dismissed the picker. Leave what is on screen alone.
        if (result.status === 'canceled') return
        applyLoad(result)
      },

      dismissError: () => dispatch({ type: 'dismissError' }),
      dismissConflict: () => dispatch({ type: 'dismissConflict' })
    }
  }, [runSave, applyLoad])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      projection,
      isDirty: dirty,
      canSave: canSave(state),
      isEditable: state.content?.mode === 'editable',
      commands
    }),
    [state, projection, dirty, commands]
  )

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>
}
