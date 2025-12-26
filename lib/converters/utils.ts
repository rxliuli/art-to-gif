/**
 * Load an image file and return an HTMLImageElement
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
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

export interface ScaleDimensions {
  width: number
  height: number
  scale: number
  wasScaled: boolean
}

export interface ScaleConstraints {
  maxWidth: number
  maxHeight: number
  minWidth?: number
  minHeight?: number
}

/**
 * Scale image dimensions to fit within constraints while maintaining aspect ratio
 * @param width - Original width
 * @param height - Original height
 * @param constraints - Maximum and minimum dimension constraints
 * @returns Scaled dimensions with scale factor and whether scaling was applied
 */
export function scaleImageDimensions(
  width: number,
  height: number,
  constraints: ScaleConstraints,
): ScaleDimensions {
  let newWidth = width
  let newHeight = height
  let scale = 1
  let wasScaled = false

  // Apply maximum dimension constraints
  if (newWidth > constraints.maxWidth || newHeight > constraints.maxHeight) {
    const scaleW = constraints.maxWidth / newWidth
    const scaleH = constraints.maxHeight / newHeight
    scale = Math.min(scaleW, scaleH)
    newWidth = Math.round(newWidth * scale)
    newHeight = Math.round(newHeight * scale)
    wasScaled = true
  }

  // Apply minimum dimension constraints
  const minWidth = constraints.minWidth ?? 1
  const minHeight = constraints.minHeight ?? 1

  if (newWidth < minWidth) {
    newWidth = minWidth
    wasScaled = true
  }
  if (newHeight < minHeight) {
    newHeight = minHeight
    wasScaled = true
  }

  return {
    width: newWidth,
    height: newHeight,
    scale,
    wasScaled,
  }
}

/**
 * Check if WebCodecs API with Twitter-compatible codecs (H.264/H.265) is supported
 * This is used to determine if VideoConverterV2 can be used
 */
export async function isWebCodecsVideoSupported(): Promise<boolean> {
  // Check if VideoEncoder API is available
  if (typeof VideoEncoder === 'undefined') {
    return false
  }

  // Check if at least one Twitter-compatible codec is supported
  // Twitter/X only supports H.264 (avc) and H.265 (hevc)
  const codecs = [
    'avc1.42001E', // H.264 Baseline
    'avc1.4D401E', // H.264 Main
    'hev1.1.6.L93.B0', // H.265
  ]

  for (const codec of codecs) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width: 1920,
        height: 1080,
      })

      if (support.supported) {
        return true
      }
    } catch {
      // Codec check failed, try next one
      continue
    }
  }

  return false
}
