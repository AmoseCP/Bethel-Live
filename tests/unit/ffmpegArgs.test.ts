import { describe, expect, it } from 'vitest'
import { buildStreamArgs, DEFAULT_ENCODE } from '../../src/main/core/ffmpegArgs'

const RTMP = 'rtmp://a.rtmp.youtube.com/live2/key-1'

describe('buildStreamArgs — macOS', () => {
  it('摄像头：avfoundation 索引输入 + 低延迟 x264 + flv', () => {
    const args = buildStreamArgs(
      { platform: 'darwin', source: 'camera', videoIndex: 1, audioIndex: 2 },
      RTMP
    )
    const s = args.join(' ')
    expect(s).toContain('-f avfoundation')
    expect(s).toContain('-i 1:2')
    expect(s).toContain('-video_size 1280x720')
    expect(s).toContain('-c:v libx264')
    expect(s).toContain('-tune zerolatency')
    expect(s).toContain('-b:v 4500k')
    expect(s).toContain('-c:a aac')
    expect(args[args.length - 1]).toBe(RTMP)
    expect(args[args.length - 2]).toBe('flv')
  })

  it('屏幕：带鼠标指针，不强制 video_size', () => {
    const args = buildStreamArgs(
      { platform: 'darwin', source: 'screen', videoIndex: 3, audioIndex: 0 },
      RTMP
    )
    const s = args.join(' ')
    expect(s).toContain('-capture_cursor 1')
    expect(s).toContain('-i 3:0')
    expect(s).not.toContain('-video_size')
  })

  it('缺设备索引时抛错', () => {
    expect(() =>
      buildStreamArgs({ platform: 'darwin', source: 'camera', audioIndex: 0 }, RTMP)
    ).toThrow()
  })
})

describe('buildStreamArgs — Windows', () => {
  it('摄像头：dshow 名称输入', () => {
    const args = buildStreamArgs(
      {
        platform: 'win32',
        source: 'camera',
        videoName: 'StreamLine Mini+ GC311G2',
        audioName: 'Analogue 1 + 2 (Focusrite USB Audio)'
      },
      RTMP
    )
    const s = args.join(' ')
    expect(s).toContain('-f dshow')
    // 视频/音频为两个独立输入（设备名含冒号也安全）
    expect(args).toContain('video=StreamLine Mini+ GC311G2')
    expect(args).toContain('audio=Analogue 1 + 2 (Focusrite USB Audio)')
    expect(s).not.toContain('video=StreamLine Mini+ GC311G2:audio=')
  })

  it('屏幕：gdigrab desktop + dshow 音频', () => {
    const args = buildStreamArgs(
      { platform: 'win32', source: 'screen', audioName: 'Mic' },
      RTMP
    )
    const s = args.join(' ')
    expect(s).toContain('-f gdigrab')
    expect(args).toContain('desktop')
    expect(args).toContain('audio=Mic')
    expect(s).not.toContain('-offset_x')
  })

  it('屏幕：指定外接屏区域（offset + size）', () => {
    const args = buildStreamArgs(
      {
        platform: 'win32',
        source: 'screen',
        audioName: 'Mic',
        screenRegion: { x: 1920, y: 0, width: 1920, height: 1080 }
      },
      RTMP
    )
    const s = args.join(' ')
    expect(s).toContain('-offset_x 1920')
    expect(s).toContain('-offset_y 0')
    expect(s).toContain('-video_size 1920x1080')
    expect(args).toContain('desktop')
  })
})

describe('编码参数', () => {
  it('GOP 为 2 秒（fps*2），缩放保持比例并补边', () => {
    const args = buildStreamArgs(
      { platform: 'darwin', source: 'camera', videoIndex: 0, audioIndex: 0 },
      RTMP,
      { ...DEFAULT_ENCODE, fps: 25 }
    )
    const s = args.join(' ')
    expect(s).toContain('-g 50')
    expect(s).toContain('scale=1280:720:force_original_aspect_ratio=decrease')
  })
})

describe('画质预设', () => {
  it('三档码率递减且分辨率合法', async () => {
    const { QUALITY_PRESETS } = await import('../../src/main/core/ffmpegArgs')
    expect(QUALITY_PRESETS.high.videoBitrateKbps).toBeGreaterThan(QUALITY_PRESETS.medium.videoBitrateKbps)
    expect(QUALITY_PRESETS.medium.videoBitrateKbps).toBeGreaterThan(QUALITY_PRESETS.low.videoBitrateKbps)
    expect(QUALITY_PRESETS.low.width).toBe(854)
  })

  it('中档预设生成 2500k 码率参数', async () => {
    const { QUALITY_PRESETS, buildStreamArgs } = await import('../../src/main/core/ffmpegArgs')
    const args = buildStreamArgs(
      { platform: 'darwin', source: 'camera', videoIndex: 0, audioIndex: 0 },
      'rtmp://a.rtmp.youtube.com/live2/k',
      QUALITY_PRESETS.medium
    )
    expect(args.join(' ')).toContain('-b:v 2500k')
  })
})
