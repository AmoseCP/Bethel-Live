import type { JSX } from 'react'
import { useI18n } from '../i18n'

export type LivePhase = 'idle' | 'created' | 'pushing' | 'testing' | 'live' | 'ending' | 'complete'

const MAP: Record<LivePhase, { text: string; cls: string }> = {
  idle: { text: '未开播', cls: 'badge-idle' },
  created: { text: '已创建', cls: 'badge-idle' },
  pushing: { text: '连接中', cls: 'badge-warn pulse' },
  testing: { text: '测试中', cls: 'badge-warn' },
  live: { text: '直播中', cls: 'badge-live pulse' },
  ending: { text: '正在结束', cls: 'badge-warn' },
  complete: { text: '已结束', cls: 'badge-idle' }
}

/** 直播状态灯 */
export default function StatusBadge({ phase }: { phase: LivePhase }): JSX.Element {
  const { t } = useI18n()
  const { text, cls } = MAP[phase]
  return (
    <span className={`status-badge ${cls}`}>
      <span className="badge-dot" />
      {t(text)}
    </span>
  )
}
