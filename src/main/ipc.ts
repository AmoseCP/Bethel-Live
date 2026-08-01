/** IPC 注册：渲染进程唯一入口（preload 桥调用） */
import { app, ipcMain, systemPreferences } from 'electron'
import { AppSettings } from '../shared/settings'
import { getSettings, updateSettings } from './settingsStore'
import { getDefaultTitle, getTitleOptions } from './core/titleGenerator'
import * as yt from './youtubeService'

export function registerIpcHandlers(): void {
  ipcMain.handle('app:version', () => app.getVersion())

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
  ipcMain.handle('youtube:isAuthorized', () => yt.isAuthorized())
  ipcMain.handle('youtube:signIn', () => yt.signIn())
  ipcMain.handle('youtube:signOut', () => yt.signOut())
  ipcMain.handle('youtube:createLive', (_e, title: string, description: string) =>
    yt.createLive(title, description)
  )
  ipcMain.handle('youtube:transition', (_e, broadcastId: string, to: 'testing' | 'live' | 'complete') =>
    yt.youtubeApi.transition(broadcastId, to)
  )
  ipcMain.handle('youtube:streamStatus', (_e, streamId: string) =>
    yt.youtubeApi.getStreamStatus(streamId)
  )
  ipcMain.handle('youtube:broadcastStatus', (_e, broadcastId: string) =>
    yt.youtubeApi.getBroadcastStatus(broadcastId)
  )

  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings>) => {
    const next = updateSettings(patch)
    if ('launchAtLogin' in patch) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
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
