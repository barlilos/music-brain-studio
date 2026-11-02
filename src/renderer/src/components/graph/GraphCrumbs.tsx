/**
 * Where you are in the graph: the project, the focused node's ancestors, the
 * focus, and the unfolded branch. Every step but the last is a way back.
 *
 * This replaces the permanently visible tree as the answer to "where am I".
 */

import type { JSX } from 'react'
import type { NodeIndex } from '@shared/model/nodeIndex'
import { ancestorIdsOf } from '@shared/model/nodeIndex'
import {
  focusOn,
  fold,
  isLooseKey,
  type GraphPlace
} from '@renderer/components/graph/graphNavigation'

interface GraphCrumbsProps {
  projectName: string
  index: NodeIndex
  place: GraphPlace
  onPlaceChange: (place: GraphPlace) => void
}

export function GraphCrumbs({
  projectName,
  index,
  place,
  onPlaceChange
}: GraphCrumbsProps): JSX.Element {
  const nameOf = (id: string): string => index.byId.get(id)?.label ?? 'Untitled'

  const steps: { key: string; label: string; onClick: (() => void) | null }[] = [
    {
      key: 'root',
      label: projectName,
      onClick:
        place.focusId === null && place.unfoldedKey === null
          ? null
          : () => onPlaceChange(focusOn(place, null))
    }
  ]

  if (place.focusId !== null) {
    for (const id of ancestorIdsOf(index, place.focusId)) {
      steps.push({ key: id, label: nameOf(id), onClick: () => onPlaceChange(focusOn(place, id)) })
    }
    steps.push({
      key: place.focusId,
      label: nameOf(place.focusId),
      onClick: place.unfoldedKey === null ? null : () => onPlaceChange(fold(place))
    })
  } else if (place.unfoldedKey !== null) {
    // On the brain map the project crumb folds rather than re-roots.
    steps[0] = { ...steps[0]!, onClick: () => onPlaceChange(fold(place)) }
  }

  if (place.unfoldedKey !== null) {
    steps.push({
      key: place.unfoldedKey,
      label: isLooseKey(place.unfoldedKey) ? 'Tasks here' : nameOf(place.unfoldedKey),
      onClick: null
    })
  }

  return (
    <nav className="lpg-crumbs" aria-label="Location">
      {steps.map((step, i) => (
        <span key={step.key} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span className="sep">›</span>}
          {step.onClick === null ? (
            <span className="here truncate" aria-current="location" title={step.label}>
              {step.label}
            </span>
          ) : (
            <button type="button" onClick={step.onClick} title={step.label}>
              {step.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}
