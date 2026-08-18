import { describe, expect, it } from 'vitest'
import { parseBulkLines } from '@renderer/components/editing/bulkAdd'

describe('parseBulkLines', () => {
  it('makes one title per line', () => {
    expect(parseBulkLines('One\nTwo\nThree')).toEqual(['One', 'Two', 'Three'])
  })

  it('preserves the order they were typed in', () => {
    expect(parseBulkLines('Zebra\nApple\nMango')).toEqual(['Zebra', 'Apple', 'Mango'])
  })

  it('trims each line', () => {
    expect(parseBulkLines('  One  \n\tTwo\t')).toEqual(['One', 'Two'])
  })

  it('discards blank lines wherever they appear', () => {
    expect(parseBulkLines('\n\nOne\n\n   \nTwo\n\n')).toEqual(['One', 'Two'])
  })

  it('handles Windows line endings', () => {
    // Text pasted from a Windows editor, which would otherwise leave a carriage
    // return at the end of every title.
    expect(parseBulkLines('One\r\nTwo\r\n')).toEqual(['One', 'Two'])
  })

  it('returns nothing for text with no content', () => {
    expect(parseBulkLines('')).toEqual([])
    expect(parseBulkLines('   \n\t\n  ')).toEqual([])
  })
})
