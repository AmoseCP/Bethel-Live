import { useEffect, useState, type JSX } from 'react'
import type { AppSettings } from '../../../shared/settings'
import { THEME_OPTIONS, type ThemeKind } from '../../../shared/theme'
import { applyTheme } from '../applyTheme'

interface DeviceOption {
  deviceId: string
  label: string
}

async function enumerateInputs(): Promise<{ video: DeviceOption[]; audio: DeviceOption[] }> {
  await window.bethel.media.requestAccess('camera')
  await window.bethel.media.requestAccess('microphone')

  let devices = await navigator.mediaDevices.enumerateDevices()
  // 未拿到设备名时，短暂开启一次采集以解锁 label
  if (devices.some((d) => d.kind === 'videoinput' && !d.label)) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      s.getTracks().forEach((t) => t.stop())
      devices = await navigator.mediaDevices.enumerateDevices()
    } catch {
      /* 用户拒绝授权时保持无名列表 */
    }
  }
  const pick = (kind: MediaDeviceKind): DeviceOption[] =>
    devices
      .filter((d) => d.kind === kind)
      .map((d) => ({ deviceId: d.deviceId, label: d.label || `设备 ${d.deviceId.slice(0, 6)}` }))
  return { video: pick('videoinput'), audio: pick('audioinput') }
}

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [videoDevices, setVideoDevices] = useState<DeviceOption[]>([])
  const [audioDevices, setAudioDevices] = useState<DeviceOption[]>([])
  const [savedTip, setSavedTip] = useState(false)

  useEffect(() => {
    window.bethel.settings.get().then(setSettings)
    enumerateInputs().then(({ video, audio }) => {
      setVideoDevices(video)
      setAudioDevices(audio)
    })
  }, [])

  if (!settings) return <div className="page">加载中…</div>

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void =>
    setSettings({ ...settings, [key]: value })

  /** 主题：点击立即生效并持久化（无需点保存） */
  const setTheme = async (theme: ThemeKind): Promise<void> => {
    applyTheme(theme)
    setSettings(await window.bethel.settings.update({ theme }))
  }

  const save = async (): Promise<void> => {
    const next = await window.bethel.settings.update(settings)
    setSettings(next)
    setSavedTip(true)
    setTimeout(() => setSavedTip(false), 2000)
  }

  return (
    <div className="page">
      <h2 className="page-title">设置</h2>

      <section className="panel">
        <h3 className="panel-title">Google API 凭据</h3>
        <label className="field">
          <span>Client ID</span>
          <input
            value={settings.googleClientId}
            onChange={(e) => set('googleClientId', e.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
          />
        </label>
        <label className="field">
          <span>Client Secret（加密存储）</span>
          <input
            type="password"
            value={settings.googleClientSecret}
            onChange={(e) => set('googleClientSecret', e.target.value)}
          />
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">Telegram</h3>
        <label className="field">
          <span>Bot API Token（加密存储）</span>
          <input
            type="password"
            value={settings.telegramBotToken}
            onChange={(e) => set('telegramBotToken', e.target.value)}
          />
        </label>
        <label className="field">
          <span>目标群组 Chat ID</span>
          <input
            value={settings.telegramChatId}
            onChange={(e) => set('telegramChatId', e.target.value)}
            placeholder="-1001234567890"
          />
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">直播默认值</h3>
        <label className="field">
          <span>默认直播描述</span>
          <input
            value={settings.defaultDescription}
            onChange={(e) => set('defaultDescription', e.target.value)}
          />
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">采集设备</h3>
        <label className="field">
          <span>视频设备（默认自动匹配 GC311G2 采集卡）</span>
          <select
            value={settings.videoDeviceId}
            onChange={(e) => set('videoDeviceId', e.target.value)}
          >
            <option value="">自动（优先 StreamLine Mini+ GC311G2）</option>
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>音频设备（默认自动匹配 Focusrite USB 声卡）</span>
          <select
            value={settings.audioDeviceId}
            onChange={(e) => set('audioDeviceId', e.target.value)}
          >
            <option value="">自动（优先 Analogue 1 + 2 Focusrite）</option>
            {audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">外观主题</h3>
        <div className="theme-picker">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.key}
              className={`theme-swatch ${settings.theme === t.key ? 'active' : ''}`}
              onClick={() => {
                setTheme(t.key)
              }}
            >
              <span className="dot" style={{ background: t.swatch }} />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">系统</h3>
        <label className="field-inline">
          <input
            type="checkbox"
            checked={settings.launchAtLogin}
            onChange={(e) => set('launchAtLogin', e.target.checked)}
          />
          <span>开机自动启动</span>
        </label>
        <label className="field">
          <span>点击关闭按钮时</span>
          <select
            value={settings.closeAction}
            onChange={(e) => set('closeAction', e.target.value as AppSettings['closeAction'])}
          >
            <option value="ask">每次询问</option>
            <option value="tray">最小化到托盘</option>
            <option value="quit">退出软件</option>
          </select>
        </label>
      </section>

      <div className="actions-row">
        <button className="btn btn-primary" onClick={save}>
          保存设置
        </button>
        {savedTip && <span className="saved-tip">✓ 已保存</span>}
      </div>
    </div>
  )
}
