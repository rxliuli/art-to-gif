// Export the interface and implementations
export { IImageConverter, isPngOrJpg } from './converters/IImageConverter'
export { GifConverter } from './converters/GifConverter'
export { VideoConverter } from './converters/VideoConverter'

// Backward compatibility: export the original functions
import { GifConverter } from './converters/GifConverter'
import { VideoConverterV2 } from './converters'

/**
 * Convert PNG/JPG image to video format using MediaRecorder
 * @param file - The image file to convert
 * @returns A new File object containing the video
 * @deprecated Use VideoConverter class instead
 */
export async function convertToVideo(file: File): Promise<File> {
  const converter = new VideoConverterV2()
  return converter.convert(file)
}

/**
 * Convert PNG/JPG image to GIF format
 * @param file - The image file to convert
 * @returns A new File object containing the GIF image
 * @deprecated Use GifConverter class instead
 */
export async function convertToGif(file: File): Promise<File> {
  const converter = new GifConverter()
  return converter.convert(file)
}
