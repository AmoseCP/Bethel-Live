/**
 * Google OAuth 2.0（桌面应用回环授权）纯逻辑。
 * fetch 注入以便单测；HTTP 服务器与浏览器打开由上层（youtubeService）负责。
 */

export type FetchLike = typeof fetch

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  /** access token 过期时刻（epoch ms） */
  expiresAt: number
}

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube'

export function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state
  })
  return `${AUTH_ENDPOINT}?${q}`
}

async function tokenRequest(
  params: Record<string, string>,
  fetchFn: FetchLike
): Promise<Record<string, unknown>> {
  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(`Google 令牌请求失败：${data.error ?? res.status} ${data.error_description ?? ''}`)
  }
  return data
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetchFn: FetchLike,
  now: () => number = Date.now
): Promise<OAuthTokens> {
  const data = await tokenRequest(
    {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    },
    fetchFn
  )
  if (typeof data.refresh_token !== 'string') {
    throw new Error('Google 未返回 refresh token，请在授权时勾选全部权限后重试')
  }
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token,
    expiresAt: now() + Number(data.expires_in ?? 3600) * 1000
  }
}

export async function refreshAccessToken(
  tokens: OAuthTokens,
  clientId: string,
  clientSecret: string,
  fetchFn: FetchLike,
  now: () => number = Date.now
): Promise<OAuthTokens> {
  const data = await tokenRequest(
    {
      refresh_token: tokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    },
    fetchFn
  )
  return {
    accessToken: String(data.access_token),
    refreshToken: tokens.refreshToken,
    expiresAt: now() + Number(data.expires_in ?? 3600) * 1000
  }
}

/** 提前 60 秒视为过期，避免边界请求失败 */
export function isExpired(tokens: OAuthTokens, now: () => number = Date.now): boolean {
  return now() >= tokens.expiresAt - 60_000
}
