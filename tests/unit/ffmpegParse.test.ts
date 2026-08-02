import { describe, expect, it } from 'vitest'
import {
  matchDeviceByLabel,
  parseAvfoundationDevices,
  parseDshowDevices,
  parseProgressLine,
  pickScreenDevice
} from '../../src/main/core/ffmpegParse'

const AVF_STDERR = `
[AVFoundation indev @ 0x7f8] AVFoundation video devices:
[AVFoundation indev @ 0x7f8] [0] FaceTime HD Camera
[AVFoundation indev @ 0x7f8] [1] StreamLine Mini+ GC311G2
[AVFoundation indev @ 0x7f8] [2] Capture screen 0
[AVFoundation indev @ 0x7f8] AVFoundation audio devices:
[AVFoundation indev @ 0x7f8] [0] MacBook Pro Microphone
[AVFoundation indev @ 0x7f8] [1] Analogue 1 + 2 (Focusrite USB Audio)
: Input/output error
`

const DSHOW_STDERR = `
[dshow @ 000001] "StreamLine Mini+ GC311G2" (video)
[dshow @ 000001]   Alternative name "@device_pnp_..."
[dshow @ 000001] "麦克风 (Focusrite USB Audio)" (audio)
dummy: Immediate exit requested
`

describe('parseAvfoundationDevices', () => {
  it('分组解析视频与音频设备', () => {
    const list = parseAvfoundationDevices(AVF_STDERR)
    expect(list.video).toEqual([
      { index: 0, name: 'FaceTime HD Camera' },
      { index: 1, name: 'StreamLine Mini+ GC311G2' },
      { index: 2, name: 'Capture screen 0' }
    ])
    expect(list.audio).toHaveLength(2)
    expect(list.audio[1].name).toContain('Focusrite')
  })
})

describe('parseDshowDevices', () => {
  it('解析引号设备名并跳过别名行', () => {
    const list = parseDshowDevices(DSHOW_STDERR)
    expect(list.video).toEqual([{ index: 0, name: 'StreamLine Mini+ GC311G2' }])
    expect(list.audio).toEqual([{ index: 0, name: '麦克风 (Focusrite USB Audio)' }])
  })
})

describe('matchDeviceByLabel', () => {
  const devices = parseAvfoundationDevices(AVF_STDERR).video
  it('label 带厂商 ID 后缀也能匹配', () => {
    expect(matchDeviceByLabel(devices, 'StreamLine Mini+ GC311G2 (0408:5321)')?.index).toBe(1)
  })
  it('大小写与标点差异不影响匹配', () => {
    expect(matchDeviceByLabel(devices, 'facetime hd camera')?.index).toBe(0)
  })
  it('无匹配返回 null', () => {
    expect(matchDeviceByLabel(devices, 'Nonexistent Cam')).toBeNull()
    expect(matchDeviceByLabel(devices, '')).toBeNull()
  })
})

describe('pickScreenDevice', () => {
  const one = parseAvfoundationDevices(AVF_STDERR).video // 只有 Capture screen 0
  const two = [
    ...one,
    { index: 3, name: 'Capture screen 1' }
  ]
  it('按序号取屏：0=主屏，1=第二块', () => {
    expect(pickScreenDevice(two, 0)?.name).toBe('Capture screen 0')
    expect(pickScreenDevice(two, 1)?.name).toBe('Capture screen 1')
  })
  it('序号越界回落主屏', () => {
    expect(pickScreenDevice(one, 1)?.index).toBe(2)
    expect(pickScreenDevice(two, 5)?.name).toBe('Capture screen 0')
  })
  it('无屏幕设备返回 null', () => {
    expect(pickScreenDevice([{ index: 0, name: 'FaceTime HD Camera' }], 0)).toBeNull()
  })
})

describe('parseProgressLine', () => {
  it('解析 fps/码率/时长', () => {
    const p = parseProgressLine(
      'frame=  302 fps= 30 q=23.0 size=    1024KiB time=00:01:10.05 bitrate=4433.2kbits/s speed=1x'
    )
    expect(p).toEqual({ fps: 30, bitrateKbps: 4433.2, timeSec: 70.05 })
  })
  it('非进度行返回 null', () => {
    expect(parseProgressLine('[libx264 @ 0x7f] using cpu capabilities')).toBeNull()
  })
})
