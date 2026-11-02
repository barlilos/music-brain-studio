/**
 * The Living Progress Graph — R1: A's seed bubbles for seeing, B's unfold for
 * doing (docs/handoffs/003).
 *
 * One focused node sits at the hub with its children on a ring around it, each
 * drawn as a bubble of seeds. Clicking a bubble unfolds it in place into a
 * working panel; its siblings slide onto an arc beside the hub and stay on
 * screen, so the user never loses where they are. Double-clicking makes a
 * bubble the new hub. Esc steps back out, one level at a time.
 *
 * Rendering is plain SVG plus HTML labels, positioned from a deterministic
 * layout (`graphLayout`) and fitted to the pane. Every element is keyed by node
 * id and moves with a CSS transition, so a re-root, an unfold or a completed
 * task glides rather than jumps. At most one level of bubbles (with one nested
 * level inside each) is ever drawn, which keeps the whole-brain map readable
 * and the cost proportional to the focus rather than to the project.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react'
import type { ExplorerNode } from '@shared/model/node'
import type { NodeIndex } from '@shared/model/nodeIndex'
import { regionStateOf, type ProgressIndex, type RegionState } from '@shared/model/progress'
import { presentationFor } from '@renderer/components/explorer/nodeKinds'
import {
  bubbleOf,
  constellationOf,
  fitToRect,
  isWorkItem,
  looseBubbleOf,
  workUnder,
  type BubbleLayout,
  type SeedSpec
} from '@renderer/components/graph/graphLayout'
import {
  focusOn,
  fold,
  looseKey,
  nodeIdOfKey,
  revealPlace,
  unfold,
  up,
  type GraphPlace
} from '@renderer/components/graph/graphNavigation'
import { BubbleArt, StatusIcon, type SeedHandlers } from '@renderer/components/graph/GraphArt'
import { GRAPH_COLORS } from '@renderer/components/graph/graphColors'
import { BranchPanel, AddTasks } from '@renderer/components/graph/BranchPanel'
import { countWords, regionWords } from '@renderer/components/graph/graphText'
import { InlineRename } from '@renderer/components/editing/InlineRename'
import { isRenaming, useEditing } from '@renderer/state/editingContext'
import { useCommands } from '@renderer/state/workspaceContext'
import '@renderer/components/graph/graph.css'

/** The brain map is denser than a focused level: more seeds, smaller marks. */
const OVERVIEW_SPEC: SeedSpec = { spacing: 7.5, radius: 2.7, pad: 5, gap: 6 }
const FOCUS_SPEC: SeedSpec = { spacing: 9.5, radius: 3.4, pad: 6, gap: 8 }

const HUB_R = 48
const LABEL_W_MIN = 92
const LABEL_W_MAX = 190
const PANEL_GAP = 20

const HUB_KEY = 'hub'

/** How long a click waits to find out whether it is the first of a double click. */
const DOUBLE_CLICK_MS = 230

export interface GraphViewProps {
  projectName: string
  index: NodeIndex
  progress: ProgressIndex
  place: GraphPlace
  onPlaceChange: (place: GraphPlace) => void
  selectedId: string | null
  onSelect: (nodeId: string | null) => void
  isEditable: boolean
  isNew: (nodeId: string) => boolean
  /** True while a dialog or menu owns the keyboard. */
  isKeyboardBlocked: boolean
  onContextMenu: (nodeId: string | null, x: number, y: number) => void
}

interface Placed {
  key: string
  node: ExplorerNode | undefined
  bubble: BubbleLayout
  /** Screen position of the centre, and the bubble's scale. */
  x: number
  y: number
  scale: number
  slot: number
  /** Hidden while it is unfolded into the panel. */
  isUnfolded: boolean
}

function usePaneSize(): [RefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return
      const { width, height } = entry.contentRect
      setSize((previous) =>
        Math.round(previous.width) === Math.round(width) &&
        Math.round(previous.height) === Math.round(height)
          ? previous
          : { width, height }
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

export function GraphView({
  projectName,
  index,
  progress,
  place,
  onPlaceChange,
  selectedId,
  onSelect,
  isEditable,
  isNew,
  isKeyboardBlocked,
  onContextMenu
}: GraphViewProps): JSX.Element {
  const [paneRef, pane] = usePaneSize()
  const [hover, setHover] = useState<{
    id: string
    x: number
    y: number
    kind: 'seed' | 'bubble'
  } | null>(null)
  const { rename, endRename } = useEditing()
  const commands = useCommands()

  const focusNode = place.focusId === null ? undefined : index.byId.get(place.focusId)
  const children = focusNode?.children ?? index.roots
  const focusName =
    focusNode === undefined
      ? projectName
      : (focusNode.label ?? `Untitled ${presentationFor(focusNode.kind).name.toLowerCase()}`)
  const spec = place.focusId === null ? OVERVIEW_SPEC : FOCUS_SPEC

  const regionOf = useCallback(
    (nodeId: string): RegionState =>
      regionStateOf(progress.byId.get(nodeId), index.byId.get(nodeId)?.finishedAt),
    [progress, index]
  )

  // ---------------------------------------------------------------- layout

  const entries = useMemo(() => {
    const list: { key: string; node: ExplorerNode | undefined; bubble: BubbleLayout }[] = []
    for (const child of children) {
      if (isWorkItem(child)) continue
      list.push({ key: child.id, node: child, bubble: bubbleOf(child, spec, 1, isNew) })
    }
    const direct = children.filter(isWorkItem)
    if (direct.length > 0) {
      list.push({
        key: looseKey(place.focusId),
        node: undefined,
        bubble: looseBubbleOf(direct, spec, isNew)
      })
    }
    return list
  }, [children, spec, isNew, place.focusId])

  const unfoldedKey =
    place.unfoldedKey !== null && entries.some((entry) => entry.key === place.unfoldedKey)
      ? place.unfoldedKey
      : null

  const panelWidth =
    unfoldedKey === null ? 0 : Math.round(Math.min(680, Math.max(420, pane.width * 0.52)))
  const panelLeft = pane.width - panelWidth - PANEL_GAP
  const graphRect = {
    x: 0,
    y: 0,
    width: unfoldedKey === null ? pane.width : Math.max(panelLeft - 8, 160),
    height: Math.max(pane.height - 34, 120)
  }

  const layout = useMemo(() => {
    const ring = entries.filter((entry) => entry.key !== unfoldedKey)
    const constellation = constellationOf(ring, {
      hubR: HUB_R,
      ringGap: unfoldedKey === null ? 46 : 38,
      minSlot: unfoldedKey === null ? 150 : 120,
      arc: unfoldedKey === null ? undefined : { start: 100, end: 260 }
    })
    const fit = fitToRect(constellation.bounds, graphRect, {
      pad: 22,
      labelX: 64,
      labelTop: 8,
      labelBottom: 40,
      maxScale: place.focusId === null ? 1.25 : 2
    })
    return { constellation, fit }
    // graphRect is derived from these numbers; listing them keeps the memo honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, unfoldedKey, graphRect.width, graphRect.height, place.focusId])

  const { constellation, fit } = layout
  // The hub is a name, not a container of seeds: it grows with the fit only so far.
  const hubScale = Math.min(fit.scale, 1.3)
  const hub = { x: fit.tx, y: fit.ty, r: HUB_R * hubScale }

  const placed: Placed[] = entries.map((entry) => {
    const item = constellation.items.find((candidate) => candidate.key === entry.key)
    if (item === undefined) {
      // The unfolded branch flies into the panel's header icon and fades.
      const iconScale = Math.min(1.4, 30 / Math.max(entry.bubble.R, 1))
      return {
        ...entry,
        x: panelLeft + 16 + 36,
        y: 16 + 14 + 36,
        scale: iconScale,
        slot: 0,
        isUnfolded: true
      }
    }
    return {
      ...entry,
      x: item.x * fit.scale + fit.tx,
      y: item.y * fit.scale + fit.ty,
      scale: fit.scale,
      slot: item.slot,
      isUnfolded: false
    }
  })

  /*
   * How much of a bubble's label fits. On the full ring every slot is wide
   * enough by construction; on the arc beside an open panel, siblings are
   * context, and a label that would collide with its neighbour is dropped in
   * favour of a hover tooltip rather than drawn over the next bubble.
   */
  const labelModeOf = (item: Placed): 'full' | 'title' | 'none' => {
    if (unfoldedKey === null) return 'full'
    const room = item.slot * item.scale
    if (room >= 104) return 'full'
    if (room >= 64) return 'title'
    return 'none'
  }

  // ----------------------------------------------------------- navigation

  const go = useCallback((next: GraphPlace) => onPlaceChange(next), [onPlaceChange])

  const reveal = useCallback(
    (nodeId: string) => {
      const target = revealPlace(index, nodeId)
      go(target.place)
      onSelect(target.select)
    },
    [index, go, onSelect]
  )

  const toggleUnfold = useCallback(
    (key: string) => {
      setHover(null)
      go(place.unfoldedKey === key ? fold(place) : unfold(place, key))
    },
    [go, place]
  )

  const openAsMap = useCallback(
    (nodeId: string) => {
      setHover(null)
      const node = index.byId.get(nodeId)
      if (node === undefined || isWorkItem(node)) return
      go(focusOn(place, nodeId))
    },
    [go, index, place]
  )

  /*
   * Seeds are for seeing (R1): hovering one names the task and where it lives.
   * A click anywhere in a bubble — seeds included — opens the bubble; the work
   * itself is done in the panel's rows, where nothing moves under the pointer.
   */
  const seedHandlers = useMemo(
    (): SeedHandlers => ({
      onEnter: (taskId, event) => {
        const rect = paneRef.current?.getBoundingClientRect()
        if (rect === undefined) return
        setHover({
          id: taskId,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          kind: 'seed'
        })
      },
      onLeave: () => setHover(null)
    }),
    [paneRef]
  )

  /*
   * One click unfolds, a double click re-roots. The unfold waits out the
   * double-click interval: unfolding at once would fly the bubble into the
   * panel, and the second click of a double click would land on whatever took
   * its place.
   */
  const pendingClick = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(pendingClick.current ?? undefined), [])
  const clickBubble = (key: string, nodeId: string | null, detail: number): void => {
    clearTimeout(pendingClick.current ?? undefined)
    pendingClick.current = null
    if (detail >= 2) {
      if (nodeId !== null) openAsMap(nodeId)
      return
    }
    pendingClick.current = setTimeout(() => {
      pendingClick.current = null
      toggleUnfold(key)
    }, DOUBLE_CLICK_MS)
  }

  // Esc steps out: Inspector first, then the open panel, then one level up.
  useEffect(() => {
    if (isKeyboardBlocked) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (
        target !== null &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        target.blur()
        return
      }
      event.preventDefault()
      if (selectedId !== null) onSelect(null)
      else go(up(place, index))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isKeyboardBlocked, selectedId, onSelect, go, place, index])

  // ------------------------------------------------------------- render

  const hubSummary = place.focusId === null ? progress.total : progress.byId.get(place.focusId)
  const hubRegion: RegionState =
    place.focusId === null ? regionStateOf(progress.total, undefined) : regionOf(place.focusId)
  const hubKind = focusNode === undefined ? 'Whole brain' : presentationFor(focusNode.kind).name
  const hoveredNode = hover === null ? undefined : index.byId.get(hover.id)
  const isEmpty = entries.length === 0
  const layoutKey = `${place.focusId ?? 'root'}|${unfoldedKey ?? ''}`
  const ready = pane.width > 0 && pane.height > 0

  return (
    <div ref={paneRef} className="lpg" onClick={() => setHover(null)}>
      {ready && (
        <svg className="lpg-svg" role="group" aria-label={`Map of ${focusName}`}>
          {/* Edges: re-drawn per layout, fading in once the bubbles have moved. */}
          <g key={layoutKey} className="lpg-enter" style={{ animationDelay: '160ms' }}>
            {placed
              .filter((item) => !item.isUnfolded)
              .map((item) => {
                const angle = Math.atan2(item.y - hub.y, item.x - hub.x)
                const r = item.bubble.R * item.scale
                const x1 = hub.x + Math.cos(angle) * hub.r
                const y1 = hub.y + Math.sin(angle) * hub.r
                const x2 = item.x - Math.cos(angle) * r
                const y2 = item.y - Math.sin(angle) * r
                const mx = (x1 + x2) / 2
                const my = (y1 + y2) / 2
                const k = 0.1
                return (
                  <path
                    key={item.key}
                    d={`M${x1} ${y1} Q${mx - (y2 - y1) * k} ${my + (x2 - x1) * k} ${x2} ${y2}`}
                    fill="none"
                    stroke={GRAPH_COLORS.edge}
                    strokeWidth={1.4}
                    strokeLinecap="round"
                  />
                )
              })}
            {unfoldedKey !== null && (
              <>
                <path
                  d={`M${hub.x + hub.r} ${hub.y} C${hub.x + hub.r + 120} ${hub.y} ${panelLeft - 90} 52 ${panelLeft} 52`}
                  fill="none"
                  stroke="#56657a"
                  strokeWidth={1.6}
                />
                <circle cx={panelLeft} cy={52} r={4} fill="#56657a" />
              </>
            )}
          </g>

          {placed.map((item) => {
            const nodeId = item.node?.id ?? null
            const done = nodeId !== null && regionOf(nodeId) === 'nothingOpen'
            const label =
              item.node?.label ??
              (item.node === undefined ? `Directly in ${focusName}` : 'Untitled')
            return (
              <g
                key={item.key}
                className={`lpg-move lpg-bubble${done ? ' is-done' : ''}`}
                style={{
                  transform: `translate(${item.x}px, ${item.y}px) scale(${item.scale})`,
                  opacity: item.isUnfolded ? 0 : 1,
                  pointerEvents: item.isUnfolded ? 'none' : undefined
                }}
                role="button"
                tabIndex={item.isUnfolded ? -1 : 0}
                aria-label={`${label}: ${countWords(nodeId === null ? undefined : progress.byId.get(nodeId))}. Press Enter to open.`}
                onClick={(event) => {
                  event.stopPropagation()
                  clickBubble(item.key, nodeId, event.detail)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    if (event.shiftKey && nodeId !== null) openAsMap(nodeId)
                    else toggleUnfold(item.key)
                  }
                }}
                onContextMenu={(event) => {
                  if (!isEditable) return
                  event.preventDefault()
                  onContextMenu(nodeId ?? place.focusId, event.clientX, event.clientY)
                }}
                onMouseEnter={(event) => {
                  if (nodeId === null || labelModeOf(item) !== 'none') return
                  const rect = paneRef.current?.getBoundingClientRect()
                  if (rect === undefined) return
                  setHover({
                    id: nodeId,
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    kind: 'bubble'
                  })
                }}
                onMouseLeave={() => setHover((h) => (h?.kind === 'bubble' ? null : h))}
              >
                <circle
                  className="lpg-focus-ring"
                  r={item.bubble.R + 6 / Math.max(item.scale, 0.1)}
                  fill="none"
                  stroke="#5aa7ff"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
                {item.key === place.recentId && !item.isUnfolded && (
                  <circle
                    r={item.bubble.R + 9 / Math.max(item.scale, 0.1)}
                    fill="none"
                    stroke="#9cc4ff"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                    opacity={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <BubbleArt
                  bubble={item.bubble}
                  regionOf={regionOf}
                  radius={spec.radius}
                  spacing={spec.spacing}
                  selectedId={selectedId}
                  handlers={item.isUnfolded ? undefined : seedHandlers}
                />
              </g>
            )
          })}

          {/* The hub: the focused node, or the project itself on the brain map. */}
          <g
            key={HUB_KEY}
            className="lpg-move lpg-hub"
            style={{ transform: `translate(${hub.x}px, ${hub.y}px) scale(${hubScale})` }}
            role="button"
            tabIndex={0}
            aria-label={
              place.focusId === null
                ? `${focusName}, the whole brain`
                : `${focusName}. Click for details, double-click to step out.`
            }
            onClick={(event) => {
              event.stopPropagation()
              if (place.focusId !== null) onSelect(place.focusId)
            }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              go(up({ ...place, unfoldedKey: null }, index))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && place.focusId !== null) onSelect(place.focusId)
            }}
            onContextMenu={(event) => {
              if (!isEditable) return
              event.preventDefault()
              onContextMenu(place.focusId, event.clientX, event.clientY)
            }}
          >
            <circle
              className="lpg-rim"
              r={HUB_R}
              fill={GRAPH_COLORS.hub}
              stroke={
                hubRegion === 'finished' || hubRegion === 'nothingOpen'
                  ? GRAPH_COLORS.green
                  : GRAPH_COLORS.hubRim
              }
              strokeWidth={hubRegion === 'finished' ? 2.4 : 1.4}
              vectorEffect="non-scaling-stroke"
            />
            {selectedId !== null && selectedId === place.focusId && (
              <circle
                r={HUB_R + 5 / Math.max(hubScale, 0.1)}
                fill="none"
                stroke="#e8ecf1"
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        </svg>
      )}

      {/* Labels are HTML at a fixed pixel size, so they stay legible at any fit. */}
      {ready &&
        placed.map((item) => {
          const nodeId = item.node?.id ?? null
          const mode = labelModeOf(item)
          if (mode === 'none') return null
          const width = Math.max(LABEL_W_MIN, Math.min(LABEL_W_MAX, item.slot * item.scale - 12))
          const top = item.y + item.bubble.R * item.scale + 6
          const summary = nodeId === null ? summarizeLoose(children) : progress.byId.get(nodeId)
          const region = nodeId === null ? 'open' : regionOf(nodeId)
          const fresh =
            item.node === undefined
              ? children.filter((child) => isWorkItem(child) && isNew(child.id)).length
              : workUnder(item.node).filter((node) => isNew(node.id)).length
          const label =
            item.node === undefined
              ? `Directly in ${focusName}`
              : (item.node.label ??
                `Untitled ${presentationFor(item.node.kind).name.toLowerCase()}`)
          return (
            <div
              key={item.key}
              className={`lpg-label${item.key === place.recentId ? ' is-recent' : ''}`}
              style={{
                width,
                transform: `translate(${item.x - width / 2}px, ${top}px)`,
                opacity: item.isUnfolded ? 0 : 1
              }}
            >
              {nodeId !== null && isRenaming(rename, nodeId, 'graph') && !item.isUnfolded ? (
                <InlineRename
                  initialValue={item.node?.label ?? ''}
                  onCommit={(title) => {
                    commands.rename(nodeId, title)
                    endRename()
                  }}
                  onCancel={endRename}
                  className="lpg-input"
                />
              ) : (
                <span
                  className="lpg-label-title"
                  title={label}
                  style={mode === 'title' ? { WebkitLineClamp: 1 } : undefined}
                >
                  {label}
                </span>
              )}
              <span className="lpg-label-sub" hidden={mode === 'title'}>
                <span
                  className={
                    region === 'finished' || region === 'nothingOpen' ? 'is-done' : undefined
                  }
                >
                  {regionWords(region, summary, item.node?.finishedAt)}
                </span>
                {fresh > 0 && <span className="is-new"> · {fresh} new</span>}
              </span>
            </div>
          )
        })}

      {ready && (
        <div
          className="lpg-hub-label"
          style={{
            width: Math.max(hub.r * 2 * 0.92, 104),
            height: hub.r * 2,
            transform: `translate(${hub.x - Math.max(hub.r * 2 * 0.92, 104) / 2}px, ${hub.y - hub.r}px)`
          }}
        >
          {place.focusId !== null && isRenaming(rename, place.focusId, 'graph') ? (
            <InlineRename
              initialValue={focusNode?.label ?? ''}
              onCommit={(title) => {
                if (place.focusId !== null) commands.rename(place.focusId, title)
                endRename()
              }}
              onCancel={endRename}
              className="lpg-input pointer-events-auto"
            />
          ) : (
            <span className="lpg-hub-title" title={focusName}>
              {focusName}
            </span>
          )}
          <span className="lpg-hub-sub">{hubKind}</span>
        </div>
      )}

      {ready && (
        <div
          className="lpg-label"
          style={{
            width: 220,
            transform: `translate(${hub.x - 110}px, ${hub.y + hub.r + 6}px)`,
            opacity: placed.some(
              (item) => !item.isUnfolded && Math.abs(item.x - hub.x) < 120 && item.y > hub.y
            )
              ? 0
              : 1
          }}
        >
          <span className="lpg-label-sub">
            <span
              className={
                hubRegion === 'nothingOpen' || hubRegion === 'finished' ? 'is-done' : undefined
              }
            >
              {regionWords(hubRegion, hubSummary, focusNode?.finishedAt)}
            </span>
          </span>
        </div>
      )}

      {ready && isEmpty && (
        <div className="lpg-empty" style={{ left: hub.x, top: hub.y + hub.r + 44, width: 340 }}>
          <span>
            {place.focusId === null
              ? 'This brain is empty. Add the first domain or project.'
              : `Nothing in ${focusName} yet.`}
          </span>
          {isEditable && (
            <div className="w-full text-left">
              <AddTasks parentId={place.focusId} parentName={focusName} startOpen />
            </div>
          )}
        </div>
      )}

      {ready && unfoldedKey !== null && (
        <BranchPanel
          key={unfoldedKey}
          branchId={nodeIdOfKey(unfoldedKey)}
          hostId={place.focusId}
          hostName={focusName}
          index={index}
          progress={progress}
          selectedId={selectedId}
          isEditable={isEditable}
          isNew={isNew}
          style={{ left: panelLeft, top: 16, width: panelWidth, maxHeight: pane.height - 32 - 30 }}
          onSelect={onSelect}
          onReveal={reveal}
          onOpenAsMap={openAsMap}
          onFold={() => go(fold(place))}
          onContextMenu={onContextMenu}
        />
      )}

      {hover !== null && hoveredNode !== undefined && hover.kind === 'bubble' && (
        <div
          className="lpg-tip"
          style={{
            transform: `translate(${Math.min(hover.x + 14, pane.width - 330)}px, ${hover.y + 14}px)`
          }}
          role="tooltip"
        >
          <span className="flex flex-col">
            <span>{hoveredNode.label ?? 'Untitled'}</span>
            <span className="lpg-tip-path">
              {regionWords(
                regionOf(hoveredNode.id),
                progress.byId.get(hoveredNode.id),
                hoveredNode.finishedAt
              )}
            </span>
          </span>
        </div>
      )}

      {hover !== null && hoveredNode !== undefined && hover.kind === 'seed' && (
        <div
          className="lpg-tip"
          style={{
            transform: `translate(${Math.min(hover.x + 14, pane.width - 330)}px, ${hover.y + 14}px)`
          }}
          role="tooltip"
        >
          <StatusIcon
            status={hoveredNode.status ?? 'todo'}
            isNew={isNew(hoveredNode.id)}
            r={6}
            bg="#1a202a"
            decorative
          />
          <span className="flex flex-col">
            <span>{hoveredNode.label ?? 'Untitled task'}</span>
            <span className="lpg-tip-path">{pathWords(index, hoveredNode.id, place.focusId)}</span>
          </span>
        </div>
      )}

      <Legend />
      <div className="lpg-hint" hidden={pane.width < 1180}>
        Click a bubble to open it · double-click to make it the centre ·{' '}
        <span className="lpg-kbd">Esc</span> steps back
      </div>
    </div>
  )
}

/** The counts of the work sitting directly in the focus — the loose pod's label. */
function summarizeLoose(children: readonly ExplorerNode[]): {
  todo: number
  inProgress: number
  done: number
} {
  const summary = { todo: 0, inProgress: 0, done: 0 }
  for (const child of children) {
    if (!isWorkItem(child)) continue
    if (child.status === 'done') summary.done++
    else if (child.status === 'in_progress') summary.inProgress++
    else summary.todo++
  }
  return summary
}

/** Where a hovered seed lives, relative to the hub — `Recording › Rhythm guitar`. */
function pathWords(index: NodeIndex, nodeId: string, focusId: string | null): string {
  const names: string[] = []
  let current = index.parentIdOf.get(nodeId) ?? null
  while (current !== null && current !== focusId) {
    names.unshift(index.byId.get(current)?.label ?? 'Untitled')
    current = index.parentIdOf.get(current) ?? null
  }
  return names.join(' › ')
}

function Legend(): JSX.Element {
  return (
    <div className="lpg-legend" aria-label="Legend">
      <span>
        <StatusIcon status="todo" r={5.5} bg="#0d1015" decorative />
        To do
      </span>
      <span>
        <StatusIcon status="in_progress" r={5.5} bg="#0d1015" decorative />
        In progress
      </span>
      <span>
        <StatusIcon status="done" r={5.5} bg="#0d1015" decorative />
        Done
      </span>
      <span>
        <StatusIcon status="todo" isNew r={5.5} bg="#0d1015" decorative />
        Added this session
      </span>
      <span>
        <svg width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" fill="#111720" stroke="#3ecf8e" strokeWidth="1.6" />
        </svg>
        Nothing open right now
      </span>
      <span>
        <svg width="20" height="20" aria-hidden="true">
          <circle cx="10" cy="10" r="6" fill="#111720" stroke="#3ecf8e" strokeWidth="2.2" />
          <circle
            cx="10"
            cy="10"
            r="8.6"
            fill="none"
            stroke="#3ecf8e"
            strokeWidth="1"
            opacity="0.7"
          />
        </svg>
        Finished
      </span>
    </div>
  )
}
