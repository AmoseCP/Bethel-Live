import { describe, expect, it, vi } from 'vitest'
import { buildShareMessage, sendTelegramMessage } from '../../src/main/core/telegram'

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body }) as Response

describe('buildShareMessage', () => {
  it('标题 + 链接', () => {
    expect(buildShareMessage('8/2/2026 Sunday Service', 'https://youtube.com/live/x?feature=share')).toBe(
      '8/2/2026 Sunday Service\nhttps://youtube.com/live/x?feature=share'
    )
  })
})

describe('sendTelegramMessage', () => {
  it('POST 到 bot API，携带 chat_id 与 text', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    await sendTelegramMessage('TOKEN123', '-100555', 'hello', fetchFn)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/botTOKEN123/sendMessage')
    expect(JSON.parse(init.body)).toEqual({ chat_id: '-100555', text: 'hello' })
  })

  it('Telegram 返回 ok=false → 抛出 description', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: false, description: 'chat not found' }, false, 400)
    )
    await expect(sendTelegramMessage('T', 'C', 'x', fetchFn)).rejects.toThrow(/chat not found/)
  })

  it('缺配置直接报设置提示，不发请求', async () => {
    const fetchFn = vi.fn()
    await expect(sendTelegramMessage('', 'C', 'x', fetchFn)).rejects.toThrow(/设置/)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
