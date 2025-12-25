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

  canvas.width = img.width
  canvas.height = img.height

  ctx.drawImage(img, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to convert canvas to blob'))
      }
    }, 'image/gif')
  })

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
