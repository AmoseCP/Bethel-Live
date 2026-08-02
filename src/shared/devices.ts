/**
 * 采集设备选择：用户在检测列表中手选并持久保存；
 * 未保存（或已拔出）时回落到列表第一个检测到的设备。
 */

export interface MediaDeviceLite {
  deviceId: string
  label: string
}

export function pickDevice(devices: MediaDeviceLite[], savedId: string): MediaDeviceLite | null {
  if (devices.length === 0) return null
  return devices.find((d) => d.deviceId === savedId) ?? devices[0]
}
