/** 应用设置：结构与默认值（主/渲染进程共享） */
import { DEFAULT_THEME, ThemeKind } from './theme'

export type VideoSourceKind = 'camera' | 'screen'

export interface AppSettings {
  /** Google OAuth 凭据 */
  googleClientId: string
  googleClientSecret: string
  /** Telegram */
  telegramBotToken: string
  telegramChatId: string
  /** 直播默认描述 */
  defaultDescription: string
  /** 设备（存 deviceId；空串 = 自动匹配默认设备） */
  videoDeviceId: string
  audioDeviceId: string
  /** 视频源 */
  videoSource: VideoSourceKind
  /** 开机自启 */
  launchAtLogin: boolean
  /** 关闭窗口行为：ask=每次询问 quit=退出 tray=最小化到托盘 */
  closeAction: 'ask' | 'quit' | 'tray'
  /** 界面主题 */
  theme: ThemeKind
}

/** 磁盘上必须加密存储的字段（safeStorage） */
export const SECRET_KEYS = ['googleClientSecret', 'telegramBotToken'] as const

export const DEFAULT_SETTINGS: AppSettings = {
  googleClientId: '',
  googleClientSecret: '',
  telegramBotToken: '',
  telegramChatId: '',
  defaultDescription: 'God Bless You!',
  videoDeviceId: '',
  audioDeviceId: '',
  videoSource: 'camera',
  launchAtLogin: false,
  closeAction: 'ask',
  theme: DEFAULT_THEME
}
