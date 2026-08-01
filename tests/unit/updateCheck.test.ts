import { describe, expect, it, vi } from 'vitest'
import { checkForUpdate, compareVersions } from '../../src/main/core/updateCheck'

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body }) as Response

describe('compareVersions', () => {
  it('主/次/修订逐级比较', () => {
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1)
    expect(compareVersions('0.1.0', '0.1.1')).toBe(-1)
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('v1.2.0', '1.2')).toBe(0)
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1)
  })
})

describe('checkForUpdate', () => {
  it('有新版本 → update-available 并给出下载页', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ tag_name: 'v0.2.0', html_url: 'https://github.com/AmoseCP/Bethel-Live/releases/tag/v0.2.0' })
    )
    const r = await checkForUpdate('0.1.0', fetchFn)
    expect(r.status).toBe('update-available')
    expect(r.latestVersion).toBe('0.2.0')
    expect(r.url).toContain('/releases/tag/v0.2.0')
  })

  it('已是最新 → up-to-date', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ tag_name: 'v0.1.0' }))
    expect((await checkForUpdate('0.1.0', fetchFn)).status).toBe('up-to-date')
  })

  it('无发布（404）→ no-release', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, false, 404))
    expect((await checkForUpdate('0.1.0', fetchFn)).status).toBe('no-release')
  })

  it('网络错误 → error 且不抛异常', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'))
    const r = await checkForUpdate('0.1.0', fetchFn)
    expect(r.status).toBe('error')
    expect(r.message).toContain('offline')
  })
})
