import { describe, expect, it } from 'vitest'
import {
  computeBars,
  findMergedRange,
  fitMergedRange,
  maxColumns,
  planImages,
  subjectPerBar,
} from './layout'

function maskWithSubject(
  width: number,
  height: number,
  x0: number,
  x1: number,
): Uint8Array {
  const alpha = new Uint8Array(width * height)
  for (let y = Math.floor(height / 4); y < Math.floor((height * 3) / 4); y++) {
    for (let x = x0; x < x1; x++) alpha[y * width + x] = 255
  }
  return alpha
}

describe('computeBars', () => {
  it('scales the gap from the 643px timeline height', () => {
    const grid = computeBars(736, 1286, 10)
    expect(grid.gap).toBe(12)
    expect(grid.radius).toBe(16)
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

describe('findMergedRange', () => {
  const width = 1000
  const height = 643
  const grid = computeBars(width, height, 10)

  it('returns null when the subject crosses no gap', () => {
    const bar = grid.bars[4]
    const alpha = maskWithSubject(width, height, bar.x + 5, bar.x + bar.width - 5)
    expect(findMergedRange(alpha, width, height, grid)).toBeNull()
  })

  it('merges the bars on both sides of every gap the subject covers', () => {
    const alpha = maskWithSubject(
      width,
      height,
      grid.bars[3].x + 10,
      grid.bars[6].x + 10,
    )
    expect(findMergedRange(alpha, width, height, grid)).toEqual([3, 6])
  })

  it('ignores a few stray pixels in a gap', () => {
    const alpha = new Uint8Array(width * height)
    alpha[10 * width + grid.bars[0].width + 1] = 255
    expect(findMergedRange(alpha, width, height, grid)).toBeNull()
  })
})

describe('fitMergedRange', () => {
  const width = 1000
  const height = 643
  const grid = computeBars(width, height, 10)

  it('keeps a range that already fits', () => {
    expect(fitMergedRange(grid, [3, 6], 1000, new Array(10).fill(1))).toEqual([
      3, 6,
    ])
  })

  it('drops the end bars that hold the least of the subject', () => {
    const alpha = maskWithSubject(
      width,
      height,
      grid.bars[2].x + grid.bars[2].width - 4,
      grid.bars[7].x + 40,
    )
    const weights = subjectPerBar(alpha, width, height, grid)
    const maxWidth = grid.bars[6].x + grid.bars[6].width - grid.bars[3].x
    expect(fitMergedRange(grid, [2, 7], maxWidth, weights)).toEqual([3, 6])
  })

  it('returns null when not even two bars fit', () => {
    expect(fitMergedRange(grid, [3, 6], 50, new Array(10).fill(1))).toBeNull()
  })
})

describe('planImages', () => {
  const grid = computeBars(1000, 643, 10)

  it('gives one image per bar when nothing is merged', () => {
    expect(planImages(grid, null)).toHaveLength(10)
  })

  it('collapses the merged bars into one image, in order', () => {
    const images = planImages(grid, [3, 6])
    expect(images).toHaveLength(7)
    expect(images[3]).toEqual({
      x: grid.bars[3].x,
      width: grid.bars[6].x + grid.bars[6].width - grid.bars[3].x,
      from: 3,
      to: 6,
    })
    expect(images.map((i) => i.x)).toEqual(
      [...images.map((i) => i.x)].sort((a, b) => a - b),
    )
  })
})
