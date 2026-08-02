/** IPC 注册：渲染进程唯一入口（preload 桥调用） */
import { app, BrowserWindow, ipcMain, systemPreferences } from 'electron'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/settings'
import { getSettings, updateSettings } from './settingsStore'
import { getDefaultTitle, getTitleOptions } from './core/titleGenerator'
import * as yt from './youtubeService'
import * as ff from './ffmpegService'
import { orderedDisplays } from './ffmpegService'
import { sendTelegramMessage } from './core/telegram'
import { manualCheck } from './updater'
import { shell } from 'electron'

/** E2E 模式：YouTube/Telegram/FFmpeg 走内置假实现，覆盖完整用户流程而不触网 */
const MOCK_API = process.env.BETHEL_MOCK_API === '1'
let mockStreaming = false
let mockFrameTimer: NodeJS.Timeout | null = null
// 1x1 像素的最小合法 JPEG（模拟推流回传画面帧）
const MOCK_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
)

function mockSession(title: string): unknown {
  return {
    broadcast: { broadcastId: 'mock-broadcast-id', title, lifeCycleStatus: 'created' },
    stream: {
      streamId: 'mock-stream-id',
      ingestionAddress: 'rtmp://mock.local/live2',
      streamKey: 'mock-key',
      status: 'ready',
      healthStatus: 'good'
    },
    rtmpUrl: 'rtmp://mock.local/live2/mock-key',
    shareLink: 'https://youtube.com/live/mock-broadcast-id?feature=share',
    createdAt: Date.now()
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:checkUpdate', () => manualCheck())
  ipcMain.handle('app:openUrl', (_e, url: string) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
  })

  // ---- 直播标题 ----
  ipcMain.handle('live:titleInfo', () => {
    const now = new Date()
    return {
      options: getTitleOptions(now),
      defaultTitle: getDefaultTitle(now),
      defaultDescription: getSettings().defaultDescription
    }
  })

  // ---- YouTube ----
  ipcMain.handle('youtube:isAuthorized', () => (MOCK_API ? true : yt.isAuthorized()))
  ipcMain.handle('youtube:signIn', () => (MOCK_API ? undefined : yt.signIn()))
  ipcMain.handle('youtube:signOut', () => (MOCK_API ? undefined : yt.signOut()))
  ipcMain.handle('youtube:createLive', (_e, title: string, description: string) =>
    MOCK_API ? mockSession(title) : yt.createLive(title, description)
  )
  ipcMain.handle('youtube:transition', (_e, broadcastId: string, to: 'testing' | 'live' | 'complete') =>
    MOCK_API ? to : yt.youtubeApi.transition(broadcastId, to)
  )
  ipcMain.handle('youtube:streamStatus', (_e, streamId: string) =>
    MOCK_API ? { status: 'active', health: 'good' } : yt.youtubeApi.getStreamStatus(streamId)
  )
  ipcMain.handle('youtube:broadcastStatus', (_e, broadcastId: string) =>
    MOCK_API ? 'ready' : yt.youtubeApi.getBroadcastStatus(broadcastId)
  )

  // ---- Telegram ----
  ipcMain.handle('telegram:send', async (_e, text: string) => {
    if (MOCK_API) return
    const { telegramBotToken, telegramChatId } = getSettings()
    await sendTelegramMessage(telegramBotToken, telegramChatId, text)
  })

  // ---- 屏幕列表（屏幕直播采集目标） ----
  ipcMain.handle('screens:list', () =>
    orderedDisplays().map((d, i) => ({
      id: String(d.id),
      label: `${d.label || (i === 0 ? '主屏幕' : `屏幕 ${i + 1}`)}（${d.bounds.width}×${d.bounds.height}${i === 0 ? '，主屏' : ''}）`
    }))
  )

  // ---- FFmpeg 推流 ----
  ipcMain.handle('stream:start', (_e, opts: ff.StreamStartOptions) => {
    if (MOCK_API) {
      mockStreaming = true
      // 模拟 FFmpeg 画面回传（覆盖"推流中预览显示"这条 UI 路径）
      if (!mockFrameTimer) {
        mockFrameTimer = setInterval(() => {
          for (const w of BrowserWindow.getAllWindows()) {
            w.webContents.send('stream:previewFrame', MOCK_JPEG)
          }
        }, 200)
      }
      return
    }
    return ff.startStream(opts)
  })
  ipcMain.handle('stream:stop', () => {
    if (MOCK_API) {
      mockStreaming = false
      if (mockFrameTimer) {
        clearInterval(mockFrameTimer)
        mockFrameTimer = null
      }
      return
    }
    return ff.stopStream()
  })
  ipcMain.handle('stream:isActive', () => (MOCK_API ? mockStreaming : ff.isStreaming()))

  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_e, rawPatch: Partial<AppSettings>) => {
    // 白名单过滤：只接受已知键且类型一致的字段
    const patch: Partial<AppSettings> = {}
    if (typeof rawPatch === 'object' && rawPatch !== null) {
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
        const v = (rawPatch as Record<string, unknown>)[key]
        if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[key]) {
          ;(patch as Record<string, unknown>)[key] = v
        }
      }
    }
    const next = updateSettings(patch)
    if ('launchAtLogin' in patch) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
    }
    if ('videoSource' in patch) {
      // 屏幕直播时软件窗口（含迷你小窗）不出现在采集画面中
      for (const w of BrowserWindow.getAllWindows()) {
        w.setContentProtection(next.videoSource === 'screen')
      }
    }
    // 通知所有页面设置已变更（直播页常驻挂载，需实时感知设备/描述等变化）
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send('settings:changed', next)
    }
    return next
  })

  // macOS 首次访问摄像头/麦克风需要系统授权；其他平台直接放行
  ipcMain.handle('media:requestAccess', async (_e, kind: 'camera' | 'microphone') => {
    if (process.env.BETHEL_FAKE_MEDIA === '1') return true
    if (process.platform !== 'darwin') return true
    const status = systemPreferences.getMediaAccessStatus(kind)
    if (status === 'granted') return true
    return systemPreferences.askForMediaAccess(kind)
  })
}
