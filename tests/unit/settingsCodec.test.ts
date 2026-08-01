import { describe, expect, it } from 'vitest'
import {
  deserializeSettings,
  SecretCodec,
  serializeSettings
} from '../../src/main/core/settingsCodec'
import { DEFAULT_SETTINGS } from '../../src/shared/settings'

// 可逆的假加密：便于断言密文确实不同于明文
const fakeCodec: SecretCodec = {
  encrypt: (p) => `X${Buffer.from(p).toString('base64')}`,
  decrypt: (c) => {
    if (!c.startsWith('X')) throw new Error('bad cipher')
    return Buffer.from(c.slice(1), 'base64').toString()
  }
}

describe('settingsCodec', () => {
  it('密钥字段落盘为密文，非密钥字段保持明文', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      googleClientSecret: 'top-secret',
      telegramBotToken: 'bot-token',
      googleClientId: 'plain-id'
    }
    const raw = serializeSettings(s, fakeCodec)
    expect(raw.googleClientSecret).toMatch(/^enc:X/)
    expect(raw.telegramBotToken).toMatch(/^enc:X/)
    expect(String(raw.googleClientSecret)).not.toContain('top-secret')
    expect(raw.googleClientId).toBe('plain-id')
  })

  it('序列化后可完整还原', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      googleClientSecret: 'top-secret',
      telegramBotToken: 'bot-token',
      defaultDescription: '自定义描述'
    }
    const restored = deserializeSettings(serializeSettings(s, fakeCodec), fakeCodec)
    expect(restored).toEqual(s)
  })

  it('空密钥不加密，保持空串', () => {
    const raw = serializeSettings(DEFAULT_SETTINGS, fakeCodec)
    expect(raw.googleClientSecret).toBe('')
  })

  it('文件损坏/非对象 → 回落默认值', () => {
    expect(deserializeSettings(null, fakeCodec)).toEqual(DEFAULT_SETTINGS)
    expect(deserializeSettings('garbage', fakeCodec)).toEqual(DEFAULT_SETTINGS)
  })

  it('密文无法解密 → 该字段回落空串，其余不受影响', () => {
    const raw = {
      ...DEFAULT_SETTINGS,
      googleClientSecret: 'enc:INVALID',
      defaultDescription: 'keep me'
    }
    const restored = deserializeSettings(raw, fakeCodec)
    expect(restored.googleClientSecret).toBe('')
    expect(restored.defaultDescription).toBe('keep me')
  })

  it('缺失字段与类型不符的字段用默认值补齐', () => {
    const restored = deserializeSettings({ defaultDescription: 123, launchAtLogin: true }, fakeCodec)
    expect(restored.defaultDescription).toBe(DEFAULT_SETTINGS.defaultDescription)
    expect(restored.launchAtLogin).toBe(true)
  })
})
