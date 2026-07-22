import { describe, it, expect } from 'vitest'
import { computeSourceCrop } from '../crop'

describe('computeSourceCrop', () => {
  it('portrait image (1143×1600) zonder pan/zoom levert 4:5 crop op (1143×1428)', () => {
    const r = computeSourceCrop(1143, 1600, { x: 0, y: 0, scale: 1 })
    expect(r.left).toBe(0)
    expect(r.width).toBe(1143)
    // 1143 × 1.25 = 1428.75 → afgerond op 1429 (binnen image-bound 1600)
    expect(r.height).toBeGreaterThanOrEqual(1428)
    expect(r.height).toBeLessThanOrEqual(1429)
    // Vertically gecentreerd: top ≈ (1600 - 1428.5) / 2 ≈ 85
    expect(r.top).toBeGreaterThanOrEqual(85)
    expect(r.top).toBeLessThanOrEqual(86)
  })

  it('landscape image (1600×1143) zonder pan/zoom levert 4:5 crop op (914×1143)', () => {
    const r = computeSourceCrop(1600, 1143, { x: 0, y: 0, scale: 1 })
    expect(r.top).toBe(0)
    expect(r.height).toBe(1143)
    // 1143 × 0.8 = 914.4 → 914
    expect(r.width).toBeGreaterThanOrEqual(913)
    expect(r.width).toBeLessThanOrEqual(915)
  })

  it('square image (1000×1000) zonder pan/zoom: 4:5 = 800×1000 crop, gecentreerd', () => {
    // baseScale = max(1000/1000, 1250/1000) = 1.25
    // sourceW = 1000/1.25 = 800, sourceH = 1250/1.25 = 1000
    // Horizontaal gecentreerd: left = (1000 - 800)/2 = 100
    const r = computeSourceCrop(1000, 1000, { x: 0, y: 0, scale: 1 })
    expect(r.left).toBe(100)
    expect(r.top).toBe(0)
    expect(r.width).toBe(800)
    expect(r.height).toBe(1000)
  })

  it('scale=2 zoom-in: helft van de breedte, helft van de hoogte zichtbaar', () => {
    const r = computeSourceCrop(1143, 1600, { x: 0, y: 0, scale: 2 })
    // baseScale = max(1000/1143, 1250/1600) = 0.875
    // totalScale = 0.875 * 2 = 1.75
    // sourceW = 1000/1.75 ≈ 571
    // sourceH = 1250/1.75 ≈ 714
    expect(r.width).toBeGreaterThanOrEqual(570)
    expect(r.width).toBeLessThanOrEqual(572)
    expect(r.height).toBeGreaterThanOrEqual(713)
    expect(r.height).toBeLessThanOrEqual(715)
  })

  it('clampt naar image-bounds als crop buiten de afbeelding valt', () => {
    // Extreme pan
    const r = computeSourceCrop(1000, 1000, { x: 10, y: 10, scale: 1 })
    expect(r.left).toBeGreaterThanOrEqual(0)
    expect(r.top).toBeGreaterThanOrEqual(0)
    expect(r.left + r.width).toBeLessThanOrEqual(1000)
    expect(r.top + r.height).toBeLessThanOrEqual(1000)
  })
})
