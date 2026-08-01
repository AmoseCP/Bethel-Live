import { useEffect, useState, type JSX } from 'react'
import type { UpdateCheckResult } from '../../shared/update'
import { applyTheme } from './applyTheme'
import logoUrl from './assets/logo.png'
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
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null)

  useEffect(() => {
    window.bethel.settings.get().then((s) => applyTheme(s.theme))
    return window.bethel.onUpdateAvailable(setUpdate)
  }, [])

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
            <img src={logoUrl} alt="Bethel Live" className="logo-img" />
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
        {update && !mini && (
          <div className="update-banner">
            <span>
              🎉 新版本 v{update.latestVersion} 已发布（当前 v{update.currentVersion}）
            </span>
            <button
              className="btn btn-primary btn-banner"
              onClick={() => window.bethel.openUrl(update.url!)}
            >
              前往下载
            </button>
            <button className="btn btn-banner" onClick={() => setUpdate(null)}>
              稍后再说
            </button>
          </div>
        )}
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
