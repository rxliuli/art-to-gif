import { GIFEncoder, quantize, applyPalette } from 'gifenc'

/**
 * Convert PNG/JPG image to GIF format
 * @param file - The image file to convert
 * @returns A new File object containing the GIF image
 */
export async function convertToGif(file: File): Promise<File> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  const img = await loadImage(file)

  // Twitter requires GIF dimensions to be >= 4x4 and <= 2048x2048
  const MAX_SIZE = 2048
  const MIN_SIZE = 4

  let width = img.width
  let height = img.height

  // Check if image exceeds maximum dimensions
  if (width > MAX_SIZE || height > MAX_SIZE) {
    const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height)
    width = Math.floor(width * scale)
    height = Math.floor(height * scale)
  }

  // Ensure minimum dimensions
  if (width < MIN_SIZE) width = MIN_SIZE
  if (height < MIN_SIZE) height = MIN_SIZE

  canvas.width = width
  canvas.height = height

  ctx.drawImage(img, 0, 0, width, height)

  // Get image data from canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Create GIF encoder with at least 2 frames for Twitter compatibility
  const gif = GIFEncoder()

  // Quantize colors to create a palette (max 256 colors for GIF)
  const palette = quantize(imageData.data, 256)

  // Apply palette to get indexed pixels
  const index = applyPalette(imageData.data, palette)

  // Add the same frame twice with proper animation settings for Twitter
  // Twitter requires animated GIFs to loop, otherwise they display as static images
  // First frame: set the global palette and loop forever
  gif.writeFrame(index, canvas.width, canvas.height, {
    palette,
    delay: 50,   // 50ms delay (20fps)
    repeat: 0,   // 0 = loop forever (required for Twitter)
    dispose: 1   // 1 = clear frame before rendering next
  })

  // Second frame: use the same palette from first frame
  gif.writeFrame(index, canvas.width, canvas.height, {
    delay: 50,
    dispose: 1
  })

  // Finish encoding
  gif.finish()

  // Create blob from encoded GIF
  const buffer = gif.bytes()
  const blob = new Blob([buffer], { type: 'image/gif' })

  const gifFileName = file.name.replace(/\.(png|jpe?g)$/i, '.gif')
  const gifFile = new File([blob], gifFileName, {
    type: 'image/gif',
    lastModified: Date.now(),
  })

  return gifFile
}

/**
 * Load an image file and return an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Check if a file is a PNG or JPG image
 */
export function isPngOrJpg(file: File): boolean {
  return /\.(png|jpe?g)$/i.test(file.name) ||
         file.type === 'image/png' ||
         file.type === 'image/jpeg' ||
         file.type === 'image/jpg'
}
