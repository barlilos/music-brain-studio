import { describe, expect, it } from 'vitest'
import type { ExplorerNode } from '@shared/model/node'
import { indexNodes } from '@shared/model/nodeIndex'
import {
  START_PLACE,
  focusOn,
  fold,
  looseKey,
  reconcilePlace,
  revealPlace,
  unfold,
  up
} from '@renderer/components/graph/graphNavigation'

const task = (id: string): ExplorerNode => ({
  id,
  label: id,
  kind: 'task',
  status: 'todo',
  tags: [],
  children: []
})
const area = (id: string, children: ExplorerNode[]): ExplorerNode => ({
  id,
  label: id,
  kind: 'area',
  status: undefined,
  tags: [],
  children
})

/**
 *   insaint
 *     recording
 *       guitar
 *         take   ← three levels below the project
 *       bounce
 *     styling (empty)
 *   loose        ← a top-level task
 */
const roots = [
  area('insaint', [
    area('recording', [area('guitar', [task('take')]), task('bounce')]),
    area('styling', [])
  ]),
  task('loose')
]
const index = indexNodes(roots)

describe('revealPlace', () => {
  it('opens a task’s parent beside the grandparent and selects the task', () => {
    expect(revealPlace(index, 'take')).toEqual({
      place: { focusId: 'recording', unfoldedKey: 'guitar', recentId: null },
      select: 'take'
    })
  })

  it('opens a branch beside its parent', () => {
    expect(revealPlace(index, 'recording')).toEqual({
      place: { focusId: 'insaint', unfoldedKey: 'recording', recentId: null },
      select: null
    })
  })

  it('opens a top-level domain on the brain map', () => {
    expect(revealPlace(index, 'insaint').place).toEqual({
      focusId: null,
      unfoldedKey: 'insaint',
      recentId: null
    })
  })

  it('opens a top-level task in the project’s loose pod', () => {
    expect(revealPlace(index, 'loose')).toEqual({
      place: { focusId: null, unfoldedKey: looseKey(null), recentId: null },
      select: 'loose'
    })
  })

  it('opens an empty branch so its first task can be added', () => {
    expect(revealPlace(index, 'styling').place.unfoldedKey).toBe('styling')
  })

  it('is total for an id that no longer exists', () => {
    expect(revealPlace(index, 'gone')).toEqual({ place: START_PLACE, select: null })
  })
})

describe('stepping out', () => {
  it('folds first, then climbs one level at a time, marking where it came from', () => {
    let place = unfold(focusOn(START_PLACE, 'recording'), 'guitar')
    place = up(place, index)
    expect(place).toEqual({ focusId: 'recording', unfoldedKey: null, recentId: 'guitar' })
    place = up(place, index)
    expect(place).toEqual({ focusId: 'insaint', unfoldedKey: null, recentId: 'recording' })
    place = up(place, index)
    expect(place).toEqual({ focusId: null, unfoldedKey: null, recentId: 'insaint' })
    expect(up(place, index)).toBe(place)
  })

  it('remembers the previous focus when re-rooting', () => {
    expect(
      focusOn({ focusId: 'insaint', unfoldedKey: 'recording', recentId: null }, 'recording')
    ).toEqual({ focusId: 'recording', unfoldedKey: null, recentId: 'insaint' })
  })

  it('fold keeps the focus', () => {
    expect(fold({ focusId: 'insaint', unfoldedKey: 'recording', recentId: null })).toEqual({
      focusId: 'insaint',
      unfoldedKey: null,
      recentId: 'recording'
    })
  })
})

describe('reconcilePlace', () => {
  it('leaves a valid place untouched, by identity', () => {
    const place = { focusId: 'insaint', unfoldedKey: 'recording', recentId: null }
    expect(reconcilePlace(place, index)).toBe(place)
  })

  it('folds a panel whose branch was moved elsewhere', () => {
    const moved = indexNodes([
      area('insaint', [area('styling', [area('recording', [task('bounce')])])]),
      task('loose')
    ])
    expect(
      reconcilePlace({ focusId: 'insaint', unfoldedKey: 'recording', recentId: null }, moved)
    ).toEqual({ focusId: 'insaint', unfoldedKey: null, recentId: null })
  })

  it('climbs out of a focus that no longer exists', () => {
    expect(
      reconcilePlace({ focusId: 'gone', unfoldedKey: null, recentId: null }, index).focusId
    ).toBeNull()
  })

  it('folds a loose pod once its tasks are gone', () => {
    const noLoose = indexNodes([roots[0]!])
    expect(
      reconcilePlace({ focusId: null, unfoldedKey: looseKey(null), recentId: null }, noLoose)
        .unfoldedKey
    ).toBeNull()
  })
})
