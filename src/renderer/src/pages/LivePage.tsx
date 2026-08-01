import { useEffect, useRef, useState, type JSX } from 'react'
import type { AppSettings, VideoSourceKind } from '../../../shared/settings'
import type { LiveSession } from '../../../shared/youtube'
import { useMediaPreview } from '../hooks/useMediaPreview'
import AudioMeter from '../components/AudioMeter'

export default function LivePage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [titleOptions, setTitleOptions] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [session, setSession] = useState<LiveSession | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    window.bethel.settings.get().then(setSettings)
    window.bethel.youtube.isAuthorized().then(setAuthorized)
    window.bethel.live.titleInfo().then((info) => {
      setTitleOptions(info.options)
      setTitle(info.defaultTitle)
      setDescription(info.defaultDescription)
    })
  }, [])

  const source: VideoSourceKind = settings?.videoSource ?? 'camera'
  const preview = useMediaPreview(
    source,
    settings?.videoDeviceId ?? '',
    settings?.audioDeviceId ?? '',
    settings !== null
  )

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = preview.videoStream
  }, [preview.videoStream])

  const switchSource = async (next: VideoSourceKind): Promise<void> => {
    if (!settings || next === settings.videoSource) return
    setSettings(await window.bethel.settings.update({ videoSource: next }))
  }

  const run = async (label: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const connectYouTube = (): Promise<void> =>
    run('正在等待浏览器授权…', async () => {
      await window.bethel.youtube.signIn()
      setAuthorized(true)
    })

  const createLive = (): Promise<void> =>
    run('正在创建直播…', async () => {
      setSession(await window.bethel.youtube.createLive(title, description))
    })

  const copyLink = async (): Promise<void> => {
    if (!session) return
    await navigator.clipboard.writeText(session.shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const hasSignal =
    preview.videoStream !== null &&
    preview.videoStream.getVideoTracks().some((t) => t.readyState === 'live')

  return (
    <div className="page page-live">
      <div className="live-header">
        <h2 className="page-title">直播控制台</h2>
        <div className="source-switch">
          <button
            className={`switch-btn ${source === 'camera' ? 'active' : ''}`}
            onClick={() => switchSource('camera')}
          >
            📷 摄像机
          </button>
          <button
            className={`switch-btn ${source === 'screen' ? 'active' : ''}`}
            onClick={() => switchSource('screen')}
          >
            🖥 本机屏幕
          </button>
        </div>
      </div>

      <div className="preview-box">
        <video ref={videoRef} autoPlay muted playsInline className="preview-video" />
        {!hasSignal && (
          <div className="preview-overlay">
            {preview.videoError ? `⚠ 无法打开视频源：${preview.videoError}` : '正在等待视频信号…'}
          </div>
        )}
      </div>

      <div className="panel meter-panel">
        <h3 className="panel-title">音频电平</h3>
        <AudioMeter stream={preview.audioStream} />
        {preview.audioError && <p className="meter-warn">⚠ 无法打开音频设备：{preview.audioError}</p>}
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h3 className="panel-title">创建直播</h3>

        {authorized === false && (
          <div className="actions-row" style={{ margin: 0 }}>
            <button className="btn btn-primary" onClick={connectYouTube} disabled={busy !== null}>
              连接 YouTube 账号
            </button>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              需先在「设置」中填写 Google API 凭据
            </span>
          </div>
        )}

        {authorized && !session && (
          <>
            <label className="field">
              <span>直播标题（按当天日期自动生成，可修改）</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {titleOptions.length > 1 && (
              <div className="title-options">
                {titleOptions.map((t) => (
                  <button key={t} className="chip" onClick={() => setTitle(t)}>
                    {t.split(' ').slice(1).join(' ')}
                  </button>
                ))}
              </div>
            )}
            <label className="field">
              <span>直播描述</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="actions-row" style={{ margin: 0 }}>
              <button
                className="btn btn-primary"
                onClick={createLive}
                disabled={busy !== null || !title.trim()}
              >
                🚀 一键创建直播
              </button>
            </div>
          </>
        )}

        {session && (
          <div className="session-info">
            <p className="session-title">✓ 已创建：{session.broadcast.title}</p>
            <div className="share-row">
              <code className="share-link">{session.shareLink}</code>
              <button className="btn" onClick={copyLink}>
                {copied ? '✓ 已复制' : '复制链接'}
              </button>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>
              推流控制（测试 / 开播 / 结束）将在下一阶段接入 FFmpeg 后启用。
            </p>
          </div>
        )}

        {busy && <p className="busy-tip">{busy}</p>}
        {error && <p className="error-tip">⚠ {error}</p>}
      </section>
    </div>
  )
}
