import { describe, expect, it } from 'vitest'
import { computeRms, dbToPercent, rmsToDb } from '../../src/shared/audioLevel'

describe('audioLevel', () => {
  it('全静音 RMS 为 0 → -60dB → 0%', () => {
    const silent = new Float32Array(1024)
    const rms = computeRms(silent)
    expect(rms).toBe(0)
    expect(rmsToDb(rms)).toBe(-60)
    expect(dbToPercent(-60)).toBe(0)
  })

  it('满幅方波 RMS 为 1 → 0dB → 100%', () => {
    const full = new Float32Array(1024).fill(1)
    const rms = computeRms(full)
    expect(rms).toBeCloseTo(1, 5)
    expect(rmsToDb(rms)).toBeCloseTo(0, 5)
    expect(dbToPercent(0)).toBe(100)
  })

  it('半幅正弦约 -9dB', () => {
    const buf = new Float32Array(4096)
    for (let i = 0; i < buf.length; i++) buf[i] = 0.5 * Math.sin((2 * Math.PI * i) / 128)
    const db = rmsToDb(computeRms(buf))
    expect(db).toBeGreaterThan(-10)
    expect(db).toBeLessThan(-8)
  })

  it('dbToPercent 截断越界值', () => {
    expect(dbToPercent(-100)).toBe(0)
    expect(dbToPercent(10)).toBe(100)
    expect(dbToPercent(-30)).toBe(50)
  })

  it('空数组安全返回 0', () => {
    expect(computeRms(new Float32Array(0))).toBe(0)
  })
})
