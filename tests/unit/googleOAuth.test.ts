import { describe, expect, it, vi } from 'vitest'
import {
  buildAuthUrl,
  exchangeCode,
  isExpired,
  refreshAccessToken,
  YOUTUBE_SCOPE
} from '../../src/main/core/googleOAuth'

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body }) as Response

describe('buildAuthUrl', () => {
  it('包含必需参数', () => {
    const url = new URL(buildAuthUrl('cid', 'http://127.0.0.1:8080/oauth2callback', 'st4te'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:8080/oauth2callback')
    expect(url.searchParams.get('scope')).toBe(YOUTUBE_SCOPE)
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('st4te')
  })
})

describe('exchangeCode', () => {
  it('换取令牌并计算过期时刻', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })
    )
    const now = (): number => 1_000_000
    const tokens = await exchangeCode('code1', 'cid', 'sec', 'http://x', fetchFn, now)
    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAt: 1_000_000 + 3_600_000 })

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const body = new URLSearchParams(init.body)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code1')
  })

  it('缺 refresh_token 时报可读错误', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'at' }))
    await expect(exchangeCode('c', 'i', 's', 'u', fetchFn)).rejects.toThrow(/refresh token/)
  })

  it('Google 返回错误时抛错', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ error: 'invalid_grant', error_description: 'Bad code' }, false, 400)
    )
    await expect(exchangeCode('c', 'i', 's', 'u', fetchFn)).rejects.toThrow(/invalid_grant/)
  })
})

describe('refreshAccessToken', () => {
  it('刷新后保留原 refresh token', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'new', expires_in: 100 }))
    const now = (): number => 5000
    const next = await refreshAccessToken(
      { accessToken: 'old', refreshToken: 'rt', expiresAt: 0 },
      'cid',
      'sec',
      fetchFn,
      now
    )
    expect(next).toEqual({ accessToken: 'new', refreshToken: 'rt', expiresAt: 105_000 })
  })
})

describe('isExpired', () => {
  const t = { accessToken: 'a', refreshToken: 'r', expiresAt: 200_000 }
  it('提前 60 秒判定过期', () => {
    expect(isExpired(t, () => 139_000)).toBe(false)
    expect(isExpired(t, () => 140_000)).toBe(true)
    expect(isExpired(t, () => 300_000)).toBe(true)
  })
})
