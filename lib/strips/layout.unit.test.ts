import { describe, expect, it } from 'vitest'
import { computeBars, maxColumns } from './layout'

describe('computeBars', () => {
  it('scales the gap from the 643px timeline height', () => {
    const grid = computeBars(736, 1286, 10)
    expect(grid.gap).toBe(12)
    expect(grid.bars).toHaveLength(10)
  })

  it('covers the full width without overlapping', () => {
    const grid = computeBars(1000, 708, 8)
    expect(grid.bars[0].x).toBe(0)
    const last = grid.bars.at(-1)!
    expect(last.x + last.width).toBe(1000)
    for (let i = 1; i < grid.bars.length; i++) {
      const prev = grid.bars[i - 1]
      expect(grid.bars[i].x - (prev.x + prev.width)).toBeGreaterThanOrEqual(
        grid.gap - 1,
      )
    }
  })
})

describe('maxColumns', () => {
  it('keeps bars at least twice as wide as the gap', () => {
    const columns = maxColumns(643, 643)
    const grid = computeBars(643, 643, columns)
    expect(Math.min(...grid.bars.map((b) => b.width))).toBeGreaterThanOrEqual(
      grid.gap * 2 - 1,
    )
  })
})
