/** 音频电平计算（纯函数，供电平表使用与单测） */

/** 时域采样（-1..1）的 RMS 值 */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/** RMS → dBFS（静音下限 -60dB） */
export function rmsToDb(rms: number): number {
  if (rms <= 0) return -60
  return Math.max(-60, 20 * Math.log10(rms))
}

/** dBFS → 电平表百分比（-60dB..0dB 映射 0..100） */
export function dbToPercent(db: number): number {
  return Math.min(100, Math.max(0, ((db + 60) / 60) * 100))
}
