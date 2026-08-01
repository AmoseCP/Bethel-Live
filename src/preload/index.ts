import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '../shared/settings'

// 渲染进程可用的 API 桥，随阶段逐步扩充
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', patch)
  },
  media: {
    requestAccess: (kind: 'camera' | 'microphone'): Promise<boolean> =>
      ipcRenderer.invoke('media:requestAccess', kind)
  }
}

contextBridge.exposeInMainWorld('bethel', api)

export type BethelApi = typeof api
