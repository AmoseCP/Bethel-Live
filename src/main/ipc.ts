/** IPC 注册：渲染进程唯一入口（preload 桥调用） */
import { app, ipcMain, systemPreferences } from 'electron'
import { AppSettings } from '../shared/settings'
import { getSettings, updateSettings } from './settingsStore'

export function registerIpcHandlers(): void {
  ipcMain.handle('app:version', () => app.getVersion())

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
    if (process.platform !== 'darwin') return true
    const status = systemPreferences.getMediaAccessStatus(kind)
    if (status === 'granted') return true
    return systemPreferences.askForMediaAccess(kind)
  })
}
