/**
 * The canvas: the primary workspace.
 *
 * Owns the pipeline from a selection to a drawn graph, and the React Flow
 * viewport. Everything it renders comes from one canvas root:
 *
 *   selection → canvasRootFor → buildCanvasGraph → layoutCanvas
 *             → toCanvasViewModel → toReactFlow → React Flow
 *
 * Each stage answers one question — which canvas, what is on it, where it goes,
 * how it looks, how this library wants it — and may only read the stage above.
 *
 * **Cost is bounded by the root.** Every stage after the root is resolved is
 * proportional to that node's fan-out, which is at most about fifteen cards. No
 * stage walks the project, nothing is precomputed per node, and React Flow is
 * never handed a node that is not on the current canvas. That is what makes the
 * canvas indifferent to the size of the knowledge base.
 */

import { useEffect, useMemo, useRef, type JSX } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type FitViewOptions,
  type NodeTypes
} from '@xyflow/react'
import { buildCanvasGraph, canvasKey, canvasRootFor } from '@shared/model/canvas'
import type { NodeIndex } from '@shared/model/nodeIndex'
import type { WorkStatus } from '@shared/model/workStatus'
import type { ProgressIndex } from '@shared/model/progress'
import { layoutCanvas } from '@renderer/components/canvas/canvasLayout'
import { toCanvasViewModel } from '@renderer/components/canvas/canvasViewModel'
import {
  CANVAS_CARD_NODE_TYPE,
  geometrySignatureOf,
  toReactFlow
} from '@renderer/components/canvas/toReactFlow'
import { CanvasCard } from '@renderer/components/canvas/CanvasCard'
import { CanvasInteractionContext } from '@renderer/components/canvas/canvasInteraction'
import '@renderer/components/canvas/canvas.css'

/** Module-level so the identity is stable; React Flow warns otherwise. */
const NODE_TYPES: NodeTypes = { [CANVAS_CARD_NODE_TYPE]: CanvasCard }

/**
 * Never zoom past 1.0 on the way in — a canvas with one child blown up to 200%
 * looks broken. Never below 0.8 on the way out: at that point a title stops
 * being legible, and a tall column is a list, which the user can already pan.
 */
const FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.12,
  maxZoom: 1,
  minZoom: 0.8
}

/**
 * The project root is the exception, and a deliberate one.
 *
 * It is the overview — the answer to "what is in here at all" — and an overview
 * that cuts the top and bottom off the list is not an overview. Every other
 * canvas is somewhere you navigated *to*, where reading the cards matters more
 * than counting them and panning a tall column is natural because you already
 * know what you are looking at.
 *
 * So the floor is lower here rather than absent. The zoom is still whatever
 * React Flow computes from the graph bounds, the viewport and the padding; 0.55
 * only stops a knowledge base with a very large top level from being framed into
 * illegibility. On the reference file the computed fit lands above it, so the
 * floor does not bind and the framing is entirely bounds-driven.
 */
const PROJECT_FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.12,
  maxZoom: 1,
  minZoom: 0.55
}

/** The same framing, eased. Only for refits — the first one has nothing to ease from. */
function animated(options: FitViewOptions): FitViewOptions {
  return { ...options, duration: 180 }
}

interface CanvasViewProps {
  index: NodeIndex
  projectName: string | undefined
  selectedId: string | null
  onSelect: (nodeId: string) => void
  /** Omitted for a read-only project, which removes the status controls. */
  onCycleStatus?: (nodeId: string, status: WorkStatus) => void
  /** Omitted for a read-only project, which removes the context menu. */
  onContextMenu?: (nodeId: string, x: number, y: number) => void
  renamingNodeId?: string | null
  onCommitRename?: (nodeId: string, title: string) => void
  onCancelRename?: () => void
  /** Per-node work counts, shown under each card's title. */
  progress?: ProgressIndex
}

function CanvasFlow({
  index,
  projectName,
  selectedId,
  onSelect,
  onCycleStatus,
  onContextMenu,
  renamingNodeId,
  onCommitRename,
  onCancelRename,
  progress
}: CanvasViewProps): JSX.Element {
  const root = useMemo(() => canvasRootFor(selectedId, index), [selectedId, index])

  const graph = useMemo(
    () => buildCanvasGraph(root, index, projectName, selectedId),
    [root, index, projectName, selectedId]
  )

  const { nodes, edges } = useMemo(
    () => toReactFlow(toCanvasViewModel(layoutCanvas(graph), progress)),
    [graph, progress]
  )

  const interaction = useMemo(
    () => ({
      onSelect,
      onCycleStatus,
      onContextMenu,
      renamingNodeId,
      onCommitRename,
      onCancelRename
    }),
    [onSelect, onCycleStatus, onContextMenu, renamingNodeId, onCommitRename, onCancelRename]
  )

  const { fitView } = useReactFlow()

  /*
   * Framing has to wait for two things, and getting either wrong is silent.
   *
   * **The store must hold this canvas's cards.** React Flow ingests a new node
   * array a render behind, so an effect that fires on the canvas key alone
   * frames the canvas the user just left — which, coming from a taller one,
   * looks exactly like the zoom floor being hit.
   *
   * **Those cards must have been measured.** A `fitView` issued before
   * measurement has no bounds to work from and does nothing at all.
   *
   * `useNodesInitialized` is the obvious way to wait for the second, and gating
   * the refit on it was tried and abandoned: in this configuration it stayed
   * false, so every refit after the first silently never happened. Rather than
   * depend on a flag whose exact contract here was never pinned down, both
   * conditions are read from the measurements themselves.
   *
   * `nodeLookup` is where React Flow keeps its own measured copies, so that is
   * what both conditions are read from. The signature changes when the card set
   * changes and again when the measurements land, which is what guarantees the
   * effect re-runs at a moment when the bounds are real.
   */
  const measurementSignature = useStore((state) => {
    let signature = ''
    for (const node of state.nodeLookup.values()) {
      signature += `${node.id}:${node.measured?.width ?? 0}x${node.measured?.height ?? 0}|`
    }
    return signature
  })
  const storedIds = useStore((state) => [...state.nodeLookup.keys()].join('|'))

  /*
   * The viewport is also reframed when the pane changes size. Layout is in graph
   * space and never consults the window, so resizing moves no card — but it does
   * change how much of the canvas fits, and with no zoom controls a user who
   * resizes would otherwise have no way to recover a graph that has fallen off
   * the edge.
   */
  const paneSize = useStore((state) => `${Math.round(state.width)}x${Math.round(state.height)}`)

  const key = canvasKey(root)
  // The overview frames differently from a node canvas — see the two option sets.
  const fitOptions = root.type === 'project' ? PROJECT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS
  const renderedIds = nodes.map((node) => node.id).join('|')
  const isMeasured = measurementSignature.length > 0 && !measurementSignature.includes(':0x0')
  const isFramable = isMeasured && storedIds === renderedIds

  /*
   * Reframe whenever anything the framing depends on changes — and nothing else.
   *
   * Three things decide a frame: which canvas, how big the pane is, and where
   * the cards actually are. Keying on the first two alone was wrong: the same
   * root can hold a different graph, so "same root, same pane" would report a
   * canvas as already framed and skip the `fitView` its new bounds needed. That
   * is reachable today by reopening a project whose file changed on disk, and it
   * becomes routine the moment adding or removing a node exists.
   *
   * The geometry signature is what makes the sibling case work rather than
   * something it has to be excused from: moving the ring between sibling leaves
   * produces identical ids at identical positions, so the signature is unchanged
   * and the viewport is left exactly alone. It comes from the layout, which is
   * deterministic, so no DOM measurement is involved.
   */
  const geometrySignature = geometrySignatureOf(nodes)
  const framedFor = useRef<{ key: string; pane: string; geometry: string } | null>(null)
  useEffect(() => {
    const previous = framedFor.current
    const alreadyFramed =
      previous !== null &&
      previous.key === key &&
      previous.pane === paneSize &&
      previous.geometry === geometrySignature
    if (!isFramable || alreadyFramed) return

    // Easing is for arriving at a new canvas. The first framing has nothing to
    // ease from; a resize should track the pointer rather than lag behind it;
    // and a graph that changed under a root the user is already looking at is
    // the same canvas, not a new one. Only the first of those eases.
    const isNewCanvas = previous !== null && previous.key !== key

    void fitView(isNewCanvas ? animated(fitOptions) : fitOptions)
    framedFor.current = { key, pane: paneSize, geometry: geometrySignature }
  }, [key, fitOptions, paneSize, geometrySignature, isFramable, measurementSignature, fitView])

  return (
    <CanvasInteractionContext value={interaction}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        // Read-only, switched off by name rather than left unused, so turning
        // any of it back on later is a decision instead of a discovery.
        nodesDraggable={false}
        nodesConnectable={false}
        // Selection is application state shared with the explorer. React Flow's
        // own per-node flag would be a second source of truth that disagrees the
        // first time selection changes from the tree.
        elementsSelectable={false}
        // The card is a real <button>; React Flow's tab cycling would give every
        // card a second, useless tab stop.
        nodesFocusable={false}
        edgesFocusable={false}
        // Left free: double-click will mean "open" once there is something to
        // open.
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={fitOptions}
        minZoom={0.4}
        maxZoom={1.5}
        colorMode="system"
        proOptions={{ hideAttribution: false }}
        aria-label="Canvas"
        // React Flow's stylesheet gives `.react-flow` no dimensions of its own,
        // and every one of its children is absolutely positioned — so without
        // this it collapses to zero height, `fitView` has no viewport to fit
        // into, and the graph renders unframed off the edge of the pane.
        className="h-full w-full"
      />
    </CanvasInteractionContext>
  )
}

export function CanvasView(props: CanvasViewProps): JSX.Element {
  if (props.index.roots.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
        This project has no entries yet.
      </p>
    )
  }

  // The provider is what lets the flow reframe itself from an effect. No
  // <Controls />, no <Background />, no <MiniMap />: a dot grid is an alignment
  // aid for placement the user cannot do, and a control panel floating over
  // fifteen cards is chrome for a problem that does not exist.
  return (
    <ReactFlowProvider>
      <CanvasFlow {...props} />
    </ReactFlowProvider>
  )
}
