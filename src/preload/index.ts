import { contextBridge } from 'electron'

// 渲染进程可用的 API 桥，后续阶段逐步扩充
const api = {
  appVersion: process.env.npm_package_version ?? ''
}

contextBridge.exposeInMainWorld('bethel', api)

export type BethelApi = typeof api
