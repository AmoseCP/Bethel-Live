import type { JSX } from 'react'

export default function App(): JSX.Element {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Bethel Live</h1>
        <p style={{ color: 'var(--text-dim)' }}>脚手架就绪 — 阶段 0</p>
      </div>
    </div>
  )
}
