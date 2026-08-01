import { useEffect, useRef, useState, type JSX } from 'react'
import type { AppSettings, VideoSourceKind } from '../../../shared/settings'
import { useMediaPreview } from '../hooks/useMediaPreview'
import AudioMeter from '../components/AudioMeter'

export default function LivePage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    window.bethel.settings.get().then(setSettings)
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
    const updated = await window.bethel.settings.update({ videoSource: next })
    setSettings(updated)
  }

  const hasSignal =
    preview.videoStream !== null && preview.videoStream.getVideoTracks().some((t) => t.readyState === 'live')

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
            {preview.videoError
              ? `⚠ 无法打开视频源：${preview.videoError}`
              : '正在等待视频信号…'}
          </div>
        )}
      </div>

      <div className="panel meter-panel">
        <h3 className="panel-title">音频电平</h3>
        <AudioMeter stream={preview.audioStream} />
        {preview.audioError && <p className="meter-warn">⚠ 无法打开音频设备：{preview.audioError}</p>}
      </div>
    </div>
  )
}
