import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { AppSettings, VideoSourceKind } from '../../../shared/settings'
import type { LiveSession } from '../../../shared/youtube'
import { checkScheduleTime } from '../../../shared/schedule'
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

interface Props {
  mini: boolean
  onToggleMini: (mini: boolean) => Promise<void>
}

export default function LivePage({ mini, onToggleMini }: Props): JSX.Element {
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
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduledAt, setScheduledAt] = useState<number | null>(null)
  const [countdown, setCountdown] = useState('')
  const phaseRef = useRef<LivePhase>('idle')
  phaseRef.current = phase
  const lastStartOpts = useRef<Parameters<typeof window.bethel.stream.start>[0] | null>(null)
  const reconnecting = useRef(false)
  const reconnectCount = useRef(0)
  const lastReconnectAt = useRef(0)
  const defaultDescRef = useRef('')

  const defaultTitleRef = useRef('')

  const refreshTitleInfo = useCallback((): void => {
    window.bethel.live.titleInfo().then((info) => {
      setTitleOptions(info.options)
      if (phaseRef.current === 'idle' || defaultTitleRef.current === '') {
        // 仅当用户没手动改过标题/描述时才替换为新默认值（托盘常驻跨天场景）
        const oldTitle = defaultTitleRef.current
        defaultTitleRef.current = info.defaultTitle
        setTitle((prev) => (prev === oldTitle || prev === '' ? info.defaultTitle : prev))
        const oldDesc = defaultDescRef.current
        defaultDescRef.current = info.defaultDescription
        setDescription((prev) => (prev === oldDesc || prev === '' ? info.defaultDescription : prev))
      }
    })
  }, [])

  useEffect(() => {
    window.bethel.settings.get().then(setSettings)
    window.bethel.youtube.isAuthorized().then(setAuthorized)
    refreshTitleInfo()
    window.addEventListener('focus', refreshTitleInfo)
    const offStats = window.bethel.stream.onStats(setStats)
    // 设置页改动实时同步（设备/屏幕偏好/默认描述等）
    const offSettings = window.bethel.settings.onChanged((s) => {
      setSettings(s)
      if (phaseRef.current === 'idle') {
        // 先捕获旧默认值：函数式更新是异步执行的，不能在比较前改掉 ref
        const oldDefault = defaultDescRef.current
        defaultDescRef.current = s.defaultDescription
        setDescription((prev) => (prev === oldDefault ? s.defaultDescription : prev))
      }
    })
    const offExit = window.bethel.stream.onExit(async (info) => {
      setStats(null)
      const ph = phaseRef.current
      if (info.expected || ph === 'complete' || ph === 'idle') return

      // 测试/直播中意外退出：自动重连（60 秒内最多 2 次，防止反复崩溃死循环）
      if ((ph === 'testing' || ph === 'live') && lastStartOpts.current && !reconnecting.current) {
        if (Date.now() - lastReconnectAt.current > 60_000) reconnectCount.current = 0
        if (reconnectCount.current < 2) {
          reconnecting.current = true
          reconnectCount.current += 1
          lastReconnectAt.current = Date.now()
          setError('⚠ 推流意外中断，正在自动重连…')
          try {
            await window.bethel.stream.start(lastStartOpts.current)
            setError(null)
          } catch (e) {
            setError(
              `推流中断且自动重连失败：${e instanceof Error ? e.message : e}\n请检查设备与网络后点「结束直播」，再重新开播。`
            )
          } finally {
            reconnecting.current = false
          }
          return
        }
        setError(`推流反复中断（码 ${info.code}），已停止自动重连。请点「结束直播」后排查设备。\n${info.logTail}`)
        return
      }

      if (!reconnecting.current) {
        setError(`推流进程意外退出（码 ${info.code}）\n${info.logTail}`)
        setPhase('created')
      }
    })
    return () => {
      window.removeEventListener('focus', refreshTitleInfo)
      offStats()
      offSettings()
      offExit()
    }
  }, [refreshTitleInfo])

  const source: VideoSourceKind = settings?.videoSource ?? 'camera'
  const preview = useMediaPreview(
    source,
    settings?.videoDeviceId ?? '',
    settings?.audioDeviceId ?? '',
    settings !== null
  )

  // 回调 ref：迷你/完整两套布局共用同一条预览流
  const attachVideo = useCallback(
    (el: HTMLVideoElement | null): void => {
      if (el && el.srcObject !== preview.videoStream) el.srcObject = preview.videoStream
    },
    [preview.videoStream]
  )

  const switchSource = async (next: VideoSourceKind): Promise<void> => {
    if (!settings || next === settings.videoSource || busy !== null) return
    setSettings(await window.bethel.settings.update({ videoSource: next }))

    // 直播/测试进行中：用新视频源重启推流（画面短暂停顿，直播不中断）
    if (streamingActive && session) {
      await run(next === 'screen' ? '正在切换到屏幕画面…' : '正在切换到摄像机画面…', async () => {
        await window.bethel.stream.stop()
        const startOpts = {
          rtmpUrl: session.rtmpUrl,
          source: next,
          videoLabel: '', // 按默认规则匹配：摄像机优先采集卡，屏幕按设置选屏
          audioLabel: preview.audioStream?.getAudioTracks()[0]?.label ?? ''
        }
        await window.bethel.stream.start(startOpts)
        lastStartOpts.current = startOpts
      })
    }
  }

  const run = useCallback(async (label: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      if (/授权已失效/.test(msg)) setAuthorized(false)
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
      setScheduledAt(null) // 手动创建后解除已武装的定时，避免到点重复开播
      setSession(await window.bethel.youtube.createLive(title, description))
      setPhase('created')
    })

  /** 启动推流 → 等 YouTube 收流 → 进入测试阶段（供手动与定时流程复用） */
  const doStartTest = useCallback(
    async (sess: LiveSession): Promise<void> => {
      const startOpts = {
        rtmpUrl: sess.rtmpUrl,
        source,
        videoLabel: preview.videoStream?.getVideoTracks()[0]?.label ?? '',
        audioLabel: preview.audioStream?.getAudioTracks()[0]?.label ?? ''
      }
      await window.bethel.stream.start(startOpts)
      lastStartOpts.current = startOpts
      setPhase('pushing')

      // 此后任一步失败：停流并回退，绝不把界面留在 pushing 且 ffmpeg 还在跑
      try {
        let active = false
        for (let i = 0; i < 22; i++) {
          if (!(await window.bethel.stream.isActive())) {
            throw new Error('推流进程已退出，请查看上方错误信息后重试')
          }
          const s = await window.bethel.youtube.streamStatus(sess.stream.streamId)
          if (s.status === 'active') {
            active = true
            break
          }
          await new Promise((r) => setTimeout(r, 2000))
        }
        if (!active) {
          throw new Error('YouTube 未在 45 秒内收到推流信号，请检查网络与设备后重试')
        }
        await window.bethel.youtube.transition(sess.broadcast.broadcastId, 'testing')
      } catch (e) {
        await window.bethel.stream.stop().catch(() => {})
        setPhase('created')
        throw e
      }
      setPhase('testing')
    },
    [source, preview.videoStream, preview.audioStream]
  )

  const startTest = (): Promise<void> =>
    run('正在启动推流并等待 YouTube 接收信号…', async () => {
      if (session) await doStartTest(session)
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
      const before = phaseRef.current
      setPhase('ending')
      try {
        await window.bethel.youtube.transition(session.broadcast.broadcastId, 'complete')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // 广播已被 YouTube 自动结束（redundant/invalid transition）视为结束成功
        if (!/redundant|invalid/i.test(msg)) {
          setPhase(before) // 回退，保留"结束直播"按钮可重试
          throw e
        }
      }
      await window.bethel.stream.stop()
      setPhase('complete')
      setLiveStartAt(null)
    })

  /** 定时到点：创建 → 推流测试 → 直接开播 */
  const autoStart = useCallback((): Promise<void> => {
    if (phaseRef.current !== 'idle') return Promise.resolve() // 已手动开播则忽略定时触发
    return run('定时开播：正在自动创建并开始直播…', async () => {
      const sess = await window.bethel.youtube.createLive(title, description)
      setSession(sess)
      setPhase('created')
      await doStartTest(sess)
      await window.bethel.youtube.transition(sess.broadcast.broadcastId, 'live')
      setPhase('live')
      setLiveStartAt(Date.now())
    })
  }, [run, doStartTest, title, description])
  const autoStartRef = useRef(autoStart)
  autoStartRef.current = autoStart

  // 定时触发与倒计时
  useEffect(() => {
    if (scheduledAt === null) return
    const t = setInterval(() => {
      const remain = scheduledAt - Date.now()
      if (remain <= 0) {
        setScheduledAt(null)
        setCountdown('')
        void autoStartRef.current()
        return
      }
      const m = Math.floor(remain / 60000)
      const s = Math.floor((remain % 60000) / 1000)
      setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }, 500)
    return () => clearInterval(t)
  }, [scheduledAt])

  const armSchedule = (): void => {
    const check = checkScheduleTime(scheduleTime, new Date())
    if (!check.valid) {
      setError(check.reason ?? '定时时间无效')
      return
    }
    setError(null)
    setScheduledAt(check.target!.getTime())
  }

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

  // ---------- 迷你模式 ----------
  if (mini) {
    return (
      <div className="mini-view">
        <video ref={attachVideo} autoPlay muted playsInline className="mini-video" />
        <div className="mini-overlay">
          <div className="mini-top">
            <StatusBadge phase={phase} />
            {phase === 'live' && liveStartAt && <LiveTimer since={liveStartAt} />}
          </div>
          <div className="mini-actions">
            <button
              className={`btn btn-mini ${source === 'camera' ? 'btn-mini-active' : ''}`}
              onClick={() => switchSource('camera')}
              disabled={busy !== null}
              title="切换到摄像机"
            >
              📷
            </button>
            <button
              className={`btn btn-mini ${source === 'screen' ? 'btn-mini-active' : ''}`}
              onClick={() => switchSource('screen')}
              disabled={busy !== null}
              title="切换到本机屏幕（放 PPT）"
            >
              🖥
            </button>
            {(phase === 'testing' || phase === 'live') && (
              <button className="btn btn-danger btn-mini" onClick={endLive} disabled={busy !== null}>
                ⏹
              </button>
            )}
            <button className="btn btn-mini" onClick={() => onToggleMini(false)} title="返回完整界面">
              ⤢
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 完整界面 ----------
  return (
    <div className="page page-live">
      <div className="live-header">
        <div className="live-header-left">
          <h2 className="page-title">直播控制台</h2>
          <StatusBadge phase={phase} />
          {phase === 'live' && liveStartAt && <LiveTimer since={liveStartAt} />}
        </div>
        <div className="live-header-right">
          <button className="btn btn-icon" onClick={() => onToggleMini(true)} title="迷你模式">
            ⧉
          </button>
          <div className="source-switch">
            <button
              className={`switch-btn ${source === 'camera' ? 'active' : ''}`}
              onClick={() => switchSource('camera')}
              disabled={busy !== null}
              title="直播中也可切换，画面短暂停顿后恢复"
            >
              📷 摄像机
            </button>
            <button
              className={`switch-btn ${source === 'screen' ? 'active' : ''}`}
              onClick={() => switchSource('screen')}
              disabled={busy !== null}
              title="放映 PPT 时切到此源，观众即可看到你的屏幕"
            >
              🖥 本机屏幕
            </button>
          </div>
        </div>
      </div>

      <div className="preview-box">
        <video ref={attachVideo} autoPlay muted playsInline className="preview-video" />
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

        {!session && (
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
              {authorized ? (
                <button
                  className="btn btn-primary"
                  onClick={createLive}
                  disabled={busy !== null || !title.trim()}
                >
                  🚀 一键创建直播
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={connectYouTube}
                    disabled={busy !== null || authorized === null}
                  >
                    连接 YouTube 账号
                  </button>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    连接后即可用上方标题一键创建直播（需先在「设置」中填写 Google API 凭据）
                  </span>
                </>
              )}
            </div>

            <div className="schedule-row">
              {scheduledAt === null ? (
                <>
                  <span className="schedule-label">⏰ 定时直播（今天）</span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="schedule-input"
                  />
                  <button
                    className="btn"
                    onClick={armSchedule}
                    disabled={!scheduleTime || busy !== null || !authorized}
                    title={authorized ? '' : '需先连接 YouTube 账号'}
                  >
                    启动定时
                  </button>
                </>
              ) : (
                <>
                  <span className="schedule-armed">
                    ⏰ 将于 {scheduleTime} 自动开播（倒计时 {countdown || '…'}）
                  </span>
                  <button className="btn" onClick={() => setScheduledAt(null)}>
                    取消定时
                  </button>
                </>
              )}
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
              {phase === 'pushing' && busy === null && (
                <button
                  className="btn btn-danger"
                  onClick={() =>
                    run('正在停止推流…', async () => {
                      await window.bethel.stream.stop()
                      setPhase('created')
                    })
                  }
                >
                  ⏹ 停止推流
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
