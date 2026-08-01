import { describe, expect, it } from 'vitest'
import { buildShareLink } from '../../src/main/core/shareLink'

describe('buildShareLink', () => {
  it('生成规定格式的分享链接', () => {
    expect(buildShareLink('abc123XYZ')).toBe('https://youtube.com/live/abc123XYZ?feature=share')
  })
  it('空 id 抛错', () => {
    expect(() => buildShareLink('')).toThrow()
  })
})
