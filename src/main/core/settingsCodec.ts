/**
 * 设置序列化/反序列化（纯逻辑，加解密函数注入，便于单测）。
 * 密钥字段落盘前加密，读取时解密；损坏或无法解密的字段回落为空串。
 */
import { AppSettings, DEFAULT_SETTINGS, SECRET_KEYS } from '../../shared/settings'

export interface SecretCodec {
  encrypt(plain: string): string
  decrypt(cipher: string): string
}

const ENC_PREFIX = 'enc:'

export function serializeSettings(s: AppSettings, codec: SecretCodec): Record<string, unknown> {
  const out: Record<string, unknown> = { ...s }
  for (const key of SECRET_KEYS) {
    const v = s[key]
    out[key] = v ? ENC_PREFIX + codec.encrypt(v) : ''
  }
  return out
}

export function deserializeSettings(raw: unknown, codec: SecretCodec): AppSettings {
  const merged: AppSettings = { ...DEFAULT_SETTINGS }
  if (typeof raw !== 'object' || raw === null) return merged

  const source = raw as Record<string, unknown>
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    const v = source[key]
    if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[key]) {
      ;(merged as unknown as Record<string, unknown>)[key] = v
    }
  }

  for (const key of SECRET_KEYS) {
    const v = merged[key]
    if (typeof v === 'string' && v.startsWith(ENC_PREFIX)) {
      try {
        merged[key] = codec.decrypt(v.slice(ENC_PREFIX.length))
      } catch {
        merged[key] = ''
      }
    }
  }
  return merged
}
