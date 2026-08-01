import { describe, expect, it } from 'vitest'
import {
  PREFERRED_AUDIO_PATTERN,
  PREFERRED_VIDEO_PATTERN,
  pickDevice
} from '../../src/main/core/devices'

const cams = [
  { deviceId: 'builtin', label: 'FaceTime HD Camera' },
  { deviceId: 'gc311', label: 'StreamLine Mini+ GC311G2' }
]
const mics = [
  { deviceId: 'builtin-mic', label: 'MacBook Pro Microphone' },
  { deviceId: 'focusrite', label: 'Analogue 1 + 2 (Focusrite USB Audio)' }
]

describe('pickDevice', () => {
  it('无保存值时优先匹配 GC311G2 采集卡', () => {
    expect(pickDevice(cams, '', PREFERRED_VIDEO_PATTERN)?.deviceId).toBe('gc311')
  })
  it('无保存值时优先匹配 Focusrite 声卡', () => {
    expect(pickDevice(mics, '', PREFERRED_AUDIO_PATTERN)?.deviceId).toBe('focusrite')
  })
  it('已保存的设备仍在 → 尊重用户选择', () => {
    expect(pickDevice(cams, 'builtin', PREFERRED_VIDEO_PATTERN)?.deviceId).toBe('builtin')
  })
  it('已保存的设备已拔出 → 回落到首选匹配', () => {
    expect(pickDevice(cams, 'gone', PREFERRED_VIDEO_PATTERN)?.deviceId).toBe('gc311')
  })
  it('无首选设备 → 取第一个', () => {
    const only = [{ deviceId: 'x', label: 'Some Webcam' }]
    expect(pickDevice(only, '', PREFERRED_VIDEO_PATTERN)?.deviceId).toBe('x')
  })
  it('空列表 → null', () => {
    expect(pickDevice([], '', PREFERRED_VIDEO_PATTERN)).toBeNull()
  })
})
