import { describe, expect, it } from 'vitest'
import {
  formatDateMDY,
  getDefaultTitle,
  getTitleOptions
} from '../../src/main/core/titleGenerator'

// 2026-07-27 是周一（PROMPT.md 示例表使用的同一周）
const at = (y: number, m: number, d: number, h = 9): Date => new Date(y, m - 1, d, h, 0, 0)

describe('formatDateMDY', () => {
  it('格式为 M/D/YYYY，不补零', () => {
    expect(formatDateMDY(at(2026, 7, 27))).toBe('7/27/2026')
    expect(formatDateMDY(at(2026, 12, 5))).toBe('12/5/2026')
    expect(formatDateMDY(at(2026, 1, 1))).toBe('1/1/2026')
  })
})

describe('getTitleOptions（各星期场次）', () => {
  it('周一：Morning Service', () => {
    expect(getTitleOptions(at(2026, 7, 27))).toEqual(['7/27/2026 Morning Service'])
  })
  it('周二：Morning Service', () => {
    expect(getTitleOptions(at(2026, 7, 28))).toEqual(['7/28/2026 Morning Service'])
  })
  it('周三：早晚两场', () => {
    expect(getTitleOptions(at(2026, 7, 29))).toEqual([
      '7/29/2026 Morning Service',
      '7/29/2026 Wednesday Service'
    ])
  })
  it('周四：Morning Service', () => {
    expect(getTitleOptions(at(2026, 7, 30))).toEqual(['7/30/2026 Morning Service'])
  })
  it('周五：早晚两场', () => {
    expect(getTitleOptions(at(2026, 7, 31))).toEqual([
      '7/31/2026 Morning Service',
      '7/31/2026 Friday Prayer Meeting'
    ])
  })
  it('周六：Broadcast', () => {
    expect(getTitleOptions(at(2026, 8, 1))).toEqual(['8/1/2026 Broadcast'])
  })
  it('周日：Sunday Service', () => {
    expect(getTitleOptions(at(2026, 8, 2))).toEqual(['8/2/2026 Sunday Service'])
  })
})

describe('getDefaultTitle（早晚场判定）', () => {
  it('周三上午 → Morning Service', () => {
    expect(getDefaultTitle(at(2026, 7, 29, 9))).toBe('7/29/2026 Morning Service')
  })
  it('周三 12:00 及之后 → Wednesday Service', () => {
    expect(getDefaultTitle(at(2026, 7, 29, 12))).toBe('7/29/2026 Wednesday Service')
    expect(getDefaultTitle(at(2026, 7, 29, 19))).toBe('7/29/2026 Wednesday Service')
  })
  it('周三 11:59 仍是早场', () => {
    expect(getDefaultTitle(new Date(2026, 6, 29, 11, 59))).toBe('7/29/2026 Morning Service')
  })
  it('周五晚 → Friday Prayer Meeting', () => {
    expect(getDefaultTitle(at(2026, 7, 31, 20))).toBe('7/31/2026 Friday Prayer Meeting')
  })
  it('单场日不受时刻影响（周日晚上仍是 Sunday Service）', () => {
    expect(getDefaultTitle(at(2026, 8, 2, 21))).toBe('8/2/2026 Sunday Service')
  })
})
