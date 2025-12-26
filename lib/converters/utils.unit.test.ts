import { describe, expect, it } from 'vitest'
import { scaleImageDimensions } from './utils'

describe('scaleImageDimensions', () => {
  describe('scaling down to fit max constraints', () => {
    it('should scale down when width exceeds max width', () => {
      const result = scaleImageDimensions(2000, 1000, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(1920)
      expect(result.height).toBe(960)
      expect(result.scale).toBe(0.96)
      expect(result.wasScaled).toBe(true)
    })

    it('should scale down when height exceeds max height', () => {
      const result = scaleImageDimensions(1000, 2000, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(600)
      expect(result.height).toBe(1200)
      expect(result.scale).toBe(0.6)
      expect(result.wasScaled).toBe(true)
    })

    it('should scale down when both dimensions exceed max', () => {
      const result = scaleImageDimensions(4898, 3265, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(1800)
      expect(result.height).toBe(1200)
      expect(result.scale).toBeCloseTo(0.3675, 4)
      expect(result.wasScaled).toBe(true)
    })

    it('should use the most restrictive constraint', () => {
      const result = scaleImageDimensions(3000, 2000, {
        maxWidth: 1920,
        maxHeight: 1080,
      })

      // Height is more restrictive (2000/1080 = 1.85x vs 3000/1920 = 1.56x)
      expect(result.width).toBe(1620)
      expect(result.height).toBe(1080)
      expect(result.scale).toBe(0.54)
      expect(result.wasScaled).toBe(true)
    })
  })

  describe('no scaling needed', () => {
    it('should not scale when dimensions are within constraints', () => {
      const result = scaleImageDimensions(1000, 800, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(1000)
      expect(result.height).toBe(800)
      expect(result.scale).toBe(1)
      expect(result.wasScaled).toBe(false)
    })

    it('should not scale when dimensions exactly match max', () => {
      const result = scaleImageDimensions(1920, 1200, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(1920)
      expect(result.height).toBe(1200)
      expect(result.scale).toBe(1)
      expect(result.wasScaled).toBe(false)
    })
  })

  describe('minimum dimension constraints', () => {
    it('should enforce minimum width', () => {
      const result = scaleImageDimensions(2, 100, {
        maxWidth: 1920,
        maxHeight: 1200,
        minWidth: 4,
        minHeight: 4,
      })

      expect(result.width).toBe(4)
      expect(result.height).toBe(100)
      expect(result.wasScaled).toBe(true)
    })

    it('should enforce minimum height', () => {
      const result = scaleImageDimensions(100, 2, {
        maxWidth: 1920,
        maxHeight: 1200,
        minWidth: 4,
        minHeight: 4,
      })

      expect(result.width).toBe(100)
      expect(result.height).toBe(4)
      expect(result.wasScaled).toBe(true)
    })

    it('should enforce both minimum dimensions', () => {
      const result = scaleImageDimensions(2, 3, {
        maxWidth: 1920,
        maxHeight: 1200,
        minWidth: 4,
        minHeight: 4,
      })

      expect(result.width).toBe(4)
      expect(result.height).toBe(4)
      expect(result.wasScaled).toBe(true)
    })

    it('should use default minimum of 1 when not specified', () => {
      const result = scaleImageDimensions(0, 0, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(1)
      expect(result.height).toBe(1)
      expect(result.wasScaled).toBe(true)
    })
  })

  describe('real-world use cases', () => {
    it('should handle Twitter GIF constraints (2048x2048)', () => {
      const result = scaleImageDimensions(3000, 2500, {
        maxWidth: 2048,
        maxHeight: 2048,
        minWidth: 4,
        minHeight: 4,
      })

      expect(result.width).toBe(2048)
      expect(result.height).toBeCloseTo(1707, 0)
      expect(result.wasScaled).toBe(true)
    })

    it('should handle Twitter video landscape constraints (1920x1200)', () => {
      const result = scaleImageDimensions(4898, 3265, {
        maxWidth: 1920,
        maxHeight: 1200,
        minWidth: 4,
        minHeight: 4,
      })

      expect(result.width).toBe(1800)
      expect(result.height).toBe(1200)
      expect(result.wasScaled).toBe(true)
    })

    it('should handle Twitter video portrait constraints (1920x1900)', () => {
      const result = scaleImageDimensions(1080, 1920, {
        maxWidth: 1920,
        maxHeight: 1900,
        minWidth: 4,
        minHeight: 4,
      })

      // 1920/1900 = 1.01x, so needs to scale down slightly
      expect(result.width).toBe(1069)
      expect(result.height).toBe(1900)
      expect(result.wasScaled).toBe(true)
    })

    it('should handle very small images', () => {
      const result = scaleImageDimensions(1, 1, {
        maxWidth: 1920,
        maxHeight: 1200,
        minWidth: 4,
        minHeight: 4,
      })

      expect(result.width).toBe(4)
      expect(result.height).toBe(4)
      expect(result.wasScaled).toBe(true)
    })
  })

  describe('aspect ratio preservation', () => {
    it('should maintain aspect ratio when scaling down', () => {
      const originalRatio = 16 / 9
      const result = scaleImageDimensions(3840, 2160, {
        maxWidth: 1920,
        maxHeight: 1080,
      })

      const newRatio = result.width / result.height
      expect(newRatio).toBeCloseTo(originalRatio, 5)
    })

    it('should maintain aspect ratio for portrait images', () => {
      const originalRatio = 9 / 16
      const result = scaleImageDimensions(1080, 1920, {
        maxWidth: 540,
        maxHeight: 960,
      })

      const newRatio = result.width / result.height
      expect(newRatio).toBeCloseTo(originalRatio, 5)
    })

    it('should maintain aspect ratio for square images', () => {
      const result = scaleImageDimensions(2000, 2000, {
        maxWidth: 1000,
        maxHeight: 1000,
      })

      expect(result.width).toBe(result.height)
      expect(result.width).toBe(1000)
    })
  })

  describe('edge cases', () => {
    it('should handle very wide images', () => {
      const result = scaleImageDimensions(10000, 100, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(1920)
      expect(result.height).toBeCloseTo(19, 0)
      expect(result.wasScaled).toBe(true)
    })

    it('should handle very tall images', () => {
      const result = scaleImageDimensions(100, 10000, {
        maxWidth: 1920,
        maxHeight: 1200,
      })

      expect(result.width).toBe(12)
      expect(result.height).toBe(1200)
      expect(result.wasScaled).toBe(true)
    })

    it('should round dimensions to whole numbers', () => {
      const result = scaleImageDimensions(1000, 333, {
        maxWidth: 500,
        maxHeight: 500,
      })

      expect(Number.isInteger(result.width)).toBe(true)
      expect(Number.isInteger(result.height)).toBe(true)
    })
  })
})
