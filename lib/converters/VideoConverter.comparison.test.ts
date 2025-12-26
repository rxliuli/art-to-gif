import { describe, expect, it } from 'vitest'
import { VideoConverter } from './VideoConverter'
import { VideoConverterV2 } from './VideoConverterV2'

describe('VideoConverter Performance Comparison', () => {
  it('should compare performance between V1 (MediaRecorder) and V2 (MediaBunny)', async () => {
    // Create a test image (500x500)
    const canvas = document.createElement('canvas')
    canvas.width = 500
    canvas.height = 500
    const ctx = canvas.getContext('2d')!

    // Create a gradient for more interesting content
    const gradient = ctx.createLinearGradient(0, 0, 500, 500)
    gradient.addColorStop(0, '#FF6B6B')
    gradient.addColorStop(0.5, '#4ECDC4')
    gradient.addColorStop(1, '#45B7D1')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 500, 500)

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })

    const file = new File([blob], 'comparison.png', { type: 'image/png' })

    // Test V1 (MediaRecorder)
    const v1Converter = new VideoConverter()
    const v1Start = performance.now()
    const v1Result = await v1Converter.convert(file)
    const v1Time = performance.now() - v1Start

    // Test V2 (MediaBunny)
    const v2Converter = new VideoConverterV2()
    const v2Start = performance.now()
    const v2Result = await v2Converter.convert(file)
    const v2Time = performance.now() - v2Start

    // Log results for visibility
    console.log('\n📊 Performance Comparison:')
    console.log(`  V1 (MediaRecorder): ${v1Time.toFixed(0)}ms`)
    console.log(`  V2 (MediaBunny):    ${v2Time.toFixed(0)}ms`)
    console.log(
      `  Speedup: ${(v1Time / v2Time).toFixed(1)}x faster with V2\n`,
    )

    // Verify both results are valid
    expect(v1Result.size).toBeGreaterThan(0)
    expect(v2Result.size).toBeGreaterThan(0)

    // V1 should take around 1000ms (recording time)
    expect(v1Time).toBeGreaterThan(1000)

    // V2 should be significantly faster (no real-time recording required)
    expect(v2Time).toBeLessThan(1000)

    // V2 should be at least 2x faster than V1
    const speedup = v1Time / v2Time
    expect(speedup).toBeGreaterThan(2)

    // Verify both videos have similar durations
    const v1Video = document.createElement('video')
    const v2Video = document.createElement('video')

    const v1Url = URL.createObjectURL(v1Result)
    const v2Url = URL.createObjectURL(v2Result)

    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          v1Video.onloadedmetadata = () => resolve()
          v1Video.onerror = () => reject(new Error('Failed to load V1 video'))
          v1Video.src = v1Url
        }),
        new Promise<void>((resolve, reject) => {
          v2Video.onloadedmetadata = () => resolve()
          v2Video.onerror = () => reject(new Error('Failed to load V2 video'))
          v2Video.src = v2Url
        }),
      ])

      console.log('📹 Video Quality Comparison:')
      console.log(
        `  V1 duration: ${v1Video.duration.toFixed(2)}s, size: ${(v1Result.size / 1024).toFixed(1)}KB`,
      )
      console.log(
        `  V2 duration: ${v2Video.duration.toFixed(2)}s, size: ${(v2Result.size / 1024).toFixed(1)}KB\n`,
      )

      // Both should have approximately 1 second duration
      expect(v1Video.duration).toBeGreaterThanOrEqual(0.9)
      expect(v1Video.duration).toBeLessThanOrEqual(1.5)
      expect(v2Video.duration).toBeGreaterThanOrEqual(0.9)
      expect(v2Video.duration).toBeLessThanOrEqual(1.1)

      // Both should have same dimensions
      expect(v1Video.videoWidth).toBe(500)
      expect(v1Video.videoHeight).toBe(500)
      expect(v2Video.videoWidth).toBe(500)
      expect(v2Video.videoHeight).toBe(500)
    } finally {
      URL.revokeObjectURL(v1Url)
      URL.revokeObjectURL(v2Url)
    }
  }, 30000)

  it('should compare file sizes between V1 and V2', async () => {
    // Create a simple solid color image
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3498db'
    ctx.fillRect(0, 0, 800, 600)

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })

    const file = new File([blob], 'size-test.png', { type: 'image/png' })

    // Convert with both versions
    const v1Converter = new VideoConverter()
    const v2Converter = new VideoConverterV2()

    const v1Result = await v1Converter.convert(file)
    const v2Result = await v2Converter.convert(file)

    console.log('\n📦 File Size Comparison:')
    console.log(
      `  V1 (MediaRecorder): ${(v1Result.size / 1024).toFixed(1)}KB`,
    )
    console.log(`  V2 (MediaBunny):    ${(v2Result.size / 1024).toFixed(1)}KB`)
    console.log(
      `  Difference: ${(((v2Result.size - v1Result.size) / v1Result.size) * 100).toFixed(1)}%\n`,
    )

    // Both should produce reasonable file sizes (not too small, not too large)
    expect(v1Result.size).toBeGreaterThan(1024) // At least 1KB
    expect(v1Result.size).toBeLessThan(5 * 1024 * 1024) // Less than 5MB

    expect(v2Result.size).toBeGreaterThan(1024) // At least 1KB
    expect(v2Result.size).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
  }, 30000)

  it('should verify both versions produce playable videos', async () => {
    // Create a colorful test pattern
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    const ctx = canvas.getContext('2d')!

    // Draw a simple pattern
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `hsl(${i * 36}, 70%, 60%)`
      ctx.fillRect(i * 40, 0, 40, 300)
    }

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })

    const file = new File([blob], 'playable-test.png', { type: 'image/png' })

    // Convert with both versions
    const v1Converter = new VideoConverter()
    const v2Converter = new VideoConverterV2()

    const v1Result = await v1Converter.convert(file)
    const v2Result = await v2Converter.convert(file)

    // Test playback for both
    const testPlayback = async (videoFile: File, version: string) => {
      const video = document.createElement('video')
      video.muted = true
      const url = URL.createObjectURL(videoFile)

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () =>
            reject(new Error(`Failed to load ${version} video`))
          video.src = url
        })

        // Verify can play
        await video.play()
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(video.currentTime).toBeGreaterThan(0)
        video.pause()

        console.log(
          `✅ ${version}: Playable, ${video.duration.toFixed(2)}s, ${video.videoWidth}x${video.videoHeight}`,
        )
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    await testPlayback(v1Result, 'V1')
    await testPlayback(v2Result, 'V2')
  }, 30000)
})
