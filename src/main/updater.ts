/**
 * 更新统一入口：
 * - Windows 打包版：electron-updater 后台静默下载 + 一键重启安装（手动检查同样走此通道）
 * - macOS / 开发模式：GitHub Releases API 检查 + 引导下载（系统要求签名应用才能自更新）
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { checkForUpdate, compareVersions } from './core/updateCheck'
import type { UpdateCheckResult } from '../shared/update'
import { isStreaming } from './ffmpegService'

type ElectronAutoUpdater = typeof import('electron-updater').autoUpdater

let autoUpdaterRef: ElectronAutoUpdater | null = null

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload)
}

/** 手动「检查更新」：Windows 打包版触发自动下载，其余平台返回下载指引 */
export async function manualCheck(): Promise<UpdateCheckResult> {
  const current = app.getVersion()
  if (autoUpdaterRef) {
    try {
      const r = await autoUpdaterRef.checkForUpdates()
      const latest = r?.updateInfo?.version
      if (latest && compareVersions(latest, current) > 0) {
        return {
          status: 'update-available',
          currentVersion: current,
          latestVersion: latest,
          autoInstall: true
        }
      }
      return { status: 'up-to-date', currentVersion: current, latestVersion: latest ?? current }
    } catch (e) {
      return {
        status: 'error',
        currentVersion: current,
        message: e instanceof Error ? e.message : String(e)
      }
    }
  }
  return checkForUpdate(current)
}

export async function setupUpdates(onBeforeInstall: () => void): Promise<void> {
  if (process.platform === 'win32' && app.isPackaged) {
    const { autoUpdater } = await import('electron-updater')
    autoUpdaterRef = autoUpdater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-downloaded', (info) => {
      broadcast('update:downloaded', { version: info.version })
    })
    ipcMain.handle('update:install', () => {
      if (isStreaming()) throw new Error('直播推流进行中，请结束直播后再重启更新')
      onBeforeInstall()
      autoUpdater.quitAndInstall(true, true)
    })
    const check = (): void => {
      autoUpdater.checkForUpdates().catch(() => {})
    }
    setTimeout(check, 8_000)
    setInterval(check, 4 * 3600_000)
    return
  }

  ipcMain.handle('update:install', () => {
    throw new Error('当前平台不支持应用内自动安装，请从下载页获取新版本')
  })
  const notifyUpdate = async (): Promise<void> => {
    const r = await checkForUpdate(app.getVersion())
    if (r.status === 'update-available') broadcast('update:available', r)
  }
  setTimeout(() => void notifyUpdate(), 8_000)
  setInterval(() => void notifyUpdate(), 4 * 3600_000)
}
