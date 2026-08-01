/**
 * YouTube 业务编排：OAuth 回环授权、令牌加密持久化、一键创建直播。
 */
import { app, safeStorage, shell } from 'electron'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  buildAuthUrl,
  exchangeCode,
  isExpired,
  OAuthTokens,
  refreshAccessToken
} from './core/googleOAuth'
import { YouTubeApi } from './core/youtubeApi'
import type { LiveSession } from '../shared/youtube'
import { buildShareLink } from './core/shareLink'
import { getSettings } from './settingsStore'

function tokensPath(): string {
  return join(app.getPath('userData'), 'google-tokens.bin')
}

let tokensCache: OAuthTokens | null = null

function loadTokens(): OAuthTokens | null {
  if (tokensCache) return tokensCache
  try {
    const raw = readFileSync(tokensPath())
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf8')
    tokensCache = JSON.parse(json) as OAuthTokens
    return tokensCache
  } catch {
    return null
  }
}

function saveTokens(tokens: OAuthTokens): void {
  tokensCache = tokens
  const json = JSON.stringify(tokens)
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8')
  mkdirSync(dirname(tokensPath()), { recursive: true })
  writeFileSync(tokensPath(), data)
}

export function isAuthorized(): boolean {
  return loadTokens() !== null
}

export function signOut(): void {
  tokensCache = null
  rmSync(tokensPath(), { force: true })
}

/** 打开系统浏览器完成 Google 授权，回环服务器接收授权码 */
export async function signIn(): Promise<void> {
  const { googleClientId, googleClientSecret } = getSettings()
  if (!googleClientId || !googleClientSecret) {
    throw new Error('请先在「设置」中填写 Google Client ID 与 Client Secret')
  }

  const state = randomBytes(16).toString('hex')

  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end()
        return
      }
      const finish = (ok: boolean, msg: string): void => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          `<html><body style="font-family:sans-serif;background:#0d1117;color:#e6edf3;display:grid;place-items:center;height:100vh"><div><h2>${ok ? '✓ 授权成功' : '✗ 授权失败'}</h2><p>${msg}</p></div></body></html>`
        )
        server.close()
      }
      try {
        if (url.searchParams.get('state') !== state) throw new Error('state 校验失败')
        const err = url.searchParams.get('error')
        if (err) throw new Error(`Google 返回错误：${err}`)
        const code = url.searchParams.get('code')
        if (!code) throw new Error('未收到授权码')

        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        const redirectUri = `http://127.0.0.1:${port}/oauth2callback`
        const tokens = await exchangeCode(code, googleClientId, googleClientSecret, redirectUri, fetch)
        saveTokens(tokens)
        finish(true, '现在可以回到 Bethel Live 了')
        resolve()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        finish(false, msg)
        reject(new Error(msg))
      }
    })

    server.on('error', reject)
    // 3 分钟无回调自动放弃
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('授权超时，请重试'))
    }, 180_000)
    server.on('close', () => clearTimeout(timer))

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const redirectUri = `http://127.0.0.1:${port}/oauth2callback`
      shell.openExternal(buildAuthUrl(googleClientId, redirectUri, state))
    })
  })
}

async function getAccessToken(): Promise<string> {
  let tokens = loadTokens()
  if (!tokens) throw new Error('尚未连接 YouTube 账号，请先授权')
  if (isExpired(tokens)) {
    const { googleClientId, googleClientSecret } = getSettings()
    tokens = await refreshAccessToken(tokens, googleClientId, googleClientSecret, fetch)
    saveTokens(tokens)
  }
  return tokens.accessToken
}

export const youtubeApi = new YouTubeApi(getAccessToken)

/** 一键创建直播：广播 + 流 + 绑定 + 分享链接 */
export async function createLive(title: string, description: string): Promise<LiveSession> {
  const result = await youtubeApi.createLive(title, description, new Date().toISOString())
  return {
    ...result,
    shareLink: buildShareLink(result.broadcast.broadcastId),
    createdAt: Date.now()
  }
}
