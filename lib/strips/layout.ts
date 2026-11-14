/**
 * Geometry for the "3D strips" effect on X.
 *
 * X shows a multi-image post as a row of images at their native aspect ratio,
 * separated by a fixed 6 px (4 px gap plus a 1 px border on each image) with
 * 8 px rounded corners. The effect cuts the picture into vertical bars. Bars
 * the subject does not reach become separate images, so the gaps between them
 * are X's own. Bars the subject crosses are kept in one image whose gaps are
 * transparent pixels sized to look the same, which is the only way anything
 * can be drawn "over" a gap.
 *
 * Measured on x.com (desktop web, November 2026):
 * - The row is 643 px tall in the home and profile timelines, 702 px on the
 *   post's own page and 354 px inside a quoted post. The gap stays 6 px in all
 *   three, so fake gaps can only match one of them; the timeline is used.
 * - An image wider than 9:14 is centre-cropped to 9:14.
 * - The row is 598 px wide. Anything beyond that scrolls out of view, which
 *   on the post's own page means a total aspect ratio above about 0.85.
 */
export const TIMELINE_HEIGHT = 643
export const TIMELINE_GAP = 6
export const TIMELINE_RADIUS = 8
export const MAX_IMAGE_ASPECT = 9 / 14
export const MAX_TOTAL_ASPECT = 0.85

export interface Bar {
  x: number
  width: number
}

export interface BarGrid {
  bars: Bar[]
  /** Gap between bars, in image pixels. */
  gap: number
  /** Corner radius of a bar, in image pixels. */
  radius: number
}

export interface PlannedImage {
  x: number
  width: number
  /** Index of the first and last bar this image contains. */
  from: number
  to: number
}

export function computeBars(
  width: number,
  height: number,
  columns: number,
): BarGrid {
  const scale = height / TIMELINE_HEIGHT
  const gap = Math.max(1, Math.round(TIMELINE_GAP * scale))
  const radius = Math.max(1, Math.round(TIMELINE_RADIUS * scale))
  const barWidth = (width - gap * (columns - 1)) / columns
  const bars: Bar[] = []
  for (let i = 0; i < columns; i++) {
    const start = Math.round(i * (barWidth + gap))
    const end = Math.round(i * (barWidth + gap) + barWidth)
    bars.push({ x: start, width: end - start })
  }
  return { bars, gap, radius }
}

/** The most columns that still leaves every bar at least twice as wide as a gap. */
export function maxColumns(width: number, height: number): number {
  const gap = Math.max(1, Math.round((TIMELINE_GAP * height) / TIMELINE_HEIGHT))
  return Math.max(2, Math.floor((width + gap) / (3 * gap)))
}

/**
 * Find the run of bars that has to stay in one image: from the first gap the
 * subject covers to the last one. Returns bar indexes, or null when the
 * subject crosses no gap (there is nothing to pop out).
 */
export function findMergedRange(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  grid: BarGrid,
  options: { threshold?: number; minCoverage?: number } = {},
): [number, number] | null {
  const threshold = options.threshold ?? 128
  const minCoverage = options.minCoverage ?? 0.01
  let first = -1
  let last = -1
  for (let i = 0; i < grid.bars.length - 1; i++) {
    const x0 = grid.bars[i].x + grid.bars[i].width
    const x1 = grid.bars[i + 1].x
    if (x1 <= x0) continue
    let covered = 0
    for (let y = 0; y < height; y++) {
      const row = y * width
      for (let x = x0; x < x1; x++) {
        if (alpha[row + x] >= threshold) covered++
      }
    }
    if (covered / ((x1 - x0) * height) >= minCoverage) {
      if (first === -1) first = i
      last = i
    }
  }
  return first === -1 ? null : [first, last + 1]
}

/**
 * Shrink a merged range until its image is no wider than `maxWidth`, dropping
 * whichever end bar holds less of the subject. `weights` is the amount of
 * subject in each bar.
 */
export function fitMergedRange(
  grid: BarGrid,
  merged: [number, number],
  maxWidth: number,
  weights: ArrayLike<number>,
): [number, number] | null {
  let [from, to] = merged
  const width = () =>
    grid.bars[to].x + grid.bars[to].width - grid.bars[from].x
  while (from < to && width() > maxWidth) {
    if (weights[from] <= weights[to]) from++
    else to--
  }
  return from < to ? [from, to] : null
}

/** How much of the subject each bar holds, as a pixel count. */
export function subjectPerBar(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  grid: BarGrid,
  threshold = 128,
): number[] {
  return grid.bars.map((bar) => {
    let count = 0
    for (let y = 0; y < height; y++) {
      const row = y * width
      for (let x = bar.x; x < bar.x + bar.width; x++) {
        if (alpha[row + x] >= threshold) count++
      }
    }
    return count
  })
}

/** The images to upload, left to right. */
export function planImages(
  grid: BarGrid,
  merged: [number, number] | null,
): PlannedImage[] {
  const images: PlannedImage[] = []
  for (let i = 0; i < grid.bars.length; i++) {
    if (merged && i === merged[0]) {
      const from = grid.bars[merged[0]]
      const to = grid.bars[merged[1]]
      images.push({
        x: from.x,
        width: to.x + to.width - from.x,
        from: merged[0],
        to: merged[1],
      })
      i = merged[1]
      continue
    }
    images.push({ x: grid.bars[i].x, width: grid.bars[i].width, from: i, to: i })
  }
  return images
}
