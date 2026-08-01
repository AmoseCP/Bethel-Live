/** FFmpeg 输出解析（纯逻辑）：设备列表与推流进度 */

export interface FfDevice {
  index: number
  name: string
}

export interface FfDeviceList {
  video: FfDevice[]
  audio: FfDevice[]
}

/**
 * 解析 macOS `ffmpeg -f avfoundation -list_devices true -i ""` 的 stderr。
 * 形如：
 *   [AVFoundation indev @ 0x...] AVFoundation video devices:
 *   [AVFoundation indev @ 0x...] [0] FaceTime HD Camera
 *   [AVFoundation indev @ 0x...] [1] Capture screen 0
 *   [AVFoundation indev @ 0x...] AVFoundation audio devices:
 *   [AVFoundation indev @ 0x...] [0] MacBook Pro Microphone
 */
export function parseAvfoundationDevices(stderr: string): FfDeviceList {
  const video: FfDevice[] = []
  const audio: FfDevice[] = []
  let section: 'video' | 'audio' | null = null

  for (const line of stderr.split('\n')) {
    if (/AVFoundation video devices/i.test(line)) {
      section = 'video'
      continue
    }
    if (/AVFoundation audio devices/i.test(line)) {
      section = 'audio'
      continue
    }
    const m = /\[(\d+)\]\s+(.+?)\s*$/.exec(line)
    if (m && section) {
      const device = { index: Number(m[1]), name: m[2] }
      ;(section === 'video' ? video : audio).push(device)
    }
  }
  return { video, audio }
}

/**
 * 解析 Windows `ffmpeg -f dshow -list_devices true -i dummy` 的 stderr。
 * 形如：
 *   [dshow @ ...] "USB Video Device" (video)
 *   [dshow @ ...] "麦克风 (USB Audio)" (audio)
 */
export function parseDshowDevices(stderr: string): FfDeviceList {
  const video: FfDevice[] = []
  const audio: FfDevice[] = []
  for (const line of stderr.split('\n')) {
    const m = /"(.+?)"\s+\((video|audio)\)/.exec(line)
    if (!m) continue
    const list = m[2] === 'video' ? video : audio
    list.push({ index: list.length, name: m[1] })
  }
  return { video, audio }
}

/** 在 FFmpeg 设备列表中按渲染进程的设备 label 模糊匹配（label 常带厂商后缀） */
export function matchDeviceByLabel(devices: FfDevice[], label: string): FfDevice | null {
  if (devices.length === 0) return null
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '')
  const target = norm(label)
  if (!target) return null
  const hit = devices.find((d) => {
    const n = norm(d.name)
    return n === target || target.includes(n) || n.includes(target)
  })
  return hit ?? null
}

/** macOS 屏幕捕获设备（"Capture screen N"） */
export function findScreenDevice(devices: FfDevice[]): FfDevice | null {
  return devices.find((d) => /capture screen/i.test(d.name)) ?? null
}

export interface StreamProgress {
  fps: number
  bitrateKbps: number
  /** 已推流时长（秒） */
  timeSec: number
}

/** 解析进度行：frame= 302 fps= 30 q=23.0 size= 1024KiB time=00:00:10.05 bitrate=4433.2kbits/s */
export function parseProgressLine(line: string): StreamProgress | null {
  const time = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line)
  const bitrate = /bitrate=\s*([\d.]+)\s*kbits\/s/.exec(line)
  const fps = /fps=\s*([\d.]+)/.exec(line)
  if (!time && !bitrate) return null
  return {
    fps: fps ? Number(fps[1]) : 0,
    bitrateKbps: bitrate ? Number(bitrate[1]) : 0,
    timeSec: time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : 0
  }
}
