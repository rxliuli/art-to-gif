import { expect, it } from 'vitest'
import { segmentSubject } from './segment'

// Runs the real model in the browser, from the same files the extension ships
// in public/.
it('finds a subject in the middle of a plain picture', async () => {
  const picture = document.createElement('canvas')
  picture.width = 400
  picture.height = 400
  const ctx = picture.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 400, 400)
  ctx.fillStyle = '#d33'
  ctx.beginPath()
  ctx.arc(200, 200, 90, 0, Math.PI * 2)
  ctx.fill()

  const mask = await segmentSubject(picture, {
    modelUrl: '/u2netp/u2netp.onnx',
    wasmUrl: '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  })

  expect(mask.width).toBe(320)
  const alpha = (x: number, y: number) =>
    mask.getContext('2d')!.getImageData(x, y, 1, 1).data[3]
  expect(alpha(160, 160)).toBeGreaterThan(200)
  expect(alpha(8, 8)).toBeLessThan(50)
  expect(alpha(312, 312)).toBeLessThan(50)
}, 60_000)
