import { useState, type JSX } from 'react'
import LivePage from './pages/LivePage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'

type Page = 'live' | 'settings' | 'about'

const NAV: { key: Page; label: string; icon: string }[] = [
  { key: 'live', label: '直播', icon: '📡' },
  { key: 'settings', label: '设置', icon: '⚙️' },
  { key: 'about', label: '关于', icon: 'ℹ️' }
]

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('live')
  const [mini, setMini] = useState(false)

  const toggleMini = async (next: boolean): Promise<void> => {
    await window.bethel.window.setMini(next)
    setMini(next)
    if (next) setPage('live')
  }

  return (
    <div className={`app-shell ${mini ? 'mini' : ''}`}>
      {!mini && (
        <aside className="sidebar">
          <div className="sidebar-brand">
            {/* Logo 占位：正式 Logo 到位后替换 resources/logo.svg */}
            <div className="logo-placeholder">BL</div>
            <span className="brand-name">Bethel Live</span>
          </div>
          <nav>
            {NAV.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${page === item.key ? 'active' : ''}`}
                onClick={() => setPage(item.key)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
      )}
      <main className="content">
        {/* LivePage 常驻挂载：切页/迷你模式均不丢失直播会话状态 */}
        <div style={{ display: page === 'live' ? 'block' : 'none', height: '100%' }}>
          <LivePage mini={mini} onToggleMini={toggleMini} />
        </div>
        {page === 'settings' && <SettingsPage />}
        {page === 'about' && <AboutPage />}
      </main>
    </div>
  )
}
