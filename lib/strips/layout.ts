/**
 * Geometry for the "strips" effect on X.
 *
 * X shows a multi-image post as a row of images at their native aspect ratio,
 * separated by a fixed 6 px (4 px gap plus a 1 px border on each image) with
 * 8 px rounded corners. The effect cuts the picture into vertical bars and
 * uploads each one as its own image, so the gaps between them are X's own.
 * The part of the picture that falls in a gap is left out, which keeps lines
 * that run across several bars aligned, like a view through a fence.
 *
 * Measured on x.com (desktop web, November 2026):
 * - The row is 643 px tall in the home and profile timelines, 702 px on the
 *   post's own page and 354 px inside a quoted post. The gap stays 6 px in all
 *   three, so the width left out can only match one of them; the timeline is
 *   used.
 * - The row is 598 px wide. Anything beyond that scrolls out of view, which
 *   on the post's own page means a total aspect ratio above about 0.85.
 */
export const TIMELINE_HEIGHT = 643
export const TIMELINE_GAP = 6
export const TIMELINE_RADIUS = 8
export const MAX_TOTAL_ASPECT = 0.85

export interface Bar {
  x: number
  width: number
}

export interface BarGrid {
  bars: Bar[]
  /** Gap between bars, in image pixels. */
  gap: number
}

export function computeBars(
  width: number,
  height: number,
  columns: number,
): BarGrid {
  const scale = height / TIMELINE_HEIGHT
  const gap = Math.max(1, Math.round(TIMELINE_GAP * scale))
  const barWidth = (width - gap * (columns - 1)) / columns
  const bars: Bar[] = []
  for (let i = 0; i < columns; i++) {
    const start = Math.round(i * (barWidth + gap))
    const end = Math.round(i * (barWidth + gap) + barWidth)
    bars.push({ x: start, width: end - start })
  }
  return { bars, gap }
}

/** The most columns that still leaves every bar at least twice as wide as a gap. */
export function maxColumns(width: number, height: number): number {
  const gap = Math.max(1, Math.round((TIMELINE_GAP * height) / TIMELINE_HEIGHT))
  return Math.max(2, Math.floor((width + gap) / (3 * gap)))
}
