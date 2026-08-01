import type { JSX } from 'react'

export default function LivePage(): JSX.Element {
  return (
    <div className="page">
      <h2 className="page-title">直播</h2>
      <p style={{ color: 'var(--text-dim)' }}>直播控制台将在后续阶段实现（预览 / 一键开播 / 定时）。</p>
    </div>
  )
}
