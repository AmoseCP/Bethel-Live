import { useEffect, useState, type JSX } from 'react'
import type { AppSettings } from '../../../shared/settings'
import { THEME_OPTIONS, type ThemeKind } from '../../../shared/theme'
import { applyTheme } from '../applyTheme'
import { useI18n } from '../i18n'

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
  const { t } = useI18n()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [videoDevices, setVideoDevices] = useState<DeviceOption[]>([])
  const [audioDevices, setAudioDevices] = useState<DeviceOption[]>([])
  const [savedTip, setSavedTip] = useState(false)
  const [ytConnected, setYtConnected] = useState<boolean | null>(null)
  const [screens, setScreens] = useState<{ id: string; label: string }[]>([])

  useEffect(() => {
    window.bethel.youtube.isAuthorized().then(setYtConnected)
    window.bethel.screens.list().then(setScreens)
    window.bethel.settings.get().then(setSettings)
    enumerateInputs().then(({ video, audio }) => {
      setVideoDevices(video)
      setAudioDevices(audio)
    })
  }, [])

  if (!settings) return <div className="page">{t('加载中…')}</div>

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
      <h2 className="page-title">{t('设置')}</h2>

      <section className="panel">
        <h3 className="panel-title">{t('Google API 凭据')}</h3>
        <label className="field">
          <span>Client ID</span>
          <input
            value={settings.googleClientId}
            onChange={(e) => set('googleClientId', e.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
          />
        </label>
        <label className="field">
          <span>{t('Client Secret（加密存储）')}</span>
          <input
            type="password"
            value={settings.googleClientSecret}
            onChange={(e) => set('googleClientSecret', e.target.value)}
          />
        </label>
        <div className="field-inline" style={{ marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {t('YouTube 账号：')}{ytConnected === null ? '…' : ytConnected ? t('✓ 已连接') : t('未连接（去「直播」页连接）')}
          </span>
          {ytConnected && (
            <button
              className="btn"
              style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={async () => {
                await window.bethel.youtube.signOut()
                setYtConnected(false)
              }}
            >
              {t('断开连接')}
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Telegram</h3>
        <label className="field">
          <span>{t('Bot API Token（加密存储）')}</span>
          <input
            type="password"
            value={settings.telegramBotToken}
            onChange={(e) => set('telegramBotToken', e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('目标群组 Chat ID')}</span>
          <input
            value={settings.telegramChatId}
            onChange={(e) => set('telegramChatId', e.target.value)}
            placeholder="-1001234567890"
          />
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">{t('直播默认值')}</h3>
        <label className="field">
          <span>{t('默认直播描述')}</span>
          <input
            value={settings.defaultDescription}
            onChange={(e) => set('defaultDescription', e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('直播画质（按场地网络上行带宽选择）')}</span>
          <select
            value={settings.quality}
            onChange={(e) => set('quality', e.target.value as AppSettings['quality'])}
          >
            <option value="fullhd">{t('超清 1080p · 6Mbps（需稳定上行 ≥ 8Mbps）')}</option>
            <option value="high">{t('高清 720p · 4.5Mbps（需稳定上行 ≥ 6Mbps，默认）')}</option>
            <option value="medium">{t('标准 720p · 2.5Mbps（需稳定上行 ≥ 3.5Mbps）')}</option>
            <option value="low">{t('流畅 480p · 1.2Mbps（需稳定上行 ≥ 2Mbps）')}</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">{t('采集设备')}</h3>
        <label className="field">
          <span>{t('默认视频设备（在检测到的设备中选择，保存后一直生效）')}</span>
          <select
            value={settings.videoDeviceId || videoDevices[0]?.deviceId || ''}
            onChange={(e) => set('videoDeviceId', e.target.value)}
          >
            {videoDevices.length === 0 && <option value="">{t('未检测到视频设备')}</option>}
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('默认音频设备（在检测到的设备中选择，保存后一直生效）')}</span>
          <select
            value={settings.audioDeviceId || audioDevices[0]?.deviceId || ''}
            onChange={(e) => set('audioDeviceId', e.target.value)}
          >
            {audioDevices.length === 0 && <option value="">{t('未检测到音频设备')}</option>}
            {audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('屏幕直播采集的屏幕（放映 PPT 用，保存后一直生效）')}</span>
          <select
            value={settings.captureDisplayId || screens[0]?.id || ''}
            onChange={(e) => set('captureDisplayId', e.target.value)}
          >
            {screens.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">{t('外观主题')}</h3>
        <div className="theme-picker">
          {THEME_OPTIONS.map((th) => (
            <button
              key={th.key}
              className={`theme-swatch ${settings.theme === th.key ? 'active' : ''}`}
              onClick={() => {
                setTheme(th.key)
              }}
            >
              <span className="dot" style={{ background: th.swatch }} />
              {t(th.label)}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">{t('系统')}</h3>
        <label className="field-inline">
          <input
            type="checkbox"
            checked={settings.launchAtLogin}
            onChange={(e) => set('launchAtLogin', e.target.checked)}
          />
          <span>{t('开机自动启动')}</span>
        </label>
        <label className="field">
          <span>{t('点击关闭按钮时')}</span>
          <select
            value={settings.closeAction}
            onChange={(e) => set('closeAction', e.target.value as AppSettings['closeAction'])}
          >
            <option value="ask">{t('每次询问')}</option>
            <option value="tray">{t('最小化到托盘')}</option>
            <option value="quit">{t('退出软件')}</option>
          </select>
        </label>
      </section>

      <div className="actions-row">
        <button className="btn btn-primary" onClick={save}>
          {t('保存设置')}
        </button>
        {savedTip && <span className="saved-tip">{t('✓ 已保存')}</span>}
      </div>
    </div>
  )
}
