import { useEffect, useRef, useState } from 'react'
import type { VideoSourceKind } from '../../../shared/settings'
import { pickDevice } from '../../../shared/devices'

/** 设备解析：用户保存的选择优先，否则取检测列表第一个 */
async function resolveDeviceId(
  kind: 'videoinput' | 'audioinput',
  savedId: string
): Promise<string> {
  const all = await navigator.mediaDevices.enumerateDevices()
  const devices = all
    .filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'default')
    .map((d) => ({ deviceId: d.deviceId, label: d.label }))
  return pickDevice(devices, savedId)?.deviceId ?? ''
}

export interface PreviewState {
  /** 预览视频流（含摄像头或屏幕视频轨） */
  videoStream: MediaStream | null
  /** 监听音频流（所选麦克风，用于电平表） */
  audioStream: MediaStream | null
  videoError: string | null
  audioError: string | null
}

/**
 * 管理预览采集：按视频源（摄像机/屏幕）与设备 ID 打开媒体流，
 * 依赖变化或卸载时自动释放旧流，保证切换平滑且不泄漏设备占用。
 */
export function useMediaPreview(
  source: VideoSourceKind,
  videoDeviceId: string,
  audioDeviceId: string,
  enabled: boolean,
  /** false = 暂不占用视频设备（Windows 推流期间摄像头须让给 FFmpeg 独占） */
  videoEnabled: boolean = true
): PreviewState {
  const [state, setState] = useState<PreviewState>({
    videoStream: null,
    audioStream: null,
    videoError: null,
    audioError: null
  })
  const currentVideo = useRef<MediaStream | null>(null)
  const currentAudio = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    const stop = (s: MediaStream | null): void => s?.getTracks().forEach((t) => t.stop())

    async function open(): Promise<void> {
      if (!enabled) {
        stop(currentVideo.current)
        stop(currentAudio.current)
        currentVideo.current = null
        currentAudio.current = null
        setState({ videoStream: null, audioStream: null, videoError: null, audioError: null })
        return
      }

      let video: MediaStream | null = null
      let videoError: string | null = null
      try {
        if (!videoEnabled) {
          video = null
        } else if (source === 'screen') {
          video = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        } else {
          await window.bethel.media.requestAccess('camera')
          const vid = await resolveDeviceId('videoinput', videoDeviceId)
          video = await navigator.mediaDevices.getUserMedia({
            video: vid ? { deviceId: { exact: vid } } : true,
            audio: false
          })
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        videoError =
          source === 'screen'
            ? `屏幕捕获失败（${raw}）。请到「系统设置 → 隐私与安全性 → 屏幕录制」中允许 Bethel Live（若已在列表中请先关再开），然后重启软件。`
            : raw
      }

      let audio: MediaStream | null = null
      let audioError: string | null = null
      try {
        await window.bethel.media.requestAccess('microphone')
        const aid = await resolveDeviceId('audioinput', audioDeviceId)
        // 关闭回声消除/自动增益/降噪：电平表与试听必须反映 ffmpeg 实际推流的原始信号
        const rawAudio = {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
        audio = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: aid ? { deviceId: { exact: aid }, ...rawAudio } : rawAudio
        })
      } catch (e) {
        audioError = e instanceof Error ? e.message : String(e)
      }

      if (cancelled) {
        stop(video)
        stop(audio)
        return
      }

      // 新流就绪后再停旧流，避免画面闪黑
      stop(currentVideo.current)
      stop(currentAudio.current)
      currentVideo.current = video
      currentAudio.current = audio
      setState({ videoStream: video, audioStream: audio, videoError, audioError })
    }

    open()
    return () => {
      cancelled = true
    }
  }, [source, videoDeviceId, audioDeviceId, enabled, videoEnabled])

  // 卸载时释放
  useEffect(() => {
    return () => {
      currentVideo.current?.getTracks().forEach((t) => t.stop())
      currentAudio.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return state
}
