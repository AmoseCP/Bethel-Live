/**
 * 定时直播时间计算（见 PROMPT.md §5.1）
 * 仅允许选择「当天」某个时间点，且必须晚于当前时刻。
 */

export interface ScheduleCheck {
  valid: boolean
  /** 距离目标时刻的毫秒数（valid 时存在） */
  delayMs?: number
  /** 目标时刻（valid 时存在） */
  target?: Date
  reason?: string
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** 解析 "HH:mm" 并校验：格式正确、当天、晚于 now */
export function checkScheduleTime(timeStr: string, now: Date): ScheduleCheck {
  const m = TIME_RE.exec(timeStr.trim())
  if (!m) return { valid: false, reason: '时间格式应为 HH:mm' }

  const target = new Date(now)
  target.setHours(Number(m[1]), Number(m[2]), 0, 0)

  const delayMs = target.getTime() - now.getTime()
  if (delayMs <= 0) return { valid: false, reason: '定时时间必须晚于当前时刻' }

  return { valid: true, delayMs, target }
}
