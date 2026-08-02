import { useState, type JSX } from 'react'
import { useI18n } from '../i18n'

interface Props {
  initialText: string
  onClose: () => void
}

/** Telegram 分享确认弹窗：先预览消息内容，确认后才发送 */
export default function ShareModal({ initialText, onClose }: Props): JSX.Element {
  const { t } = useI18n()
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
        <h3 className="modal-title">{t('发送到 Telegram 群组')}</h3>
        <p className="modal-hint">{t('以下消息将发送到设置中配置的群组，请确认内容：')}</p>
        <textarea
          className="modal-preview"
          value={text}
          rows={4}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className="error-tip">⚠ {error}</p>}
        {done ? (
          <p className="saved-tip">{t('✓ 已发送')}</p>
        ) : (
          <div className="actions-row" style={{ margin: '14px 0 0' }}>
            <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()}>
              {sending ? t('发送中…') : t('确认发送')}
            </button>
            <button className="btn" onClick={onClose} disabled={sending}>
              {t('取消')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
