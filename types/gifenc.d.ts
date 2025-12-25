declare module 'gifenc' {
  export interface GIFEncoderOptions {
    palette?: number[][]
    delay?: number
    repeat?: number
    transparent?: number
    dispose?: number
  }

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GIFEncoderOptions
    ): void
    finish(): void
    bytes(): Uint8Array<ArrayBuffer>
    bytesView(): Uint8Array<ArrayBuffer>
  }

  export function GIFEncoder(): GIFEncoderInstance
  export function quantize(rgba: Uint8ClampedArray, maxColors: number): number[][]
  export function applyPalette(rgba: Uint8ClampedArray, palette: number[][]): Uint8Array
}
