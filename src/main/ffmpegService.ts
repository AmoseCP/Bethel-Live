/**
 * FFmpeg 进程管理：设备枚举、启动/停止推流、进度事件广播。
 */
import { app, BrowserWindow, screen } from 'electron'
import { ChildProcess, execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  FfDeviceList,
  matchDeviceByLabel,
  parseAvfoundationDevices,
  parseDshowDevices,
  parseProgressLine,
  pickScreenDevice
} from './core/ffmpegParse'
import { getSettings } from './settingsStore'
import { buildStreamArgs, CaptureTarget, QUALITY_PRESETS } from './core/ffmpegArgs'
import type { VideoSourceKind } from '../shared/settings'

/** 显示器列表（主屏固定排在最前，与 avfoundation 屏幕序号约定一致） */
export function orderedDisplays(): Electron.Display[] {
  const primary = screen.getPrimaryDisplay()
  const rest = screen.getAllDisplays().filter((d) => d.id !== primary.id)
  return [primary, ...rest]
}

/** 用户所选显示器（保存值缺失/已拔出时回落主屏） */
function chosenDisplay(): Electron.Display {
  const saved = getSettings().captureDisplayId
  const list = orderedDisplays()
  return list.find((d) => String(d.id) === saved) ?? list[0]
}

/** 所选显示器在主屏在前列表中的序号 */
function chosenDisplayOrdinal(): number {
  const saved = getSettings().captureDisplayId
  const idx = orderedDisplays().findIndex((d) => String(d.id) === saved)
  return idx >= 0 ? idx : 0
}

/** 打包后优先用随应用分发的 ffmpeg（resources/bin），否则用系统 PATH 中的 */
export function ffmpegPath(): string {
  const bundled = join(
    process.resourcesPath ?? '',
    'bin',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  )
  if (app.isPackaged && existsSync(bundled)) return bundled
  return 'ffmpeg'
}

/** 枚举 FFmpeg 可见的采集设备（结果解析为统一结构） */
export function listCaptureDevices(): Promise<FfDeviceList> {
  return new Promise((resolve) => {
    const args =
      process.platform === 'darwin'
        ? ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', '']
        : ['-hide_banner', '-f', 'dshow', '-list_devices', 'true', '-i', 'dummy']
    // 列设备时 ffmpeg 以非零码退出属正常，只取 stderr
    execFile(ffmpegPath(), args, { timeout: 10_000 }, (_err, _stdout, stderr) => {
      resolve(
        process.platform === 'darwin'
          ? parseAvfoundationDevices(String(stderr))
          : parseDshowDevices(String(stderr))
      )
    })
  })
}

export interface StreamStartOptions {
  rtmpUrl: string
  source: VideoSourceKind
  /** 渲染进程侧选中的设备 label（空 = 自动） */
  videoLabel: string
  audioLabel: string
}

let current: ChildProcess | null = null
let starting = false

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function isStreaming(): boolean {
  return current !== null
}

/** 启动推流；进度经 'stream:stats' 广播，退出经 'stream:exit' 广播 */
export async function startStream(opts: StreamStartOptions): Promise<void> {
  if (current || starting) throw new Error('已有推流进行中')
  if (!/^rtmps?:\/\/[a-z0-9.-]+\.youtube\.com\//i.test(opts.rtmpUrl)) {
    throw new Error('无效的推流地址（仅支持 YouTube RTMP）')
  }
  starting = true
  try {
    await startStreamInner(opts)
  } finally {
    starting = false
  }
}

async function startStreamInner(opts: StreamStartOptions): Promise<void> {
  const devices = await listCaptureDevices()
  const target: CaptureTarget = {
    platform: process.platform === 'darwin' ? 'darwin' : 'win32',
    source: opts.source
  }

  const audio = matchDeviceByLabel(devices.audio, opts.audioLabel) ?? devices.audio[0]
  if (!audio) throw new Error('未找到可用的音频采集设备')

  if (opts.source === 'screen' && target.platform === 'darwin') {
    // 所选显示器 → avfoundation 屏幕序号：主屏在前的显示器列表中的位置
    const screenDev = pickScreenDevice(devices.video, chosenDisplayOrdinal())
    if (!screenDev) throw new Error('未找到屏幕捕获设备（请在系统设置中授权屏幕录制）')
    target.videoIndex = screenDev.index
  } else if (opts.source === 'screen') {
    // Windows：所选显示器的物理像素区域（混合 DPI 用系统换算）
    const chosen = chosenDisplay()
    const rect = screen.dipToScreenRect(null, chosen.bounds)
    target.screenRegion = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  } else if (opts.source === 'camera') {
    const video =
      matchDeviceByLabel(devices.video, opts.videoLabel) ??
      devices.video.find((d) => !/capture screen/i.test(d.name))
    if (!video) throw new Error('未找到可用的摄像头设备')
    target.videoIndex = video.index
    target.videoName = video.name
  }
  target.audioIndex = audio.index
  target.audioName = audio.name

  const args = buildStreamArgs(target, opts.rtmpUrl, QUALITY_PRESETS[getSettings().quality])
  const child = spawn(ffmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] })
  current = child

  // 每个进程独享日志尾（重启推流后旧进程 exit 事件不会读到新进程日志）
  const logTail: string[] = []
  // 日志中的推流密钥脱敏（stderr 会原样打印输出 URL）
  const streamKey = opts.rtmpUrl.split('/').pop() ?? ''
  const redact = (line: string): string =>
    streamKey.length >= 8 ? line.split(streamKey).join('****') : line

  // ffmpeg 刚退出瞬间对 stdin 的写入会以异步 error 事件抛出，必须兜底防主进程崩溃
  child.stdin?.on('error', () => {})

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    for (const line of chunk.split(/\r|\n/)) {
      if (!line.trim()) continue
      logTail.push(redact(line))
      if (logTail.length > 40) logTail.shift()
      const progress = parseProgressLine(line)
      if (progress) broadcast('stream:stats', progress)
    }
  })

  child.on('exit', (code) => {
    const wasCurrent = current === child
    if (wasCurrent) current = null
    broadcast('stream:exit', {
      code,
      expected: !wasCurrent || code === 0 || code === 255,
      logTail: logTail.slice(-8).join('\n')
    })
  })

  // 等待启动结果：3 秒内进程未退出即视为启动成功
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 3000)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`FFmpeg 启动失败（退出码 ${code}）：\n${logTail.slice(-6).join('\n')}`))
    })
    child.once('error', (e) => {
      clearTimeout(timer)
      current = null
      reject(new Error(`无法启动 FFmpeg：${e.message}（请确认已安装 ffmpeg）`))
    })
  })
}

/** 停止推流：先发 q/SIGINT 让 FFmpeg 优雅收尾，超时强杀 */
export async function stopStream(): Promise<void> {
  const child = current
  if (!child) return
  current = null

  await new Promise<void>((resolve) => {
    const force = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 4000)
    child.once('exit', () => {
      clearTimeout(force)
      resolve()
    })
    try {
      child.stdin?.write('q')
      child.stdin?.end()
    } catch {
      child.kill('SIGINT')
    }
  })
}
