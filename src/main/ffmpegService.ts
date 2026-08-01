/**
 * FFmpeg 进程管理：设备枚举、启动/停止推流、进度事件广播。
 */
import { app, BrowserWindow } from 'electron'
import { ChildProcess, execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  FfDeviceList,
  findScreenDevice,
  matchDeviceByLabel,
  parseAvfoundationDevices,
  parseDshowDevices,
  parseProgressLine
} from './core/ffmpegParse'
import { buildStreamArgs, CaptureTarget, DEFAULT_ENCODE } from './core/ffmpegArgs'
import type { VideoSourceKind } from '../shared/settings'

/** 打包后优先用随应用分发的 ffmpeg，否则用系统 PATH 中的 */
export function ffmpegPath(): string {
  const bundled = join(
    process.resourcesPath ?? '',
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
let lastLogTail: string[] = []

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
  if (current) throw new Error('已有推流进行中')

  const devices = await listCaptureDevices()
  const target: CaptureTarget = {
    platform: process.platform === 'darwin' ? 'darwin' : 'win32',
    source: opts.source
  }

  const audio =
    matchDeviceByLabel(devices.audio, opts.audioLabel) ??
    devices.audio.find((d) => /focusrite|analogue/i.test(d.name)) ??
    devices.audio[0]
  if (!audio) throw new Error('未找到可用的音频采集设备')

  if (opts.source === 'screen' && target.platform === 'darwin') {
    const screen = findScreenDevice(devices.video)
    if (!screen) throw new Error('未找到屏幕捕获设备（请在系统设置中授权屏幕录制）')
    target.videoIndex = screen.index
  } else if (opts.source === 'camera') {
    const video =
      matchDeviceByLabel(devices.video, opts.videoLabel) ??
      devices.video.find((d) => /gc311g2|streamline/i.test(d.name)) ??
      devices.video.find((d) => !/capture screen/i.test(d.name))
    if (!video) throw new Error('未找到可用的摄像头设备')
    target.videoIndex = video.index
    target.videoName = video.name
  }
  target.audioIndex = audio.index
  target.audioName = audio.name

  const args = buildStreamArgs(target, opts.rtmpUrl, DEFAULT_ENCODE)
  const child = spawn(ffmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] })
  current = child
  lastLogTail = []

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    for (const line of chunk.split(/\r|\n/)) {
      if (!line.trim()) continue
      lastLogTail.push(line)
      if (lastLogTail.length > 40) lastLogTail.shift()
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
      logTail: lastLogTail.slice(-8).join('\n')
    })
  })

  // 等待启动结果：3 秒内进程未退出即视为启动成功
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 3000)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`FFmpeg 启动失败（退出码 ${code}）：\n${lastLogTail.slice(-6).join('\n')}`))
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
