import type { IImageConverter } from './IImageConverter'
import { loadImage, scaleImageDimensions } from './utils'

/**
 * Converts images to video format
 */
export class VideoConverter implements IImageConverter {
  /**
   * Convert PNG/JPG image to video format using MediaRecorder
   * @param file - The image file to convert
   * @returns A new File object containing the video
   */
  async convert(file: File): Promise<File> {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    const img = await loadImage(file)

    // Scale image dimensions to fit Twitter video limits
    // Twitter video limits: 1920x1200 (landscape) or 1200x1900 (portrait)
    const MAX_WIDTH = 1920
    const MAX_HEIGHT = img.width > img.height ? 1200 : 1900 // Landscape vs Portrait
    const MIN_SIZE = 4

    const { width, height } = scaleImageDimensions(img.width, img.height, {
      maxWidth: MAX_WIDTH,
      maxHeight: MAX_HEIGHT,
      minWidth: MIN_SIZE,
      minHeight: MIN_SIZE,
    })

    canvas.width = width
    canvas.height = height

    // Draw the image once
    ctx.drawImage(img, 0, 0, width, height)

    // Get media stream from canvas
    const stream = canvas.captureStream(30) // 30fps

    // Check supported MIME types
    const mimeType = this.getSupportedMimeType()

    // Create MediaRecorder with optimized settings
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    })

    const chunks: Blob[] = []

    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Stop all tracks to free resources
        stream.getTracks().forEach((track) => track.stop())

        // Check if we got any data
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
        if (chunks.length === 0 || totalSize === 0) {
          reject(
            new Error(
              `MediaRecorder failed to encode video. Canvas size: ${width}x${height}. ` +
                'This may be due to canvas size limitations or unsupported codec.',
            ),
          )
          return
        }

        // Create blob from chunks
        const blob = new Blob(chunks, { type: mimeType })

        // Determine file extension based on mime type
        const extension = mimeType.includes('mp4') ? '.mp4' : '.webm'
        const videoFileName = file.name.replace(/\.(png|jpe?g)$/i, extension)

        // For Twitter compatibility, use a more standard MIME type
        const standardMimeType = mimeType.includes('mp4')
          ? 'video/mp4'
          : 'video/webm'

        const videoFile = new File([blob], videoFileName, {
          type: standardMimeType,
          lastModified: Date.now(),
        })

        resolve(videoFile)
      }

      mediaRecorder.onerror = (event) => {
        stream.getTracks().forEach((track) => track.stop())
        reject(new Error('MediaRecorder error: ' + event))
      }

      // Start recording
      mediaRecorder.start()

      // Record for 1000ms to ensure Twitter accepts it and give encoder time
      // Twitter requires minimum 0.5 seconds, 1000ms provides margin for large canvases
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop()
        }
      }, 1000)
    })
  }

  /**
   * Get the best supported MIME type for video recording
   */
  private getSupportedMimeType(): string {
    // Prefer MP4 for better Twitter compatibility, fallback to WebM
    const types = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      // Twitter don't officially support WebM
      // 'video/webm;codecs=vp9',
      // 'video/webm;codecs=vp8',
      // 'video/webm',
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    // Fallback to default
    throw new Error('No supported MIME type for video recording found')
  }
}
