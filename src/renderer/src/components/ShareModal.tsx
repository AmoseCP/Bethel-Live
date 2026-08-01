import { useState, type JSX } from 'react'

interface Props {
  initialText: string
  onClose: () => void
}

/** Telegram 分享确认弹窗：先预览消息内容，确认后才发送 */
export default function ShareModal({ initialText, onClose }: Props): JSX.Element {
  const [text, setText] = useState(initialText)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (): Promise<void> => {
    setSending(true)
    setError(null)
    try {
      await window.bethel.telegram.send(text)
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">发送到 Telegram 群组</h3>
        <p className="modal-hint">以下消息将发送到设置中配置的群组，请确认内容：</p>
        <textarea
          className="modal-preview"
          value={text}
          rows={4}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className="error-tip">⚠ {error}</p>}
        {done ? (
          <p className="saved-tip">✓ 已发送</p>
        ) : (
          <div className="actions-row" style={{ margin: '14px 0 0' }}>
            <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()}>
              {sending ? '发送中…' : '确认发送'}
            </button>
            <button className="btn" onClick={onClose} disabled={sending}>
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
