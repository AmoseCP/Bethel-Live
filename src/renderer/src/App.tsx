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

  return (
    <div className="app-shell">
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
      <main className="content">
        {page === 'live' && <LivePage />}
        {page === 'settings' && <SettingsPage />}
        {page === 'about' && <AboutPage />}
      </main>
    </div>
  )
}
