import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEME_OPTIONS } from '../../src/shared/theme'
import { DEFAULT_SETTINGS } from '../../src/shared/settings'
import { deserializeSettings, serializeSettings } from '../../src/main/core/settingsCodec'

const noopCodec = { encrypt: (s: string): string => s, decrypt: (s: string): string => s }

describe('主题', () => {
  it('包含需求要求的全部选项', () => {
    const labels = THEME_OPTIONS.map((t) => t.label)
    for (const need of ['深色', '浅粉', '浅红', '浅紫', '浅蓝', '黑白']) {
      expect(labels).toContain(need)
    }
  })

  it('key 唯一且默认深色', () => {
    const keys = THEME_OPTIONS.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(DEFAULT_THEME).toBe('dark')
    expect(DEFAULT_SETTINGS.theme).toBe('dark')
  })

  it('主题随设置持久化往返', () => {
    const s = { ...DEFAULT_SETTINGS, theme: 'pink' as const }
    const restored = deserializeSettings(serializeSettings(s, noopCodec), noopCodec)
    expect(restored.theme).toBe('pink')
  })

  it('旧版本设置文件（无 theme 字段）回落默认深色', () => {
    const restored = deserializeSettings({ defaultDescription: 'x' }, noopCodec)
    expect(restored.theme).toBe('dark')
  })
})
