import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '../shared/settings'
import type { BroadcastLifeCycle, LiveSession, TitleInfo } from '../shared/youtube'

// 渲染进程可用的 API 桥，随阶段逐步扩充
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  live: {
    titleInfo: (): Promise<TitleInfo> => ipcRenderer.invoke('live:titleInfo')
  },
  youtube: {
    isAuthorized: (): Promise<boolean> => ipcRenderer.invoke('youtube:isAuthorized'),
    signIn: (): Promise<void> => ipcRenderer.invoke('youtube:signIn'),
    signOut: (): Promise<void> => ipcRenderer.invoke('youtube:signOut'),
    createLive: (title: string, description: string): Promise<LiveSession> =>
      ipcRenderer.invoke('youtube:createLive', title, description),
    transition: (broadcastId: string, to: 'testing' | 'live' | 'complete'): Promise<BroadcastLifeCycle> =>
      ipcRenderer.invoke('youtube:transition', broadcastId, to),
    streamStatus: (streamId: string): Promise<{ status: string; health: string }> =>
      ipcRenderer.invoke('youtube:streamStatus', streamId),
    broadcastStatus: (broadcastId: string): Promise<BroadcastLifeCycle> =>
      ipcRenderer.invoke('youtube:broadcastStatus', broadcastId)
  },
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
