import { describe, expect, it, beforeAll } from 'vitest'
import { VideoConverter } from './VideoConverter'

describe('VideoConverter', () => {
  let converter: VideoConverter

  beforeAll(() => {
    converter = new VideoConverter()
  })

  describe('convert', () => {
    it('should convert PNG to video with 1000ms duration', async () => {
      // Create a simple test image (100x100 red square)
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'red'
      ctx.fillRect(0, 0, 100, 100)

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })

      // Create File from blob
      const file = new File([blob], 'test.png', { type: 'image/png' })

      // Convert to video
      const videoFile = await converter.convert(file)

      // Verify it's a video file
      expect(videoFile.type).toMatch(/^video\/(mp4|webm)$/)
      expect(videoFile.name).toMatch(/test\.(mp4|webm)$/)
      expect(videoFile.size).toBeGreaterThan(0)

      // Load video to check duration
      const video = document.createElement('video')
      const videoUrl = URL.createObjectURL(videoFile)

      try {
        // Wait for video metadata to load
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error('Failed to load video'))
          video.src = videoUrl
        })

        // Check duration is approximately 1000ms (allow for encoding variance)
        // MediaRecorder may not produce exact duration due to keyframes and encoding
        expect(video.duration).toBeGreaterThanOrEqual(0.9) // At least 900ms
        expect(video.duration).toBeLessThanOrEqual(1.5) // At most 1500ms

        // Verify video dimensions
        expect(video.videoWidth).toBe(100)
        expect(video.videoHeight).toBe(100)
      } finally {
        URL.revokeObjectURL(videoUrl)
      }
    }, 15000) // Increase timeout for video encoding

    it('should convert JPG to video with 1000ms duration', async () => {
      // Create a test image (200x150 blue rectangle)
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 150
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'blue'
      ctx.fillRect(0, 0, 200, 150)

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
      })

      // Create File from blob
      const file = new File([blob], 'test.jpg', { type: 'image/jpeg' })

      // Convert to video
      const videoFile = await converter.convert(file)

      // Verify it's a video file
      expect(videoFile.type).toMatch(/^video\/(mp4|webm)$/)
      expect(videoFile.name).toMatch(/test\.(mp4|webm)$/)

      // Load video to check duration
      const video = document.createElement('video')
      const videoUrl = URL.createObjectURL(videoFile)

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error('Failed to load video'))
          video.src = videoUrl
        })

        // Check duration is approximately 1000ms
        expect(video.duration).toBeGreaterThanOrEqual(0.9)
        expect(video.duration).toBeLessThanOrEqual(1.5)

        // Verify video dimensions
        expect(video.videoWidth).toBe(200)
        expect(video.videoHeight).toBe(150)
      } finally {
        URL.revokeObjectURL(videoUrl)
      }
    }, 15000)

    it('should handle large images and scale them down while maintaining 1000ms duration', async () => {
      // Create a large test image (3000x2000)
      const canvas = document.createElement('canvas')
      canvas.width = 3000
      canvas.height = 2000
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'green'
      ctx.fillRect(0, 0, 3000, 2000)

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })

      const file = new File([blob], 'large-test.png', { type: 'image/png' })

      // Convert to video
      const videoFile = await converter.convert(file)

      // Load video to check duration and dimensions
      const video = document.createElement('video')
      const videoUrl = URL.createObjectURL(videoFile)

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error('Failed to load video'))
          video.src = videoUrl
        })

        // Check duration is approximately 1000ms
        expect(video.duration).toBeGreaterThanOrEqual(0.9)
        expect(video.duration).toBeLessThanOrEqual(1.5)

        // Verify video was scaled down to Twitter limits
        // For landscape: max 1920x1200
        expect(video.videoWidth).toBeLessThanOrEqual(1920)
        expect(video.videoHeight).toBeLessThanOrEqual(1200)

        // Verify aspect ratio is maintained (3000:2000 = 1.5:1)
        const aspectRatio = video.videoWidth / video.videoHeight
        expect(aspectRatio).toBeCloseTo(1.5, 1)
      } finally {
        URL.revokeObjectURL(videoUrl)
      }
    }, 15000)

    it('should produce video that can be played', async () => {
      // Create a simple test image
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'purple'
      ctx.fillRect(0, 0, 100, 100)

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })

      const file = new File([blob], 'playable.png', { type: 'image/png' })
      const videoFile = await converter.convert(file)

      // Create video element and attempt to play
      const video = document.createElement('video')
      video.muted = true // Mute to allow autoplay
      const videoUrl = URL.createObjectURL(videoFile)

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error('Failed to load video'))
          video.src = videoUrl
        })

        // Try to play the video
        await video.play()

        // Wait a bit and verify we can read current time
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(video.currentTime).toBeGreaterThan(0)
        expect(video.currentTime).toBeLessThanOrEqual(video.duration)

        video.pause()
      } finally {
        URL.revokeObjectURL(videoUrl)
      }
    }, 15000)
  })

  describe('error handling', () => {
    it('should throw error for invalid file', async () => {
      const invalidFile = new File(['invalid data'], 'invalid.png', {
        type: 'image/png',
      })

      await expect(converter.convert(invalidFile)).rejects.toThrow()
    })

    it('should handle small images', async () => {
      // Create a 50x50 pixel image
      // Note: Very small sizes (< 32x32) may fail in MediaRecorder due to codec limitations
      const canvas = document.createElement('canvas')
      canvas.width = 50
      canvas.height = 50
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, 50, 50)

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })

      const file = new File([blob], 'small.png', { type: 'image/png' })
      const videoFile = await converter.convert(file)

      // Should keep dimensions as 50x50 (above minimum of 4x4)
      const video = document.createElement('video')
      const videoUrl = URL.createObjectURL(videoFile)

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error('Failed to load video'))
          video.src = videoUrl
        })

        expect(video.videoWidth).toBe(50)
        expect(video.videoHeight).toBe(50)

        // Duration should still be ~1000ms
        expect(video.duration).toBeGreaterThanOrEqual(0.9)
        expect(video.duration).toBeLessThanOrEqual(1.5)
      } finally {
        URL.revokeObjectURL(videoUrl)
      }
    }, 15000)
  })
})
