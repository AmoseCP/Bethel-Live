/**
 * FFmpeg 采集/编码/推流参数构建（纯逻辑）。
 * macOS: avfoundation（设备用索引）；Windows: dshow（设备用名称）+ gdigrab（屏幕）。
 */

export interface StreamEncodeOptions {
  width: number
  height: number
  fps: number
  videoBitrateKbps: number
  audioBitrateKbps: number
}

export const DEFAULT_ENCODE: StreamEncodeOptions = {
  width: 1280,
  height: 720,
  fps: 30,
  videoBitrateKbps: 4500,
  audioBitrateKbps: 128
}

export type QualityPreset = 'fullhd' | 'high' | 'medium' | 'low'

/** 三档画质：按场地上行带宽选择（约需码率的 1.3 倍稳定上行） */
export const QUALITY_PRESETS: Record<QualityPreset, StreamEncodeOptions> = {
  fullhd: { width: 1920, height: 1080, fps: 30, videoBitrateKbps: 6000, audioBitrateKbps: 128 },
  high: DEFAULT_ENCODE,
  medium: { width: 1280, height: 720, fps: 30, videoBitrateKbps: 2500, audioBitrateKbps: 128 },
  low: { width: 854, height: 480, fps: 30, videoBitrateKbps: 1200, audioBitrateKbps: 96 }
}

export interface CaptureTarget {
  platform: 'darwin' | 'win32'
  source: 'camera' | 'screen'
  /** macOS：avfoundation 视频设备索引；screen 时为屏幕捕获设备索引 */
  videoIndex?: number
  audioIndex?: number
  /** Windows：dshow 设备名称 */
  videoName?: string
  audioName?: string
  /** Windows 屏幕采集区域（物理像素；缺省=整个虚拟桌面） */
  screenRegion?: { x: number; y: number; width: number; height: number }
}

/** 低延迟 x264 + AAC 输出到 RTMP */
function encodeArgs(o: StreamEncodeOptions, rtmpUrl: string): string[] {
  return [
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-b:v', `${o.videoBitrateKbps}k`,
    '-maxrate', `${o.videoBitrateKbps}k`,
    '-bufsize', `${o.videoBitrateKbps * 2}k`,
    '-g', String(o.fps * 2),
    '-vf', `scale=${o.width}:${o.height}:force_original_aspect_ratio=decrease,pad=${o.width}:${o.height}:(ow-iw)/2:(oh-ih)/2,fps=${o.fps}`,
    '-c:a', 'aac',
    '-b:a', `${o.audioBitrateKbps}k`,
    '-ar', '44100',
    '-f', 'flv',
    rtmpUrl
  ]
}

export function buildStreamArgs(
  target: CaptureTarget,
  rtmpUrl: string,
  o: StreamEncodeOptions = DEFAULT_ENCODE
): string[] {
  const pre = ['-hide_banner', '-loglevel', 'level+info', '-stats_period', '1']

  if (target.platform === 'darwin') {
    // avfoundation 统一处理摄像头与屏幕（屏幕也是一个视频设备索引）
    if (target.videoIndex === undefined || target.audioIndex === undefined) {
      throw new Error('macOS 推流需要视频与音频设备索引')
    }
    const input = [
      '-f', 'avfoundation',
      '-framerate', String(o.fps),
      ...(target.source === 'camera' ? ['-video_size', `${o.width}x${o.height}`] : ['-capture_cursor', '1']),
      '-i', `${target.videoIndex}:${target.audioIndex}`
    ]
    return [...pre, ...input, ...encodeArgs(o, rtmpUrl)]
  }

  // Windows
  if (target.source === 'screen') {
    if (!target.audioName) throw new Error('Windows 推流需要音频设备名称')
    const grab = ['-f', 'gdigrab', '-framerate', String(o.fps)]
    if (target.screenRegion) {
      const r = target.screenRegion
      grab.push('-offset_x', String(r.x), '-offset_y', String(r.y), '-video_size', `${r.width}x${r.height}`)
    }
    grab.push('-i', 'desktop')
    return [
      ...pre,
      ...grab,
      '-f', 'dshow', '-i', `audio=${target.audioName}`,
      ...encodeArgs(o, rtmpUrl)
    ]
  }
  if (!target.videoName || !target.audioName) {
    throw new Error('Windows 推流需要视频与音频设备名称')
  }
  // 视频/音频拆成两个独立输入：设备名含 ':' 时组合串会解析错位
  return [
    ...pre,
    '-f', 'dshow',
    '-framerate', String(o.fps),
    '-video_size', `${o.width}x${o.height}`,
    '-i', `video=${target.videoName}`,
    '-f', 'dshow',
    '-i', `audio=${target.audioName}`,
    ...encodeArgs(o, rtmpUrl)
  ]
}
