/**
 * Image converter interface for converting images to different formats
 */
export interface IImageConverter {
  /**
   * Convert an image file to the target format
   * @param file - The source image file
   * @returns A Promise that resolves to the converted file
   */
  convert(file: File): Promise<File>
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
