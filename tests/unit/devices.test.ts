import { describe, expect, it } from 'vitest'
import { pickDevice } from '../../src/shared/devices'

const cams = [
  { deviceId: 'builtin', label: 'FaceTime HD Camera' },
  { deviceId: 'gc311', label: 'StreamLine Mini+ GC311G2' }
]

describe('pickDevice', () => {
  it('已保存的设备仍在 → 尊重用户选择', () => {
    expect(pickDevice(cams, 'gc311')?.deviceId).toBe('gc311')
    expect(pickDevice(cams, 'builtin')?.deviceId).toBe('builtin')
  })
  it('未保存 → 取检测列表第一个', () => {
    expect(pickDevice(cams, '')?.deviceId).toBe('builtin')
  })
  it('已保存的设备已拔出 → 回落到第一个', () => {
    expect(pickDevice(cams, 'gone')?.deviceId).toBe('builtin')
  })
  it('空列表 → null', () => {
    expect(pickDevice([], 'x')).toBeNull()
  })
})
