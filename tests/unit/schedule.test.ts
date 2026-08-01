import { describe, expect, it } from 'vitest'
import { checkScheduleTime } from '../../src/main/core/schedule'

const now = new Date(2026, 7, 1, 10, 30, 0) // 2026-08-01 10:30:00

describe('checkScheduleTime', () => {
  it('晚于当前的当天时间 → 有效并给出 delayMs', () => {
    const r = checkScheduleTime('14:00', now)
    expect(r.valid).toBe(true)
    expect(r.delayMs).toBe(3.5 * 3600 * 1000)
    expect(r.target?.getHours()).toBe(14)
  })
  it('早于当前时刻 → 无效', () => {
    expect(checkScheduleTime('09:00', now).valid).toBe(false)
  })
  it('等于当前时刻 → 无效', () => {
    expect(checkScheduleTime('10:30', now).valid).toBe(false)
  })
  it('格式非法 → 无效', () => {
    for (const bad of ['25:00', '12:60', 'abc', '', '7pm', '12:5']) {
      expect(checkScheduleTime(bad, now).valid).toBe(false)
    }
  })
  it('支持前导零与单位小时', () => {
    expect(checkScheduleTime('11:05', now).valid).toBe(true)
    expect(checkScheduleTime('23:59', now).valid).toBe(true)
  })
})
