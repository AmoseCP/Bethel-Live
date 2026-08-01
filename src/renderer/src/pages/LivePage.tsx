import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { AppSettings, VideoSourceKind } from '../../../shared/settings'
import type { LiveSession } from '../../../shared/youtube'
import { useMediaPreview } from '../hooks/useMediaPreview'
import AudioMeter from '../components/AudioMeter'
import StatusBadge, { type LivePhase } from '../components/StatusBadge'
import LiveTimer from '../components/LiveTimer'
import ShareModal from '../components/ShareModal'

interface StreamStats {
  fps: number
  bitrateKbps: number
  timeSec: number
}

export default function LivePage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [titleOptions, setTitleOptions] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [session, setSession] = useState<LiveSession | null>(null)
  const [phase, setPhase] = useState<LivePhase>('idle')
  const [liveStartAt, setLiveStartAt] = useState<number | null>(null)
  const [stats, setStats] = useState<StreamStats | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const phaseRef = useRef<LivePhase>('idle')
  phaseRef.current = phase

  useEffect(() => {
    window.bethel.settings.get().then(setSettings)
    window.bethel.youtube.isAuthorized().then(setAuthorized)
    window.bethel.live.titleInfo().then((info) => {
      setTitleOptions(info.options)
      setTitle(info.defaultTitle)
      setDescription(info.defaultDescription)
    })
    const offStats = window.bethel.stream.onStats(setStats)
    const offExit = window.bethel.stream.onExit((info) => {
      setStats(null)
      if (!info.expected && phaseRef.current !== 'complete' && phaseRef.current !== 'idle') {
        setError(`推流进程意外退出（码 ${info.code}）\n${info.logTail}`)
        setPhase('created')
      }
    })
    return () => {
      offStats()
      offExit()
    }
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

  const run = useCallback(async (label: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }, [])

  const connectYouTube = (): Promise<void> =>
    run('正在等待浏览器授权…', async () => {
      await window.bethel.youtube.signIn()
      setAuthorized(true)
    })

  const createLive = (): Promise<void> =>
    run('正在创建直播…', async () => {
      setSession(await window.bethel.youtube.createLive(title, description))
      setPhase('created')
    })

  /** 开始推流并进入 YouTube 测试阶段 */
  const startTest = (): Promise<void> =>
    run('正在启动推流并等待 YouTube 接收信号…', async () => {
      if (!session) return
      await window.bethel.stream.start({
        rtmpUrl: session.rtmpUrl,
        source,
        videoLabel: preview.videoStream?.getVideoTracks()[0]?.label ?? '',
        audioLabel: preview.audioStream?.getAudioTracks()[0]?.label ?? ''
      })
      setPhase('pushing')

      // 轮询直到 YouTube 收到推流数据（最多 45 秒）
      let active = false
      for (let i = 0; i < 22; i++) {
        const s = await window.bethel.youtube.streamStatus(session.stream.streamId)
        if (s.status === 'active') {
          active = true
          break
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      if (!active) {
        await window.bethel.stream.stop()
        setPhase('created')
        throw new Error('YouTube 未在 45 秒内收到推流信号，请检查网络与设备后重试')
      }

      await window.bethel.youtube.transition(session.broadcast.broadcastId, 'testing')
      setPhase('testing')
    })

  const goLive = (): Promise<void> =>
    run('正在切换为正式直播…', async () => {
      if (!session) return
      await window.bethel.youtube.transition(session.broadcast.broadcastId, 'live')
      setPhase('live')
      setLiveStartAt(Date.now())
    })

  const endLive = (): Promise<void> =>
    run('正在结束直播…', async () => {
      if (!session) return
      setPhase('ending')
      try {
        await window.bethel.youtube.transition(session.broadcast.broadcastId, 'complete')
      } finally {
        await window.bethel.stream.stop()
      }
      setPhase('complete')
      setLiveStartAt(null)
    })

  const resetSession = (): void => {
    setSession(null)
    setPhase('idle')
    setStats(null)
    setError(null)
    window.bethel.live.titleInfo().then((info) => {
      setTitle(info.defaultTitle)
      setDescription(info.defaultDescription)
    })
  }

  const copyLink = async (): Promise<void> => {
    if (!session) return
    await navigator.clipboard.writeText(session.shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const hasSignal =
    preview.videoStream !== null &&
    preview.videoStream.getVideoTracks().some((t) => t.readyState === 'live')

  const streamingActive = phase === 'pushing' || phase === 'testing' || phase === 'live'

  return (
    <div className="page page-live">
      <div className="live-header">
        <div className="live-header-left">
          <h2 className="page-title">直播控制台</h2>
          <StatusBadge phase={phase} />
          {phase === 'live' && liveStartAt && <LiveTimer since={liveStartAt} />}
        </div>
        <div className="source-switch">
          <button
            className={`switch-btn ${source === 'camera' ? 'active' : ''}`}
            onClick={() => switchSource('camera')}
            disabled={streamingActive}
          >
            📷 摄像机
          </button>
          <button
            className={`switch-btn ${source === 'screen' ? 'active' : ''}`}
            onClick={() => switchSource('screen')}
            disabled={streamingActive}
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
        {stats && streamingActive && (
          <div className="stats-bar">
            <span>⏱ {new Date(stats.timeSec * 1000).toISOString().slice(11, 19)}</span>
            <span>{stats.fps.toFixed(0)} fps</span>
            <span>{(stats.bitrateKbps / 1000).toFixed(1)} Mbps</span>
          </div>
        )}
      </div>

      <div className="panel meter-panel">
        <h3 className="panel-title">音频电平</h3>
        <AudioMeter stream={preview.audioStream} />
        {preview.audioError && <p className="meter-warn">⚠ 无法打开音频设备：{preview.audioError}</p>}
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h3 className="panel-title">直播流程</h3>

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
            <p className="session-title">
              {phase === 'complete' ? '✓ 直播已结束：' : '✓ 已创建：'}
              {session.broadcast.title}
            </p>
            <div className="share-row">
              <code className="share-link">{session.shareLink}</code>
              <button className="btn" onClick={copyLink}>
                {copied ? '✓ 已复制' : '复制链接'}
              </button>
              <button className="btn" onClick={() => setShareOpen(true)}>
                📤 分享到 Telegram
              </button>
            </div>

            <div className="actions-row" style={{ marginTop: 14, marginBottom: 0 }}>
              {phase === 'created' && (
                <button className="btn btn-primary" onClick={startTest} disabled={busy !== null}>
                  ▶ 开始推流测试
                </button>
              )}
              {phase === 'testing' && (
                <button className="btn btn-live" onClick={goLive} disabled={busy !== null}>
                  🔴 正式开播
                </button>
              )}
              {(phase === 'testing' || phase === 'live') && (
                <button className="btn btn-danger" onClick={endLive} disabled={busy !== null}>
                  ⏹ 结束直播
                </button>
              )}
              {phase === 'complete' && (
                <button className="btn" onClick={resetSession}>
                  创建新直播
                </button>
              )}
            </div>
            {phase === 'testing' && (
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 10 }}>
                测试中：请确认上方预览画面与音频电平正常。观众此时还看不到画面，点「正式开播」后直播对观众可见。
              </p>
            )}
          </div>
        )}

        {busy && <p className="busy-tip">{busy}</p>}
        {error && <p className="error-tip">⚠ {error}</p>}
      </section>

      {shareOpen && session && (
        <ShareModal
          initialText={`${session.broadcast.title}\n${session.shareLink}`}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}
