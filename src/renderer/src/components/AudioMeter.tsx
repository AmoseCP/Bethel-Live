import { useEffect, useRef, useState, type JSX } from 'react'
import { computeRms, dbToPercent, rmsToDb } from '../../../shared/audioLevel'

interface Props {
  stream: MediaStream | null
}

/** 实时音频电平表：绿-黄-红渐变条 + dB 读数 + 无声检测 */
export default function AudioMeter({ stream }: Props): JSX.Element {
  const [db, setDb] = useState(-60)
  const silentSince = useRef<number>(Date.now())
  const [silentTooLong, setSilentTooLong] = useState(false)

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setDb(-60)
      return
    }
    const ctx = new AudioContext()
    const srcNode = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    srcNode.connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    let raf = 0
    silentSince.current = Date.now()

    const tick = (): void => {
      analyser.getFloatTimeDomainData(buf)
      const level = rmsToDb(computeRms(buf))
      setDb(level)
      if (level > -50) {
        silentSince.current = Date.now()
        setSilentTooLong(false)
      } else if (Date.now() - silentSince.current > 5000) {
        setSilentTooLong(true)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      srcNode.disconnect()
      ctx.close()
    }
  }, [stream])

  const percent = dbToPercent(db)

  return (
    <div className="audio-meter">
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="meter-db">{db <= -59.5 ? '-∞' : db.toFixed(0)} dB</span>
      {!stream && <span className="meter-warn">未检测到音频设备</span>}
      {stream && silentTooLong && <span className="meter-warn">⚠ 持续无声，请检查声卡</span>}
    </div>
  )
}
