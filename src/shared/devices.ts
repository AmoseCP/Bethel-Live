/**
 * 采集设备默认匹配（见 PROMPT.md §3）
 * 视频优先 StreamLine Mini+ GC311G2，音频优先 Focusrite USB 声卡。
 */

export interface MediaDeviceLite {
  deviceId: string
  label: string
}

export const PREFERRED_VIDEO_PATTERN = /GC311G2|StreamLine/i
export const PREFERRED_AUDIO_PATTERN = /Focusrite|Analogue 1 \+ 2/i

/**
 * 选择设备：已保存的 deviceId 仍存在则用它；
 * 否则按首选型号匹配；再否则取列表第一个。
 */
export function pickDevice(
  devices: MediaDeviceLite[],
  savedId: string,
  preferred: RegExp
): MediaDeviceLite | null {
  if (devices.length === 0) return null
  const saved = devices.find((d) => d.deviceId === savedId)
  if (savedId && saved) return saved
  const match = devices.find((d) => preferred.test(d.label))
  return match ?? devices[0]
}
