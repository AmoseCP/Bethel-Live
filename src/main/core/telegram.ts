/** Telegram Bot 分享（纯逻辑，fetch 注入） */
import type { FetchLike } from './googleOAuth'

/** 分享消息内容：标题 + 分享链接 */
export function buildShareMessage(title: string, shareLink: string): string {
  return `${title}\n${shareLink}`
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  fetchFn: FetchLike = fetch
): Promise<void> {
  if (!botToken || !chatId) {
    throw new Error('请先在「设置」中填写 Telegram Bot Token 与群组 Chat ID')
  }
  const res = await fetchFn(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    description?: string
  }
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram 发送失败：${data.description ?? `HTTP ${res.status}`}`)
  }
}
