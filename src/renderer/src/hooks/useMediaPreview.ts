import { useEffect, useRef, useState } from 'react'
import type { VideoSourceKind } from '../../../shared/settings'

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
  enabled: boolean
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
        if (source === 'screen') {
          video = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        } else {
          await window.bethel.media.requestAccess('camera')
          video = await navigator.mediaDevices.getUserMedia({
            video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
            audio: false
          })
        }
      } catch (e) {
        videoError = e instanceof Error ? e.message : String(e)
      }

      let audio: MediaStream | null = null
      let audioError: string | null = null
      try {
        await window.bethel.media.requestAccess('microphone')
        audio = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true
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
  }, [source, videoDeviceId, audioDeviceId, enabled])

  // 卸载时释放
  useEffect(() => {
    return () => {
      currentVideo.current?.getTracks().forEach((t) => t.stop())
      currentAudio.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return state
}
