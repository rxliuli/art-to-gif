import {
  computeBars,
  MAX_TOTAL_ASPECT,
  TIMELINE_GAP,
  TIMELINE_HEIGHT,
  TIMELINE_RADIUS,
} from './layout'

/** Height the picture is scaled down to before it is cut. */
const MAX_HEIGHT = 2048

export interface PreparedImage {
  /** The picture, scaled and cropped to what X can show in one row. */
  canvas: HTMLCanvasElement
  /** True when the sides of the picture were cut off to keep the row narrow. */
  cropped: boolean
}

export interface StripResult {
  /** One canvas per strip, left to right. */
  images: HTMLCanvasElement[]
  height: number
  cropped: boolean
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * Fit the picture to what X can show: a row wider than MAX_TOTAL_ASPECT
 * scrolls out of view, so the sides of a wider picture are cut off evenly.
 */
export function prepareImage(image: ImageBitmap): PreparedImage {
  const height = Math.min(image.height, MAX_HEIGHT)
  const scale = height / image.height
  const fullWidth = Math.max(1, Math.round(image.width * scale))
  const width = Math.min(fullWidth, Math.floor(height * MAX_TOTAL_ASPECT))

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  // X flattens transparency onto white when it re-encodes a large PNG; do it
  // here so every strip looks the same whatever its size.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, -Math.round((fullWidth - width) / 2), 0, fullWidth, height)
  return { canvas, cropped: width < fullWidth }
}

export function renderStrips(
  prepared: PreparedImage,
  columns: number,
): StripResult {
  const { width, height } = prepared.canvas
  const images = computeBars(width, height, columns).bars.map((bar) => {
    const canvas = createCanvas(bar.width, height)
    canvas.getContext('2d')!.drawImage(prepared.canvas, -bar.x, 0)
    return canvas
  })
  return { images, height, cropped: prepared.cropped }
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
  const widths = result.images.map((image) => image.width * scale)
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
    ctx.drawImage(image, x, 0, w, displayHeight)
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
        image.toBlob(
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
