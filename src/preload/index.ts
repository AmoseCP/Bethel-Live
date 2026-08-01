import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppSettings, VideoSourceKind } from '../shared/settings'
import type { BroadcastLifeCycle, LiveSession, TitleInfo } from '../shared/youtube'

export interface StreamProgress {
  fps: number
  bitrateKbps: number
  timeSec: number
}

export interface StreamExitInfo {
  code: number | null
  expected: boolean
  logTail: string
}

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

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
  stream: {
    start: (opts: {
      rtmpUrl: string
      source: VideoSourceKind
      videoLabel: string
      audioLabel: string
    }): Promise<void> => ipcRenderer.invoke('stream:start', opts),
    stop: (): Promise<void> => ipcRenderer.invoke('stream:stop'),
    isActive: (): Promise<boolean> => ipcRenderer.invoke('stream:isActive'),
    onStats: (cb: (p: StreamProgress) => void): (() => void) => subscribe('stream:stats', cb),
    onExit: (cb: (p: StreamExitInfo) => void): (() => void) => subscribe('stream:exit', cb)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', patch)
  },
  telegram: {
    send: (text: string): Promise<void> => ipcRenderer.invoke('telegram:send', text)
  },
  media: {
    requestAccess: (kind: 'camera' | 'microphone'): Promise<boolean> =>
      ipcRenderer.invoke('media:requestAccess', kind)
  }
}

contextBridge.exposeInMainWorld('bethel', api)

export type BethelApi = typeof api
