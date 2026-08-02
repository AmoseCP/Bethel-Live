/** 检查更新结果（主/渲染进程共享） */
export interface UpdateCheckResult {
  status: 'update-available' | 'up-to-date' | 'no-release' | 'error'
  currentVersion: string
  latestVersion?: string
  /** 下载页面地址（有新版时） */
  url?: string
  message?: string
  /** true = 正在后台自动下载，无需手动下载（Windows） */
  autoInstall?: boolean
}
