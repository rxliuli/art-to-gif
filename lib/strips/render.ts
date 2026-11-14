import {
  BarGrid,
  computeBars,
  findMergedRange,
  fitMergedRange,
  MAX_IMAGE_ASPECT,
  MAX_TOTAL_ASPECT,
  planImages,
  subjectPerBar,
  TIMELINE_GAP,
  TIMELINE_HEIGHT,
  TIMELINE_RADIUS,
} from './layout'

/** Height the source picture is scaled down to before anything else. */
const MAX_SOURCE_HEIGHT = 1280
/**
 * Longest side of an uploaded image. X keeps a PNG as a PNG only up to 900 px;
 * anything larger is re-encoded as JPEG, which turns the transparent gaps
 * white.
 */
const MAX_OUTPUT_SIZE = 900
/** How much taller than the picture the bars may grow to fit a wide subject. */
const MAX_PADDING_FACTOR = 2.5

export type Background = 'light' | 'dark' | 'mixed'

export interface PreparedImage {
  width: number
  height: number
  /** Opaque pixels of the picture, flattened onto white. */
  pixels: ImageData
  /** Subject mask at the same size, 0-255. */
  alpha: Uint8ClampedArray
  /** Whether the area around the subject is close to plain white or black. */
  background: Background
  /** Horizontal extent of the subject, in pixels. */
  subject: { left: number; right: number } | null
}

export interface StripOptions {
  columns: number
  /** Colour for the bars' background as #rrggbb, or null to keep the picture's own. */
  tint: string | null
}

export interface StripImage {
  canvas: HTMLCanvasElement
  /** True for the image that holds the subject and the transparent gaps. */
  merged: boolean
}

export interface StripResult {
  images: StripImage[]
  width: number
  height: number
  /** False when the subject crosses no gap, so nothing pops out. */
  popsOut: boolean
  /** True when the sides of the picture were cut off to keep the row narrow. */
  cropped: boolean
  /** True when the subject is too wide for one image, so its edges stay flat. */
  subjectClipped: boolean
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function prepareImage(
  image: ImageBitmap,
  mask: HTMLCanvasElement,
): PreparedImage {
  const height = Math.min(image.height, MAX_SOURCE_HEIGHT)
  const width = Math.max(1, Math.round((image.width * height) / image.height))

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height)

  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mask, 0, 0, width, height)
  const scaled = ctx.getImageData(0, 0, width, height).data
  const alpha = new Uint8ClampedArray(width * height)
  let backgroundCount = 0
  let backgroundLuma = 0
  let left = width
  let right = -1
  for (let i = 0; i < alpha.length; i++) {
    // The mask is a 320px map scaled up, so its edge is a wide soft ramp.
    // Tighten it to keep the background from showing as a halo.
    alpha[i] = ((scaled[i * 4 + 3] - 64) / 128) * 255
    if (alpha[i] < 26) {
      backgroundCount++
      backgroundLuma +=
        0.299 * pixels.data[i * 4] +
        0.587 * pixels.data[i * 4 + 1] +
        0.114 * pixels.data[i * 4 + 2]
    } else if (alpha[i] >= 128) {
      const x = i % width
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  const luma = backgroundCount ? backgroundLuma / backgroundCount : 128
  const background: Background =
    luma > 230 ? 'light' : luma < 25 ? 'dark' : 'mixed'

  return {
    width,
    height,
    pixels,
    alpha,
    background,
    subject: right >= left ? { left, right: right + 1 } : null,
  }
}

interface Frame {
  width: number
  height: number
  pixels: Uint8ClampedArray
  alpha: Uint8ClampedArray
  cropped: boolean
}

/**
 * Fit the picture to what X can show. A plain background can simply be
 * extended, so the frame grows taller until the subject fits in one 9:14
 * image and the whole row fits the timeline. A picture with a real background
 * cannot be extended, so its sides are cut off around the subject instead.
 */
function frameImage(prepared: PreparedImage, mergedWidth: number): Frame {
  const { width, height, pixels, alpha, background, subject } = prepared

  if (background !== 'mixed') {
    const wanted = Math.max(
      height,
      Math.ceil(width / MAX_TOTAL_ASPECT),
      Math.ceil(mergedWidth / MAX_IMAGE_ASPECT),
    )
    const framed = Math.min(wanted, Math.round(height * MAX_PADDING_FACTOR))
    if (framed === height) {
      return { width, height, pixels: pixels.data, alpha, cropped: false }
    }
    const top = Math.floor((framed - height) / 2)
    const data = new Uint8ClampedArray(width * framed * 4)
    data.fill(background === 'light' ? 255 : 0)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    data.set(pixels.data, top * width * 4)
    const framedAlpha = new Uint8ClampedArray(width * framed)
    framedAlpha.set(alpha, top * width)
    // A "plain" background is rarely perfectly flat. Fade the picture's top
    // and bottom edges into the fill so the extension shows no seam, leaving
    // the subject untouched.
    const fill = background === 'light' ? 255 : 0
    const fade = Math.min(Math.round(height * 0.12), Math.floor(height / 2))
    for (let row = 0; row < fade; row++) {
      const strength = 1 - (row + 0.5) / fade
      for (const y of [top + row, top + height - 1 - row]) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x
          const weight = strength * (1 - framedAlpha[i] / 255)
          if (weight === 0) continue
          for (let c = 0; c < 3; c++) {
            data[i * 4 + c] += (fill - data[i * 4 + c]) * weight
          }
        }
      }
    }
    return {
      width,
      height: framed,
      pixels: data,
      alpha: framedAlpha,
      cropped: false,
    }
  }

  const target = Math.floor(height * MAX_TOTAL_ASPECT)
  if (width <= target) {
    return { width, height, pixels: pixels.data, alpha, cropped: false }
  }
  const center = subject ? (subject.left + subject.right) / 2 : width / 2
  const left = Math.max(
    0,
    Math.min(width - target, Math.round(center - target / 2)),
  )
  const data = new Uint8ClampedArray(target * height * 4)
  const cropAlpha = new Uint8ClampedArray(target * height)
  for (let y = 0; y < height; y++) {
    const from = y * width + left
    data.set(
      pixels.data.subarray(from * 4, (from + target) * 4),
      y * target * 4,
    )
    cropAlpha.set(alpha.subarray(from, from + target), y * target)
  }
  return {
    width: target,
    height,
    pixels: data,
    alpha: cropAlpha,
    cropped: true,
  }
}

interface Layout {
  frame: Frame
  grid: BarGrid
  merged: [number, number] | null
  subjectClipped: boolean
}

function mergedWidthOf(grid: BarGrid, merged: [number, number] | null) {
  if (!merged) return 0
  const to = grid.bars[merged[1]]
  return to.x + to.width - grid.bars[merged[0]].x
}

function layOut(prepared: PreparedImage, columns: number): Layout {
  // The frame's height sets the gap width, and the gap width decides which
  // bars the subject merges, so settle the two over a few rounds.
  let needed = prepared.subject
    ? prepared.subject.right - prepared.subject.left
    : 0
  let frame = frameImage(prepared, needed)
  let grid = computeBars(frame.width, frame.height, columns)
  let merged = findMergedRange(frame.alpha, frame.width, frame.height, grid)
  for (let round = 0; round < 3; round++) {
    const width = mergedWidthOf(grid, merged)
    if (width <= frame.height * MAX_IMAGE_ASPECT || width <= needed) break
    needed = width
    frame = frameImage(prepared, needed)
    grid = computeBars(frame.width, frame.height, columns)
    merged = findMergedRange(frame.alpha, frame.width, frame.height, grid)
  }

  let subjectClipped = false
  const limit = frame.height * MAX_IMAGE_ASPECT
  if (merged && mergedWidthOf(grid, merged) > limit) {
    const weights = subjectPerBar(frame.alpha, frame.width, frame.height, grid)
    merged = fitMergedRange(grid, merged, limit, weights)
    subjectClipped = true
  }
  return { frame, grid, merged, subjectClipped }
}

function parseColor(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/**
 * Colour the area around the subject. Multiply turns white into the colour
 * and keeps whatever soft detail the background has; a black background
 * needs screen for the same result.
 */
function tintBackground(
  frame: Frame,
  tint: string | null,
  background: Background,
): ImageData {
  const data = new Uint8ClampedArray(frame.pixels)
  if (tint) {
    const color = parseColor(tint)
    const screen = background === 'dark'
    for (let i = 0; i < frame.alpha.length; i++) {
      const weight = 1 - frame.alpha[i] / 255
      if (weight === 0) continue
      for (let c = 0; c < 3; c++) {
        const value = data[i * 4 + c]
        const tinted = screen
          ? 255 - ((255 - value) * (255 - color[c])) / 255
          : (value * color[c]) / 255
        data[i * 4 + c] = value * (1 - weight) + tinted * weight
      }
    }
  }
  return new ImageData(data, frame.width, frame.height)
}

function drawMerged(
  base: HTMLCanvasElement,
  subject: HTMLCanvasElement,
  grid: BarGrid,
  from: number,
  to: number,
): HTMLCanvasElement {
  const left = grid.bars[from].x
  const right = grid.bars[to].x + grid.bars[to].width
  const canvas = createCanvas(right - left, base.height)
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.beginPath()
  for (let i = from; i <= to; i++) {
    const bar = grid.bars[i]
    ctx.roundRect(bar.x - left, 0, bar.width, base.height, grid.radius)
  }
  ctx.clip()
  ctx.drawImage(base, -left, 0)
  ctx.restore()
  // The subject goes on top of everything, including the transparent gaps.
  ctx.drawImage(subject, -left, 0)
  return canvas
}

export function renderStrips(
  prepared: PreparedImage,
  options: StripOptions,
): StripResult {
  const { frame, grid, merged, subjectClipped } = layOut(
    prepared,
    options.columns,
  )
  const { width, height } = frame

  const tinted = tintBackground(frame, options.tint, prepared.background)
  const base = createCanvas(width, height)
  base.getContext('2d')!.putImageData(tinted, 0, 0)

  const subject = createCanvas(width, height)
  const subjectData = new ImageData(
    new Uint8ClampedArray(tinted.data),
    width,
    height,
  )
  for (let i = 0; i < frame.alpha.length; i++) {
    subjectData.data[i * 4 + 3] = frame.alpha[i]
  }
  subject.getContext('2d')!.putImageData(subjectData, 0, 0)

  const images = planImages(grid, merged).map((plan): StripImage => {
    if (plan.from !== plan.to) {
      return {
        canvas: drawMerged(base, subject, grid, plan.from, plan.to),
        merged: true,
      }
    }
    const canvas = createCanvas(plan.width, height)
    canvas.getContext('2d')!.drawImage(base, -plan.x, 0)
    return { canvas, merged: false }
  })

  const scale = Math.min(1, MAX_OUTPUT_SIZE / height)
  if (scale < 1) {
    for (const image of images) {
      const small = createCanvas(
        Math.max(1, Math.round(image.canvas.width * scale)),
        MAX_OUTPUT_SIZE,
      )
      const ctx = small.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image.canvas, 0, 0, small.width, small.height)
      image.canvas = small
    }
  }

  return {
    images,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    popsOut: merged !== null,
    cropped: frame.cropped,
    subjectClipped,
  }
}

/**
 * Draw the images the way X lays them out in the timeline, on the page
 * background of the theme in use. The canvas is drawn at `displayHeight` and
 * left to CSS to scale down, so it keeps its proportions in a small dialog.
 */
export function drawPreview(
  canvas: HTMLCanvasElement,
  result: StripResult,
  background: string,
  dark: boolean,
  displayHeight = 420,
) {
  const ratio = window.devicePixelRatio || 1
  const zoom = displayHeight / TIMELINE_HEIGHT
  const gap = TIMELINE_GAP * zoom
  const radius = TIMELINE_RADIUS * zoom
  const scale = displayHeight / result.height
  const widths = result.images.map((image) => image.canvas.width * scale)
  const cssWidth =
    widths.reduce((sum, w) => sum + w, 0) + gap * (result.images.length - 1)
  canvas.width = Math.round(cssWidth * ratio)
  canvas.height = Math.round(displayHeight * ratio)
  canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`

  const ctx = canvas.getContext('2d')!
  ctx.scale(ratio, ratio)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, cssWidth, displayHeight)
  ctx.imageSmoothingQuality = 'high'
  ctx.strokeStyle = dark ? 'rgb(47, 51, 54)' : 'rgb(207, 217, 222)'
  ctx.lineWidth = zoom

  let x = 0
  result.images.forEach((image, index) => {
    const w = widths[index]
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, 0, w, displayHeight, radius)
    ctx.clip()
    ctx.drawImage(image.canvas, x, 0, w, displayHeight)
    ctx.restore()
    ctx.beginPath()
    ctx.roundRect(
      x + zoom / 2,
      zoom / 2,
      w - zoom,
      displayHeight - zoom,
      radius,
    )
    ctx.stroke()
    x += w + gap
  })
}

export async function toFiles(
  result: StripResult,
  baseName: string,
): Promise<File[]> {
  return Promise.all(
    result.images.map(async (image, index) => {
      const blob = await new Promise<Blob>((resolve, reject) => {
        image.canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG'))),
          'image/png',
        )
      })
      const number = String(index + 1).padStart(2, '0')
      return new File([blob], `${baseName}-${number}.png`, {
        type: 'image/png',
      })
    }),
  )
}
