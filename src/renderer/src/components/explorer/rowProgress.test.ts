import { describe, expect, it } from 'vitest'
import { rowBadgeFor } from '@renderer/components/explorer/rowProgress'

const summary = (
  todo: number,
  inProgress: number,
  done: number
): {
  todo: number
  inProgress: number
  done: number
} => ({ todo, inProgress, done })

describe('rowBadgeFor', () => {
  it('shows how much is left when there is work below', () => {
    expect(rowBadgeFor(summary(12, 1, 2), 15)).toEqual({
      text: '13',
      title: '12 open · 1 in progress · 2 done'
    })
  })

  it('counts in-progress work as still open', () => {
    expect(rowBadgeFor(summary(0, 3, 0), 3)?.text).toBe('3')
  })

  it('marks a fully finished branch rather than showing a zero', () => {
    // "0" beside a finished area reads as a warning; a tick reads as done.
    expect(rowBadgeFor(summary(0, 0, 5), 5)).toEqual({ text: '✓', title: '5 done' })
  })

  it('falls back to the child count when nothing below is work', () => {
    expect(rowBadgeFor(summary(0, 0, 0), 4)).toEqual({ text: '4', title: '4 inside' })
    expect(rowBadgeFor(undefined, 4)).toEqual({ text: '4', title: '4 inside' })
  })

  it('shows nothing for an empty leaf', () => {
    expect(rowBadgeFor(summary(0, 0, 0), 0)).toBeNull()
    expect(rowBadgeFor(undefined, 0)).toBeNull()
  })

  it('omits the parts that are zero', () => {
    expect(rowBadgeFor(summary(7, 0, 0), 7)?.title).toBe('7 open')
  })
})
