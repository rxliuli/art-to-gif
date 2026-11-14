import * as ort from 'onnxruntime-web/wasm'

const INPUT_SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

export interface SegmentAssets {
  modelUrl: string
  wasmUrl: string
}

let session: Promise<ort.InferenceSession> | null = null

function getSession(assets: SegmentAssets): Promise<ort.InferenceSession> {
  if (!session) {
    ort.env.wasm.wasmPaths = { wasm: assets.wasmUrl }
    // Content scripts are never crossOriginIsolated, so the threaded runtime
    // cannot be used; asking for one thread skips its slow fallback path.
    ort.env.wasm.numThreads = 1
    ort.env.logLevel = 'error'
    session = ort.InferenceSession.create(assets.modelUrl)
    session.catch(() => {
      session = null
    })
  }
  return session
}

/**
 * Find the salient subject of an image with U²-Net (small). Returns a
 * 320x320 canvas whose alpha channel is the subject mask; scale it to the
 * size you need when drawing.
 */
export async function segmentSubject(
  image: CanvasImageSource,
  assets: SegmentAssets,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  // Flatten transparency onto white, which is what the model was trained on.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(image, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const pixels = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)

  const count = INPUT_SIZE * INPUT_SIZE
  const input = new Float32Array(3 * count)
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * count + i] = (pixels.data[i * 4 + c] / 255 - MEAN[c]) / STD[c]
    }
  }

  const model = await getSession(assets)
  const output = await model.run({
    [model.inputNames[0]]: new ort.Tensor('float32', input, [
      1,
      3,
      INPUT_SIZE,
      INPUT_SIZE,
    ]),
  })
  const values = output[model.outputNames[0]].data as Float32Array

  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < count; i++) {
    if (values[i] < min) min = values[i]
    if (values[i] > max) max = values[i]
  }
  const range = max - min || 1
  for (let i = 0; i < count; i++) {
    pixels.data[i * 4] = 255
    pixels.data[i * 4 + 1] = 255
    pixels.data[i * 4 + 2] = 255
    pixels.data[i * 4 + 3] = Math.round(((values[i] - min) / range) * 255)
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}
