import type { IImageConverter } from './IImageConverter'
import { loadImage, scaleImageDimensions } from './utils'
import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  QUALITY_HIGH,
} from 'mediabunny'

/**
 * Converts images to video format using MediaBunny (WebCodecs-based)
 * This version is much faster than V1 as it doesn't require real-time encoding
 */
export class VideoConverterV2 implements IImageConverter {
  /**
   * Convert PNG/JPG image to video format using MediaBunny
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

    // Create MediaBunny output
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    })

    // Check if codec is supported
    const codec = await this.getSupportedCodec()

    // Create canvas source for video encoding
    const videoSource = new CanvasSource(canvas, {
      codec,
      bitrate: QUALITY_HIGH,
    })

    output.addVideoTrack(videoSource)

    await output.start()

    // Generate 1 second of video at 30fps = 30 frames
    const fps = 30
    const duration = 1.0 // seconds
    const totalFrames = Math.floor(fps * duration)
    const frameDuration = 1 / fps

    try {
      // Add frames - since the image is static, we just add the same frame multiple times
      for (let frame = 0; frame < totalFrames; frame++) {
        const timestamp = frame * frameDuration

        // For the first frame, make it a keyframe
        if (frame === 0) {
          await videoSource.add(timestamp, frameDuration, { keyFrame: true })
        } else {
          await videoSource.add(timestamp, frameDuration)
        }
      }

      await output.finalize()

      // Get the buffer containing the MP4 file
      const buffer = output.target.buffer

      if (!buffer) {
        throw new Error('Failed to retrieve video buffer from output')
      }

      // Determine file extension and MIME type
      const extension = '.mp4'
      const videoFileName = file.name.replace(/\.(png|jpe?g)$/i, extension)
      const mimeType = 'video/mp4'

      const videoFile = new File([buffer], videoFileName, {
        type: mimeType,
        lastModified: Date.now(),
      })

      return videoFile
    } catch (error) {
      throw new Error(
        `Failed to encode video. Canvas size: ${width}x${height}. Error: ${error}`,
      )
    }
  }

  /**
   * Get the best supported codec for video encoding
   * Uses WebCodecs API to check support
   * Only returns codecs supported by Twitter/X (H.264 or H.265)
   */
  private async getSupportedCodec(): Promise<'avc' | 'hevc'> {
    // Check if VideoEncoder is available
    if (typeof VideoEncoder === 'undefined') {
      throw new Error('WebCodecs VideoEncoder API is not supported in this browser')
    }

    // Only try codecs supported by Twitter/X
    // Twitter/X only supports H.264 (avc) and H.265 (hevc)
    const codecs: Array<{
      name: 'avc' | 'hevc'
      config: string
    }> = [
      { name: 'avc', config: 'avc1.42001E' }, // H.264 Baseline
      { name: 'avc', config: 'avc1.4D401E' }, // H.264 Main
      { name: 'hevc', config: 'hev1.1.6.L93.B0' }, // H.265
    ]

    for (const { name, config } of codecs) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: config,
          width: 1920,
          height: 1080,
        })

        if (support.supported) {
          return name
        }
      } catch {
        // Codec not supported, try next one
        continue
      }
    }

    // If no codec explicitly reported as supported, default to H.264 Baseline
    // This handles cases where isConfigSupported might not work correctly (e.g., some test environments)
    // H.264 Baseline is the most widely supported codec
    return 'avc'
  }
}
