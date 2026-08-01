/** 设置持久化：userData/settings.json，密钥字段用 safeStorage 加密 */
import { app, safeStorage } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/settings'
import { deserializeSettings, SecretCodec, serializeSettings } from './core/settingsCodec'

function codec(): SecretCodec {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypt: (p) => safeStorage.encryptString(p).toString('base64'),
      decrypt: (c) => safeStorage.decryptString(Buffer.from(c, 'base64'))
    }
  }
  // 极少数无钥匙串环境的降级（如部分 Linux CI）；base64 仅作最低限度混淆
  return {
    encrypt: (p) => Buffer.from(p, 'utf8').toString('base64'),
    decrypt: (c) => Buffer.from(c, 'base64').toString('utf8')
  }
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

let cache: AppSettings | null = null

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8'))
    cache = deserializeSettings(raw, codec())
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  cache = next
  const file = settingsPath()
  mkdirSync(dirname(file), { recursive: true })
  // 每次写入前留一份上个版本的备份，误覆盖时可手动找回
  if (existsSync(file)) copyFileSync(file, file + '.bak')
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(serializeSettings(next, codec()), null, 2), 'utf8')
  renameSync(tmp, file)
  return next
}
